use serde::{Deserialize, Serialize};

/// 房间状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoomStatus {
    pub code: String,
    pub has_sender: bool,
    pub has_receiver: bool,
    pub created_at: u64,
}

/// 生成 6 位房间码
pub fn generate_room_code() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};

    const CHARS: &[u8] = b"123456789ABCDEFGHIJKLMNPQRSTUVWXYZ";
    let mut code = String::with_capacity(6);

    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();

    let mut rng = seed;
    for _ in 0..6 {
        rng = rng.wrapping_mul(1103515245).wrapping_add(12345);
        let idx = (rng / 65536) % (CHARS.len() as u128);
        code.push(CHARS[idx as usize] as char);
    }

    code
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_room_code() {
        let code = generate_room_code();
        assert_eq!(code.len(), 6);
        assert!(code.chars().all(|c| "123456789ABCDEFGHIJKLMNPQRSTUVWXYZ".contains(c)));
    }
}
