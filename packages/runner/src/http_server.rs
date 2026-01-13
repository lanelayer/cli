use crate::utils::{RunnerState, Service};
use log::{error, info, warn};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;

pub trait KvStore: Send + Sync {
    fn get_kv(&self, key: &str) -> Option<Vec<u8>>;
    fn insert_kv(&mut self, key: String, value: Vec<u8>);
    fn remove_kv(&mut self, key: &str) -> Option<Vec<u8>>;
}

/// Simple HTTP server that implements the Service trait
pub struct HttpServer {
    port: u32,
    connections: HashMap<u32, HttpConnection>,
    kv_store: Option<Arc<std::sync::Mutex<dyn KvStore>>>,
}

struct HttpConnection {
    port: u32,
    buffer: Vec<u8>,
    pending_responses: std::collections::VecDeque<Vec<u8>>,
}

impl HttpConnection {
    fn new(port: u32) -> Self {
        Self {
            port,
            buffer: Vec::new(),
            pending_responses: std::collections::VecDeque::new(),
        }
    }
}

impl HttpServer {
    pub fn new(port: u32) -> Self {
        info!("Creating HTTP server on port {}", port);
        Self {
            port,
            connections: HashMap::new(),
            kv_store: None,
        }
    }

    pub fn with_kv_store(port: u32, kv_store: Arc<std::sync::Mutex<dyn KvStore>>) -> Self {
        info!("Creating HTTP server on port {} with KV store", port);
        Self {
            port,
            connections: HashMap::new(),
            kv_store: Some(kv_store),
        }
    }

    /// Parse Content-Length header from HTTP request
    fn parse_content_length(header_lines: &[&str]) -> Option<usize> {
        for line in header_lines {
            if line.to_lowercase().starts_with("content-length:") {
                if let Some(len_str) = line.split(':').nth(1) {
                    if let Ok(len) = len_str.trim().parse::<usize>() {
                        return Some(len);
                    }
                }
            }
        }
        None
    }

    /// Extract a complete HTTP request from the buffer
    fn extract_request(buffer: &[u8]) -> Option<(Vec<u8>, usize)> {
        let buffer_str = match std::str::from_utf8(buffer) {
            Ok(s) => s,
            Err(_) => return None,
        };

        // Find the header/body separator
        let header_end = buffer_str.find("\r\n\r\n")?;
        let header = &buffer[..header_end + 4];
        let header_str = &buffer_str[..header_end];
        let header_lines: Vec<&str> = header_str.lines().collect();

        // Check if there's a Content-Length header
        let content_length = Self::parse_content_length(&header_lines);
        let header_size = header_end + 4;
        
        if let Some(body_len) = content_length {
            // Need to read the body
            let total_size = header_size + body_len;
            if buffer.len() >= total_size {
                let request = buffer[..total_size].to_vec();
                return Some((request, total_size));
            }
            // Not enough data yet
            return None;
        } else {
            // No body, just headers
            return Some((header.to_vec(), header_size));
        }
    }

    pub fn handle_http_request(&mut self, data: &[u8]) -> Option<Vec<u8>> {
        // Simple HTTP request parsing
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

        info!("HTTP {} {}", method, path);

        if path.starts_with("/kv/") {
            if self.kv_store.is_some() {
                info!("Routing KV request {} {} to KV store", method, path);
                return self.handle_kv_request(method, path, &request_str);
            }
        }

        let response = match (method, path) {
            ("GET", "/") => {
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: 25\r\n\r\n<h1>Hello World!</h1>"
            }
            ("GET", "/health") => {
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}"
            }
            _ => {
                "HTTP/1.1 404 Not Found\r\nContent-Type: text/plain\r\nContent-Length: 13\r\n\r\n404 Not Found"
            }
        };

