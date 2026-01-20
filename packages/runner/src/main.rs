use cartesi_machine::{config::runtime::RuntimeConfig, machine::Machine};
use env_logger::{Builder, Env};
use log::{info};
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
mod health_check_handler;
mod http_client;
mod http_health_check_client;
mod http_server;
mod utils;
mod webhook_completion_handler;
mod webhook_delivery;
use crate::health_check_handler::HealthCheckHandler;
use crate::http_health_check_client::add_http_health_check_client;
use crate::http_server::add_http_server;
use crate::utils::{run_machine_loop_iteration, RunnerState};
use std::sync::Arc;
use tokio::sync::Mutex;
/// The port the guest machine is listening on.
#[derive(Debug, Clone, PartialEq)]
enum ExecutionState {
    /// Waiting for health check to complete
    WaitingForHealthCheck,
    /// Health check failed, should retry
    HealthCheckFailed,
    /// Health check succeeded, ready to submit webhook
    HealthCheckSucceeded,
    /// Execution complete
    Done,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    setup_logger();
    info!("START RUNNER");
    info!("________________________________________________________");

    let mut args_iter = env::args();
    args_iter.next(); // skip program name
    let mut from_arg: Option<String> = None;
    let mut to_arg: Option<String> = None;
    while let Some(arg) = args_iter.next() {
        match arg.as_str() {
            "--from" => {
                if let Some(val) = args_iter.next() {
                    from_arg = Some(val);
                }
            }
            "--to" => {
                if let Some(val) = args_iter.next() {
                    to_arg = Some(val);
                }
            }
            _ => {}
        }
    }

    let machine_path = from_arg.unwrap_or_else(|| "../../vc-cm-snapshot-release".to_string());
    let warmed_snapshot_path = to_arg.unwrap_or_else(|| "./warmed-vc-cm-snapshot".to_string());

    let machine = Arc::new(Mutex::new(
        Machine::load(Path::new(&machine_path), &RuntimeConfig::default()).unwrap(),
    ));

    let state = Arc::new(Mutex::new(RunnerState::new()));
    let exec_state = Arc::new(Mutex::new(ExecutionState::WaitingForHealthCheck));

    // Create a simple health check handler for the binary
    struct SimpleHealthCheckHandler {
        success: bool,
        failure: bool,
    }

    impl HealthCheckHandler for SimpleHealthCheckHandler {
        fn on_health_check_success(&mut self) {
            self.success = true;
        }

        fn on_health_check_failure(&mut self) {
            self.failure = true;
        }

        fn should_proceed(&self) -> bool {
            self.success
        }

        fn has_failed(&self) -> bool {
            self.failure
        }

        fn reset(&mut self) {
            self.success = false;
            self.failure = false;
        }
    }

    let health_check_handler: Arc<std::sync::Mutex<dyn HealthCheckHandler>> =
        Arc::new(std::sync::Mutex::new(SimpleHealthCheckHandler {
            success: false,
            failure: false,
        }));

    {
        let mut state_guard = state.lock().await;
        add_http_server(&mut state_guard);
        add_http_health_check_client(
            &mut state_guard,
            9000,
            Some(Arc::clone(&health_check_handler)),
        );
    }

    let machine_arc = Arc::clone(&machine);
    loop {
        {
            let es = exec_state.lock().await.clone();
            if es == ExecutionState::Done {
                break;
            }
        }

        if let Err(e) = run_machine_loop_iteration(machine_arc.clone(), state.clone()).await {
            eprintln!("Machine loop iteration failed: {}", e);
            break;
        }

        let current_state = exec_state.lock().await.clone();
        match current_state {
            ExecutionState::WaitingForHealthCheck => {
                {
                    let mut state_guard = state.lock().await;
                    if let Err(e) = state_guard.initiate_connection(9000, 1, 8080) {
                        info!("Failed to initiate health check connection: {}", e);
                    } else {
                        info!("Started health check on port {}", 9000);
                    }
                }

                {
                    let handler = health_check_handler.lock().unwrap();
                    if handler.should_proceed() {
                        info!("Health check succeeded! Transitioning to HealthCheckSucceeded");
                        let mut es = exec_state.lock().await;
                        *es = ExecutionState::HealthCheckSucceeded;
                        continue;
                    } else if handler.has_failed() {
                        info!("Health check failed, will retry");
                        let mut es = exec_state.lock().await;
                        *es = ExecutionState::HealthCheckFailed;
                        continue;
                    } else {
                        tokio::task::yield_now().await;
                        continue;
                    }
                }
            }
            ExecutionState::HealthCheckFailed => {
                info!("Retrying health check...");
                {
                    let mut state_guard = state.lock().await;
                    state_guard.remove_client(9000);
                }

                {
                    let mut handler = health_check_handler.lock().unwrap();
                    handler.reset();
                }

                {
                    let mut state_guard = state.lock().await;
                    add_http_health_check_client(
                        &mut state_guard,
                        9000,
                        Some(Arc::clone(&health_check_handler)),
                    );
                }

                {
                    let mut es = exec_state.lock().await;
                    *es = ExecutionState::WaitingForHealthCheck;
                }

                {
                    let mut state_guard = state.lock().await;
                    if let Err(e) = state_guard.initiate_connection(9000, 1, 8080) {
                        info!("Failed to restart health check connection: {}", e);
                    }
                }
                tokio::task::yield_now().await;
            }
            ExecutionState::HealthCheckSucceeded => {
                info!(
                    "Health check passed — cleaning up health check client before snapshot"
                );

                loop {
                    if let Err(e) = run_machine_loop_iteration(machine_arc.clone(), state.clone()).await {
                        eprintln!("Machine loop iteration failed during cleanup: {}", e);
                        break;
                    }

                    let state_guard = state.lock().await;
                    if state_guard.is_write_queue_empty() {
                        info!("Write queue is empty, ready to take snapshot");
                        break;
                    }
                    drop(state_guard);
                    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                }

                info!(
                    "Health check passed — saving warmed machine to {}",
                    warmed_snapshot_path
                );
                {
                    let mut machine_guard = machine.lock().await;
                    let snapshot_path = Path::new(&warmed_snapshot_path);
                    if snapshot_path.exists() {
                        info!(
                            "Snapshot path {} exists — removing to allow overwrite",
                            warmed_snapshot_path
                        );
                        if let Err(e) = fs::remove_dir_all(snapshot_path) {
                            eprintln!(
                                "Failed to remove existing snapshot {}: {}",
                                warmed_snapshot_path, e
                            );
                        }
                    }

                    if let Err(e) = machine_guard.store(snapshot_path) {
                        eprintln!(
                            "Failed to store warmed machine to {}: {}",
                            warmed_snapshot_path, e
                        );
                    } else {
                        info!("Warmed machine stored to {}", warmed_snapshot_path);
                        let mut es = exec_state.lock().await;
                        *es = ExecutionState::Done;
                    }
                }
                info!("Saved warmed machine.");
            }
            ExecutionState::Done => {
                break;
            }
        }
    }

    Ok(())
}

fn setup_logger() {
    let env = Env::default().filter_or("RUST_LOG", "off");
    let mut builder = Builder::from_env(env);
    builder
        .format(|buf, record| {
            writeln!(
                buf,
                "{} [{}] - {}",
                buf.timestamp(),
                record.level(),
                record.args()
            )
        })
        .init();
}
