-- Inicialización de bases y roles locales de desarrollo para FarmaGestión.
-- Nunca usar estas contraseñas en producción (Neon).

CREATE ROLE eps_app LOGIN PASSWORD 'eps_dev_pass';
CREATE ROLE farma_app LOGIN PASSWORD 'farma_dev_pass';

CREATE DATABASE eps_db OWNER eps_app;
CREATE DATABASE farma_db OWNER farma_app;
