-- Run once on existing production installations before deploying the workspace API.
CREATE TABLE IF NOT EXISTS user_workspaces (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    entries JSON NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
