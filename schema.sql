-- Retail Engine v12 · Cloudflare D1 Schema
-- Run: wrangler d1 execute retail-engine-db --file=schema.sql

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK(role IN ('owner','manager','staff')),
  approved    INTEGER NOT NULL DEFAULT 1,
  pending     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  role        TEXT NOT NULL,
  expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  ean           TEXT NOT NULL,
  name          TEXT NOT NULL,
  base_price    REAL NOT NULL DEFAULT 0,
  discount_pct  REAL NOT NULL DEFAULT 0,
  shelf         TEXT DEFAULT '',
  valid_until   TEXT DEFAULT '',
  created_by    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_ean ON products(ean);

CREATE TABLE IF NOT EXISTS audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL DEFAULT (datetime('now')),
  username  TEXT NOT NULL,
  action    TEXT NOT NULL,
  detail    TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit(ts DESC);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed invite code (will be regenerated on first use)
INSERT OR IGNORE INTO settings(key, value) VALUES('invite_code', 'RE-INITIAL');