        Some(response.as_bytes().to_vec())
    }

    fn handle_kv_request(
        &mut self,
        method: &str,
        path: &str,
        request_str: &str,
    ) -> Option<Vec<u8>> {
        let key = path.strip_prefix("/kv/")?;

        match method {
            "GET" => {
                info!("KV GET request received for key: '{}'", key);
                if let Some(kv_store) = &self.kv_store {
                    match kv_store.lock() {
                        Ok(store) => {
                            if let Some(value) = store.get_kv(key) {
                                info!(
                                    "KV GET found key='{}' (value size: {} bytes)",
                                    key,
                                    value.len()
                                );
                                let response = format!(
                                    "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\n\r\n",
                                    value.len()
                                );
                                let mut response_bytes = response.into_bytes();
                                response_bytes.extend_from_slice(&value);
                                return Some(response_bytes);
                            }
                        }
                        Err(e) => {
                            error!("KV GET failed for key: '{}' - lock error: {}", key, e);
                            return Some(
                                self.build_error_response(500, &format!("Lock error: {}", e)),
                            );
                        }
                    }
                }
                info!("KV GET failed: key '{}' not found", key);
                Some(self.build_error_response(404, "Key not found"))
            }
            "POST" => {
                let body = request_str.split("\r\n\r\n").nth(1).unwrap_or("");
                let value = body.as_bytes().to_vec();

                info!(
                    "KV POST request received for key: '{}' (value size: {} bytes)",
                    key,
                    value.len()
                );
                if value.len() <= 100 {
                    info!(
                        "KV POST request body: {:?}",
                        String::from_utf8_lossy(&value)
                    );
                } else {
                    info!(
                        "KV POST request body (first 100 bytes): {:?}...",
                        String::from_utf8_lossy(&value[..100])
                    );
                }

                if let Some(kv_store) = &self.kv_store {
                    match kv_store.lock() {
                        Ok(mut store) => {
                            store.insert_kv(key.to_string(), value.clone());
                            info!(
                                "KV POST successful for key: '{}' (value size: {} bytes)",
                                key,
                                value.len()
                            );
                            Some("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}".as_bytes().to_vec())
                        }
                        Err(e) => {
                            error!("KV POST failed for key: '{}' - lock error: {}", key, e);
                            Some(self.build_error_response(500, &format!("Lock error: {}", e)))
                        }
                    }
                } else {
                    error!("KV POST failed for key: '{}' - no KV store", key);
                    Some(self.build_error_response(500, "No KV store available"))
                }
            }
            "DELETE" => {
                info!("KV DELETE request received for key: '{}'", key);
                if let Some(kv_store) = &self.kv_store {
                    match kv_store.lock() {
                        Ok(mut store) => {
                            store.remove_kv(key);
                            info!("KV DELETE successful for key: '{}'", key);
                            Some("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 15\r\n\r\n{\"status\":\"ok\"}".as_bytes().to_vec())
                        }
                        Err(e) => {
                            error!("KV DELETE failed for key: '{}' - lock error: {}", key, e);
                            Some(self.build_error_response(500, &format!("Lock error: {}", e)))
                        }
                    }
                } else {
                    error!("KV DELETE failed for key: '{}' - no KV store", key);
                    Some(self.build_error_response(500, "No KV store available"))
                }
            }
            _ => {
                warn!(
                    "KV request with unsupported method: {} for key: {}",
                    method, key
                );
                Some(self.build_error_response(405, "Method Not Allowed"))
            }
        }
    }

    fn build_error_response(&self, status_code: u16, message: &str) -> Vec<u8> {
        format!(
            "HTTP/1.1 {} {}\r\nContent-Type: text/plain\r\nContent-Length: {}\r\n\r\n{}",
            status_code,
            "Internal Server Error",
            message.len(),
            message
        )
        .into_bytes()
    }
}

impl Service for HttpServer {
    fn on_connection(&mut self, port: u32) {
        info!("HTTP server received new connection on port {}", port);
        let connection = HttpConnection::new(port);
        self.connections.insert(port, connection);
    }

    fn on_data(&mut self, port: u32, data: &[u8]) {
        info!("HTTP server received {} bytes on port {}", data.len(), port);

        // Add data to buffer
        if let Some(connection) = self.connections.get_mut(&port) {
            connection.buffer.extend_from_slice(data);
        } else {
            return;
        }

        // Process all complete requests in the buffer (HTTP pipelining)
        loop {
            // Extract request data and length without holding mutable borrow
            let (request_data, request_len) = {
                let connection = match self.connections.get(&port) {
                    Some(conn) => conn,
                    None => break,
                };
                match Self::extract_request(&connection.buffer) {
                    Some((req, len)) => (req, len),
                    None => break, // No complete request available yet
                }
            };

            // Process the request (this may need mutable access to kv_store)
            let response = self.handle_http_request(&request_data);

            // Remove processed request from buffer and queue response
            if let Some(connection) = self.connections.get_mut(&port) {
                connection.buffer.drain(..request_len);
                if let Some(response_data) = response {
                    connection.pending_responses.push_back(response_data);
                    info!("HTTP server queued response for port {} ({} pending)", port, connection.pending_responses.len());
                }
            }
        }
    }

    fn on_reset(&mut self, port: u32) {
        info!("HTTP server connection reset on port {}", port);
        self.connections.remove(&port);
    }

    fn on_shutdown(&mut self, port: u32) {
        info!("HTTP server connection shutdown on port {}", port);
        self.connections.remove(&port);
    }

    fn get_write_data(&mut self, port: u32) -> Option<Vec<u8>> {
        if let Some(connection) = self.connections.get_mut(&port) {
            if let Some(response) = connection.pending_responses.pop_front() {
                info!(
                    "HTTP server sending {} bytes on port {} ({} remaining)",
                    response.len(),
                    port,
                    connection.pending_responses.len()
                );
                return Some(response);
            }
        }
        None
    }

    fn should_shutdown(&mut self, _port: u32) -> bool {
        // Keep connections open for HTTP pipelining
        false
    }
}

/// Helper function to create and add an HTTP server to the runner state
pub fn add_http_server(state: &mut RunnerState) {
    let http_server = HttpServer::new(8080);
    state.add_listener(8080, Box::new(http_server));
    info!("HTTP server added to runner state on port 8080");
}

pub fn add_http_server_with_kv_store(
    state: &mut RunnerState,
    kv_store: Arc<std::sync::Mutex<dyn KvStore>>,
) {
    let http_server = HttpServer::with_kv_store(8080, kv_store);
    state.add_listener(8080, Box::new(http_server));
    info!("HTTP server with KV store added to runner state on port 8080");
}
