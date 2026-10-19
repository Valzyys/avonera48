-- Additive migration; existing Avonera48 tables remain untouched.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS am_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT UNIQUE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('creating','ready','failed','deleted')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS am_accounts_user_created ON am_accounts(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS am_accounts_user_status ON am_accounts(user_id, status);
CREATE TABLE IF NOT EXISTS am_messages (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,
  provider_message_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL DEFAULT '',
  received_at TEXT,
  UNIQUE(account_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS am_messages_account_received ON am_messages(account_id, received_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS am_workflows (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK(status IN ('awaiting_email','awaiting_approval','running','verified','completed','failed','uncertain')),
  current_step TEXT NOT NULL,
  error_message TEXT,
  provider_receipt TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS am_workflows_account_created ON am_workflows(account_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS am_workflow_one_running ON am_workflows(account_id) WHERE status = 'running';
CREATE TABLE IF NOT EXISTS am_activity_logs (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS am_activity_account_created ON am_activity_logs(account_id, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS am_rate_limits (
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL CHECK(hits > 0),
  PRIMARY KEY(user_id, action, window_start)
);
