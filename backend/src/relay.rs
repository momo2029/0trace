use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use shared::Role;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use tracing::info;

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

    async fn join(&self, code: &str, role: Role, tx: RelayTx) -> Option<RelayTx> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.entry(code.to_string()).or_insert(RelayRoom {
            sender: None,
            receiver: None,
        });

        let peer_tx = match role {
            Role::Sender => {
                let peer = room.receiver.clone();
                room.sender = Some(tx);
                peer
            }
            Role::Receiver => {
                let peer = room.sender.clone();
                room.receiver = Some(tx);
                peer
            }
        };

        peer_tx
    }

    async fn leave(&self, code: &str, role: Role, tx: &RelayTx) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(code) {
            let slot = match role {
                Role::Sender => &mut room.sender,
                Role::Receiver => &mut room.receiver,
            };

            let should_remove = slot
                .as_ref()
                .is_some_and(|current| current.same_channel(tx));
            if should_remove {
                *slot = None;
            }

            if room.sender.is_none() && room.receiver.is_none() {
                rooms.remove(code);
            }
        }
    }

    async fn get_peer(&self, code: &str, role: Role) -> Option<RelayTx> {
        let rooms = self.rooms.read().await;
        let room = rooms.get(code)?;
        match role {
            Role::Sender => room.receiver.clone(),
            Role::Receiver => room.sender.clone(),
        }
    }
}

pub async fn handle_relay(socket: WebSocket, code: String, role: Role, manager: RelayManager) {
    let (mut ws_tx, mut ws_rx) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

    // 加入房间，获取对方 tx（如果已在线）
    let peer_tx = manager.join(&code, role, tx.clone()).await;

    info!("Relay joined: {} as {:?}", code, role);

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
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            // 过滤客户端发来的 relay 控制消息（ping 等），其余全部转发
            if let Message::Text(ref text) = msg {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
                    let t = v["type"].as_str().unwrap_or("");
                    if t.starts_with("relay-") || t == "ping" {
                        continue;
                    }
                }
            }
            if let Some(peer) = manager_clone.get_peer(&code_clone, role).await {
                let _ = peer.send(msg);
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    manager.leave(&code, role, &tx).await;
    info!("Relay left: {} as {:?}", code, role);

    // 通知对方离开
    if let Some(peer) = manager.get_peer(&code, role).await {
        let _ = peer.send(Message::Text(
            serde_json::json!({ "type": "relay-peer-left" }).to_string(),
        ));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stale_leave_does_not_remove_newer_relay_connection() {
        let manager = RelayManager::new();
        let code = "12345678";

        let (old_tx, _old_rx) = mpsc::unbounded_channel();
        manager.join(code, Role::Sender, old_tx.clone()).await;

        let (new_tx, _new_rx) = mpsc::unbounded_channel();
        manager.join(code, Role::Sender, new_tx.clone()).await;

        manager.leave(code, Role::Sender, &old_tx).await;

        let rooms = manager.rooms.read().await;
        let room = rooms.get(code).unwrap();
        let sender = room.sender.as_ref().unwrap();
        assert!(sender.same_channel(&new_tx));
    }
}
