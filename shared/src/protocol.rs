use serde::{Deserialize, Serialize};
use std::fmt;

/// WebSocket 信令消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum SignalMessage {
    /// 创建房间
    CreateRoom,
    /// 加入房间
    JoinRoom { code: String },
    /// SDP Offer
    Offer { sdp: String },
    /// SDP Answer
    Answer { sdp: String },
    /// ICE 候选
    IceCandidate { candidate: String },
    /// 对方加入
    PeerJoined { role: String },
    /// 对方离开
    PeerLeft,
    /// 错误
    Error { message: String },
}

/// DataChannel 传输消息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum TransferMessage {
    /// 文件元信息
    FileMeta {
        name: String,
        size: u64,
        mime_type: String,
    },
    /// 文件块信息
    ChunkInfo { index: u32, total: u32 },
    /// 确认收到块
    ChunkAck { index: u32 },
    /// 传输完成
    Complete,
    /// 取消传输
    Cancel,
}

/// 房间角色
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Sender,
    Receiver,
}

impl Role {
    pub fn as_str(&self) -> &'static str {
        match self {
            Role::Sender => "sender",
            Role::Receiver => "receiver",
        }
    }
}

impl TryFrom<&str> for Role {
    type Error = ParseRoleError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        match value {
            "sender" => Ok(Role::Sender),
            "receiver" => Ok(Role::Receiver),
            _ => Err(ParseRoleError),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ParseRoleError;

impl fmt::Display for ParseRoleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Invalid role")
    }
}
