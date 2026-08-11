from pydantic import BaseModel, Field
from datetime import datetime

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=3)
    content: str = Field(..., min_length=10)

class AnnouncementResponse(BaseModel):
    id: str
    title: str
    content: str
    sent_by: str
    sent_by_name: str
    created_at: datetime

    class Config:
        from_attributes = True
