use cartesi_machine::{config::runtime::RuntimeConfig, machine::Machine};
use env_logger::Builder;
use log::{info, LevelFilter};
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
use crate::http_client::start_health_check;
use crate::http_health_check_client::add_http_health_check_client;
use crate::http_server::add_http_server;
use crate::utils::{run_machine_loop, RunnerState};
use crate::webhook_completion_handler::WebhookCompletionHandler;
use crate::webhook_delivery::{add_webhook_delivery_service, Submission};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tokio::time;
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

    // Note: The binary still uses channels for simplicity, but the library uses trait-based handlers
    let (sender, mut receiver) = tokio::sync::mpsc::channel(2);

    // Create a simple webhook completion handler that uses a channel
    struct ChannelWebhookHandler {
        sender: tokio::sync::mpsc::Sender<bool>,
        success: bool,
    }

    impl runner::WebhookCompletionHandler for ChannelWebhookHandler {
        fn on_webhook_success(&mut self) {
            self.success = true;
            let _ = self.sender.try_send(true);
        }

        fn on_webhook_failure(&mut self) {
            let _ = self.sender.try_send(false);
        }

        fn has_succeeded(&self) -> bool {
            self.success
        }

        fn has_failed(&self) -> bool {
            !self.success
        }

        fn reset(&mut self) {
            self.success = false;
        }
    }

    let webhook_handler: Arc<std::sync::Mutex<dyn runner::WebhookCompletionHandler>> =
        Arc::new(std::sync::Mutex::new(ChannelWebhookHandler {
            sender,
            success: false,
        }));

    {
        let mut state_guard = state.lock().await;
        add_http_server(&mut state_guard);
        add_http_health_check_client(
            &mut state_guard,
            9000,
            Some(Arc::clone(&health_check_handler)),
        );
        add_webhook_delivery_service(
            &mut state_guard,
            9002,
            3,
            Some(Arc::clone(&webhook_handler)),
        );
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

    let health_check_handler_for_fut = Arc::clone(&health_check_handler);
    let health_check_and_webhook_fut = async move {
        const MAX_ATTEMPTS: u32 = 20;

        info!("Waiting for health check to succeed...");
        let mut succeeded = false;
        for attempt in 1..=MAX_ATTEMPTS {
            {
                let mut handler_guard = health_check_handler_for_fut.lock().unwrap();
                handler_guard.reset();
            }

            {
                let mut state_guard = state_for_webhook.lock().await;
                info!(
                    "Starting health check attempt {}/{}...",
                    attempt, MAX_ATTEMPTS
                );
                if let Err(e) = start_health_check(&mut state_guard, 9000, 1, 8080) {
                    info!("Failed to start health check attempt {}: {}", attempt, e);
                }
            }

            // Wait a bit for the health check to complete
            time::sleep(Duration::from_secs(5)).await;

            {
                let handler_guard = health_check_handler_for_fut.lock().unwrap();
                if handler_guard.should_proceed() {
                    info!("Health check succeeded! Proceeding with webhook submission...");
                    succeeded = true;
                    break;
                } else if handler_guard.has_failed() {
                    info!("Health check attempt {} failed", attempt);
                } else {
                    info!("Health check attempt {} still in progress", attempt);
                }
            }
        }

        if !succeeded {
            info!(
                "Health check failed after {} attempts, skipping webhook submission...",
                MAX_ATTEMPTS
            );
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
