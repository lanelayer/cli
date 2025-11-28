use crate::http_client::make_http_post_request;
use crate::utils::{RunnerState, Service};
use log::{info, error};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

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

    /// Deliver a submission to the container
    pub async fn deliver_submission(&self, submission: &Submission) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // All submissions go to /submit endpoint
        let path = "/submit";

        // Serialize the submission to JSON
        let body = serde_json::to_vec(submission)?;
        let content_type = "application/json";

        info!(
            "Delivering submission to {}:{}{} ({} bytes)",
            self.target_host, self.target_port, path, body.len()
        );

        // Forward the submission to the container
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
        ).map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
            e.to_string().into()
        })?;

        Ok(())
    }

}

/// Webhook server that receives submissions from core-lane
pub struct WebhookServer {
    port: u32,
    connections: HashMap<u32, WebhookServerConnection>,
    pending_responses: HashMap<u32, Vec<u8>>,
    submission_sender: Option<mpsc::Sender<Submission>>, // Channel to send submissions for forwarding
}

struct WebhookServerConnection {
    buffer: Vec<u8>,
    request_complete: bool,
}

impl WebhookServerConnection {
    fn new() -> Self {
        Self {
            buffer: Vec::new(),
            request_complete: false,
        }
    }
}

impl WebhookServer {
    pub fn new(port: u32, submission_sender: Option<mpsc::Sender<Submission>>) -> Self {
        info!("Creating webhook server on port {}", port);
        Self {
            port,
            connections: HashMap::new(),
            pending_responses: HashMap::new(),
            submission_sender,
        }
    }

    /// Parse Content-Length header from HTTP request headers
    /// Returns the content length, or 0 if missing/invalid
    /// Handles case-insensitive header names and whitespace around the colon
    fn parse_content_length(&self, headers: &str) -> usize {
        // Search for Content-Length header case-insensitively
        for line in headers.lines() {
            // Handle both \r\n and \n line endings
            let line = line.trim_end_matches('\r').trim();
            if line.is_empty() {
                continue;
            }
            
            // Case-insensitive search for "Content-Length"
            if let Some(colon_pos) = line.find(':') {
                let header_name = &line[..colon_pos].trim();
                if header_name.eq_ignore_ascii_case("Content-Length") {
                    // Extract the value after the colon
                    let value = line[colon_pos + 1..].trim();
                    // Parse as usize, defaulting to 0 on error
                    return value.parse::<usize>().unwrap_or(0);
                }
            }
        }
        0
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

        // Handle POST requests to /submit endpoint
        if method == "POST" && path == "/submit" {
            // Parse the request body (JSON)
            if let Some(body_start) = request_str.find("\r\n\r\n") {
                let body_str = &request_str[body_start + 4..];
                info!("Webhook server received submission payload: {}", body_str);
                
                // Try to parse the submission
                match serde_json::from_str::<serde_json::Value>(body_str) {
                    Ok(submission_json) => {
                        info!("Webhook server parsed submission: {:?}", submission_json);
                        // The submission will be forwarded to the container by the delivery service
                        // which is called from the main loop
                    }
                    Err(e) => {
                        error!("Webhook server failed to parse submission: {}", e);
                    }
                }
                
                // Return 200 OK response
                let response = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}";
                return Some(response.as_bytes().to_vec());
            }
        }

        // Return 404 for other requests
        let response = "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\n404 Not Found";
        Some(response.as_bytes().to_vec())
    }

    pub fn extract_submission(&self, data: &[u8]) -> Option<Submission> {
        let request_str = String::from_utf8_lossy(data);
        
        // Extract the request body
        if let Some(body_start) = request_str.find("\r\n\r\n") {
            let body_str = &request_str[body_start + 4..];
            match serde_json::from_str::<Submission>(body_str) {
                Ok(submission) => {
                    info!("Webhook server extracted submission: {:?}", submission);
                    return Some(submission);
                }
                Err(e) => {
                    error!("Webhook server failed to parse submission: {}", e);
                }
            }
        }
        None
    }
}

impl Service for WebhookServer {
    fn on_connection(&mut self, port: u32) {
        info!("Webhook server received new connection on port {}", port);
        let connection = WebhookServerConnection::new();
        self.connections.insert(port, connection);
    }

    fn on_data(&mut self, port: u32, data: &[u8]) {
        info!("Webhook server received {} bytes on port {}", data.len(), port);

        if let Some(connection) = self.connections.get_mut(&port) {
            connection.buffer.extend_from_slice(data);

            // Check if we have a complete HTTP request
            if !connection.request_complete {
                let buffer_str = String::from_utf8_lossy(&connection.buffer);
                
                // Find the header end (end of headers, start of body)
                if let Some(header_end) = buffer_str.find("\r\n\r\n") {
                    // Extract values we need before calling methods on self
                    let header_block = buffer_str[..header_end].to_string();
                    let body_start = header_end + 4;
                    let buffer_len = connection.buffer.len();
                    
                    // Drop mutable borrow before calling methods on self
                    let _ = connection;
                    
                    // Parse Content-Length header
                    let content_length = self.parse_content_length(&header_block);
                    
                    // Calculate expected total request length
                    let expected_length = body_start + content_length;
                    
                    // Only mark as complete when we have the full request (headers + body)
                    if buffer_len >= expected_length {
                        // Clone buffer for processing (get immutable borrow)
                        let buffer_clone = self.connections.get(&port).unwrap().buffer.clone();
                        
                        // Mark as complete (get mutable borrow again)
                        if let Some(connection) = self.connections.get_mut(&port) {
                            connection.request_complete = true;
                        }
                        
                        // Extract submission and send it for forwarding
                        if let Some(submission) = self.extract_submission(&buffer_clone) {
                            if let Some(ref sender) = self.submission_sender {
                                if let Err(e) = sender.try_send(submission) {
                                    error!("Failed to send submission for forwarding: {}", e);
                                }
                            }
                        }

                        // Process the request
                        let response = self.handle_webhook_request(&buffer_clone);

                        if let Some(response_data) = response {
                            self.pending_responses.insert(port, response_data);
                        }
                    }
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
pub fn add_webhook_server(
    state: &mut RunnerState,
    port: u32,
    event_sender: Option<mpsc::Sender<Submission>>,
) -> mpsc::Receiver<Submission> {
    let (submission_tx, submission_rx) = mpsc::channel(100);
    // Use the provided event_sender if available, otherwise use the newly created sender
    let sender_to_use = if let Some(sender) = event_sender {
        sender
    } else {
        submission_tx
    };
    let webhook_server = WebhookServer::new(port, Some(sender_to_use));
    state.add_listener(port, Box::new(webhook_server));
    info!("Webhook server added to runner state on port {}", port);
    submission_rx
}

