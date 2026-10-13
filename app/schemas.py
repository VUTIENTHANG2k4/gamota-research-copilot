from typing import Literal

from pydantic import BaseModel, Field


class SubQuestion(BaseModel):
    id: str
    text: str
    search_query: str
    search_query_en: str  # English keywords: part of the corpus is English
    evidence_type: str


class Brief(BaseModel):
    decision: str
    scope: str
    sub_questions: list[SubQuestion] = Field(min_length=3, max_length=5)
    clarifying_questions: list[str] = Field(default_factory=list, max_length=3)


class DraftClaim(BaseModel):
    content: str
    value: float | None = None
    unit: str | None = None
    scope: str
    data_date: str | None = None
    claim_type: Literal["fact", "estimate", "opinion"]
    passage: str  # verbatim quote from the chunk


class ExtractOut(BaseModel):
    claims: list[DraftClaim]
