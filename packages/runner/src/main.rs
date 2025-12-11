use cartesi_machine::{config::runtime::RuntimeConfig, machine::Machine};
use env_logger::Builder;
use log::{info, LevelFilter};
use std::io::Write;
use std::path::Path;
mod http_client;
mod http_health_check_client;
mod http_server;
mod utils;
mod webhook_delivery;
use crate::http_client::start_health_check;
use crate::http_health_check_client::add_http_health_check_client;
use crate::http_server::add_http_server;
use crate::utils::{run_machine_loop, RunnerState};
use crate::webhook_delivery::{add_webhook_delivery_service, Submission};
use serde_json;
use std::sync::Arc;
use tokio::sync::Mutex;
/// The path to the machine snapshot.
const MACHINE_PATH: &str = "../../vc-cm-snapshot-release";
/// The port the guest machine is listening on.

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    setup_logger();
    info!("START RUNNER");
    info!("________________________________________________________");

    let machine = Arc::new(Mutex::new(
        Machine::load(Path::new(MACHINE_PATH), &RuntimeConfig::default()).unwrap(),
    ));

    let state = Arc::new(Mutex::new(RunnerState::new()));

    let (mut health_rx, mut submit_done_rx) = {
        let mut state_guard = state.lock().await;
        add_http_server(&mut state_guard);
        let health_rx = add_http_health_check_client(&mut state_guard, 9000, 10);
        let submit_done_rx = add_webhook_delivery_service(&mut state_guard, 9002, 3);
        (health_rx, submit_done_rx)
    };

    {
        let mut state_guard = state.lock().await;
        info!("Starting health check...");
        if let Err(e) = start_health_check(&mut state_guard, 9000, 1, 8080) {
            eprintln!("Failed to start health check: {}", e);
            return Ok(());
        }
    }

    let machine_for_loop = Arc::clone(&machine);
    let state_for_loop = Arc::clone(&state);
    let state_for_webhook = Arc::clone(&state);

    let machine_loop_fut = async move {
        info!("Starting machine loop in background...");
        match run_machine_loop(machine_for_loop, state_for_loop).await {
            Ok(_) => info!("Machine loop completed."),
            Err(e) => eprintln!("Machine loop failed: {}", e),
        }
    };

    let health_check_and_webhook_fut = async move {
        info!("Waiting for health check to succeed...");
        let health_check_result = health_rx.recv().await;
        if let Some(true) = health_check_result {
            info!("Health check succeeded! Proceeding with webhook submission...");
        } else {
            info!("Health check failed, skipping webhook submission...");
            return;
        }

        let submission = Submission {
            tx_hash: None,
            intent_id: None,
            user: "demo-user".to_string(),
            action: "demo-action".to_string(),
            params: None,
            timestamp: "now".to_string(),
            block_height: None,
            confirmations: None,
        };

        let body = match serde_json::to_vec(&submission) {
            Ok(b) => b,
            Err(e) => {
                eprintln!("Failed to serialize submission: {}", e);
                return;
            }
        };

        {
            let mut state_guard = state_for_webhook.lock().await;
            info!("Queueing webhook submission...");
            if let Some(client) = state_guard.get_client(9002) {
                info!("Client found on port 9002");
                client.queue_post_request(
                    9002,
                    "/submit".to_string(),
                    "localhost:8080".to_string(),
                    body,
                    "application/json".to_string(),
                );
                info!("Queued webhook submission");
                if let Err(e) = state_guard.initiate_connection(9002, 1, 8080) {
                    info!("Failed to initiate webhook connection: {}", e);
                    eprintln!("Failed to initiate webhook connection: {}", e);
                    return;
                } else {
                    info!("Initiated webhook connection");
                }
            } else {
                info!("Webhook delivery client not found on port 9002");
                return;
            }
        }

        info!("Waiting for webhook submission response...");
        if let Some(done) = submit_done_rx.recv().await {
            info!("Webhook submission completed: {}", done);
        }

        info!("All operations completed successfully");
    };

    tokio::select! {
        _ = machine_loop_fut => {
            info!("Machine loop completed (unexpected)");
        }
        _ = health_check_and_webhook_fut => {
            info!("Health check and webhook flow completed, machine loop was running in background");
        }
    };

    Ok(())
}

fn setup_logger() {
    let mut builder = Builder::new();
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
        .filter(None, LevelFilter::Info)
        .init();
}
