from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Optional
from datetime import datetime
from backend.database.connection import get_announcements_collection, get_notifications_collection, get_users_collection, get_audit_logs_collection
from backend.auth.dependencies import get_approved_user, get_current_admin
from backend.schemas.announcement import AnnouncementResponse, AnnouncementCreate

router = APIRouter(prefix="/api/announcements", tags=["Broadcast Announcements"])

@router.post("", response_model=AnnouncementResponse)
async def create_announcement(announcement_data: AnnouncementCreate, admin: dict = Depends(get_current_admin)):
    announcements_col = get_announcements_collection()
    
    new_announcement = {
        "title": announcement_data.title,
        "content": announcement_data.content,
        "sent_by": admin["id"],
        "sent_by_name": admin["name"],
        "created_at": datetime.utcnow()
    }
    
    result = await announcements_col.insert_one(new_announcement)
    new_announcement["id"] = str(result.inserted_id)
    
    # Broadcast notification to all approved users in database
    users_col = get_users_collection()
    notifications_col = get_notifications_collection()
    
    approved_users = await users_col.find({"status": "approved"}).to_list(length=1000)
    
    broadcast_notifications = []
    for user in approved_users:
        broadcast_notifications.append({
            "user_id": str(user["_id"]),
            "title": f"Broadcast Announcement: {announcement_data.title}",
            "message": announcement_data.content,
            "read": False,
            "type": "announcement",
            "created_at": datetime.utcnow()
        })
        
    if broadcast_notifications:
        await notifications_col.insert_many(broadcast_notifications)
        
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Announcement Broadcasted",
        "performed_by": admin["id"],
        "target_id": new_announcement["id"],
        "timestamp": datetime.utcnow(),
        "details": f"Broadcasted announcement: '{announcement_data.title}' to {len(broadcast_notifications)} residents."
    })
    
    return new_announcement

@router.get("", response_model=List[AnnouncementResponse])
async def list_announcements(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_approved_user)
):
    announcements_col = get_announcements_collection()
    cursor = announcements_col.find({}).skip(offset).limit(limit).sort("created_at", -1)
    
    announcements = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        announcements.append(doc)
        
    return announcements
