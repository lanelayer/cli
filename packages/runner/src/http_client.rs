use crate::utils::{Client, RunnerState};
use log::info;
use std::collections::HashMap;

/// Pending POST request metadata
struct PendingPostRequest {
    path: String,
    host: String,
    body: Vec<u8>,
    content_type: String,
}

/// Simple HTTP client that implements the Client trait
pub struct HttpClient {
    port: u32,
    connections: HashMap<u32, HttpClientConnection>,
    pending_requests: HashMap<u32, Vec<u8>>,
    pending_post_requests: HashMap<u32, PendingPostRequest>, // Keyed by client port
    client_port_to_connection: HashMap<u32, u32>, // Maps client port to connection port
    responses: HashMap<u32, Vec<u8>>,
}

impl HttpClient {
    pub fn get_connection(&self, port: &u32) -> Option<&HttpClientConnection> {
        self.connections.get(port)
    }

    pub fn get_mut_connection(&mut self, port: &u32) -> Option<&mut HttpClientConnection> {
        self.connections.get_mut(port)
    }
}

pub struct HttpClientConnection {
    port: u32,
    buffer: Vec<u8>,
    response_complete: bool,
}

impl HttpClientConnection {
    fn new(port: u32) -> Self {
        Self {
            port,
            buffer: Vec::new(),
            response_complete: false,
        }
    }
    pub fn is_response_complete(&self) -> bool {
        self.response_complete
    }

    pub fn set_response_complete(&mut self, response_complete: bool) {
        self.response_complete = response_complete;
    }

    pub fn get_buffer(&self) -> &[u8] {
        &self.buffer
    }
    pub fn clear_buffer(&mut self) {
        self.buffer.clear();
    }
}

impl HttpClient {
    pub fn new(port: u32) -> Self {
        info!("Creating HTTP client on port {}", port);
        Self {
            port,
            connections: HashMap::new(),
            pending_requests: HashMap::new(),
            pending_post_requests: HashMap::new(),
            client_port_to_connection: HashMap::new(),
            responses: HashMap::new(),
        }
    }

    fn create_http_request(&self, method: &str, path: &str, host: &str, body: Option<&[u8]>, content_type: Option<&str>) -> Vec<u8> {
        let mut headers = format!(
            "{} {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n",
            method, path, host
        );
        
        if let Some(body_data) = body {
            let body_len = body_data.len();
            headers.push_str(&format!("Content-Length: {}\r\n", body_len));
            if let Some(ct) = content_type {
                headers.push_str(&format!("Content-Type: {}\r\n", ct));
            }
        }
        
        headers.push_str("\r\n");
        let mut request = headers.into_bytes();
        
        if let Some(body_data) = body {
            request.extend_from_slice(body_data);
        }
        
        request
    }

    pub fn make_request(&mut self, connection_port: u32, method: &str, path: &str, host: &str) {
        let request = self.create_http_request(method, path, host, None, None);
        self.pending_requests.insert(connection_port, request);
        info!("HTTP client queued {} {} request to {}", method, path, host);
    }

    pub fn make_post_request(&mut self, connection_port: u32, path: &str, host: &str, body: &[u8], content_type: &str) {
        let request = self.create_http_request("POST", path, host, Some(body), Some(content_type));
        self.pending_requests.insert(connection_port, request);
        info!("HTTP client queued POST {} request to {} with {} bytes", path, host, body.len());
    }

    fn queue_post_request_impl(&mut self, client_port: u32, path: String, host: String, body: Vec<u8>, content_type: String) {
        self.pending_post_requests.insert(client_port, PendingPostRequest {
            path,
            host,
            body,
            content_type,
        });
        info!("HTTP client queued POST request for client port {}", client_port);
    }

    pub fn queue_post_request(&mut self, client_port: u32, path: String, host: String, body: Vec<u8>, content_type: String) {
        self.queue_post_request_impl(client_port, path, host, body, content_type);
    }

    pub fn parse_http_response(&self, response: &[u8]) -> Option<(u16, String)> {
        let response_str = String::from_utf8_lossy(response);
        let lines: Vec<&str> = response_str.lines().collect();

        if lines.is_empty() {
            return None;
        }

        let status_line = lines[0];
        let parts: Vec<&str> = status_line.split_whitespace().collect();

        if parts.len() < 3 {
            return None;
        }

        let status_code = parts[1].parse::<u16>().ok()?;
        let body = response_str
            .split("\r\n\r\n")
            .nth(1)
            .unwrap_or("")
            .to_string();

        Some((status_code, body))
    }
}

