from typing import Any, List, Optional

from pydantic import BaseModel, Field, ValidationError


class ActionItem(BaseModel):
    task: str = Field(..., description="What needs to be done")
    owner: str = Field("", description="Person responsible, if known")
    deadline: str = Field(
        "",
        description="Natural language or ISO date deadline if mentioned; empty if unknown",
    )


class TopicSegment(BaseModel):
    topic: str
    start: str = Field(
        "",
        description="Start position marker in transcript (e.g. timestamp or line index)",
    )
    end: str = Field(
        "",
        description="End position marker in transcript (e.g. timestamp or line index)",
    )
    summary: str


class SpeakerSentiment(BaseModel):
    speaker: str
    sentiment: str


class SentimentBlock(BaseModel):
    overall: str
    per_speaker: List[SpeakerSentiment] = Field(default_factory=list)


class MeetingInsights(BaseModel):
    summary: str
    key_points: List[str] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)
    decisions: List[str] = Field(default_factory=list)
    topics: List[TopicSegment] = Field(default_factory=list)
    sentiment: SentimentBlock


def coerce_and_validate_insights(data: Any) -> MeetingInsights:
    """
    Validate and lightly coerce arbitrary JSON coming back from the LLM
    into the strict `MeetingInsights` schema, raising a clear error on failure.
    """
    try:
        return MeetingInsights.model_validate(data)
    except ValidationError as exc:
        raise ValueError(f"Invalid insights schema: {exc}") from exc

