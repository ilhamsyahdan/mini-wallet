SELECT format('CREATE ROLE wallet_app LOGIN PASSWORD %L', :'APP_PASSWORD')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'wallet_app')
\gexec

GRANT USAGE ON SCHEMA public TO wallet_app;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO wallet_app;
GRANT UPDATE ON accounts, idempotency_keys TO wallet_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO wallet_app;