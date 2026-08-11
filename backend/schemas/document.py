from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    BYLAWS = "Bylaws"
    MEETING_MINUTES = "Meeting Minutes"
    CIRCULAR = "Circular"

class DocumentResponse(BaseModel):
    id: str
    filename: str
    filepath: str
    type: DocumentType
    description: Optional[str] = None
    uploaded_by: str
    uploaded_by_name: str
    uploaded_at: datetime
    is_active: Optional[bool] = None

    class Config:
        from_attributes = True
