-- Safe additive repair of missing objects in an existing Mishwark D1 database.
-- Uses IF NOT EXISTS, so existing data and already-created objects are preserved.
CREATE TABLE IF NOT EXISTS subscription_offers (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL,
 trial_months INTEGER NOT NULL CHECK(trial_months BETWEEN 0 AND 24),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 starts_at TEXT,
 ends_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS captain_subscriptions (
 captain_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('trial','active','expired','cancelled')),
 offer_id TEXT REFERENCES subscription_offers(id) ON DELETE SET NULL,
 trial_started_at TEXT,
 trial_ends_at TEXT,
 period_started_at TEXT,
 period_ends_at TEXT,
 monthly_fee_piasters INTEGER NOT NULL DEFAULT 10000 CHECK(monthly_fee_piasters >= 0),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS captain_restrictions (
 captain_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 reason TEXT,
 starts_at TEXT NOT NULL,
 ends_at TEXT NOT NULL,
 created_by TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS user_notifications (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 notification_type TEXT NOT NULL,
 title TEXT NOT NULL,
 message TEXT NOT NULL,
 dedupe_key TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 read_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_dedupe
 ON user_notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user
 ON user_notifications(user_id,created_at DESC);
INSERT OR IGNORE INTO app_settings(setting_key,setting_value) VALUES
 ('captain_monthly_fee_piasters','10000'),
 ('captain_trial_enabled','1'),
 ('captain_trial_months','3'),
 ('captain_subscription_wallet_number',''),
 ('captain_subscription_wallet_provider',''),
 ('captain_subscription_instapay',''),
 ('captain_subscription_payment_note','حوّل قيمة الاشتراك ثم تواصل مع الإدارة لتأكيد التجديد.'),
 ('captain_subscription_currency','EGP');
INSERT OR IGNORE INTO subscription_offers(id,title,trial_months,active)
 VALUES('launch-three-months','عرض الإطلاق: 3 شهور مجانية',3,1);
