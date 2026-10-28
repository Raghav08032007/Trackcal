-- Additive DDL reference; run migrate_wellness.py for indexes/seed definitions.


CREATE TABLE IF NOT EXISTS food_aliases (
	id CHAR(36) NOT NULL, 
	food_id CHAR(36) NOT NULL, 
	alias VARCHAR(120) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_food_alias UNIQUE (food_id, alias), 
	FOREIGN KEY(food_id) REFERENCES foods (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS food_favorites (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	food_key VARCHAR(120) NOT NULL, 
	snapshot JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_food_favorite_owner UNIQUE (user_id, food_key), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS food_search_history (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	query VARCHAR(100) NOT NULL, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_food_search_owner UNIQUE (user_id, query), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS workout_blueprints (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	exercises JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS workout_sessions (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	plan_activity_id CHAR(36), 
	name VARCHAR(120) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	details JSON NOT NULL, 
	revision INTEGER NOT NULL, 
	active_seconds INTEGER NOT NULL, 
	recorded_minutes FLOAT NOT NULL, 
	started_at DATETIME NOT NULL, 
	running_since DATETIME, 
	completed_at DATETIME, 
	is_deleted BOOL NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	UNIQUE (plan_activity_id), 
	FOREIGN KEY(plan_activity_id) REFERENCES plan_activities (id) ON DELETE SET NULL
)

;