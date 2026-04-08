use shared::{Role, RoomStatus};
use std::collections::HashMap;
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
    pub last_activity: u64,  // 最后活跃时间
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
        match role {
            Role::Sender => {
                self.sender = Some(Client { role, tx });
            }
            Role::Receiver => {
                self.receiver = Some(Client { role, tx });
            }
        }
        Ok(())
    }

    pub fn remove_client(&mut self, role: Role) {
        self.update_activity();
        match role {
            Role::Sender => self.sender = None,
            Role::Receiver => self.receiver = None,
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
        let code = shared::generate_room_code();
        let mut rooms = self.rooms.write().await;
        rooms.insert(code.clone(), Room::new(code.clone()));
        code
    }

    pub async fn get_room(&self, code: &str) -> Option<RoomStatus> {
        let rooms = self.rooms.read().await;
        rooms.get(code).map(|r| r.status())
    }

    pub async fn join_room(&self, code: &str, role: Role, tx: Tx) -> Result<(), String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(code).ok_or("Room not found")?;
        room.add_client(role, tx)
    }

    pub async fn send_to_peer(&self, code: &str, role: Role, message: String) -> Result<(), String> {
        let mut rooms = self.rooms.write().await;
        let room = rooms.get_mut(code).ok_or("Room not found")?;
        room.update_activity();  // 更新活跃时间
        let peer = room.get_peer(role).ok_or("Peer not found")?;
        peer.tx.send(message).map_err(|_| "Failed to send message".to_string())
    }

    pub async fn leave_room(&self, code: &str, role: Role) {
        let mut rooms = self.rooms.write().await;
        if let Some(room) = rooms.get_mut(code) {
            room.remove_client(role);
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
