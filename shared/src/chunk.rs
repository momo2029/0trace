/// 文件分块大小（256KB）
pub const CHUNK_SIZE: usize = 256 * 1024;

/// 将数据分块
pub fn split_chunks(data: &[u8]) -> Vec<Vec<u8>> {
    data.chunks(CHUNK_SIZE)
        .map(|chunk| chunk.to_vec())
        .collect()
}

/// 合并分块
pub fn merge_chunks(chunks: &[Vec<u8>]) -> Vec<u8> {
    chunks.iter().flat_map(|c| c.iter()).copied().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_and_merge() {
        let data = vec![1u8; 300 * 1024]; // 300KB
        let chunks = split_chunks(&data);
        assert_eq!(chunks.len(), 2); // 256KB + 44KB

        let merged = merge_chunks(&chunks);
        assert_eq!(merged, data);
    }
}
