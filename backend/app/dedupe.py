"""Guardrail: sources quoting the same origin count as one independent source."""
import csv
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "corpus" / "origin_groups.csv"


@lru_cache
def groups() -> dict[str, str]:
    return {r["source_id"]: r["origin_group"] for r in csv.DictReader(open(PATH, encoding="utf-8"))}


def origin_of(source_id: str) -> str:
    return groups().get(source_id, source_id)


def independent_count(source_ids: list[str]) -> int:
    return len({origin_of(s) for s in source_ids})
