mod room;
mod ws;

use axum::{
    extract::{Query, State, WebSocketUpgrade},
    http::StatusCode,
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use room::RoomManager;
use serde::{Deserialize, Serialize};
use shared::Role;
use tower_http::{cors::CorsLayer, services::ServeDir};
use tracing::info;

#[derive(Clone)]
struct AppState {
    room_manager: RoomManager,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let room_manager = RoomManager::new();

    // 定期清理过期房间
    let room_manager_clone = room_manager.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            room_manager_clone.cleanup_expired().await;
            info!("Cleaned up expired rooms");
        }
    });

    let state = AppState { room_manager };

    // 静态文件路径：开发环境和生产环境自动适配
    let static_path = if std::path::Path::new("../frontend/static").exists() {
        "../frontend/static" // 开发环境：从 backend/ 目录运行
    } else {
        "frontend/static"    // 生产环境：从项目根目录运行
    };

    let app = Router::new()
        .route("/", get(index_handler))
        .route("/api/create-room", post(create_room_handler))
        .route("/api/room-info", get(room_info_handler))
        .route("/api/ws", get(ws_handler))
        .nest_service("/static", ServeDir::new(static_path))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let port = std::env::var("PORT")
        .unwrap_or_else(|_| "2029".to_string())
        .parse()
        .unwrap_or(2029);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port))
        .await
        .unwrap();

    info!("Server running on http://0.0.0.0:{}", port);

    axum::serve(listener, app).await.unwrap();
}

async fn index_handler() -> Html<&'static str> {
    Html(include_str!("../../frontend/static/index.html"))
}

#[derive(Serialize)]
struct CreateRoomResponse {
    success: bool,
    code: String,
}

async fn create_room_handler(State(state): State<AppState>) -> Json<CreateRoomResponse> {
    let code = state.room_manager.create_room().await;
    Json(CreateRoomResponse {
        success: true,
        code,
    })
}

#[derive(Deserialize)]
struct RoomInfoQuery {
    code: String,
}

#[derive(Serialize)]
struct RoomInfoResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    status: Option<shared::RoomStatus>,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

async fn room_info_handler(
    State(state): State<AppState>,
    Query(query): Query<RoomInfoQuery>,
) -> Json<RoomInfoResponse> {
    match state.room_manager.get_room(&query.code).await {
        Some(status) => Json(RoomInfoResponse {
            success: true,
            status: Some(status),
            message: None,
        }),
        None => Json(RoomInfoResponse {
            success: false,
            status: None,
            message: Some("Room not found".to_string()),
        }),
    }
}

#[derive(Deserialize)]
struct WsQuery {
    code: String,
    role: String,
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
    Query(query): Query<WsQuery>,
) -> impl IntoResponse {
    let role = match query.role.as_str() {
        "sender" => Role::Sender,
        "receiver" => Role::Receiver,
        _ => return (StatusCode::BAD_REQUEST, "Invalid role").into_response(),
    };

    ws.on_upgrade(move |socket| ws::handle_websocket(socket, query.code, role, state.room_manager))
}
