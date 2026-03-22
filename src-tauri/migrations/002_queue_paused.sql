ALTER TABLE queues ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0;

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('clipboard_auto_add', 'false');
