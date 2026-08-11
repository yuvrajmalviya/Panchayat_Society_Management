from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class NoticeCreate(BaseModel):
    title: str = Field(..., min_length=3)
    content: str = Field(..., min_length=10)
    pinned: bool = False

class NoticeUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    pinned: Optional[bool] = None

class NoticeResponse(BaseModel):
    id: str
    title: str
    content: str
    pinned: bool
    created_by: str
    created_by_name: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
