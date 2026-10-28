CREATE TABLE IF NOT EXISTS account_action_tokens (
  digest VARCHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  purpose VARCHAR(20) NOT NULL,
  credential VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  INDEX ix_account_action_tokens_user_id(user_id),
  INDEX ix_account_action_tokens_expires_at(expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS rate_buckets (
  `key` VARCHAR(64) PRIMARY KEY,
  hits INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  INDEX ix_rate_buckets_expires_at(expires_at)
) CHARACTER SET utf8mb4;
