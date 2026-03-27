use rusqlite::Connection;

const MIGRATION_001: &str = include_str!("../../migrations/001_initial.sql");
const MIGRATION_002: &str = include_str!("../../migrations/002_queue_paused.sql");
const MIGRATION_003: &str = include_str!("../../migrations/003_task_archived.sql");
const MIGRATION_004: &str = include_str!("../../migrations/004_video_settings.sql");

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)",
    )?;

    let current: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    if current < 1 {
        conn.execute_batch(MIGRATION_001)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (1)", [])?;
    }

    if current < 2 {
        conn.execute_batch(MIGRATION_002)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (2)", [])?;
    }

    if current < 3 {
        conn.execute_batch(MIGRATION_003)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (3)", [])?;
    }

    if current < 4 {
        conn.execute_batch(MIGRATION_004)?;
        conn.execute("INSERT INTO _migrations (version) VALUES (4)", [])?;
    }

    Ok(())
}
