import os

import psycopg
from dotenv import load_dotenv

load_dotenv()

SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;
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
"""


def connect():
    return psycopg.connect(os.environ["DATABASE_URL"])


def init_schema(conn):
    conn.execute(SCHEMA)
    conn.commit()
