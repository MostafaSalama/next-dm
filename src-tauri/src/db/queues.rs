use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueueRow {
    pub id: String,
    pub name: String,
    pub save_path: String,
    pub max_concurrent: i64,
    pub speed_limit: i64,
    pub sort_order: i64,
    pub created_at: String,
}

pub fn insert_queue(conn: &Connection, queue: &QueueRow) -> Result<(), rusqlite::Error> {
    conn.execute(
        "INSERT INTO queues (id, name, save_path, max_concurrent, speed_limit, sort_order, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![queue.id, queue.name, queue.save_path, queue.max_concurrent, queue.speed_limit, queue.sort_order, queue.created_at],
    )?;
    Ok(())
}

pub fn get_all_queues(conn: &Connection) -> Result<Vec<QueueRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, save_path, max_concurrent, speed_limit, sort_order, created_at FROM queues ORDER BY sort_order ASC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(QueueRow {
            id: row.get(0)?,
            name: row.get(1)?,
            save_path: row.get(2)?,
            max_concurrent: row.get(3)?,
            speed_limit: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn get_queue(conn: &Connection, id: &str) -> Result<Option<QueueRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, name, save_path, max_concurrent, speed_limit, sort_order, created_at FROM queues WHERE id = ?1"
    )?;
    let mut rows = stmt.query_map(params![id], |row| {
        Ok(QueueRow {
            id: row.get(0)?,
            name: row.get(1)?,
            save_path: row.get(2)?,
            max_concurrent: row.get(3)?,
            speed_limit: row.get(4)?,
            sort_order: row.get(5)?,
            created_at: row.get(6)?,
        })
    })?;
    match rows.next() {
        Some(row) => Ok(Some(row?)),
        None => Ok(None),
    }
}

pub fn ensure_default_queue(conn: &Connection, default_save_path: &str) -> Result<String, rusqlite::Error> {
    let existing = get_all_queues(conn)?;
    if !existing.is_empty() {
        return Ok(existing[0].id.clone());
    }
    let id = uuid::Uuid::new_v4().to_string();
    let queue = QueueRow {
        id: id.clone(),
        name: "Default".to_string(),
        save_path: default_save_path.to_string(),
        max_concurrent: 0,
        speed_limit: 0,
        sort_order: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    insert_queue(conn, &queue)?;
    Ok(id)
}
