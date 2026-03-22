use crate::db::settings;
use crate::state::AppState;
use std::collections::HashMap;

#[tauri::command]
pub async fn get_all_settings(
    state: tauri::State<'_, AppState>,
) -> Result<HashMap<String, String>, String> {
    let conn = state.db.conn();
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?;

    let mut map = HashMap::new();
    for row in rows {
        let (key, value) = row.map_err(|e| e.to_string())?;
        map.insert(key, value);
    }
    Ok(map)
}

#[tauri::command]
pub async fn update_setting(
    state: tauri::State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.db.conn();
    settings::set_setting(&conn, &key, &value).map_err(|e| e.to_string())?;

    if key == "global_speed_limit" {
        let bps: u64 = value.parse().unwrap_or(0);
        state.engine.governor.set_limit(bps);
    }

    Ok(())
}
