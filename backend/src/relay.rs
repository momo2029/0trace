use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::{error, info};

type RelayTx = mpsc::UnboundedSender<Message>;

#[derive(Clone)]
pub struct RelayManager {
    rooms: Arc<RwLock<HashMap<String, RelayRoom>>>,
}

struct RelayRoom {
    sender: Option<RelayTx>,
    receiver: Option<RelayTx>,
}

impl RelayManager {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    async fn join(&self, code: &str, role: &str, tx: RelayTx) -> Result<Option<RelayTx>, String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(code.to_string()).or_insert(RelayRoom {
            sender: None,
            receiver: None,
        });

        let peer_tx = match role {
            "sender" => {
                let peer = room.receiver.clone();
                room.sender = Some(tx);
                peer
            }
            "receiver" => {
                let peer = room.sender.clone();
                room.receiver = Some(tx);
                peer
            }
            _ => return Err("invalid role".to_string()),
        };

        Ok(peer_tx)
    }

    async fn leave(&self, code: &str, role: &str) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(code) {
            match role {
                "sender" => room.sender = None,
                "receiver" => room.receiver = None,
                _ => {}
            }
            if room.sender.is_none() && room.receiver.is_none() {
                rooms.remove(code);
            }
        }
    }

    async fn get_peer(&self, code: &str, role: &str) -> Option<RelayTx> {
        let rooms = self.rooms.read().await;
        let room = rooms.get(code)?;
        match role {
            "sender" => room.receiver.clone(),
            "receiver" => room.sender.clone(),
            _ => None,
        }
    }
}

pub async fn handle_relay(socket: WebSocket, code: String, role: String, manager: RelayManager) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // 加入房间，获取对方 tx（如果已在线）
    let peer_tx = match manager.join(&code, &role, tx.clone()).await {
        Ok(p) => p,
        Err(e) => {
            error!("Relay join error: {}", e);
            return;
        }
    };

    info!("Relay joined: {} as {}", code, role);

    // 通知自己：relay-ready，告知对方是否在线
    let ready_msg = serde_json::json!({
        "type": "relay-ready",
        "peer_connected": peer_tx.is_some()
    })
    .to_string();
    let _ = ws_tx.send(Message::Text(ready_msg)).await;

    // 通知对方：relay-peer-joined
    if let Some(ref peer) = peer_tx {
        let _ = peer.send(Message::Text(
            serde_json::json!({ "type": "relay-peer-joined" }).to_string(),
        ));
    }

    // 发送任务
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_tx.send(msg).await.is_err() {
                break;
            }
        }
    });

    // 接收任务：转发给对方
    let manager_clone = manager.clone();
    let code_clone = code.clone();
    let role_clone = role.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            // 文本控制消息不转发
            if let Message::Text(_) = &msg {
                continue;
            }
            if let Some(peer) = manager_clone.get_peer(&code_clone, &role_clone).await {
                let _ = peer.send(msg);
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    manager.leave(&code, &role).await;
    info!("Relay left: {} as {}", code, role);

    // 通知对方离开
    if let Some(peer) = manager.get_peer(&code, &role).await {
        let _ = peer.send(Message::Text(
            serde_json::json!({ "type": "relay-peer-left" }).to_string(),
        ));
    }
}
