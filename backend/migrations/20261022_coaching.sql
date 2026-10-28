CREATE TABLE IF NOT EXISTS coach_slots (
  id CHAR(36) PRIMARY KEY,
  coach_id CHAR(36) NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  reserved_booking_id CHAR(36) NULL,
  INDEX ix_coach_slots_coach_id(coach_id),
  INDEX ix_coach_slots_starts_at(starts_at),
  FOREIGN KEY(coach_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS coach_bookings (
  id CHAR(36) PRIMARY KEY,
  slot_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  created_at DATETIME NOT NULL,
  INDEX ix_coach_bookings_slot_id(slot_id),
  INDEX ix_coach_bookings_user_id(user_id),
  FOREIGN KEY(slot_id) REFERENCES coach_slots(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4;
