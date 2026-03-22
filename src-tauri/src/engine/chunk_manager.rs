use crate::db::chunks::ChunkRow;
use futures::StreamExt;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

const BUFFER_SIZE: usize = 64 * 1024; // 64 KB read buffer

pub struct ChunkHandle {
    pub chunk_id: String,
    pub chunk_index: i64,
    pub downloaded: Arc<AtomicU64>,
    pub total: u64,
}

pub struct DownloadResult {
    pub task_id: String,
    pub success: bool,
    pub error: Option<String>,
}

pub fn plan_chunks(
    task_id: &str,
    total_bytes: i64,
    supports_range: bool,
    num_chunks: i64,
    save_path: &str,
    filename: &str,
    threshold: i64,
) -> Vec<ChunkRow> {
    let parts_dir = PathBuf::from(save_path).join(format!(".{}.parts", filename));
    let effective_chunks = if supports_range && total_bytes > threshold {
        num_chunks.max(1)
    } else {
        1
    };

    let chunk_size = if effective_chunks > 1 {
        total_bytes / effective_chunks
    } else {
        total_bytes
    };

    (0..effective_chunks)
        .map(|i| {
            let start = i * chunk_size;
            let end = if i == effective_chunks - 1 {
                total_bytes - 1
            } else {
                (i + 1) * chunk_size - 1
            };
            ChunkRow {
                id: uuid::Uuid::new_v4().to_string(),
                task_id: task_id.to_string(),
                chunk_index: i,
                start_byte: start,
                end_byte: end,
                downloaded_bytes: 0,
                status: "pending".to_string(),
                temp_path: parts_dir
                    .join(format!("chunk_{:03}", i))
                    .to_string_lossy()
                    .to_string(),
            }
        })
        .collect()
}

pub async fn download_chunk(
    url: &str,
    chunk: &ChunkRow,
    supports_range: bool,
    cancel: CancellationToken,
    downloaded_counter: Arc<AtomicU64>,
    config: &serde_json::Value,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let offset = chunk.downloaded_bytes;
    let start = chunk.start_byte + offset;

    let mut request = client.get(url);

    if supports_range {
        request = request.header("Range", format!("bytes={}-{}", start, chunk.end_byte));
    }

    if let Some(referer) = config.get("referer").and_then(|v| v.as_str()) {
        request = request.header("Referer", referer);
    }
    if let Some(ua) = config.get("user_agent").and_then(|v| v.as_str()) {
        request = request.header("User-Agent", ua);
    }

    let response = request.send().await.map_err(|e| e.to_string())?;
    if !response.status().is_success() && response.status().as_u16() != 206 {
        return Err(format!("HTTP {}", response.status()));
    }

    let temp_path = PathBuf::from(&chunk.temp_path);
    if let Some(parent) = temp_path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    let mut file = if offset > 0 {
        tokio::fs::OpenOptions::new()
            .append(true)
            .open(&temp_path)
            .await
            .map_err(|e| e.to_string())?
    } else {
        tokio::fs::File::create(&temp_path)
            .await
            .map_err(|e| e.to_string())?
    };

    downloaded_counter.store(offset as u64, Ordering::Relaxed);

    let mut stream = response.bytes_stream();
    let mut buf = Vec::with_capacity(BUFFER_SIZE);

    while let Some(result) = stream.next().await {
        if cancel.is_cancelled() {
            file.flush().await.map_err(|e| e.to_string())?;
            return Err("cancelled".to_string());
        }

        let bytes = result.map_err(|e| e.to_string())?;
        buf.extend_from_slice(&bytes);

        if buf.len() >= BUFFER_SIZE {
            file.write_all(&buf).await.map_err(|e| e.to_string())?;
            downloaded_counter.fetch_add(buf.len() as u64, Ordering::Relaxed);
            buf.clear();
        }
    }

    if !buf.is_empty() {
        file.write_all(&buf).await.map_err(|e| e.to_string())?;
        downloaded_counter.fetch_add(buf.len() as u64, Ordering::Relaxed);
    }

    file.flush().await.map_err(|e| e.to_string())?;
    Ok(())
}
