-- Error Management System - Database Schema
-- Run this file to initialize your PostgreSQL database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    VARCHAR(50)  UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role        VARCHAR(20)  NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHANNELS (for dynamic admin management)
-- ============================================================
CREATE TABLE IF NOT EXISTS channels (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(50) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO channels (name) VALUES
  ('Web'),
  ('Mobile'),
  ('API'),
  ('Backend'),
  ('Email'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- CATEGORIES (for dynamic admin management)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(50) UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO categories (name) VALUES
  ('UI Bug'),
  ('Server Error'),
  ('Database'),
  ('Performance'),
  ('Security'),
  ('Logic'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ERRORS
-- ============================================================
CREATE TABLE IF NOT EXISTS errors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title          VARCHAR(255) NOT NULL DEFAULT 'Untitled',
  error_details  TEXT        NOT NULL,
  channel        VARCHAR(50) NOT NULL DEFAULT 'Web',
  category       VARCHAR(50) NOT NULL DEFAULT 'UI Bug',
  resolution     VARCHAR(20) NOT NULL DEFAULT 'Open'
                   CHECK (resolution IN ('Open','In Progress','Resolved','Closed')),
  ticket         VARCHAR(255),
  created_by     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_to    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE errors ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT 'Untitled';

-- Full text search index
ALTER TABLE errors ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(error_details,'') || ' ' || coalesce(ticket,''))
  ) STORED;

CREATE INDEX IF NOT EXISTS errors_search_idx ON errors USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS errors_resolution_idx ON errors(resolution);
CREATE INDEX IF NOT EXISTS errors_channel_idx ON errors(channel);
CREATE INDEX IF NOT EXISTS errors_category_idx ON errors(category);
CREATE INDEX IF NOT EXISTS errors_created_at_idx ON errors(created_at DESC);

-- ============================================================
-- SCREENSHOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS screenshots (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_id     UUID NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  file_name    VARCHAR(255) NOT NULL,
  file_path    VARCHAR(500) NOT NULL,
  thumb_path   VARCHAR(500),
  mime_type    VARCHAR(100) NOT NULL,
  file_size    INTEGER,
  uploaded_by  UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS screenshots_error_id_idx ON screenshots(error_id);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  error_id    UUID NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_error_id_idx ON comments(error_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          VARCHAR(30) NOT NULL CHECK (type IN ('assignment','resolution_change','comment','mention')),
  reference_id  UUID,
  message       TEXT NOT NULL,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_read_at_idx ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   UUID,
  details     JSONB,
  ip_address  VARCHAR(45),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

-- ============================================================
-- TRIGGERS - auto update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'users_updated_at') THEN
    CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'errors_updated_at') THEN
    CREATE TRIGGER errors_updated_at BEFORE UPDATE ON errors
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'comments_updated_at') THEN
    CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- SEED: Default admin user  (password: Admin@123)
-- ============================================================
INSERT INTO users (username, email, password_hash, role)
VALUES (
  'admin',
  'admin@errormanagement.app',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY.5F.FqV3vZ7Gm',
  'admin'
) ON CONFLICT (email) DO NOTHING;
