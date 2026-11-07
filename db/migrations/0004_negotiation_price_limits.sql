-- Set the agreed negotiation range for existing and new D1 databases.
INSERT INTO app_settings(setting_key,setting_value) VALUES
 ('negotiation_min_piasters','2500'),
 ('negotiation_max_piasters','5000')
ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP;
