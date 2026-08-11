from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ComplaintCategory(str, Enum):
    WATER = "Water"
    ELECTRICITY = "Electricity"
    SECURITY = "Security"
    ROAD = "Road"
    GARBAGE = "Garbage"
    SANITATION = "Sanitation"
    GARDEN = "Garden"
    STREET_LIGHT = "Street Light"
    OTHER = "Other"

class ComplaintPriority(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class ComplaintStatus(str, Enum):
    PENDING = "Pending"
    IN_PROGRESS = "In Progress"
    ASSIGNED = "Assigned"
    RESOLVED = "Resolved"
    CLOSED = "Closed"

class TimelineEvent(BaseModel):
    status: ComplaintStatus
    updated_by: str  # User ID or "System"
    updated_by_name: str
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    comment: str

class ComplaintCreate(BaseModel):
    title: str = Field(..., min_length=3)
    description: str = Field(..., min_length=10)
    category: ComplaintCategory
    priority: ComplaintPriority = ComplaintPriority.MEDIUM
    location: Optional[str] = None

class ComplaintUpdate(BaseModel):
    status: Optional[ComplaintStatus] = None
    priority: Optional[ComplaintPriority] = None
    category: Optional[ComplaintCategory] = None
    assigned_to: Optional[str] = None  # Admin User ID
    comment: Optional[str] = None  # To add to timeline

class ComplaintResponse(BaseModel):
    id: str
    complaint_number: str
    title: str
    description: str
    category: ComplaintCategory
    priority: ComplaintPriority
    status: ComplaintStatus
    location: Optional[str] = None
    image_urls: List[str] = []
    voice_url: Optional[str] = None
    created_by: str
    created_by_name: str
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    timeline: List[TimelineEvent] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
