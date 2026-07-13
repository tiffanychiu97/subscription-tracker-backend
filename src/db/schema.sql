CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cost REAL NOT NULL,
  billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('weekly', 'monthly', 'yearly')),
  category TEXT NOT NULL,
  next_renewal_date TEXT NOT NULL,
  start_date TEXT NOT NULL,
  is_rarely_used INTEGER DEFAULT 0
);