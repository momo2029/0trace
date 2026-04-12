use shared::{Role, RoomStatus};
use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{mpsc, RwLock};

pub type Tx = mpsc::UnboundedSender<String>;

/// 房间内的客户端
pub struct Client {
    #[allow(dead_code)]
    pub role: Role,
    pub tx: Tx,
}

/// 房间
pub struct Room {
    pub code: String,
    pub sender: Option<Client>,
    pub receiver: Option<Client>,
    pub created_at: u64,
    pub last_activity: u64, // 最后活跃时间
}

impl Room {
    pub fn new(code: String) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            code,
            sender: None,
            receiver: None,
            created_at: now,
            last_activity: now,
        }
    }

    pub fn add_client(&mut self, role: Role, tx: Tx) -> Result<(), String> {
        self.update_activity();
        *self.client_slot_mut(role) = Some(Client { role, tx });
        Ok(())
    }

    pub fn remove_client_if_current(&mut self, role: Role, tx: &Tx) {
        let slot = self.client_slot_mut(role);
        let should_remove = slot
            .as_ref()
            .is_some_and(|client| client.tx.same_channel(tx));

        if should_remove {
            *slot = None;
            self.update_activity();
        }
    }

    pub fn get_peer(&self, role: Role) -> Option<&Client> {
        match role {
            Role::Sender => self.receiver.as_ref(),
            Role::Receiver => self.sender.as_ref(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.sender.is_none() && self.receiver.is_none()
    }

    pub fn update_activity(&mut self) {
        self.last_activity = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }

    pub fn status(&self) -> RoomStatus {
        RoomStatus {
            code: self.code.clone(),
            has_sender: self.sender.is_some(),
            has_receiver: self.receiver.is_some(),
            created_at: self.created_at,
        }
    }

    fn client_slot_mut(&mut self, role: Role) -> &mut Option<Client> {
        match role {
            Role::Sender => &mut self.sender,
            Role::Receiver => &mut self.receiver,
        }
    }

    fn peer_slot_mut(&mut self, role: Role) -> &mut Option<Client> {
        match role {
            Role::Sender => &mut self.receiver,
            Role::Receiver => &mut self.sender,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoomError {
    RoomNotFound,
}

impl fmt::Display for RoomError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RoomError::RoomNotFound => f.write_str("Room not found"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SendError {
    RoomNotFound,
    PeerNotFound,
    PeerDisconnected,
}

impl fmt::Display for SendError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SendError::RoomNotFound => f.write_str("Room not found"),
            SendError::PeerNotFound => f.write_str("Peer not found"),
            SendError::PeerDisconnected => f.write_str("Peer disconnected"),
        }
    }
}

/// 房间管理器
#[derive(Clone)]
pub struct RoomManager {
    rooms: Arc<RwLock<HashMap<String, Room>>>,
}

impl RoomManager {
    pub fn new() -> Self {
        Self {
            rooms: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn create_room(&self) -> String {
        let mut rooms = self.rooms.write().await;
        // 碰撞重试，最多 10 次
        for _ in 0..10 {
            let code = shared::generate_room_code();
            if !rooms.contains_key(&code) {
                rooms.insert(code.clone(), Room::new(code.clone()));
                return code;
            }
        }
        // 兜底：极端情况下仍然插入（覆盖旧房间）
        let code = shared::generate_room_code();
        rooms.insert(code.clone(), Room::new(code.clone()));
        code
    }

    pub async fn get_room(&self, code: &str) -> Option<RoomStatus> {
        let rooms = self.rooms.read().await;
        rooms.get(code).map(|r| r.status())
    }

    pub async fn join_room(&self, code: &str, role: Role, tx: Tx) -> Result<(), RoomError> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(code).ok_or(RoomError::RoomNotFound)?;
        room.add_client(role, tx)
            .map_err(|_| RoomError::RoomNotFound)
    }

    pub async fn send_to_peer(
        &self,
        code: &str,
        role: Role,
        message: String,
    ) -> Result<(), SendError> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(code).ok_or(SendError::RoomNotFound)?;
        room.update_activity();

        let peer_slot = room.peer_slot_mut(role);
        let Some(peer) = peer_slot.as_ref() else {
            return Err(SendError::PeerNotFound);
        };

        if peer.tx.send(message).is_err() {
            *peer_slot = None;
            room.update_activity();
            return Err(SendError::PeerDisconnected);
        }

        Ok(())
    }

    pub async fn leave_room(&self, code: &str, role: Role, tx: &Tx) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(code) {
            room.remove_client_if_current(role, tx);
            // 不要立即删除房间，让过期机制处理
            // 这样接收方还有机会加入
        }
    }

    pub async fn cleanup_expired(&self) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut rooms = self.rooms.write().await;
        rooms.retain(|_, room| {
            // 如果房间有人在线，不过期
            if !room.is_empty() {
                return true;
            }

            // 空房间：5 分钟后清理
            now - room.last_activity < 300
        });
    }
}

impl Default for RoomManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn stale_leave_does_not_remove_newer_connection() {
        let manager = RoomManager::new();
        let code = manager.create_room().await;

        let (old_tx, _old_rx) = mpsc::unbounded_channel();
        manager
            .join_room(&code, Role::Sender, old_tx.clone())
            .await
            .unwrap();

        let (new_tx, _new_rx) = mpsc::unbounded_channel();
        manager
            .join_room(&code, Role::Sender, new_tx.clone())
            .await
            .unwrap();

        manager.leave_room(&code, Role::Sender, &old_tx).await;

        let rooms = manager.rooms.read().await;
        let room = rooms.get(&code).unwrap();
        let sender = room.sender.as_ref().unwrap();
        assert!(sender.tx.same_channel(&new_tx));
    }

    #[tokio::test]
    async fn failed_peer_send_cleans_up_stale_peer() {
        let manager = RoomManager::new();
        let code = manager.create_room().await;

        let (receiver_tx, receiver_rx) = mpsc::unbounded_channel();
        drop(receiver_rx);

        manager
            .join_room(&code, Role::Receiver, receiver_tx.clone())
            .await
            .unwrap();

        let result = manager
            .send_to_peer(&code, Role::Sender, "hello".to_string())
            .await;

        assert_eq!(result, Err(SendError::PeerDisconnected));

        let rooms = manager.rooms.read().await;
        let room = rooms.get(&code).unwrap();
        assert!(room.receiver.is_none());
    }
}
