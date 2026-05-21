-- Conveyor Product Counter — initial schema
-- Mirrors SQLAlchemy models in apps/api-backend/app/db/models.py
-- Applied once on fresh Postgres container (docker-entrypoint-initdb.d)
-- SQLAlchemy create_all() handles subsequent column additions.

CREATE TABLE IF NOT EXISTS users (
    id          SERIAL PRIMARY KEY,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        VARCHAR(32) NOT NULL DEFAULT 'viewer',
    preferences JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash  TEXT NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address          VARCHAR(45),
    user_agent          TEXT,
    city                VARCHAR(128),
    country             VARCHAR(64)
);

CREATE TABLE IF NOT EXISTS videos (
    id              SERIAL PRIMARY KEY,
    filename        VARCHAR(512) NOT NULL,
    storage_key     VARCHAR(512) NOT NULL UNIQUE,
    storage_url     TEXT,
    size_bytes      BIGINT,
    duration_sec    DOUBLE PRECISION,
    uploaded_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS processing_jobs (
    id                      SERIAL PRIMARY KEY,
    video_id                INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    processed_storage_key   VARCHAR(512),
    processed_storage_url   TEXT,
    model_key               VARCHAR(128) NOT NULL DEFAULT 'conveyor-products',
    status                  VARCHAR(32) NOT NULL DEFAULT 'queued',
    total_count             INTEGER,
    processing_time_sec     DOUBLE PRECISION,
    error_message           TEXT,
    created_by              INTEGER REFERENCES users(id) ON DELETE SET NULL,
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_counts (
    id              SERIAL PRIMARY KEY,
    job_id          INTEGER NOT NULL UNIQUE REFERENCES processing_jobs(id) ON DELETE CASCADE,
    video_id        INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    total_count     INTEGER NOT NULL DEFAULT 0,
    class_breakdown JSONB,
    counted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id              SERIAL PRIMARY KEY,
    actor_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(128) NOT NULL,
    target_user_id  INTEGER,
    details         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
