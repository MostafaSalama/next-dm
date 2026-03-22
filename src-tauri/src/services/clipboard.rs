use crate::db::{settings, Database};
use regex::Regex;
use std::collections::HashMap;
use std::time::Instant;

const POLL_INTERVAL_MS: u64 = 500;
const DEDUP_TTL_SECS: u64 = 30;
const DEDUP_MAX_ENTRIES: usize = 100;

pub fn start_clipboard_monitor(app_handle: tauri::AppHandle, db: Database) {
    std::thread::spawn(move || {
        let url_re = Regex::new(r"https?://[^\s]+").unwrap();
        let mut seen: HashMap<String, Instant> = HashMap::new();
        let mut last_text = String::new();

        let mut clipboard = match arboard::Clipboard::new() {
            Ok(cb) => cb,
            Err(e) => {
                log::error!("Failed to init clipboard: {}", e);
                return;
            }
        };

        loop {
            std::thread::sleep(std::time::Duration::from_millis(POLL_INTERVAL_MS));

            let enabled = {
                let conn = db.conn();
                settings::get_setting(&conn, "clipboard_enabled")
                    .ok()
                    .flatten()
                    .map(|v| v != "false")
                    .unwrap_or(true)
            };

            if !enabled {
                continue;
            }

            let text = match clipboard.get_text() {
                Ok(t) => t,
                Err(_) => continue,
            };

            if text == last_text {
                continue;
            }
            last_text = text.clone();

            let now = Instant::now();
            seen.retain(|_, ts| now.duration_since(*ts).as_secs() < DEDUP_TTL_SECS);
            if seen.len() > DEDUP_MAX_ENTRIES {
                if let Some(oldest_key) = seen
                    .iter()
                    .min_by_key(|(_, ts)| *ts)
                    .map(|(k, _)| k.clone())
                {
                    seen.remove(&oldest_key);
                }
            }

            for mat in url_re.find_iter(&text) {
                let url = mat.as_str().to_string();
                if seen.contains_key(&url) {
                    continue;
                }
                seen.insert(url.clone(), now);

                let _ = tauri::Emitter::emit(
                    &app_handle,
                    "clipboard_url_detected",
                    serde_json::json!({ "url": url }),
                );
            }
        }
    });
}
