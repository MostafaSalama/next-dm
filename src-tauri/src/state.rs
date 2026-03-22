use crate::db::Database;
use crate::engine::DownloadEngine;

pub struct AppState {
    pub db: Database,
    pub engine: DownloadEngine,
}
