-- Manual login is attested by the owner after reviewing an owned inbox message.
CREATE TABLE IF NOT EXISTS am_login_confirmations (
  workflow_id TEXT PRIMARY KEY REFERENCES am_workflows(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL REFERENCES am_messages(id) ON DELETE CASCADE,
  confirmed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS am_login_confirmations_account ON am_login_confirmations(account_id);
