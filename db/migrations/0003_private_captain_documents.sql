-- Apply once to an existing D1 database after the earlier schema.
ALTER TABLE captain_profiles ADD COLUMN profile_photo_data BLOB;
ALTER TABLE captain_profiles ADD COLUMN profile_photo_mime TEXT;
ALTER TABLE captain_profiles ADD COLUMN profile_photo_status TEXT NOT NULL DEFAULT 'pending' CHECK(profile_photo_status IN ('pending','approved','rejected'));
ALTER TABLE captain_documents ADD COLUMN file_data BLOB;
ALTER TABLE captain_documents ADD COLUMN mime_type TEXT;
ALTER TABLE captain_documents ADD COLUMN file_size INTEGER;
