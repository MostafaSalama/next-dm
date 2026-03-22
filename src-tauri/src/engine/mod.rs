pub mod chunk_manager;
pub mod stitcher;
pub mod worker_pool;

use crate::db::Database;
use std::sync::Arc;
use worker_pool::WorkerPool;

pub struct DownloadEngine {
    pub pool: Arc<WorkerPool>,
}

impl DownloadEngine {
    pub fn new(db: Database, app_handle: tauri::AppHandle, max_concurrent: usize) -> Self {
        let pool = Arc::new(WorkerPool::new(db, app_handle, max_concurrent));
        pool.clone().start();
        Self { pool }
    }
}
