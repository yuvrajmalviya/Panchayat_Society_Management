from pydantic import BaseModel, Field
from typing import List, Optional

class Citation(BaseModel):
    document_name: str
    page: int

class BylawQueryRequest(BaseModel):
    question: str = Field(..., min_length=2)
    language: Optional[str] = "English"

class BylawQueryResponse(BaseModel):
    answer: str
    citations: List[Citation] = []

class ChatDigestRequest(BaseModel):
    chat_text: str = Field(..., min_length=10)

class ChatDigestResponse(BaseModel):
    summary: str
    decisions: List[str] = []
    tasks: List[str] = []
    announcements: List[str] = []
    deadlines: List[str] = []
