PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('passenger','captain','admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','suspended','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  UNIQUE(email, role),
  UNIQUE(phone, role)
);

CREATE TABLE IF NOT EXISTS captain_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wallet_provider TEXT CHECK(wallet_provider IN ('vodafone_cash','orange_cash') OR wallet_provider IS NULL),
  wallet_number TEXT,
  wallet_owner_name TEXT,
  instapay_address TEXT,
  instapay_owner_name TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  vehicle_plate TEXT,
  vehicle_color TEXT,
  profile_photo_data BLOB,
  profile_photo_mime TEXT,
  profile_photo_status TEXT NOT NULL DEFAULT 'pending' CHECK(profile_photo_status IN ('pending','approved','rejected')),
  availability TEXT NOT NULL DEFAULT 'offline' CHECK(availability IN ('online','offline')),
  approved_at TEXT
);

CREATE TABLE IF NOT EXISTS captain_documents (
  id TEXT PRIMARY KEY,
  captain_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK(document_type IN ('national_id','driving_license','vehicle_license')),
  side TEXT NOT NULL CHECK(side IN ('front','back')),
  object_key TEXT,
  file_data BLOB,
  mime_type TEXT,
  file_size INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fixed_routes (
  id TEXT PRIMARY KEY,
  route_name TEXT NOT NULL,
  price_piasters INTEGER NOT NULL CHECK(price_piasters >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES users(id),
  captain_id TEXT REFERENCES users(id),
  route_type TEXT NOT NULL CHECK(route_type IN ('negotiated','fixed')),
  fixed_route_id TEXT REFERENCES fixed_routes(id),
  pickup_label TEXT,
  destination_label TEXT,
  agreed_price_piasters INTEGER NOT NULL CHECK(agreed_price_piasters BETWEEN 2500 AND 5500 OR route_type = 'fixed'),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','vodafone_cash','orange_cash','instapay')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','negotiating','accepted','in_progress','completed','cancelled','expired')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS ride_offers (
  id TEXT PRIMARY KEY,
  ride_id TEXT NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  captain_id TEXT NOT NULL REFERENCES users(id),
  price_piasters INTEGER NOT NULL CHECK(price_piasters BETWEEN 2500 AND 5500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','withdrawn')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(ride_id, captain_id, status)
);

CREATE TABLE IF NOT EXISTS ride_ledger (
  id TEXT PRIMARY KEY,
  ride_id TEXT NOT NULL UNIQUE REFERENCES rides(id),
  captain_id TEXT NOT NULL REFERENCES users(id),
  amount_piasters INTEGER NOT NULL CHECK(amount_piasters >= 0),
  payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','vodafone_cash','orange_cash','instapay')),
  local_service_date TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
CREATE INDEX IF NOT EXISTS idx_rides_passenger_date ON rides(passenger_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_captain_date ON rides(captain_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_ledger_captain_day ON ride_ledger(captain_id, local_service_date);
CREATE INDEX IF NOT EXISTS idx_offers_ride_status ON ride_offers(ride_id, status);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_secret TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS telegram_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL UNIQUE,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS password_recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON password_recovery_codes(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  admin_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_captain_document_slot ON captain_documents(captain_id, document_type, side);
CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);

-- Captain subscription system. Trial starts at signup; work access still requires admin approval.
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_dedupe ON user_notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON user_notifications(user_id,created_at DESC);

INSERT OR IGNORE INTO app_settings(setting_key,setting_value) VALUES
 ('captain_monthly_fee_piasters','10000'),
 ('captain_trial_enabled','1'),
 ('captain_trial_months','3'),
 ('captain_subscription_wallet_number',''),
 ('captain_subscription_wallet_provider',''),
 ('captain_subscription_instapay',''),
 ('captain_subscription_payment_note','حوّل قيمة الاشتراك ثم تواصل مع الإدارة لتأكيد التجديد.'),
 ('captain_subscription_currency','EGP');
INSERT OR IGNORE INTO subscription_offers(id,title,trial_months,active) VALUES
 ('launch-three-months','عرض الإطلاق: 3 شهور مجانية',3,1);