impl Client for HttpClient {
    fn on_connect_success(&mut self, port: u32) {
        info!("HTTP client connection successful on port {}", port);
        let connection = HttpClientConnection::new(port);
        self.connections.insert(port, connection);
        
        // Check if there's a pending POST request for this client port
        if let Some(post_req) = self.pending_post_requests.remove(&self.port) {
            self.client_port_to_connection.insert(self.port, port);
            let request = self.create_http_request("POST", &post_req.path, &post_req.host, Some(&post_req.body), Some(&post_req.content_type));
            self.pending_requests.insert(port, request);
            info!("HTTP client constructed POST request for connection port {}", port);
        }
    }

    fn queue_post_request(&mut self, client_port: u32, path: String, host: String, body: Vec<u8>, content_type: String) {
        // Delegate to the implementation to avoid code duplication
        self.queue_post_request_impl(client_port, path, host, body, content_type);
    }

    fn on_connect_failed(&mut self, port: u32) {
        info!("HTTP client connection failed on port {}", port);
        self.pending_requests.remove(&port);
    }

    fn on_data(&mut self, port: u32, data: &[u8]) {
        info!("HTTP client received {} bytes on port {}", data.len(), port);

        if let Some(connection) = self.connections.get_mut(&port) {
            connection.buffer.extend_from_slice(data);

            // Check if we have a complete HTTP response
            let buffer_str = String::from_utf8_lossy(&connection.buffer);
            if buffer_str.contains("\r\n\r\n") && !connection.response_complete {
                connection.response_complete = true;

                // Store the response
                self.responses.insert(port, connection.buffer.clone());
                info!("HTTP client received complete response on port {}", port);

                // Parse and log the response - clone buffer to avoid borrowing issues
                let buffer_clone = connection.buffer.clone();
                if let Some((status_code, body)) = self.parse_http_response(&buffer_clone) {
                    info!("HTTP client received status {}: {}", status_code, body);
                }
            }
        }
    }

    fn on_reset(&mut self, port: u32) {
        info!("HTTP client connection reset on port {}", port);
        self.connections.remove(&port);
        self.pending_requests.remove(&port);
        self.responses.remove(&port);
    }

    fn on_shutdown(&mut self, port: u32) {
        info!("HTTP client connection shutdown on port {}", port);
        self.connections.remove(&port);
        self.pending_requests.remove(&port);
        self.responses.remove(&port);
    }

    fn get_write_data(&mut self, port: u32) -> Option<Vec<u8>> {
        if let Some(request) = self.pending_requests.remove(&port) {
            info!(
                "HTTP client sending {} bytes on port {}",
                request.len(),
                port
            );
            return Some(request);
        }
        None
    }

    fn should_shutdown(&mut self, port: u32) -> bool {
        // Shutdown after sending request and receiving response
        if let Some(connection) = self.connections.get(&port) {
            connection.response_complete
        } else {
            false
        }
    }

}

/// Helper function to create and add an HTTP client to the runner state
pub fn add_http_client(state: &mut RunnerState, client_port: u32) {
    let http_client = HttpClient::new(client_port);
    state.add_client(client_port, Box::new(http_client));
    info!("HTTP client added to runner state on port {}", client_port);
}

/// Helper function to make an HTTP request
pub fn make_http_request(
    state: &mut RunnerState,
    client_port: u32,
    target_cid: u32,
    target_port: u32,
    method: &str,
    path: &str,
    host: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Initiate the connection
    state.initiate_connection(client_port, target_cid, target_port)?;

    // Queue the request for when connection is established
    info!(
        "HTTP request {} {} to {}:{} queued",
        method, path, target_cid, target_port
    );

    Ok(())
}

/// Helper function to start a health check
pub fn start_health_check(
    state: &mut RunnerState,
    client_port: u32,
    target_cid: u32,
    target_port: u32,
) -> Result<(), Box<dyn std::error::Error>> {
    info!(
        "Starting health check from client {} to {}:{}",
        client_port, target_cid, target_port
    );

    // Initiate the connection
    state.initiate_connection(client_port, target_cid, target_port)?;

    Ok(())
}

/// Helper function to make an HTTP POST request
pub fn make_http_post_request(
    state: &mut RunnerState,
    client_port: u32,
    target_cid: u32,
    target_port: u32,
    path: &str,
    host: &str,
    body: &[u8],
    content_type: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // Queue the POST request metadata in the client
    let client = state.get_client(client_port).ok_or_else(|| {
        let error_msg = format!("No HTTP client found for port {}", client_port);
        error!("{}", error_msg);
        Box::<dyn std::error::Error>::from(error_msg)
    })?;
    
    client.queue_post_request(
        client_port,
        path.to_string(),
        host.to_string(),
        body.to_vec(),
        content_type.to_string(),
    );
    info!(
        "HTTP POST request {} to {}:{} queued",
        path, target_cid, target_port
    );

    // Initiate the connection
    state.initiate_connection(client_port, target_cid, target_port)?;
    
    Ok(())
}
