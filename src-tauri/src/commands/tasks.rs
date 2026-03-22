use crate::db::{chunks, settings, tasks};
use crate::engine::chunk_manager;
use crate::state::AppState;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    pub url: String,
    pub filename: String,
    pub original_name: String,
    pub save_path: String,
    pub total_bytes: i64,
    pub supports_range: bool,
    pub queue_id: String,
    pub tags: Vec<String>,
    pub config: serde_json::Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskWithChunks {
    #[serde(flatten)]
    pub task: tasks::TaskRow,
    pub chunks: Vec<chunks::ChunkRow>,
    pub speed_bps: u64,
    pub eta_seconds: f64,
}

#[tauri::command]
pub async fn create_tasks(
    state: tauri::State<'_, AppState>,
    input: Vec<CreateTaskInput>,
) -> Result<Vec<String>, String> {
    let mut ids = Vec::new();
    let conn = state.db.conn();

    let num_chunks = settings::get_setting_i64(&conn, "default_chunks", 8);
    let threshold = settings::get_setting_i64(&conn, "chunk_threshold_bytes", 1048576);

    for item in &input {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let task_row = tasks::TaskRow {
            id: id.clone(),
            url: item.url.clone(),
            filename: item.filename.clone(),
            original_name: item.original_name.clone(),
            save_path: item.save_path.clone(),
            status: "queued".to_string(),
            total_bytes: item.total_bytes,
            downloaded_bytes: 0,
            queue_id: item.queue_id.clone(),
            priority: 0,
            tags: serde_json::to_string(&item.tags).unwrap_or_else(|_| "[]".to_string()),
            config: serde_json::to_string(&item.config).unwrap_or_else(|_| "{}".to_string()),
            error_message: None,
            retry_count: 0,
            created_at: now.clone(),
            updated_at: now,
        };

        tasks::insert_task(&conn, &task_row).map_err(|e| e.to_string())?;

        let planned_chunks = chunk_manager::plan_chunks(
            &id,
            item.total_bytes,
            item.supports_range,
            num_chunks,
            &item.save_path,
            &item.filename,
            threshold,
        );

        chunks::insert_chunks(&conn, &planned_chunks).map_err(|e| e.to_string())?;

        ids.push(id);
    }

    Ok(ids)
}

#[tauri::command]
pub async fn get_all_tasks(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<TaskWithChunks>, String> {
    let conn = state.db.conn();
    let all_tasks = tasks::get_all_tasks(&conn).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for task in all_tasks {
        let task_chunks =
            chunks::get_chunks_for_task(&conn, &task.id).map_err(|e| e.to_string())?;
        result.push(TaskWithChunks {
            task,
            chunks: task_chunks,
            speed_bps: 0,
            eta_seconds: 0.0,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn pause_tasks(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    state.engine.pool.pause_tasks(&ids).await;
    Ok(())
}

#[tauri::command]
pub async fn resume_tasks(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    state.engine.pool.resume_tasks(&ids).await;
    Ok(())
}

#[tauri::command]
pub async fn cancel_tasks(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    state.engine.pool.cancel_tasks(&ids).await;
    Ok(())
}

#[tauri::command]
pub async fn delete_tasks(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    state.engine.pool.cancel_tasks(&ids).await;
    let conn = state.db.conn();
    for id in &ids {
        tasks::delete_task(&conn, id).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_all_queues(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<crate::db::queues::QueueRow>, String> {
    let conn = state.db.conn();
    crate::db::queues::get_all_queues(&conn).map_err(|e| e.to_string())
}
