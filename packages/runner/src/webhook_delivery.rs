use crate::http_client::HttpClient;
use crate::utils::{Client, RunnerState};
use crate::webhook_completion_handler::WebhookCompletionHandler;
use log::info;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Submission data sent from core-lane to containers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Submission {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tx_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub intent_id: Option<String>,
    pub user: String,
    pub action: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<HashMap<String, serde_json::Value>>,
    pub timestamp: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirmations: Option<u32>,
}

pub struct WebhookDeliveryService {
    http_client: HttpClient,
    retries: u32,
    max_retries: u32,
    target_host: String,
    submission_body: Vec<u8>,
    webhook_completion_handler: Option<Arc<Mutex<dyn WebhookCompletionHandler>>>,
}

impl WebhookDeliveryService {
    pub fn new(
        client_port: u32,
        max_retries: u32,
        target_host: String,
        webhook_completion_handler: Option<Arc<Mutex<dyn WebhookCompletionHandler>>>,
    ) -> Self {
        info!("Creating webhook submit client on port {}", client_port);
        Self {
            http_client: HttpClient::new(client_port),
            retries: 0,
            max_retries,
            target_host,
            submission_body: Vec::new(),
            webhook_completion_handler,
        }
    }

    pub fn start_submit(&mut self, connection_port: u32, submission: &Submission) {
        info!("Starting webhook submit on port {}", connection_port);
        self.retries = 0;
        self.submission_body = serde_json::to_vec(submission).unwrap_or_default();
        self.http_client.make_post_request(
            connection_port,
            "/submit",
            &self.target_host,
            &self.submission_body,
            "application/json",
        );
    }
}

impl Client for WebhookDeliveryService {
    fn on_connect_success(&mut self, port: u32) {
        info!(
            "Webhook submit client connection successful on port {}",
            port
        );
        self.http_client.on_connect_success(port);
    }

    fn on_connect_failed(&mut self, port: u32) {
        info!("Webhook submit client connection failed on port {}", port);
        self.http_client.on_connect_failed(port);
        if let Some(handler) = &self.webhook_completion_handler {
            if let Ok(mut handler_guard) = handler.lock() {
                handler_guard.on_webhook_failure();
            }
        }
    }

    fn on_data(&mut self, port: u32, data: &[u8]) {
        self.http_client.on_data(port, data);

        if let Some(connection) = self.http_client.get_connection(&port) {
            if connection.is_response_complete() {
                if let Some((status_code, _body)) = self
                    .http_client
                    .parse_http_response(connection.get_buffer())
                {
                    if status_code == 200 {
                        info!("Webhook submit SUCCESS");
                        if let Some(handler) = &self.webhook_completion_handler {
                            if let Ok(mut handler_guard) = handler.lock() {
                                handler_guard.on_webhook_success();
                            }
                        }
                    } else if self.retries < self.max_retries {
                        self.retries += 1;
                        info!(
                            "Webhook submit retry {}/{} after status {}",
                            self.retries, self.max_retries, status_code
                        );

                        if let Some(conn) = self.http_client.get_mut_connection(&port) {
                            conn.set_response_complete(false);
                            conn.clear_buffer();
                        }

                        self.http_client.make_post_request(
                            port,
                            "/submit",
                            &self.target_host,
                            &self.submission_body,
                            "application/json",
                        );
                    } else {
                        info!(
                            "Webhook submit failed after {} attempts (last status {})",
                            self.max_retries, status_code
                        );
                        if let Some(handler) = &self.webhook_completion_handler {
                            if let Ok(mut handler_guard) = handler.lock() {
                                handler_guard.on_webhook_failure();
                            }
                        }
                    }
                }
            }
        }
    }

    fn on_reset(&mut self, port: u32) {
        self.http_client.on_reset(port);
    }

    fn on_shutdown(&mut self, port: u32) {
        self.http_client.on_shutdown(port);
    }

    fn get_write_data(&mut self, port: u32) -> Option<Vec<u8>> {
        self.http_client.get_write_data(port)
    }

    fn should_shutdown(&mut self, port: u32) -> bool {
        if let Some(connection) = self.http_client.get_connection(&port) {
            if connection.is_response_complete() {
                if let Some((status_code, _)) = self
                    .http_client
                    .parse_http_response(connection.get_buffer())
                {
                    return status_code == 200 || self.retries >= self.max_retries;
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
        self.retries = 0;
        self.submission_body = body.clone();
        self.target_host = host.clone();
        self.http_client
            .queue_post_request(client_port, path, host, body, content_type);
    }
}

/// Helper to add the webhook submit client to runner state
pub fn add_webhook_delivery_service(
    state: &mut RunnerState,
    client_port: u32,
    max_retries: u32,
    webhook_completion_handler: Option<Arc<Mutex<dyn WebhookCompletionHandler>>>,
) {
    let client = WebhookDeliveryService::new(
        client_port,
        max_retries,
        "localhost:8080".to_string(),
        webhook_completion_handler,
    );
    state.add_client(client_port, Box::new(client));
    info!(
        "Webhook submit client added to runner state on port {}",
        client_port
    );
}
