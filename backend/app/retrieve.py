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

    def search(self, query: str, k: int = 5, per_source: int | None = None,
               synthetic: bool | None = None) -> list[dict]:
        """Top-k chunks; `per_source` caps chunks per document so one long file cannot crowd out the rest.
        `synthetic` True/False restricts to SYNTHETIC / real documents; None searches both."""
        scores = self.bm25.get_scores(tokens(query))
        order, seen = [], {}
        for i in sorted(range(len(scores)), key=lambda i: -scores[i]):
            if synthetic is not None and bool(self.rows[i][4]) != synthetic:
                continue
            sid = self.rows[i][1]
            if per_source and seen.get(sid, 0) >= per_source:
                continue
            seen[sid] = seen.get(sid, 0) + 1
            order.append(i)
            if len(order) == k:
                break
        return [self._hit(i, scores) for i in order if scores[i] > 0]

    def search_split(self, query: str, k_real: int, k_syn: int, per_source: int | None = None) -> list[dict]:
        """Same as search(k_real, synthetic=False) + search(k_syn, synthetic=True), scoring the corpus once."""
        scores = self.bm25.get_scores(tokens(query))
        want = {False: k_real, True: k_syn}
        picked, seen = {False: [], True: []}, {}
        for i in sorted(range(len(scores)), key=lambda i: -scores[i]):
            syn = bool(self.rows[i][4])
            if len(picked[syn]) >= want[syn]:
                if all(len(picked[b]) >= want[b] for b in want):
                    break
                continue
            sid = self.rows[i][1]
            if per_source and seen.get(sid, 0) >= per_source:
                continue
            seen[sid] = seen.get(sid, 0) + 1
            picked[syn].append(i)
        return [self._hit(i, scores) for i in picked[False] + picked[True] if scores[i] > 0]

    def _hit(self, i: int, scores) -> dict:
        return {"chunk_id": self.rows[i][0], "source_id": self.rows[i][1], "page": self.rows[i][2],
                "text": self.rows[i][3], "is_synthetic": self.rows[i][4], "score": round(float(scores[i]), 3)}
