-- Repair the existing Mishwark D1 schema to match the current application.
-- Run after 0006_restore_missing_schema_objects.sql.
-- Existing captain profile/document data is copied forward; no user or ride rows are deleted.

ALTER TABLE captain_profiles ADD COLUMN vehicle_type TEXT NOT NULL DEFAULT 'car'
  CHECK(vehicle_type IN ('motorcycle','car'));
ALTER TABLE captain_profiles ADD COLUMN profile_photo_data BLOB;
ALTER TABLE captain_profiles ADD COLUMN profile_photo_mime TEXT;
ALTER TABLE captain_profiles ADD COLUMN profile_photo_status TEXT NOT NULL DEFAULT 'pending'
  CHECK(profile_photo_status IN ('pending','approved','rejected'));

-- Rebuild captain_documents because the legacy CHECK constraint does not allow
-- vehicle_photo. Copy all existing document rows into the expanded schema.
ALTER TABLE captain_documents RENAME TO captain_documents_legacy;

CREATE TABLE captain_documents (
  id TEXT PRIMARY KEY,
  captain_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK(document_type IN ('national_id','driving_license','vehicle_license','vehicle_photo')),
  side TEXT NOT NULL CHECK(side IN ('front','back')),
  object_key TEXT,
  file_data BLOB,
  mime_type TEXT,
  file_size INTEGER,
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO captain_documents (
  id, captain_id, document_type, side, object_key, review_status, uploaded_at
)
SELECT
  id, captain_id, document_type, side, object_key, review_status, uploaded_at
FROM captain_documents_legacy;

DROP TABLE captain_documents_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_captain_document_slot
  ON captain_documents(captain_id, document_type, side);
