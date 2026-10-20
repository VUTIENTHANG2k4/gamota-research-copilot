import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
    id text PRIMARY KEY, title text, url text, source_type text, org text,
    publish_date text, data_date text, has_methodology text,
    conflict_of_interest_note text, cites_origin text, retrieved_at text,
    sha256 text, is_synthetic boolean, notes text
);
CREATE TABLE IF NOT EXISTS chunks (
    id text PRIMARY KEY, source_id text REFERENCES sources(id),
    page int, seq int, text text
);
CREATE TABLE IF NOT EXISTS runs (
    id text PRIMARY KEY, question text NOT NULL, parent_id text,
    status text NOT NULL, stage text, error text,
    created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    brief jsonb, p2 jsonb, p3 jsonb, memo jsonb, memo_generated_at timestamptz,
    memo_status text NOT NULL DEFAULT 'none', memo_error text
);
CREATE TABLE IF NOT EXISTS reviews (
    run_id text NOT NULL REFERENCES runs(id) ON DELETE CASCADE, claim_id text NOT NULL,
    state text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, claim_id)
);
ALTER TABLE runs ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS context jsonb;
"""


def connect():
    return psycopg.connect(os.environ["DATABASE_URL"])


def init_schema(conn):
    conn.execute(SCHEMA)
    conn.commit()
