-- scripts/setup-role.sql
-- Dijalankan oleh Superuser / Admin (misal: postgres / wallet_admin)

-- 1. Buat role wallet_app jika belum ada (Password disuntikkan via variabel APP_PASSWORD)
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'wallet_app') THEN
      CREATE ROLE wallet_app LOGIN PASSWORD :'APP_PASSWORD';
   END IF;
END
$do$;

-- 2. Berikan izin koneksi ke database 'wallet' dan penggunaan skema 'public'
GRANT CONNECT ON DATABASE wallet TO wallet_app;
GRANT USAGE ON SCHEMA public TO wallet_app;

-- 3. Berikan izin SELECT dan INSERT ke semua tabel di skema public
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO wallet_app;

-- 4. Berikan izin UPDATE HANYA pada tabel yang membutuhkan perubahan data
GRANT UPDATE ON accounts, idempotency_keys TO wallet_app;

-- 5. Berikan izin penggunaan sequence (untuk auto-increment ID jika ada)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wallet_app;