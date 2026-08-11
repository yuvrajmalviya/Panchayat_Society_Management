from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotificationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    read: bool
    type: str  # e.g., complaint, announcement, notice, maintenance
    created_at: datetime

    class Config:
        from_attributes = True
