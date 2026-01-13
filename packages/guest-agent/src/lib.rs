use cmio::CmioIoDriver;
use log::{error, info};
use std::collections::HashMap;
use std::error::Error;
use std::io::{Read, Write};
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use vsock::{VsockAddr, VsockListener, VsockStream, VMADDR_CID_ANY};
use vsock_protocol::{
    Packet, VirtioVsockHdr, VSOCK_OP_REQUEST, VSOCK_OP_RESPONSE, VSOCK_OP_RST, VSOCK_OP_RW,
    VSOCK_OP_SHUTDOWN, VSOCK_TYPE_STREAM,
};

const CMIO_QUEUE_ID: u16 = 0x27;
const RW_BUF_SIZE: usize = 4096;
const LOOP_SLEEP_DURATION: Duration = Duration::from_secs(5);

const GUEST_CID: u32 = 1;
const HOST_CID: u32 = 3;
const HOST_HTTP_PORT: u32 = 8080;

#[derive(PartialEq, Eq, Hash, Clone, Copy, Debug)]
struct ConnectionKey {
    cid: u32,
    port: u32,
}

impl From<&VirtioVsockHdr> for ConnectionKey {
    fn from(hdr: &VirtioVsockHdr) -> Self {
        Self {
            cid: hdr.src_cid,
            port: hdr.src_port,
        }
    }
}

struct Connection {
    stream: VsockStream,
    request_hdr: VirtioVsockHdr,
    guest_initiated: bool,
}

struct ConnectionManager {
    connections: HashMap<ConnectionKey, Connection>,
    cmio_driver: Arc<Mutex<CmioIoDriver>>,
    listeners: HashMap<u32, VsockListener>,
}

impl ConnectionManager {
    fn new(cmio_driver: Arc<Mutex<CmioIoDriver>>) -> Self {
        Self {
            connections: HashMap::new(),
            cmio_driver,
            listeners: HashMap::new(),
        }
    }

    /// Finds a connection key by trying both possible keys (since packets can come from either direction)
    fn find_connection_key(&self, hdr: &VirtioVsockHdr) -> Option<ConnectionKey> {
        // Try the key from the packet's source (normal case)
        let key1 = ConnectionKey {
            cid: hdr.src_cid,
            port: hdr.src_port,
        };
        if self.connections.contains_key(&key1) {
            return Some(key1);
        }

        // Try the reverse key (for guest-initiated connections where packets come back from host)
        let key2 = ConnectionKey {
            cid: hdr.dst_cid,
            port: hdr.dst_port,
        };
        if self.connections.contains_key(&key2) {
            return Some(key2);
        }

        None
    }

    fn poll_cmio(&mut self) -> Result<(), Box<dyn Error>> {
        let cmio_bytes = match self
            .cmio_driver
            .lock()
            .unwrap()
            .send_cmio(&[], CMIO_QUEUE_ID)
        {
            Ok(bytes) => bytes,
            Err(e) => {
                error!(target: "guest", "Error polling CMIO for request: {}", e);
                return Ok(());
            }
        };

        if cmio_bytes.is_empty() {
            return Ok(());
        }

        let packet = match Packet::from_bytes(&cmio_bytes) {
            Ok(p) => p,
            Err(_) => {
                info!(target: "guest", "Incomplete packet from CMIO, ignoring.");
                return Ok(());
            }
        };

        self.handle_cmio_packet(packet)
    }

    fn handle_cmio_packet(&mut self, packet: Packet) -> Result<(), Box<dyn Error>> {
        let (hdr, payload) = packet.into_parts();
        info!(target: "guest", "GUEST: RECEIVED NEW PACKET FROM CMIO\n {:?}", hdr);

        match hdr.op {
            VSOCK_OP_REQUEST => self.handle_new_connection_request(hdr)?,
            VSOCK_OP_RESPONSE => {
                // Response to our connection request - connection is already established
                if let Some(key) = self.find_connection_key(&hdr) {
                    info!(target: "guest", "Received VSOCK_OP_RESPONSE for connection {:?}", key);
                } else {
                    info!(target: "guest", "Received VSOCK_OP_RESPONSE for unknown connection. Ignoring.");
                }
            }
            VSOCK_OP_RW => {
                if let Some(key) = self.find_connection_key(&hdr) {
                    if let Some(connection) = self.connections.get_mut(&key) {
                        if !payload.is_empty() {
                            info!(
                                target: "guest",
                                "GUEST: FORWARDING {} BYTES FROM CMIO TO VSOCK FOR\n {:?}",
                                payload.len(),
                                key
                            );
                            if let Err(e) = connection.stream.write_all(&payload) {
                                error!(target: "guest", "Failed to write to vsock stream for {:?}: {}", key, e);
                            }
                        }
                    }
                } else {
                    info!(target: "guest", "Received OP_RW for unknown connection. Ignoring.");
                }
            }
            VSOCK_OP_RST | VSOCK_OP_SHUTDOWN => {
                if let Some(key) = self.find_connection_key(&hdr) {
                    info!(target: "guest", "Received OP {} for {:?}, closing connection.", hdr.op, key);
                    if let Some(conn) = self.connections.remove(&key) {
                        let _ = conn.stream.shutdown(std::net::Shutdown::Both);
                    }
                } else {
                    info!(target: "guest", "Received OP {} for unknown connection. Ignoring.", hdr.op);
                }
            }
            _ => info!(target: "guest", "Received unhandled OP {} from CMIO. Ignoring.", hdr.op),
        }

        Ok(())
    }

