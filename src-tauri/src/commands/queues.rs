use crate::db::{queues, settings, tasks};
use crate::state::AppState;

#[tauri::command]
pub async fn create_queue(
    state: tauri::State<'_, AppState>,
    name: String,
    save_path: String,
) -> Result<queues::QueueRow, String> {
    let conn = state.db.conn();
    let id = uuid::Uuid::new_v4().to_string();
    let max_sort = conn
        .query_row("SELECT COALESCE(MAX(sort_order), -1) FROM queues", [], |r| {
            r.get::<_, i64>(0)
        })
        .map_err(|e| e.to_string())?;

    let effective_path = if save_path.is_empty() {
        settings::get_setting(&conn, "default_save_path")
            .ok()
            .flatten()
            .filter(|s| !s.is_empty() && s != "\"\"")
            .unwrap_or_else(|| {
                dirs_next::download_dir()
                    .unwrap_or_else(|| std::env::temp_dir())
                    .to_string_lossy()
                    .to_string()
            })
    } else {
        save_path
    };

    let queue = queues::QueueRow {
        id: id.clone(),
        name,
        save_path: effective_path,
        max_concurrent: 0,
        speed_limit: 0,
        sort_order: max_sort + 1,
        is_paused: false,
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    queues::insert_queue(&conn, &queue).map_err(|e| e.to_string())?;
    Ok(queue)
}

#[tauri::command]
pub async fn update_queue(
    state: tauri::State<'_, AppState>,
    id: String,
    name: String,
    save_path: String,
    max_concurrent: i64,
    speed_limit: i64,
) -> Result<queues::QueueRow, String> {
    let conn = state.db.conn();
    queues::update_queue(&conn, &id, &name, &save_path, max_concurrent, speed_limit)
        .map_err(|e| e.to_string())?;
    queues::get_queue(&conn, &id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Queue not found".to_string())
}

#[tauri::command]
pub async fn delete_queue(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db.conn();
    let count = queues::queue_count(&conn).map_err(|e| e.to_string())?;
    if count <= 1 {
        return Err("Cannot delete the last queue".to_string());
    }

    let all = queues::get_all_queues(&conn).map_err(|e| e.to_string())?;
    let default_id = all
        .iter()
        .find(|q| q.id != id)
        .map(|q| q.id.clone())
        .ok_or_else(|| "No fallback queue available".to_string())?;

    queues::delete_queue(&conn, &id, &default_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn reorder_queues(
    state: tauri::State<'_, AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.db.conn();
    queues::reorder_queues(&conn, &ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn move_tasks_to_queue(
    state: tauri::State<'_, AppState>,
    task_ids: Vec<String>,
    queue_id: String,
) -> Result<(), String> {
    let conn = state.db.conn();
    tasks::move_tasks_to_queue(&conn, &task_ids, &queue_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_queue_paused(
    state: tauri::State<'_, AppState>,
    id: String,
    paused: bool,
) -> Result<(), String> {
    let conn = state.db.conn();
    queues::set_queue_paused(&conn, &id, paused).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_queue(
    state: tauri::State<'_, AppState>,
    id: String,
    completed_only: bool,
) -> Result<Vec<String>, String> {
    let ids = {
        let conn = state.db.conn();
        tasks::clear_queue_tasks(&conn, &id, completed_only).map_err(|e| e.to_string())?
    };
    if !completed_only {
        state.engine.pool.cancel_tasks(&ids).await;
    }
    Ok(ids)
}
