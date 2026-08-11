from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from backend.database.connection import get_notices_collection, get_audit_logs_collection
from backend.auth.dependencies import get_approved_user, get_current_admin
from backend.schemas.notice import NoticeResponse, NoticeCreate, NoticeUpdate

router = APIRouter(prefix="/api/notices", tags=["Notice Board"])

@router.post("", response_model=NoticeResponse)
async def create_notice(notice_data: NoticeCreate, admin: dict = Depends(get_current_admin)):
    notices_col = get_notices_collection()
    
    new_notice = {
        "title": notice_data.title,
        "content": notice_data.content,
        "pinned": notice_data.pinned,
        "created_by": admin["id"],
        "created_by_name": admin["name"],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await notices_col.insert_one(new_notice)
    new_notice["id"] = str(result.inserted_id)
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Notice Created",
        "performed_by": admin["id"],
        "target_id": new_notice["id"],
        "timestamp": datetime.utcnow(),
        "details": f"Created notice: '{notice_data.title}'."
    })
    
    return new_notice

@router.get("", response_model=List[NoticeResponse])
async def list_notices(
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_approved_user)
):
    notices_col = get_notices_collection()
    query = {}
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}}
        ]
        
    # Sort: Pinned first (True/False), then created_at (descending)
    cursor = notices_col.find(query).skip(offset).limit(limit).sort([("pinned", -1), ("created_at", -1)])
    
    notices = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        notices.append(doc)
        
    return notices

@router.put("/{notice_id}", response_model=NoticeResponse)
async def update_notice(
    notice_id: str,
    update_data: NoticeUpdate,
    admin: dict = Depends(get_current_admin)
):
    notices_col = get_notices_collection()
    
    if not ObjectId.is_valid(notice_id):
        raise HTTPException(status_code=400, detail="Invalid notice ID.")
        
    notice = await notices_col.find_one({"_id": ObjectId(notice_id)})
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")
        
    update_fields = {}
    if update_data.title is not None:
        update_fields["title"] = update_data.title
    if update_data.content is not None:
        update_fields["content"] = update_data.content
    if update_data.pinned is not None:
        update_fields["pinned"] = update_data.pinned
        
    if not update_fields:
        notice["id"] = str(notice["_id"])
        return notice
        
    update_fields["updated_at"] = datetime.utcnow()
    
    await notices_col.update_one(
        {"_id": ObjectId(notice_id)},
        {"$set": update_fields}
    )
    
    updated_notice = await notices_col.find_one({"_id": ObjectId(notice_id)})
    updated_notice["id"] = str(updated_notice["_id"])
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Notice Updated",
        "performed_by": admin["id"],
        "target_id": notice_id,
        "timestamp": datetime.utcnow(),
        "details": f"Updated notice status: {update_fields}."
    })
    
    return updated_notice

@router.delete("/{notice_id}")
async def delete_notice(notice_id: str, admin: dict = Depends(get_current_admin)):
    notices_col = get_notices_collection()
    
    if not ObjectId.is_valid(notice_id):
        raise HTTPException(status_code=400, detail="Invalid notice ID.")
        
    notice = await notices_col.find_one({"_id": ObjectId(notice_id)})
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found.")
        
    await notices_col.delete_one({"_id": ObjectId(notice_id)})
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Notice Deleted",
        "performed_by": admin["id"],
        "target_id": notice_id,
        "timestamp": datetime.utcnow(),
        "details": f"Deleted notice: '{notice.get('title')}'."
    })
    
    return {"message": "Notice deleted successfully."}
