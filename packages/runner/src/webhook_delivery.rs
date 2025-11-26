use crate::http_client::make_http_post_request;
use crate::utils::RunnerState;
use log::{info, error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

/// Webhook event types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event")]
pub enum WebhookEvent {
    #[serde(rename = "payment.received")]
    PaymentReceived {
        timestamp: String,
        data: PaymentReceivedData,
    },
    #[serde(rename = "transaction.confirmed")]
    TransactionConfirmed {
        timestamp: String,
        data: TransactionConfirmedData,
    },
    #[serde(rename = "intent.submitted")]
    IntentSubmitted {
        timestamp: String,
        data: IntentSubmittedData,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymentReceivedData {
    pub tx_hash: String,
    pub amount: u64,
    pub sender: String,
    pub confirmations: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub block_height: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionConfirmedData {
    pub tx_hash: String,
    pub block_height: u64,
    pub confirmations: u32,
    pub block_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentSubmittedData {
    pub intent_id: String,
    pub user: String,
    pub action: String,
    pub params: HashMap<String, serde_json::Value>,
}

/// Webhook delivery service that forwards webhooks to containers
pub struct WebhookDeliveryService {
    state: Arc<Mutex<RunnerState>>,
    client_port: u32,
    target_cid: u32,
    target_port: u32,
    target_host: String,
}

impl WebhookDeliveryService {
    pub fn new(
        state: Arc<Mutex<RunnerState>>,
        client_port: u32,
        target_cid: u32,
        target_port: u32,
        target_host: String,
    ) -> Self {
        Self {
            state,
            client_port,
            target_cid,
            target_port,
            target_host,
        }
    }

    /// Deliver a webhook event to the container
    pub async fn deliver_webhook(&self, event: &WebhookEvent) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Determine the webhook path based on event type
        let path = match event {
            WebhookEvent::PaymentReceived { .. } => "/webhook/payment",
            WebhookEvent::TransactionConfirmed { .. } => "/webhook/confirmation",
            WebhookEvent::IntentSubmitted { .. } => "/webhook/intent",
        };

        // Serialize the event to JSON
        let body = serde_json::to_vec(event)?;
        let content_type = "application/json";

        info!(
            "Delivering webhook to {}:{}{} ({} bytes)",
            self.target_host, self.target_port, path, body.len()
        );

        // Forward the webhook to the container
        let mut state = self.state.lock().await;
        make_http_post_request(
            &mut state,
            self.client_port,
            self.target_cid,
            self.target_port,
            path,
            &self.target_host,
            &body,
            content_type,
        )?;

        Ok(())
    }
}

/// Webhook server that receives webhooks from core-lane
pub struct WebhookServer {
    port: u32,
    connections: HashMap<u32, WebhookServerConnection>,
    pending_responses: HashMap<u32, Vec<u8>>,
    event_sender: Option<mpsc::Sender<WebhookEvent>>, // Channel to send events for forwarding
}

struct WebhookServerConnection {
    port: u32,
    buffer: Vec<u8>,
    request_complete: bool,
}

impl WebhookServerConnection {
    fn new(port: u32) -> Self {
        Self {
            port,
            buffer: Vec::new(),
            request_complete: false,
        }
    }
}

impl WebhookServer {
    pub fn new(port: u32, event_sender: Option<mpsc::Sender<WebhookEvent>>) -> Self {
        info!("Creating webhook server on port {}", port);
        Self {
            port,
            connections: HashMap::new(),
            pending_responses: HashMap::new(),
            event_sender,
        }
    }

    pub fn handle_webhook_request(&mut self, data: &[u8]) -> Option<Vec<u8>> {
        let request_str = String::from_utf8_lossy(data);
        let lines: Vec<&str> = request_str.lines().collect();

        if lines.is_empty() {
            return None;
        }

        let first_line = lines[0];
        let parts: Vec<&str> = first_line.split_whitespace().collect();

        if parts.len() < 2 {
            return None;
        }

        let method = parts[0];
        let path = parts[1];

        info!("Webhook server received {} {}", method, path);

        // Only handle POST requests to /webhook endpoint
        if method == "POST" && path.starts_with("/webhook") {
            // Parse the request body (JSON)
            if let Some(body_start) = request_str.find("\r\n\r\n") {
                let body_str = &request_str[body_start + 4..];
                info!("Webhook server received webhook payload: {}", body_str);
                
                // Try to parse the webhook event
                match serde_json::from_str::<serde_json::Value>(body_str) {
                    Ok(event_json) => {
                        info!("Webhook server parsed event: {:?}", event_json);
                        // The event will be forwarded to the container by the delivery service
                        // which is called from the main loop
                    }
                    Err(e) => {
                        error!("Webhook server failed to parse event: {}", e);
                    }
                }
                
                // Return 200 OK response
                let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 17\r\n\r\n{\"status\":\"ok\"}";
                return Some(response.as_bytes().to_vec());
            }
        }

        // Return 404 for other requests
        let response = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\n404 Not Found";
        Some(response.as_bytes().to_vec())
    }

    pub fn extract_webhook_event(&self, data: &[u8]) -> Option<WebhookEvent> {
        let request_str = String::from_utf8_lossy(data);
        
        // Extract the request body
        if let Some(body_start) = request_str.find("\r\n\r\n") {
            let body_str = &request_str[body_start + 4..];
            match serde_json::from_str::<WebhookEvent>(body_str) {
                Ok(event) => {
                    info!("Webhook server extracted event: {:?}", event);
                    return Some(event);
                }
                Err(e) => {
                    error!("Webhook server failed to parse event: {}", e);
                }
            }
        }
        None
    }
}

impl crate::utils::Service for WebhookServer {
    fn on_connection(&mut self, port: u32) {
        info!("Webhook server received new connection on port {}", port);
        let connection = WebhookServerConnection::new(port);
        self.connections.insert(port, connection);
    }

    fn on_data(&mut self, port: u32, data: &[u8]) {
        info!("Webhook server received {} bytes on port {}", data.len(), port);

        if let Some(connection) = self.connections.get_mut(&port) {
            connection.buffer.extend_from_slice(data);

            // Check if we have a complete HTTP request
            let buffer_str = String::from_utf8_lossy(&connection.buffer);
            if buffer_str.contains("\r\n\r\n") && !connection.request_complete {
                connection.request_complete = true;

                // Extract webhook event if present and send it for forwarding
                if let Some(event) = self.extract_webhook_event(&connection.buffer) {
                    if let Some(ref sender) = self.event_sender {
                        if let Err(e) = sender.try_send(event) {
                            error!("Failed to send webhook event for forwarding: {}", e);
                        }
                    }
                }

                // Process the request
                let response = self.handle_webhook_request(&connection.buffer);

                if let Some(response_data) = response {
                    self.pending_responses.insert(port, response_data);
                }
            }
        }
    }

    fn on_reset(&mut self, port: u32) {
        info!("Webhook server connection reset on port {}", port);
        self.connections.remove(&port);
        self.pending_responses.remove(&port);
    }

    fn on_shutdown(&mut self, port: u32) {
        info!("Webhook server connection shutdown on port {}", port);
        self.connections.remove(&port);
        self.pending_responses.remove(&port);
    }

    fn get_write_data(&mut self, port: u32) -> Option<Vec<u8>> {
        if let Some(response) = self.pending_responses.remove(&port) {
            info!(
                "Webhook server sending {} bytes on port {}",
                response.len(),
                port
            );
            return Some(response);
        }
        None
    }

    fn should_shutdown(&mut self, port: u32) -> bool {
        // Keep connections open for now
        false
    }
}

/// Helper function to create and add a webhook server to the runner state
pub fn add_webhook_server(state: &mut RunnerState, port: u32, event_sender: Option<mpsc::Sender<WebhookEvent>>) -> mpsc::Receiver<WebhookEvent> {
    let (tx, rx) = mpsc::channel(100);
    let webhook_server = WebhookServer::new(port, Some(tx));
    state.add_listener(port, Box::new(webhook_server));
    info!("Webhook server added to runner state on port {}", port);
    rx
}

