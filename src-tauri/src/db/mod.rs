pub mod chunks;
pub mod queues;
pub mod schema;
pub mod settings;
pub mod tasks;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    pub fn init(app_data_dir: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        std::fs::create_dir_all(&app_data_dir)?;
        let db_path = app_data_dir.join("nextdm.db");
        let conn = Connection::open(db_path)?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        schema::run_migrations(&conn)?;

        let downloads_dir = dirs_next::download_dir()
            .unwrap_or_else(|| app_data_dir.join("downloads"))
            .to_string_lossy()
            .to_string();

        let current_path = settings::get_setting(&conn, "default_save_path")?;
        let needs_init = match current_path.as_deref() {
            None | Some("") | Some("\"\"") => true,
            _ => false,
        };
        if needs_init {
            settings::set_setting(&conn, "default_save_path", &downloads_dir)?;
        }

        queues::ensure_default_queue(&conn, &downloads_dir)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn conn(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().expect("database lock poisoned")
    }
}
