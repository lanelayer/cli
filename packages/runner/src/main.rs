use cartesi_machine::{config::runtime::RuntimeConfig, machine::Machine};
use env_logger::Builder;
use log::{info, LevelFilter};
use std::error::Error;
use std::io::Write;
use std::path::Path;
mod http_client;
mod http_health_check_client;
mod http_server;
mod utils;
mod webhook_delivery;
use crate::http_client::{add_http_client, start_health_check};
use crate::http_health_check_client::add_http_health_check_client;
use crate::http_server::add_http_server;
use crate::utils::{run_machine_loop, RunnerState};
use crate::webhook_delivery::{add_webhook_server, WebhookDeliveryService};
use log::error;
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

    let machine = Arc::new(Mutex::new(Machine::load(
        Path::new(MACHINE_PATH),
        &RuntimeConfig::default(),
    )?));

    // Create a single shared state
    let state = Arc::new(Mutex::new(RunnerState::new()));

    // Add HTTP server, client, and webhook server to the state
    let submission_rx = {
        let mut state_guard = state.lock().await;
        add_http_server(&mut state_guard);
        add_http_health_check_client(&mut state_guard, 9000, 10); // HTTP health check client on port 9000 with 10 max retries
        let sub_rx = add_webhook_server(&mut state_guard, 9001); // Webhook server on port 9001
        
        // Add HTTP client for webhook delivery
        add_http_client(&mut state_guard, 9002); // HTTP client on port 9002 for forwarding webhooks
        
        // Start health check example
        info!("Starting health check example...");
        if let Err(e) = start_health_check(&mut state_guard, 9000, 1, 8080) {
            eprintln!("Failed to start health check: {}", e);
        }
        sub_rx
    };

    // Create webhook delivery service
    const GUEST_CID: u32 = 1;
    const CONTAINER_PORT: u32 = 8080;
    const WEBHOOK_CLIENT_PORT: u32 = 9002;
    let webhook_delivery = Arc::new(WebhookDeliveryService::new(
        Arc::clone(&state),
        WEBHOOK_CLIENT_PORT,
        GUEST_CID,
        CONTAINER_PORT,
        "localhost:8080".to_string(),
    ));

    let machine_for_loop = Arc::clone(&machine);
    let state_for_loop = Arc::clone(&state);
    let webhook_delivery_for_loop = Arc::clone(&webhook_delivery);

    let machine_loop_fut = {
        let machine = machine_for_loop.clone();
        let state = state_for_loop.clone();
        async move {
            info!("Starting machine loop with shared state...");
            match run_machine_loop(machine, state).await {
                Ok(_) => info!("Machine loop completed."),
                Err(e) => eprintln!("Machine loop failed: {}", e),
            }
        }
    };

    // Background task to forward submissions
    let webhook_forward_fut = {
        let webhook_delivery = Arc::clone(&webhook_delivery);
        let mut submission_rx = submission_rx;
        async move {
            loop {
                match submission_rx.recv().await {
                    Some(submission) => {
                        info!("Received submission, forwarding to container...");
                        if let Err(e) = webhook_delivery.deliver_submission(&submission).await {
                            error!("Failed to deliver submission: {}", e);
                        }
                    }
                    None => {
                        info!("Submission channel closed");
                        break;
                    }
                }
            }
        }
    };

    tokio::join!(machine_loop_fut, webhook_forward_fut);

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