    fn add_listener(&mut self, port: u32) -> Result<(), Box<dyn Error>> {
        if self.listeners.contains_key(&port) {
            info!(target: "guest", "Listener already exists on port {}", port);
            return Ok(());
        }

        let listener = VsockListener::bind(&VsockAddr::new(VMADDR_CID_ANY, port))?;
        listener.set_nonblocking(true)?;
        self.listeners.insert(port, listener);
        info!(target: "guest", "Listening for vsock connections on port {}", port);
        Ok(())
    }

    fn poll_vsock_listeners(&mut self) -> Result<(), Box<dyn Error>> {
        for (port, listener) in self.listeners.iter() {
            loop {
                match listener.accept() {
                    Ok((stream, addr)) => {
                        info!(
                            target: "guest",
                            "Accepted vsock connection on port {} from {}:{}",
                            port,
                            addr.cid(),
                            addr.port()
                        );

                        stream.set_nonblocking(true)?;

                        let request_hdr = VirtioVsockHdr {
                            src_cid: GUEST_CID,
                            dst_cid: HOST_CID,
                            src_port: *port,
                            dst_port: HOST_HTTP_PORT,
                            len: 0,
                            type_: VSOCK_TYPE_STREAM,
                            op: VSOCK_OP_REQUEST,
                            flags: 0,
                            buf_alloc: 0,
                            fwd_cnt: 0,
                        };

                        let packet = Packet::new(request_hdr, vec![]);
                        let key = ConnectionKey::from(&request_hdr);

                        info!(
                            target: "guest",
                            "Initiating CMIO vsock connection to host for {:?}",
                            key
                        );

                        match self
                            .cmio_driver
                            .lock()
                            .unwrap()
                            .send_cmio(&packet.to_bytes(), CMIO_QUEUE_ID)
                        {
                            Ok(_) => {
                                self.connections.insert(
                                    key,
                                    Connection {
                                        stream,
                                        request_hdr,
                                        guest_initiated: true,
                                    },
                                );
                                info!(
                                    target: "guest",
                                    "Registered new guest <-> host proxy connection for {:?}",
                                    key
                                );
                                break;
                            }
                            Err(e) => {
                                error!(
                                    target: "guest",
                                    "Failed to send initial CMIO packet for {:?}: {}",
                                    key,
                                    e
                                );
                                let _ = stream.shutdown(std::net::Shutdown::Both);
                            }
                        }
                    }
                    Err(e) => {
                        if e.kind() == std::io::ErrorKind::WouldBlock {
                            // No more pending connections yet on this listener. Ignoring.
                            break;
                        } else {
                            error!(
                                target: "guest",
                                "Error accepting connection on listener {}: {}",
                                port,
                                e
                            );
                            break;
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn handle_new_connection_request(
        &mut self,
        request_hdr: VirtioVsockHdr,
    ) -> Result<(), Box<dyn Error>> {
        let key = ConnectionKey::from(&request_hdr);
        if self.connections.contains_key(&key) {
            info!(target: "guest", "Connection request for existing key {:?}, ignoring.", key);
            return Ok(());
        }

        info!(target: "guest", "ATTEMPTING TO CONNECT FOR {:?}", key);
        match VsockStream::connect(&VsockAddr::new(request_hdr.dst_cid, request_hdr.dst_port)) {
            Ok(stream) => {
                info!(target: "guest", "Connection to guest vsock successful for {:?}", key);
                stream.set_nonblocking(true)?;
                self.send_op_to_cmio(&request_hdr, VSOCK_OP_RESPONSE, false)?;
                self.connections.insert(
                    key,
                    Connection {
                        stream,
                        request_hdr,
                        guest_initiated: false,
                    },
                );
            }
            Err(e) => {
                error!(target: "guest", "Failed to connect to guest vsock for {:?}: {}", key, e);
                self.send_op_to_cmio(&request_hdr, VSOCK_OP_RST, false)?;
            }
        }
        Ok(())
    }

    fn poll_vsock_connections(&mut self) -> Result<(), Box<dyn Error>> {
        let mut read_buf = [0u8; RW_BUF_SIZE];
        let mut to_remove = Vec::new();
        let mut packets_to_send = Vec::new();
        let mut resets_to_send = Vec::new();
        let mut shutdowns_to_send = Vec::new();

        for (key, connection) in &mut self.connections {
            match connection.stream.read(&mut read_buf) {
                Ok(0) => {
                    info!(target: "guest", "Vsock stream closed by peer for {:?}.", key);
                    shutdowns_to_send.push((connection.request_hdr, connection.guest_initiated));
                    to_remove.push(*key);
                }
                Ok(n) => {
                    let data = &read_buf[..n];
                    info!(
                        target: "guest",
                        "Received {} bytes from vsock for\n {:?}, forwarding to CMIO.",
                        n, key
                    );
                    let rw_hdr = create_header(
                        &connection.request_hdr,
                        VSOCK_OP_RW,
                        n as u32,
                        connection.guest_initiated,
                    );
                    let packet_to_cmio = Packet::new(rw_hdr, data.to_vec());
                    packets_to_send.push(packet_to_cmio);
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {}
                Err(e) => {
                    error!(target: "guest", "Error reading from vsock stream for {:?}: {}", key, e);
                    resets_to_send.push((connection.request_hdr, connection.guest_initiated));
                    to_remove.push(*key);
                }
            }
        }

        for packet in packets_to_send {
            if let Err(e) = self
                .cmio_driver
                .lock()
                .unwrap()
                .send_cmio(&packet.to_bytes(), CMIO_QUEUE_ID)
            {
                let (hdr, _) = packet.into_parts();
                error!(
                    target: "guest",
                    "Failed to forward data to CMIO for {:?}: {}",
                    ConnectionKey::from(&hdr),
                    e
                );
            }
        }

        for (hdr, guest_initiated) in resets_to_send {
            if let Err(e) = self.send_op_to_cmio(&hdr, VSOCK_OP_RST, guest_initiated) {
                error!(
                    target: "guest",
                    "Failed to send reset for {:?}: {}",
                    ConnectionKey::from(&hdr),
                    e
                );
            }
        }

        for (hdr, guest_initiated) in shutdowns_to_send {
            if let Err(e) = self.send_op_to_cmio(&hdr, VSOCK_OP_SHUTDOWN, guest_initiated) {
                error!(
                    target: "guest",
                    "Failed to send shutdown for {:?}: {}",
                    ConnectionKey::from(&hdr),
                    e
                );
            }
        }

        for key in to_remove {
            if let Some(conn) = self.connections.remove(&key) {
                let _ = conn.stream.shutdown(std::net::Shutdown::Both);
            }
            info!(target: "guest", "Removed connection {:?}", key);
        }
        Ok(())
    }

    fn send_op_to_cmio(
        &self,
        request_hdr: &VirtioVsockHdr,
        op: u16,
        guest_initiated: bool,
    ) -> Result<(), Box<dyn Error>> {
        let op_str = match op {
            VSOCK_OP_RESPONSE => "VSOCK_OP_RESPONSE",
            VSOCK_OP_RST => "VSOCK_OP_RST",
            VSOCK_OP_SHUTDOWN => "VSOCK_OP_SHUTDOWN",
            _ => "UNKNOWN_OP",
        };

        info!(
            target: "guest",
            "Sending {} to CMIO for {:?}",
            op_str,
            ConnectionKey::from(request_hdr)
        );
        let reply_hdr = create_header(request_hdr, op, 0, guest_initiated);
        let packet = Packet::new(reply_hdr, vec![]);
        self.cmio_driver
            .lock()
            .unwrap()
            .send_cmio(&packet.to_bytes(), CMIO_QUEUE_ID)?;
        Ok(())
    }
}

/// For host-initiated connections: swap src/dst
/// For guest-initiated connections: keep src/dst
fn create_header(
    request_hdr: &VirtioVsockHdr,
    op: u16,
    len: u32,
    guest_initiated: bool,
) -> VirtioVsockHdr {
    if guest_initiated {
        VirtioVsockHdr {
            src_cid: request_hdr.src_cid,
            dst_cid: request_hdr.dst_cid,
            src_port: request_hdr.src_port,
            dst_port: request_hdr.dst_port,
            len,
            type_: request_hdr.type_,
            op,
            flags: 0,
            buf_alloc: request_hdr.buf_alloc,
            fwd_cnt: 0,
        }
    } else {
        VirtioVsockHdr {
            src_cid: request_hdr.dst_cid,
            dst_cid: request_hdr.src_cid,
            src_port: request_hdr.dst_port,
            dst_port: request_hdr.src_port,
            len,
            type_: request_hdr.type_,
            op,
            flags: 0,
            buf_alloc: request_hdr.buf_alloc,
            fwd_cnt: 0,
        }
    }
}

/// Runs the main logic of the guest agent.
pub fn run_agent(cmio_driver: Arc<Mutex<CmioIoDriver>>) -> Result<(), Box<dyn Error>> {
    info!(target: "guest", "GUEST AGENT STARTED");
    let mut manager = ConnectionManager::new(cmio_driver);
    manager.add_listener(10000)?;
    println!("GUEST AGENT: LISTENING ON PORT 10000");

    loop {
        if let Err(e) = manager.poll_vsock_connections() {
            error!(target: "guest", "Error polling vsock connections: {}", e);
        }

        if let Err(e) = manager.poll_vsock_listeners() {
            error!(target: "guest", "Error polling vsock listeners: {}", e);
        }

        if let Err(e) = manager.poll_cmio() {
            error!(target: "guest", "Error polling CMIO: {}", e);
        }

        thread::sleep(LOOP_SLEEP_DURATION);
    }
}
