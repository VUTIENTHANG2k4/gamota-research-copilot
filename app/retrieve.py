"""Keyword retrieval (BM25 over accent-stripped unigrams + bigrams) on the chunks table."""
import re
import unicodedata

from rank_bm25 import BM25Okapi

from app import db


def strip_accents(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def tokens(text: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", strip_accents(text).lower())
    return words + [f"{a}_{b}" for a, b in zip(words, words[1:])]


class Index:
    def __init__(self):
        with db.connect() as conn:
            self.rows = conn.execute(
                "SELECT c.id, c.source_id, c.page, c.text, s.is_synthetic "
                "FROM chunks c JOIN sources s ON s.id = c.source_id ORDER BY c.id").fetchall()
        self.bm25 = BM25Okapi([tokens(r[3]) for r in self.rows])

    def search(self, query: str, k: int = 5, per_source: int | None = None) -> list[dict]:
        """Top-k chunks; `per_source` caps chunks per document so one long file cannot crowd out the rest."""
        scores = self.bm25.get_scores(tokens(query))
        order, seen = [], {}
        for i in sorted(range(len(scores)), key=lambda i: -scores[i]):
            sid = self.rows[i][1]
            if per_source and seen.get(sid, 0) >= per_source:
                continue
            seen[sid] = seen.get(sid, 0) + 1
            order.append(i)
            if len(order) == k:
                break
        return [{"chunk_id": self.rows[i][0], "source_id": self.rows[i][1], "page": self.rows[i][2],
                 "text": self.rows[i][3], "is_synthetic": self.rows[i][4],
                 "score": round(float(scores[i]), 3)} for i in order if scores[i] > 0]
