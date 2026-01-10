use crate::health_check_handler::HealthCheckHandler;
use crate::http_client::HttpClient;
use crate::utils::{Client, RunnerState};
use log::info;
use std::sync::Arc;
use std::sync::Mutex;

/// HTTP Health Check Client that implements the Client trait
pub struct HttpHealthCheckClient {
    http_client: HttpClient,
    target_host: String,
    health_check_handler: Option<Arc<Mutex<dyn HealthCheckHandler>>>,
    success: bool,
}

impl HttpHealthCheckClient {
    pub fn new(
        port: u32,
        target_host: String,
        health_check_handler: Option<Arc<Mutex<dyn HealthCheckHandler>>>,
    ) -> Self {
        info!("Creating HTTP health check client on port {}", port);
        Self {
            http_client: HttpClient::new(port),
            target_host,
            health_check_handler,
            success: false,
        }
    }

    pub fn start_health_check(&mut self, connection_port: u32) {
        info!("Starting health check on port {}", connection_port);
        self.http_client
            .make_request(connection_port, "GET", "/health", &self.target_host);
    }
}

impl Client for HttpHealthCheckClient {
    fn on_connect_success(&mut self, port: u32) {
        info!(
            "HTTP health check client connection successful on port {}",
            port
        );
        // Delegate to the underlying HTTP client
        self.http_client.on_connect_success(port);

        // Start health check automatically
        self.start_health_check(port);
    }

    fn on_connect_failed(&mut self, port: u32) {
        info!(
            "HTTP health check client connection failed on port {}",
            port
        );
        self.http_client.on_connect_failed(port);
        if let Some(handler) = &self.health_check_handler {
            handler.lock().unwrap().on_health_check_failure();
        }
    }

    fn on_data(&mut self, port: u32, data: &[u8]) {
        println!(
            "HTTP health check client received {} bytes on port {}",
            data.len(),
            port
        );

        // Delegate to the underlying HTTP client first
        self.http_client.on_data(port, data);

        // Check if we have a complete response and handle health check logic
        if let Some(connection) = self.http_client.get_connection(&port) {
            if connection.is_response_complete() {
                if let Some((status_code, body)) = self
                    .http_client
                    .parse_http_response(connection.get_buffer())
                {
                    println!(
                        "Health check client received status {}: {}",
                        status_code, body
                    );

                    if status_code == 200 {
                        info!("Health check SUCCESS! Server is healthy.");
                        self.success = true;
                        if let Some(handler) = &self.health_check_handler {
                            handler.lock().unwrap().on_health_check_success();
                        }
                    } else {
                        if let Some(handler) = &self.health_check_handler {
                            handler.lock().unwrap().on_health_check_failure();
                        }
                    }
                }
            }
        }
    }

    fn on_reset(&mut self, port: u32) {
        info!("HTTP health check client connection reset on port {}", port);
        self.http_client.on_reset(port);
        if let Some(handler) = &self.health_check_handler {
            handler.lock().unwrap().on_health_check_failure();
        }
    }

    fn on_shutdown(&mut self, port: u32) {
        info!(
            "HTTP health check client connection shutdown on port {}",
            port
        );
        self.http_client.on_shutdown(port);
        if !self.success {
            if let Some(handler) = &self.health_check_handler {
                handler.lock().unwrap().on_health_check_failure();
            }
        }
    }

    fn get_write_data(&mut self, port: u32) -> Option<Vec<u8>> {
        self.http_client.get_write_data(port)
    }

    fn should_shutdown(&mut self, port: u32) -> bool {
        // Shutdown after receiving successful response or max retries
        if let Some(connection) = self.http_client.get_connection(&port) {
            if connection.is_response_complete() {
                if let Some((status_code, _)) = self
                    .http_client
                    .parse_http_response(connection.get_buffer())
                {
                    return status_code == 200;
                }
            }
        }
        false
    }

    fn queue_post_request(
        &mut self,
        client_port: u32,
        path: String,
        host: String,
        body: Vec<u8>,
        content_type: String,
    ) {
        // Delegate to underlying HTTP client
        self.http_client
            .queue_post_request(client_port, path, host, body, content_type);
    }
}

/// Helper function to create and add an HTTP health check client to the runner state
pub fn add_http_health_check_client(
    state: &mut RunnerState,
    client_port: u32,
    health_check_handler: Option<Arc<Mutex<dyn HealthCheckHandler>>>,
) {
    let health_check_client = HttpHealthCheckClient::new(
        client_port,
        "localhost:8080".to_string(),
        health_check_handler,
    );
    state.add_client(client_port, Box::new(health_check_client));
    info!(
        "HTTP health check client added to runner state on port {}",
        client_port
    );
}
