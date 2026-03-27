pub mod chunk_manager;
pub mod governor;
pub mod stitcher;
pub mod video_downloader;
pub mod worker_pool;

use crate::db::Database;
use governor::SpeedGovernor;
use std::sync::Arc;
use worker_pool::WorkerPool;

pub struct DownloadEngine {
    pub pool: Arc<WorkerPool>,
    pub governor: Arc<SpeedGovernor>,
}

impl DownloadEngine {
    pub fn new(
        db: Database,
        app_handle: tauri::AppHandle,
        max_concurrent: usize,
        global_speed_limit: u64,
    ) -> Self {
        let governor = SpeedGovernor::new(global_speed_limit);
        let pool = Arc::new(WorkerPool::new(db, app_handle, max_concurrent, governor.clone()));
        pool.clone().start();
        Self { pool, governor }
    }
}
