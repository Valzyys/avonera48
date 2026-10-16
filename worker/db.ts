/**
 * D1 schema for the shop, memberships, linked accounts and the room's comments. Created on
 * first use (IF NOT EXISTS), so a fresh database needs no migration step.
 */

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS products (
    show_slug TEXT PRIMARY KEY,
    price INTEGER,
    on_sale INTEGER NOT NULL DEFAULT 1,
    stream_slug TEXT,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    stock INTEGER,
    sold INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vouchers (
    code TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    value INTEGER NOT NULL,
    applies_to TEXT NOT NULL DEFAULT 'all',
    max_uses INTEGER,
    used INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    kind TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_title TEXT NOT NULL,
    base_amount INTEGER NOT NULL,
    discount INTEGER NOT NULL DEFAULT 0,
    voucher TEXT,
    amount INTEGER NOT NULL,
    pay_amount INTEGER,
    status TEXT NOT NULL,
    trx_id TEXT,
    pay_token TEXT,
    qr_image TEXT,
    payment_url TEXT,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    checked_at INTEGER NOT NULL DEFAULT 0,
    released INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS orders_user ON orders (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS orders_status ON orders (status, created_at)`,
  `CREATE TABLE IF NOT EXISTS tickets (
    user_id TEXT NOT NULL,
    show_slug TEXT NOT NULL,
    order_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, show_slug)
  )`,
  `CREATE TABLE IF NOT EXISTS memberships (
    user_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    show TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS comments_show ON comments (show, id)`,
  `CREATE TABLE IF NOT EXISTS account_links (
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    ext_email TEXT NOT NULL DEFAULT '',
    ext_name TEXT NOT NULL DEFAULT '',
    ext_avatar TEXT,
    plan_id TEXT,
    plan_name TEXT,
    plan_expires_at TEXT,
    linked_at TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    PRIMARY KEY (user_id, provider),
    UNIQUE (provider, external_id)
  )`,
  `CREATE TABLE IF NOT EXISTS account_flags (
    user_id TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    admin INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`,
];

/** Columns added after a table first shipped; "duplicate column" means already done. */
const MIGRATIONS = [`ALTER TABLE comments ADD COLUMN verified INTEGER NOT NULL DEFAULT 0`];

async function migrate(db: D1Database) {
  for (const sql of MIGRATIONS) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      if (!/duplicate column/i.test(String(e))) throw e;
    }
  }
}

/**
 * Starting prices, written once into a fresh database (admins change them
 * afterwards): a show ticket is Rp 5.000; memberships are weekly, monthly
 * and yearly.
 */
export const DEFAULT_TICKET_PRICE = 5000;
export const DEFAULT_PLANS = [
  { id: "weekly", name: "Weekly", description: "Every show for 7 days.", price: 10000, duration_days: 7, sort: 1 },
  { id: "monthly", name: "Monthly", description: "Every show for 30 days.", price: 20000, duration_days: 30, sort: 2 },
  { id: "yearly", name: "Yearly", description: "Every show for a whole year.", price: 120000, duration_days: 365, sort: 3 },
];

async function seed(db: D1Database) {
  const done = await db.prepare("SELECT value FROM settings WHERE key = 'seeded'").first();
  if (done) return;
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('ticket_price', ?)").bind(String(DEFAULT_TICKET_PRICE)),
    ...DEFAULT_PLANS.map((p) =>
      db
        .prepare("INSERT OR IGNORE INTO plans (id, name, description, price, duration_days, stock, active, sort, created_at) VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)")
        .bind(p.id, p.name, p.description, p.price, p.duration_days, p.sort, now),
    ),
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('seeded', '1')"),
  ]);
}

let ready: Promise<void> | null = null;

/** Creates the tables (and the starting prices) once per isolate. */
export function ensureSchema(db: D1Database) {
  ready ??= db
    .batch(SCHEMA.map((s) => db.prepare(s)))
    .then(() => migrate(db))
    .then(() => seed(db))
    .then(
      () => undefined,
      (e) => {
        ready = null;
        throw e;
      },
    );
  return ready;
}

export async function getSetting(db: D1Database, key: string) {
  return (await db.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<{ value: string }>())?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string) {
  await db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}
