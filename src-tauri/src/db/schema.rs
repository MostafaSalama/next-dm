use rusqlite::Connection;

const MIGRATION: &str = include_str!("../../migrations/001_initial.sql");

pub fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(MIGRATION)
}
