use crate::db::chunks::{self, ChunkRow};
use crate::db::{queues, settings, tasks};
use crate::db::Database;
use crate::engine::chunk_manager::{self, ChunkHandle};
use crate::engine::governor::SpeedGovernor;
use crate::engine::stitcher;
use crate::engine::video_downloader::{self, VideoDownloadConfig};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::{Mutex, Semaphore};
use tokio_util::sync::CancellationToken;

pub struct ActiveTask {
    pub cancel_token: CancellationToken,
    pub chunk_handles: Vec<ChunkHandle>,
    pub queue_id: String,
}

pub struct WorkerPool {
    pub active_tasks: Arc<Mutex<HashMap<String, ActiveTask>>>,
    semaphore: Arc<Semaphore>,
    db: Database,
    app_handle: tauri::AppHandle,
    max_concurrent: usize,
    governor: Arc<SpeedGovernor>,
}

impl WorkerPool {
    pub fn new(
        db: Database,
        app_handle: tauri::AppHandle,
        max_concurrent: usize,
        governor: Arc<SpeedGovernor>,
    ) -> Self {
        Self {
            active_tasks: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(max_concurrent)),
            db,
            app_handle,
            max_concurrent,
            governor,
        }
    }

    pub fn start(self: Arc<Self>) {
        let pool = self.clone();
        tauri::async_runtime::spawn(async move {
            pool.run_loop().await;
        });
    }

    async fn run_loop(&self) {
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

            let global_available = self.semaphore.available_permits();
            if global_available == 0 {
                continue;
            }

            let all_queues = {
                let conn = self.db.conn();
                queues::get_all_queues(&conn).unwrap_or_default()
            };

            let active = self.active_tasks.lock().await;
            let mut per_queue_active: HashMap<String, usize> = HashMap::new();
            for task in active.values() {
                *per_queue_active.entry(task.queue_id.clone()).or_insert(0) += 1;
            }
            drop(active);

            let mut candidates: Vec<tasks::TaskRow> = Vec::new();

            for queue in &all_queues {
                if queue.is_paused {
                    continue;
                }

                let active_count = per_queue_active.get(&queue.id).copied().unwrap_or(0);
                let queue_limit = if queue.max_concurrent > 0 {
                    (queue.max_concurrent as usize).saturating_sub(active_count)
                } else {
                    global_available
                };

                if queue_limit == 0 {
                    continue;
                }

                let queued = {
                    let conn = self.db.conn();
                    tasks::get_queued_tasks_for_queue(&conn, &queue.id, queue_limit)
                        .unwrap_or_default()
                };
                candidates.extend(queued);
            }

            for task in candidates {
                let permit = match self.semaphore.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => break,
                };

                {
                    let conn = self.db.conn();
                    let _ = tasks::update_task_status(&conn, &task.id, "downloading", None);
                }

                let config: serde_json::Value =
                    serde_json::from_str(&task.config).unwrap_or_default();
                let task_type = config
                    .get("task_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("file")
                    .to_string();

                let cancel_token = CancellationToken::new();

                let task_chunks = {
                    let conn = self.db.conn();
                    chunks::get_chunks_for_task(&conn, &task.id).unwrap_or_default()
                };

                let chunk_handles = if task_type == "video" {
                    let total = if task.total_bytes > 0 {
                        task.total_bytes as u64
                    } else {
                        1
                    };
                    vec![ChunkHandle {
                        chunk_id: format!("{}-video", task.id),
                        chunk_index: 0,
                        downloaded: Arc::new(AtomicU64::new(0)),
                        total,
                    }]
                } else {
                    let mut handles = Vec::new();
                    for chunk in &task_chunks {
                        let counter = Arc::new(AtomicU64::new(chunk.downloaded_bytes as u64));
                        handles.push(ChunkHandle {
                            chunk_id: chunk.id.clone(),
                            chunk_index: chunk.chunk_index,
                            downloaded: counter,
                            total: (chunk.end_byte - chunk.start_byte + 1) as u64,
                        });
                    }
                    handles
                };

                {
                    let mut active = self.active_tasks.lock().await;
                    active.insert(
                        task.id.clone(),
                        ActiveTask {
                            cancel_token: cancel_token.clone(),
                            chunk_handles,
                            queue_id: task.queue_id.clone(),
                        },
                    );
                }

                let db = self.db.clone();
                let active_tasks = self.active_tasks.clone();
                let app_handle = self.app_handle.clone();
                let governor = self.governor.clone();
                let supports_range = task.total_bytes > 0 && task_chunks.len() > 1;

                tokio::spawn(async move {
                    let result = if task_type == "video" {
                        Self::run_video_task(
                            &db,
                            &task,
                            cancel_token.clone(),
                            &config,
                            &app_handle,
                            &active_tasks,
                        )
                        .await
                    } else {
                        Self::run_task(
                            &db,
                            &task,
                            task_chunks,
                            supports_range,
                            cancel_token.clone(),
                            &active_tasks,
                            &config,
                            &governor,
                        )
                        .await
                    };

                    match result {
                        Ok(()) => {
                            let conn = db.conn();
                            let _ = tasks::update_task_status(&conn, &task.id, "completed", None);
                            let _ = tauri::Emitter::emit(
                                &app_handle,
                                "task_completed",
                                serde_json::json!({
                                    "id": task.id,
                                    "filename": task.filename,
                                    "savePath": task.save_path,
                                }),
                            );
                        }
                        Err(ref e) if e == "cancelled" => {}
                        Err(e) => {
                            let conn = db.conn();
                            let _ =
                                tasks::update_task_status(&conn, &task.id, "error", Some(&e));
                        }
                    }

                    {
                        let mut active = active_tasks.lock().await;
                        active.remove(&task.id);
                    }

                    drop(permit);
                });
            }
        }
    }

    async fn run_task(
        db: &Database,
        task: &tasks::TaskRow,
        task_chunks: Vec<ChunkRow>,
        supports_range: bool,
        cancel_token: CancellationToken,
        active_tasks: &Arc<Mutex<HashMap<String, ActiveTask>>>,
        config: &serde_json::Value,
        governor: &Arc<SpeedGovernor>,
    ) -> Result<(), String> {
        let mut handles = Vec::new();

        let active = active_tasks.lock().await;
        let active_task = active.get(&task.id).ok_or("task not found in active map")?;
        let counters: Vec<Arc<AtomicU64>> = active_task
            .chunk_handles
            .iter()
            .map(|h| h.downloaded.clone())
            .collect();
        drop(active);

        for (i, chunk) in task_chunks.iter().enumerate() {
            if chunk.status == "completed" {
                counters[i].store((chunk.end_byte - chunk.start_byte + 1) as u64, Ordering::Relaxed);
                continue;
            }

            let url = task.url.clone();
            let chunk = chunk.clone();
            let cancel = cancel_token.clone();
            let counter = counters[i].clone();
            let cfg = config.clone();
            let gov = governor.clone();

            let chunk_id = chunk.id.clone();
            let handle = tokio::spawn(async move {
                chunk_manager::download_chunk(
                    &url, &chunk, supports_range, cancel, counter, &cfg, &gov,
                )
                .await
            });
            handles.push((i, chunk_id, handle));
        }

        let mut errors = Vec::new();
        for (idx, chunk_id, handle) in handles {
            match handle.await {
                Ok(Ok(())) => {
                    let conn = db.conn();
                    let downloaded = counters[idx].load(Ordering::Relaxed) as i64;
                    let _ = chunks::update_chunk_status(&conn, &chunk_id, "completed", downloaded);
                }
                Ok(Err(e)) if e == "cancelled" => {
                    let conn = db.conn();
                    let downloaded = counters[idx].load(Ordering::Relaxed) as i64;
                    let _ = chunks::update_chunk_status(&conn, &chunk_id, "pending", downloaded);
                    return Err("cancelled".to_string());
                }
                Ok(Err(e)) => {
                    let conn = db.conn();
                    let downloaded = counters[idx].load(Ordering::Relaxed) as i64;
                    let _ = chunks::update_chunk_status(&conn, &chunk_id, "error", downloaded);
                    errors.push(e);
                }
                Err(e) => {
                    errors.push(format!("join error: {}", e));
                }
            }
        }

        if !errors.is_empty() {
            return Err(errors.join("; "));
        }

        // All chunks complete — stitch
        let chunk_paths: Vec<String> = task_chunks.iter().map(|c| c.temp_path.clone()).collect();
        let dest = PathBuf::from(&task.save_path).join(&task.filename);
        stitcher::stitch_chunks(&chunk_paths, &dest.to_string_lossy()).await?;

        let parts_dir = PathBuf::from(&task.save_path).join(format!(".{}.parts", task.filename));
        stitcher::cleanup_parts(&chunk_paths, Some(&parts_dir.to_string_lossy())).await;

        // Update total downloaded in DB
        {
            let conn = db.conn();
            let _ = tasks::update_task_progress(&conn, &task.id, task.total_bytes);
        }

        Ok(())
    }

    async fn run_video_task(
        db: &Database,
        task: &tasks::TaskRow,
        cancel_token: CancellationToken,
        config: &serde_json::Value,
        _app_handle: &tauri::AppHandle,
        active_tasks: &Arc<Mutex<HashMap<String, ActiveTask>>>,
    ) -> Result<(), String> {
        let (ytdlp_path, ffmpeg_path) = {
            let conn = db.conn();
            let yp = settings::get_setting(&conn, "ytdlp_path")
                .ok()
                .flatten()
                .unwrap_or_default();
            let fp = settings::get_setting(&conn, "ffmpeg_path")
                .ok()
                .flatten()
                .unwrap_or_default();

            let app_data_dir = dirs_next::data_dir()
                .unwrap_or_else(|| std::env::temp_dir())
                .join("com.nextdm.desktop");
            let bin_dir = app_data_dir.join("bin");

            let ytdlp = if !yp.is_empty() && PathBuf::from(&yp).exists() {
                PathBuf::from(&yp)
            } else if cfg!(target_os = "windows") {
                bin_dir.join("yt-dlp.exe")
            } else {
                bin_dir.join("yt-dlp")
            };

            let ffmpeg = if !fp.is_empty() && PathBuf::from(&fp).exists() {
                PathBuf::from(&fp)
            } else if cfg!(target_os = "windows") {
                bin_dir.join("ffmpeg.exe")
            } else {
                bin_dir.join("ffmpeg")
            };

            (ytdlp, ffmpeg)
        };

        if !ytdlp_path.exists() {
            return Err("yt-dlp is not installed. Please download it from Settings > Video Downloads.".to_string());
        }

        let format_id = config
            .get("format_id")
            .and_then(|v| v.as_str())
            .unwrap_or("bestvideo+bestaudio/best")
            .to_string();
        let output_format = config
            .get("output_format")
            .and_then(|v| v.as_str())
            .unwrap_or("mp4")
            .to_string();
        let subtitles: Vec<String> = config
            .get("subtitles")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();
        let embed_subs = config
            .get("embed_subs")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        let embed_thumbnail = config
            .get("embed_thumbnail")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        let dl_config = VideoDownloadConfig {
            format_id,
            output_format,
            subtitles,
            embed_subs,
            embed_thumbnail,
        };

        let task_id = task.id.clone();
        let active_ref = active_tasks.clone();

        video_downloader::run_video_download(
            &ytdlp_path,
            &ffmpeg_path,
            &task.url,
            &dl_config,
            &PathBuf::from(&task.save_path),
            &task.filename,
            cancel_token,
            move |progress| {
                let active_ref_inner = active_ref.clone();
                let task_id_inner = task_id.clone();
                let downloaded = progress.downloaded_bytes;
                let total = progress.total_bytes;

                tokio::spawn(async move {
                    let active = active_ref_inner.lock().await;
                    if let Some(at) = active.get(&task_id_inner) {
                        if let Some(handle) = at.chunk_handles.first() {
                            handle.downloaded.store(downloaded, Ordering::Relaxed);
                            if total > 0 {
                                // dynamically update total if we now know it
                            }
                        }
                    }
                });
            },
        )
        .await?;

        {
            let conn = db.conn();
            let _ = tasks::update_task_progress(&conn, &task.id, task.total_bytes);
        }

        Ok(())
    }

    pub async fn pause_tasks(&self, ids: &[String]) {
        let active = self.active_tasks.lock().await;
        for id in ids {
            if let Some(task) = active.get(id) {
                task.cancel_token.cancel();
            }
            let conn = self.db.conn();
            let _ = tasks::update_task_status(&conn, id, "paused", None);
        }
    }

    pub async fn resume_tasks(&self, ids: &[String]) {
        for id in ids {
            let conn = self.db.conn();
            let _ = tasks::update_task_status(&conn, id, "queued", None);
        }
    }

    pub async fn cancel_tasks(&self, ids: &[String]) {
        let active = self.active_tasks.lock().await;
        for id in ids {
            if let Some(task) = active.get(id) {
                task.cancel_token.cancel();
            }
        }
        drop(active);

        for id in ids {
            let chunk_paths: Vec<String>;
            let parts_dir: String;
            {
                let conn = self.db.conn();
                let task_chunks = chunks::get_chunks_for_task(&conn, id).unwrap_or_default();
                chunk_paths = task_chunks.iter().map(|c| c.temp_path.clone()).collect();

                if let Ok(Some(task_row)) = conn
                    .prepare("SELECT filename, save_path FROM tasks WHERE id = ?1")
                    .and_then(|mut s| {
                        s.query_row(rusqlite::params![id], |row| {
                            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                        })
                        .map(Some)
                    })
                {
                    parts_dir = PathBuf::from(&task_row.1)
                        .join(format!(".{}.parts", task_row.0))
                        .to_string_lossy()
                        .to_string();
                } else {
                    parts_dir = String::new();
                }

                let _ = tasks::update_task_status(&conn, id, "error", Some("Cancelled by user"));
            }

            stitcher::cleanup_parts(&chunk_paths, Some(&parts_dir)).await;
        }
    }
}
