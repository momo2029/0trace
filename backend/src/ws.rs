use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use shared::{Role, SignalMessage};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{interval, MissedTickBehavior};
use tracing::{error, info, warn};

use crate::room::{RoomManager, SendError};

/// 服务端认为是死连接的超时（毫秒）。
/// 客户端每 30s 发一次 ping，70s 没收到任何消息就断开。
const IDLE_TIMEOUT_MS: u64 = 70_000;

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

    // 用于检测死连接：recv_task 每次收到消息就刷新，heartbeat_task 周期性检查
    let last_activity = Arc::new(AtomicU64::new(now_millis()));
    let last_activity_hb = Arc::clone(&last_activity);

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
            last_activity.store(now_millis(), Ordering::Relaxed);
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

    // 心跳/超时检测任务：周期性检查空闲时间，超时则退出
    let code_hb = code.clone();
    let mut heartbeat_task = tokio::spawn(async move {
        let mut ticker = interval(Duration::from_secs(10));
        ticker.set_missed_tick_behavior(MissedTickBehavior::Delay);
        loop {
            ticker.tick().await;
            let elapsed = now_millis() - last_activity_hb.load(Ordering::Relaxed);
            if elapsed > IDLE_TIMEOUT_MS {
                warn!("Client idle timeout: {} as {:?}", code_hb, role);
                return;
            }
        }
    });

    // 等待任一任务完成：send/recv 完成意味着 WebSocket 断开，超时则主动退出
    tokio::select! {
        _ = &mut send_task => {
            recv_task.abort();
            heartbeat_task.abort();
        }
        _ = &mut recv_task => {
            send_task.abort();
            heartbeat_task.abort();
        }
        _ = &mut heartbeat_task => {
            recv_task.abort();
            send_task.abort();
        }
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

/// 单调时钟起点，避免 SystemTime 被 NTP/手动调钟往回拨导致误判
static MONOTONIC_EPOCH: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

fn now_millis() -> u64 {
    let epoch = MONOTONIC_EPOCH.get_or_init(std::time::Instant::now);
    epoch.elapsed().as_millis() as u64
}
