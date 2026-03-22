use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRow {
    pub id: String,
    pub url: String,
    pub filename: String,
    pub original_name: String,
    pub save_path: String,
    pub status: String,
    pub total_bytes: i64,
    pub downloaded_bytes: i64,
    pub queue_id: String,
    pub priority: i64,
    pub tags: String,
    pub config: String,
    pub error_message: Option<String>,
    pub retry_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub fn insert_task(conn: &Connection, task: &TaskRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO tasks (id, url, filename, original_name, save_path, status, total_bytes, downloaded_bytes, queue_id, priority, tags, config, error_message, retry_count, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
        params![
            task.id, task.url, task.filename, task.original_name, task.save_path,
            task.status, task.total_bytes, task.downloaded_bytes, task.queue_id,
            task.priority, task.tags, task.config, task.error_message,
            task.retry_count, task.created_at, task.updated_at,
        ],
    )?;
    Ok(())
}

pub fn get_all_tasks(conn: &Connection) -> Result<Vec<TaskRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, url, filename, original_name, save_path, status, total_bytes, downloaded_bytes, queue_id, priority, tags, config, error_message, retry_count, created_at, updated_at FROM tasks ORDER BY created_at DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TaskRow {
            id: row.get(0)?,
            url: row.get(1)?,
            filename: row.get(2)?,
            original_name: row.get(3)?,
            save_path: row.get(4)?,
            status: row.get(5)?,
            total_bytes: row.get(6)?,
            downloaded_bytes: row.get(7)?,
            queue_id: row.get(8)?,
            priority: row.get(9)?,
            tags: row.get(10)?,
            config: row.get(11)?,
            error_message: row.get(12)?,
            retry_count: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;
    rows.collect()
}

pub fn get_queued_tasks(conn: &Connection, limit: usize) -> Result<Vec<TaskRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, url, filename, original_name, save_path, status, total_bytes, downloaded_bytes, queue_id, priority, tags, config, error_message, retry_count, created_at, updated_at FROM tasks WHERE status = 'queued' ORDER BY priority ASC, created_at ASC LIMIT ?1"
    )?;
    let rows = stmt.query_map(params![limit as i64], |row| {
        Ok(TaskRow {
            id: row.get(0)?,
            url: row.get(1)?,
            filename: row.get(2)?,
            original_name: row.get(3)?,
            save_path: row.get(4)?,
            status: row.get(5)?,
            total_bytes: row.get(6)?,
            downloaded_bytes: row.get(7)?,
            queue_id: row.get(8)?,
            priority: row.get(9)?,
            tags: row.get(10)?,
            config: row.get(11)?,
            error_message: row.get(12)?,
            retry_count: row.get(13)?,
            created_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;
    rows.collect()
}

pub fn update_task_status(
    conn: &Connection,
    id: &str,
    status: &str,
    error_message: Option<&str>,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE tasks SET status = ?1, error_message = ?2, updated_at = datetime('now') WHERE id = ?3",
        params![status, error_message, id],
    )?;
    Ok(())
}

pub fn update_task_progress(
    conn: &Connection,
    id: &str,
    downloaded_bytes: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE tasks SET downloaded_bytes = ?1, updated_at = datetime('now') WHERE id = ?2",
        params![downloaded_bytes, id],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM chunks WHERE task_id = ?1", params![id])?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(())
}
