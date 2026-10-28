-- Version 20261028_02. Additive DDL reference. Use migrate_personalization.py for indexes and seeds.


CREATE TABLE IF NOT EXISTS personalization_profiles (
	user_id CHAR(36) NOT NULL, 
	preferences JSON NOT NULL, 
	step INTEGER NOT NULL, 
	revision INTEGER NOT NULL, 
	completed_at DATETIME, 
	updated_at DATETIME NOT NULL, 
	PRIMARY KEY (user_id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS wellness_measurements (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	kind VARCHAR(20) NOT NULL, 
	value FLOAT NOT NULL, 
	unit VARCHAR(12) NOT NULL, 
	canonical_value FLOAT NOT NULL, 
	recorded_at DATETIME NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS activity_plans (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	week_start VARCHAR(10) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	snapshot JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS plan_activities (
	id CHAR(36) NOT NULL, 
	plan_id CHAR(36) NOT NULL, 
	template_id VARCHAR(40) NOT NULL, 
	scheduled_day VARCHAR(10) NOT NULL, 
	minutes INTEGER NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	feedback VARCHAR(20), 
	completed_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(plan_id) REFERENCES activity_plans (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS recommendation_history (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	plan_id CHAR(36) NOT NULL, 
	explanation JSON NOT NULL, 
	created_at DATETIME NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(plan_id) REFERENCES activity_plans (id) ON DELETE CASCADE
)

;


CREATE TABLE IF NOT EXISTS reminder_deliveries (
	id CHAR(36) NOT NULL, 
	user_id CHAR(36) NOT NULL, 
	category VARCHAR(20) NOT NULL, 
	local_day VARCHAR(10) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	snoozed_until DATETIME, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_reminder_category_day UNIQUE (user_id, category, local_day), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
)

;