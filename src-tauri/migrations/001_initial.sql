CREATE TABLE IF NOT EXISTS queues (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    save_path   TEXT NOT NULL DEFAULT '',
    max_concurrent INTEGER NOT NULL DEFAULT 0,
    speed_limit INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    url             TEXT NOT NULL,
    filename        TEXT NOT NULL,
    original_name   TEXT NOT NULL DEFAULT '',
    save_path       TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    total_bytes     INTEGER NOT NULL DEFAULT 0,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    queue_id        TEXT NOT NULL,
    priority        INTEGER NOT NULL DEFAULT 0,
    tags            TEXT NOT NULL DEFAULT '[]',
    config          TEXT NOT NULL DEFAULT '{}',
    error_message   TEXT,
    retry_count     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (queue_id) REFERENCES queues(id)
);

CREATE TABLE IF NOT EXISTS chunks (
    id              TEXT PRIMARY KEY,
    task_id         TEXT NOT NULL,
    chunk_index     INTEGER NOT NULL,
    start_byte      INTEGER NOT NULL,
    end_byte        INTEGER NOT NULL,
    downloaded_bytes INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    temp_path       TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', '"dark"'),
    ('custom_theme', '{}'),
    ('default_save_path', '""'),
    ('clipboard_enabled', 'true'),
    ('global_speed_limit', '0'),
    ('max_concurrent', '5'),
    ('default_chunks', '8'),
    ('retry_count', '3'),
    ('launch_on_boot', 'false'),
    ('minimize_to_tray', 'true'),
    ('chunk_threshold_bytes', '1048576');
