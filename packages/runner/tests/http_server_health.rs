use cartesi_machine::{config::runtime::RuntimeConfig, machine::Machine};
use log::info;
use runner::http_client::{start_health_check, HttpClient};
use runner::utils::Client;
use runner::http_health_check_client::add_http_health_check_client;
use runner::http_server::{add_http_server, HttpServer};
use runner::utils::{run_machine_loop, RunnerState};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::Mutex;

#[test]
fn test_health_check_endpoint() {
    let mut server = HttpServer::new(8080);
    let mut client = HttpClient::new(9000);
    client.make_request(8080, "GET", "/health", "localhost:8080");
    let request_data = client
        .get_write_data(8080)
        .expect("Should have request data");
    println!("Request data: {:?}", String::from_utf8_lossy(&request_data));
    let response = server
        .handle_http_request(&request_data)
        .expect("Should return a response");
    println!("Response: {:?}", String::from_utf8_lossy(&response));
}

#[tokio::test]
async fn test_cartesi_machine_health_check() -> Result<(), Box<dyn std::error::Error>> {
    const GUEST_PORT: u32 = 8080;

    // Path to the machine snapshot (should match your setup)
    const MACHINE_PATH: &str = "../../vc-cm-snapshot-release";

    let machine = Arc::new(Mutex::new(Machine::load(
        Path::new(MACHINE_PATH),
        &RuntimeConfig::default(),
    )?));

    let state = Arc::new(Mutex::new(RunnerState::new()));
    {
        let mut state_guard = state.lock().await;
        add_http_server(&mut state_guard);
        add_http_health_check_client(&mut state_guard, 9000, 10);
        start_health_check(&mut state_guard, 9000, 1, GUEST_PORT)?;
    }

    let machine_for_loop = Arc::clone(&machine);
    let state_for_loop = Arc::clone(&state);
    let machine_loop_fut = async move {
        info!("Starting machine loop with shared state...");
        let _ = run_machine_loop(machine_for_loop, state_for_loop).await;
    };

    // Let the loop run briefly to exercise the path, then time out
    let _ = tokio::time::timeout(std::time::Duration::from_millis(500), machine_loop_fut).await;
    println!("Machine loop completed.");
    Ok(())
}