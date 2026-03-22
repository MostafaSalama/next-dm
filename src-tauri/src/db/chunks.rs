use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkRow {
    pub id: String,
    pub task_id: String,
    pub chunk_index: i64,
    pub start_byte: i64,
    pub end_byte: i64,
    pub downloaded_bytes: i64,
    pub status: String,
    pub temp_path: String,
}

pub fn insert_chunks(conn: &Connection, chunks: &[ChunkRow]) -> Result<(), rusqlite::Error> {
    let tx = conn.unchecked_transaction()?;
    for chunk in chunks {
        tx.execute(
            "INSERT INTO chunks (id, task_id, chunk_index, start_byte, end_byte, downloaded_bytes, status, temp_path) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![chunk.id, chunk.task_id, chunk.chunk_index, chunk.start_byte, chunk.end_byte, chunk.downloaded_bytes, chunk.status, chunk.temp_path],
        )?;
    }
    tx.commit()
}

pub fn get_chunks_for_task(conn: &Connection, task_id: &str) -> Result<Vec<ChunkRow>, rusqlite::Error> {
    let mut stmt = conn.prepare(
        "SELECT id, task_id, chunk_index, start_byte, end_byte, downloaded_bytes, status, temp_path FROM chunks WHERE task_id = ?1 ORDER BY chunk_index ASC"
    )?;
    let rows = stmt.query_map(params![task_id], |row| {
        Ok(ChunkRow {
            id: row.get(0)?,
            task_id: row.get(1)?,
            chunk_index: row.get(2)?,
            start_byte: row.get(3)?,
            end_byte: row.get(4)?,
            downloaded_bytes: row.get(5)?,
            status: row.get(6)?,
            temp_path: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn update_chunk_progress(
    conn: &Connection,
    id: &str,
    downloaded_bytes: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE chunks SET downloaded_bytes = ?1 WHERE id = ?2",
        params![downloaded_bytes, id],
    )?;
    Ok(())
}

pub fn update_chunk_status(
    conn: &Connection,
    id: &str,
    status: &str,
    downloaded_bytes: i64,
) -> Result<(), rusqlite::Error> {
    conn.execute(
        "UPDATE chunks SET status = ?1, downloaded_bytes = ?2 WHERE id = ?3",
        params![status, downloaded_bytes, id],
    )?;
    Ok(())
}

pub fn delete_chunks_for_task(conn: &Connection, task_id: &str) -> Result<(), rusqlite::Error> {
    conn.execute("DELETE FROM chunks WHERE task_id = ?1", params![task_id])?;
    Ok(())
}
