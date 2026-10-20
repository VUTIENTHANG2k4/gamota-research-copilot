"""Read corpus files into page-aware chunks stored in PostgreSQL."""
import csv
import logging
import re
from pathlib import Path

from bs4 import BeautifulSoup
from pypdf import PdfReader

from app import db

logging.getLogger("pypdf").setLevel(logging.ERROR)
CORPUS = Path(__file__).resolve().parent.parent / "corpus"
CHUNK_CHARS = 1200


def read_pages(path: Path) -> list[tuple[int, str]]:
    """Return [(page_number, text)]. Non-PDF files are a single page 1."""
    ext = path.suffix.lower()
    if ext == ".pdf":
        r = PdfReader(str(path))
        return [(i + 1, p.extract_text() or "") for i, p in enumerate(r.pages)]
    raw = path.read_bytes().decode("utf-8", errors="replace")
    if ext in (".html", ".htm"):
        soup = BeautifulSoup(raw, "lxml")
        for t in soup(["script", "style", "noscript", "nav", "footer", "header", "svg", "form"]):
            t.decompose()
        raw = soup.get_text("\n")
    return [(1, raw)]


def chunk_page(text: str) -> list[str]:
    """Split on lines, pack into ~CHUNK_CHARS windows; never cut inside a line."""
    lines = [re.sub(r"[ \t ]+", " ", l).strip() for l in text.splitlines()]
    lines = [l for l in lines if l]
    chunks, cur = [], ""
    for l in lines:
        if cur and len(cur) + len(l) + 1 > CHUNK_CHARS:
            chunks.append(cur)
            cur = ""
        cur = f"{cur}\n{l}" if cur else l
    if cur:
        chunks.append(cur)
    return chunks


def find_file(source_id: str) -> Path | None:
    for d in ("raw", "synthetic"):
        hits = list((CORPUS / d).glob(f"{source_id}.*"))
        if hits:
            return hits[0]
    return None


def ingest() -> dict:
    rows = list(csv.DictReader(open(CORPUS / "sources.csv", encoding="utf-8")))
    stats = {"sources": 0, "chunks": 0, "empty": []}
    with db.connect() as conn:
        db.init_schema(conn)
        conn.execute("TRUNCATE chunks, sources CASCADE")
        for r in rows:
            r["is_synthetic"] = r["is_synthetic"].lower() == "true"
            cols = list(r.keys())
            conn.execute(
                f"INSERT INTO sources ({','.join(cols)}) VALUES ({','.join(['%s'] * len(cols))})",
                [r[c] for c in cols])
            stats["sources"] += 1
            path = find_file(r["id"])
            n = 0
            for page, text in read_pages(path):
                for seq, c in enumerate(chunk_page(text)):
                    conn.execute(
                        "INSERT INTO chunks (id, source_id, page, seq, text) VALUES (%s,%s,%s,%s,%s)",
                        (f"{r['id']}-p{page}-{seq}", r["id"], page, seq, c.replace("\x00", "")))
                    n += 1
            if n == 0:
                stats["empty"].append(r["id"])
            stats["chunks"] += n
        conn.commit()
    return stats


def ensure_ingested() -> int:
    """Load the corpus into an empty database (first deploy). Returns the number of chunks."""
    expected = sum(1 for _ in csv.DictReader(open(CORPUS / "sources.csv", encoding="utf-8")))
    with db.connect() as conn:
        db.init_schema(conn)
        n = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
        n_src = conn.execute("SELECT count(*) FROM sources").fetchone()[0]
    if n == 0 or n_src != expected:  # empty, or the fixed corpus changed (Mission 3 added documents)
        n = ingest()["chunks"]
        from app import pipeline
        pipeline.reset_index()
    return n


if __name__ == "__main__":
    print(ingest())
