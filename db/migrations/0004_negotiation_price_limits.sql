-- Negotiated ride prices are configured by admins within the agreed EGP 25–50 range.
INSERT OR IGNORE INTO app_settings(setting_key,setting_value) VALUES
 ('negotiation_min_piasters','2500'),
 ('negotiation_max_piasters','5000');
