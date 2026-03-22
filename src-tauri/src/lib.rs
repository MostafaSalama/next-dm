mod commands;
mod db;
mod engine;
mod services;
mod state;

use db::Database;
use engine::DownloadEngine;
use state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // System tray
            let show = MenuItem::with_id(app, "show", "Show / Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            TrayIconBuilder::new()
                .tooltip("Next DM")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Database
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let database =
                Database::init(app_data_dir).expect("failed to initialize database");

            // Read max_concurrent from settings
            let max_concurrent = {
                let conn = database.conn();
                db::settings::get_setting_i64(&conn, "max_concurrent", 5) as usize
            };

            // Download engine
            let engine_handle = app.handle().clone();
            let engine = DownloadEngine::new(database.clone(), engine_handle, max_concurrent);

            // Event emitter
            let emitter_handle = app.handle().clone();
            services::events::start_event_emitter(emitter_handle, engine.pool.clone());

            // Shared state
            app.manage(AppState {
                db: database,
                engine,
            });

            // Reset any tasks stuck as "downloading" from a previous crash
            {
                let state: tauri::State<AppState> = app.state();
                let conn = state.db.conn();
                let _ = conn.execute(
                    "UPDATE tasks SET status = 'queued' WHERE status = 'downloading'",
                    [],
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::preflight::preflight_check,
            commands::tasks::create_tasks,
            commands::tasks::get_all_tasks,
            commands::tasks::pause_tasks,
            commands::tasks::resume_tasks,
            commands::tasks::cancel_tasks,
            commands::tasks::delete_tasks,
            commands::tasks::get_all_queues,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
