use crate::db::Database;
use crate::engine::DownloadEngine;
use crate::services::binary_manager::BinaryManager;

pub struct AppState {
    pub db: Database,
    pub engine: DownloadEngine,
    pub binary_manager: BinaryManager,
}
