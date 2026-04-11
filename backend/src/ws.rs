use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use shared::{Role, SignalMessage};
use tokio::sync::mpsc;
use tracing::{error, info, warn};

use crate::room::{RoomManager, SendError};

pub async fn handle_websocket(
    socket: WebSocket,
    code: String,
    role: Role,
    room_manager: RoomManager,
) {
    let (mut sender, mut receiver) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<String>();

    // 加入房间
    if let Err(e) = room_manager.join_room(&code, role, tx.clone()).await {
        error!("Failed to join room: {}", e);
        let _ = sender
            .send(Message::Text(
                serde_json::to_string(&SignalMessage::Error {
                    message: e.to_string(),
                })
                .unwrap(),
            ))
            .await;
        return;
    }

    info!("Client joined room: {} as {:?}", code, role);

    // 通知对方有人加入（如果对方在线的话）
    match room_manager
        .send_to_peer(
            &code,
            role,
            serde_json::to_string(&SignalMessage::PeerJoined {
                role: role.as_str().to_string(),
            })
            .unwrap(),
        )
        .await
    {
        Ok(()) | Err(SendError::PeerNotFound | SendError::PeerDisconnected) => {}
        Err(SendError::RoomNotFound) => {
            warn!("Room disappeared while notifying peer join: {}", code);
        }
    }

    // 发送任务：从 rx 接收消息并发送到 WebSocket
    let mut send_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sender.send(Message::Text(msg)).await.is_err() {
                break;
            }
        }
    });

    // 接收任务：从 WebSocket 接收消息并转发给对方
    let room_manager_clone = room_manager.clone();
    let code_clone = code.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                    if value["type"].as_str() == Some("ping") {
                        continue;
                    }
                }

                if let Err(e) = room_manager_clone
                    .send_to_peer(&code_clone, role, text)
                    .await
                {
                    match e {
                        SendError::PeerNotFound | SendError::PeerDisconnected => {}
                        SendError::RoomNotFound => {
                            warn!(
                                "Failed to forward message because room was missing: {}",
                                code_clone
                            );
                            break;
                        }
                    }
                }
            }
        }
    });

    // 等待任一任务完成
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // 离开房间
    room_manager.leave_room(&code, role, &tx).await;
    info!("Client left room: {} as {:?}", code, role);

    // 通知对方离开
    match room_manager
        .send_to_peer(
            &code,
            role,
            serde_json::to_string(&SignalMessage::PeerLeft).unwrap(),
        )
        .await
    {
        Ok(()) | Err(SendError::PeerNotFound | SendError::PeerDisconnected) => {}
        Err(SendError::RoomNotFound) => {
            warn!("Room disappeared while notifying peer left: {}", code);
        }
    }
}
