from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from typing import List
from datetime import datetime
from backend.database.connection import get_notifications_collection
from backend.auth.dependencies import get_approved_user
from backend.schemas.notification import NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_approved_user)
):
    notifications_col = get_notifications_collection()
    
    cursor = notifications_col.find({"user_id": current_user["id"]}).limit(limit).sort("created_at", -1)
    
    notifications = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        notifications.append(doc)
        
    return notifications

@router.put("/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: dict = Depends(get_approved_user)):
    notifications_col = get_notifications_collection()
    
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID.")
        
    result = await notifications_col.update_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["id"]},
        {"$set": {"read": True}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")
        
    return {"message": "Notification marked as read."}

@router.put("/read-all")
async def mark_all_notifications_read(current_user: dict = Depends(get_approved_user)):
    notifications_col = get_notifications_collection()
    
    await notifications_col.update_many(
        {"user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"message": "All notifications marked as read."}

@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, current_user: dict = Depends(get_approved_user)):
    notifications_col = get_notifications_collection()
    
    if not ObjectId.is_valid(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID.")
        
    result = await notifications_col.delete_one(
        {"_id": ObjectId(notification_id), "user_id": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found.")
        
    return {"message": "Notification deleted."}
