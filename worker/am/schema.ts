/** Additive first-use setup, matching the AM migrations. */
export const AM_SCHEMA: readonly string[] = [
  "CREATE TABLE IF NOT EXISTS am_accounts (\n  id TEXT PRIMARY KEY,\n  user_id TEXT NOT NULL,\n  email TEXT UNIQUE,\n  domain TEXT NOT NULL,\n  status TEXT NOT NULL CHECK(status IN ('creating','ready','failed','deleted')),\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS am_accounts_user_created ON am_accounts(user_id, created_at DESC, id DESC)",
  "CREATE INDEX IF NOT EXISTS am_accounts_user_status ON am_accounts(user_id, status)",
  "CREATE TABLE IF NOT EXISTS am_messages (\n  id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,\n  provider_message_id TEXT NOT NULL,\n  sender TEXT NOT NULL,\n  subject TEXT NOT NULL,\n  preview TEXT NOT NULL DEFAULT '',\n  received_at TEXT,\n  UNIQUE(account_id, provider_message_id)\n)",
  "CREATE INDEX IF NOT EXISTS am_messages_account_received ON am_messages(account_id, received_at DESC, id DESC)",
  "CREATE TABLE IF NOT EXISTS am_workflows (\n  id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,\n  status TEXT NOT NULL CHECK(status IN ('awaiting_email','awaiting_approval','running','verified','completed','failed','uncertain')),\n  current_step TEXT NOT NULL,\n  error_message TEXT,\n  provider_receipt TEXT,\n  created_at TEXT NOT NULL,\n  updated_at TEXT NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS am_workflows_account_created ON am_workflows(account_id, created_at DESC, id DESC)",
  "CREATE UNIQUE INDEX IF NOT EXISTS am_workflow_one_running ON am_workflows(account_id) WHERE status = 'running'",
  "CREATE TABLE IF NOT EXISTS am_activity_logs (\n  id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE,\n  action TEXT NOT NULL,\n  status TEXT NOT NULL,\n  created_at TEXT NOT NULL\n)",
  "CREATE INDEX IF NOT EXISTS am_activity_account_created ON am_activity_logs(account_id, created_at DESC, id DESC)",
  "CREATE TABLE IF NOT EXISTS am_rate_limits (\n  user_id TEXT NOT NULL,\n  action TEXT NOT NULL,\n  window_start INTEGER NOT NULL,\n  hits INTEGER NOT NULL CHECK(hits > 0),\n  PRIMARY KEY(user_id, action, window_start)\n)",
  "CREATE TABLE IF NOT EXISTS am_login_confirmations (workflow_id TEXT PRIMARY KEY REFERENCES am_workflows(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE, message_id TEXT NOT NULL REFERENCES am_messages(id) ON DELETE CASCADE, confirmed_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS am_login_confirmations_account ON am_login_confirmations(account_id)",
  "CREATE TABLE IF NOT EXISTS am_automatic_workflows (workflow_id TEXT PRIMARY KEY REFERENCES am_workflows(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES am_accounts(id) ON DELETE CASCADE, created_at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS am_automatic_workflows_account ON am_automatic_workflows(account_id)",
];

// Scope readiness to the binding, share concurrent initialization, retry failures.
const ready = new WeakMap<D1Database, Promise<void>>();
export function ensureAmSchema(db: D1Database): Promise<void> {
  let pending = ready.get(db);
  if (!pending) {
    pending = db
      .batch(AM_SCHEMA.map((sql) => db.prepare(sql)))
      .then(() => undefined)
      .catch((error: unknown) => {
        ready.delete(db);
        throw error;
      });
    ready.set(db, pending);
  }
  return pending;
}
