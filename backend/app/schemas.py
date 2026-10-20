from typing import Literal

from pydantic import BaseModel, Field, model_validator


class SubQuestion(BaseModel):
    id: str
    text: str
    search_query: str
    search_query_en: str  # English keywords: part of the corpus is English
    evidence_type: str
    core: bool  # Mission 3: true when this sub-question directly answers the original question


class Brief(BaseModel):
    decision: str
    scope: str
    needs_clarification: bool  # true when the question is too vague to research
    sub_questions: list[SubQuestion] = Field(max_length=5)  # required; empty only if needs_clarification
    clarifying_questions: list[str] = Field(max_length=3)  # required; may be empty for a clear question

    @model_validator(mode="after")
    def _check(self):
        if self.needs_clarification:
            if not 1 <= len(self.clarifying_questions) <= 3:
                raise ValueError("needs_clarification requires 1-3 clarifying questions")
        elif len(self.sub_questions) < 3:
            raise ValueError("a clear question needs 3-5 sub_questions")
        return self


class FollowupBrief(Brief):
    related_to_parent: bool  # Mission 3: false when the follow-up has nothing to do with the parent research


class DraftClaim(BaseModel):
    content: str
    value: float | None = None
    unit: str | None = None
    scope: str
    data_date: str | None = None
    claim_type: Literal["fact", "estimate", "opinion"]
    passage: str  # verbatim quote from the chunk
    answers: Literal["direct", "partial", "context"]  # Mission 3: how directly the claim answers the sub-question
    answers_reason: str


class ExtractOut(BaseModel):
    claims: list[DraftClaim]
