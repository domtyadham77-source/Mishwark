-- Store passenger profile photos privately in D1.
ALTER TABLE users ADD COLUMN profile_photo_data BLOB;
ALTER TABLE users ADD COLUMN profile_photo_mime TEXT;
