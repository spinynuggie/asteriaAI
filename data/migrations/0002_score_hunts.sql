CREATE TABLE IF NOT EXISTS score_hunt_settings (
    guild_id TEXT PRIMARY KEY,
    duration_seconds INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS score_hunts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    started_by_discord_user_id TEXT NOT NULL,
    seed_score_id INTEGER,
    seed_user_id INTEGER,
    seed_total_score INTEGER,
    beatmap_id INTEGER,
    mode TEXT,
    mods_int INTEGER,
    mods_text TEXT,
    channel_id TEXT,
    announcement_message_id TEXT,
    winning_score_id INTEGER,
    winning_user_id INTEGER,
    started_at TEXT,
    ends_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS score_hunt_candidates (
    hunt_id INTEGER NOT NULL,
    score_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hunt_id, score_id),
    FOREIGN KEY (hunt_id) REFERENCES score_hunts (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_score_hunts_status ON score_hunts (status);
CREATE INDEX IF NOT EXISTS idx_score_hunt_candidates_hunt_id ON score_hunt_candidates (hunt_id);