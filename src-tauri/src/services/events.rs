use crate::engine::worker_pool::WorkerPool;
use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub id: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub eta_seconds: f64,
    pub chunks: Vec<ChunkProgressPayload>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChunkProgressPayload {
    pub index: i64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
}

struct PreviousSnapshot {
    downloaded: u64,
    timestamp: std::time::Instant,
}

pub fn start_event_emitter(app_handle: tauri::AppHandle, pool: Arc<WorkerPool>) {
    tauri::async_runtime::spawn(async move {
        let mut prev: HashMap<String, PreviousSnapshot> = HashMap::new();

        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            let active = pool.active_tasks.lock().await;
            let now = std::time::Instant::now();

            let mut current_ids: Vec<String> = Vec::new();

            for (task_id, task) in active.iter() {
                current_ids.push(task_id.clone());

                let mut total_downloaded: u64 = 0;
                let mut total_size: u64 = 0;
                let mut chunk_payloads = Vec::new();

                for handle in &task.chunk_handles {
                    let dl = handle.downloaded.load(Ordering::Relaxed);
                    let chunk_total = handle.total.load(Ordering::Relaxed);
                    total_downloaded += dl;
                    total_size += chunk_total;
                    chunk_payloads.push(ChunkProgressPayload {
                        index: handle.chunk_index,
                        downloaded_bytes: dl,
                        total_bytes: chunk_total,
                    });
                }

                let speed = if let Some(prev_snap) = prev.get(task_id) {
                    let elapsed = now.duration_since(prev_snap.timestamp).as_secs_f64();
                    if elapsed > 0.0 {
                        let delta = total_downloaded.saturating_sub(prev_snap.downloaded);
                        (delta as f64 / elapsed) as u64
                    } else {
                        0
                    }
                } else {
                    0
                };

                let eta = if speed > 0 && total_size > total_downloaded {
                    (total_size - total_downloaded) as f64 / speed as f64
                } else {
                    0.0
                };

                let payload = ProgressPayload {
                    id: task_id.clone(),
                    downloaded_bytes: total_downloaded,
                    total_bytes: total_size,
                    speed_bps: speed,
                    eta_seconds: eta,
                    chunks: chunk_payloads,
                };

                let _ = tauri::Emitter::emit(&app_handle, "progress_update", &payload);

                prev.insert(
                    task_id.clone(),
                    PreviousSnapshot {
                        downloaded: total_downloaded,
                        timestamp: now,
                    },
                );
            }

            prev.retain(|k, _| current_ids.contains(k));
        }
    });
}
