CREATE TABLE IF NOT EXISTS am_automatic_workflows (
  workflow_id TEXT PRIMARY KEY REFERENCES am_workflows(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS am_automatic_workflows_account ON am_automatic_workflows(account_id);
