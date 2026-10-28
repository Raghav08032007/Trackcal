-- 20261028: additive gamification foundation. Run seed via migrate_gamification.py.
-- Existing XP ledger and profiles are deliberately reused.


CREATE TABLE IF NOT EXISTS gamification_rules (
	`key` VARCHAR(50) NOT NULL, 
	version INTEGER NOT NULL, 
	enabled BOOL NOT NULL, 
	xp INTEGER NOT NULL, 
	daily_cap INTEGER NOT NULL, 
	settings JSON NOT NULL, 
	PRIMARY KEY (`key`)
)

;


CREATE TABLE IF NOT EXISTS activity_reward_events (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	category VARCHAR(50) NOT NULL, 
	source_id VARCHAR(100) NOT NULL, 
	local_day VARCHAR(10) NOT NULL, 
	rule_version INTEGER NOT NULL, 
	awarded_xp INTEGER NOT NULL, 
	payload JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_activity_reward_source UNIQUE (user_id, category, source_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS achievements (
	code VARCHAR(50) NOT NULL, 
	title VARCHAR(100) NOT NULL, 
	metric VARCHAR(40) NOT NULL, 
	threshold INTEGER NOT NULL, 
	enabled BOOL NOT NULL, 
	PRIMARY KEY (code)
)

;


CREATE TABLE IF NOT EXISTS user_achievements (
	user_id CHAR(36) NOT NULL, 
	code VARCHAR(50) NOT NULL, 
	unlocked_at DATETIME NOT NULL, 
	PRIMARY KEY (user_id, code), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(code) REFERENCES achievements (code)
)

;


CREATE TABLE IF NOT EXISTS character_customizations (
	user_id CHAR(36) NOT NULL, 
	character_id VARCHAR(20) NOT NULL, 
	accessory VARCHAR(20) NOT NULL, 
	enabled BOOL NOT NULL, 
	minimized BOOL NOT NULL, 
	muted BOOL NOT NULL, 
	position VARCHAR(10) NOT NULL, 
	protection_enabled BOOL NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS character_unlocks (
	user_id CHAR(36) NOT NULL, 
	character_id VARCHAR(20) NOT NULL, 
	unlocked_at DATETIME NOT NULL, 
	PRIMARY KEY (user_id, character_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS streak_records (
	user_id CHAR(36) NOT NULL, 
	local_day VARCHAR(10) NOT NULL, 
	kind VARCHAR(12) NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (user_id, local_day), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;