-- Additive migration; never drops or alters existing journal data.
CREATE TABLE IF NOT EXISTS adventure_profiles (
 user_id CHAR(36) PRIMARY KEY, timezone VARCHAR(80) NOT NULL DEFAULT 'UTC', created_at DATETIME NOT NULL,
 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reward_events (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, reward_key VARCHAR(100) NOT NULL,
 kind VARCHAR(30) NOT NULL, local_day VARCHAR(10) NOT NULL, xp INT NOT NULL, created_at DATETIME NOT NULL,
 UNIQUE KEY uq_reward_user_key(user_id,reward_key), INDEX ix_reward_events_user_id(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS adventure_meals (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, local_day VARCHAR(10) NOT NULL,
 snapshot JSON NOT NULL, created_at DATETIME NOT NULL, INDEX ix_adventure_meals_user_id(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS game_sessions (
 id CHAR(36) PRIMARY KEY, user_id CHAR(36) NOT NULL, challenge JSON NOT NULL, expires_at DATETIME NOT NULL,
 completed BOOLEAN NOT NULL DEFAULT FALSE, attempts INT NOT NULL DEFAULT 0, INDEX ix_game_sessions_user_id(user_id),
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
