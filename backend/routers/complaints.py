from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
import os
from backend.config import settings
from backend.database.connection import (
    get_complaints_collection, 
    get_notifications_collection, 
    get_audit_logs_collection,
    get_users_collection
)
from backend.auth.dependencies import get_approved_user, get_current_admin
from backend.schemas.complaint import ComplaintResponse, ComplaintStatus, ComplaintCategory, ComplaintPriority, TimelineEvent
from backend.utils.helpers import generate_complaint_number, compress_image, save_uploaded_file
from backend.services.email_service import send_email_notification

router = APIRouter(prefix="/api/complaints", tags=["Complaint Management"])

@router.post("", response_model=ComplaintResponse)
async def create_complaint(
    title: str = Form(...),
    description: str = Form(...),
    category: ComplaintCategory = Form(...),
    priority: ComplaintPriority = Form(ComplaintPriority.MEDIUM),
    location: Optional[str] = Form(None),
    images: List[UploadFile] = File([]),
    voice: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_approved_user)
):
    complaints_col = get_complaints_collection()
    
    # Generate unique complaint number
    comp_number = await generate_complaint_number()
    
    # Save Images
    image_urls = []
    for img in images:
        if img.filename:
            rel_path = save_uploaded_file(img, os.path.join(settings.UPLOAD_DIR, "complaints"), filename_prefix="img_")
            # Compress image
            compress_image(os.path.join(os.getcwd(), rel_path))
            image_urls.append(rel_path)
            
    # Save Voice
    voice_url = None
    if voice and voice.filename:
        voice_url = save_uploaded_file(voice, os.path.join(settings.UPLOAD_DIR, "voice"), filename_prefix="voice_")
        
    timeline_event = {
        "status": ComplaintStatus.PENDING,
        "updated_by": current_user["id"],
        "updated_by_name": current_user["name"],
        "updated_at": datetime.utcnow(),
        "comment": "Complaint successfully registered in the portal."
    }
    
    new_complaint = {
        "complaint_number": comp_number,
        "title": title,
        "description": description,
        "category": category,
        "priority": priority,
        "status": ComplaintStatus.PENDING,
        "location": location,
        "image_urls": image_urls,
        "voice_url": voice_url,
        "created_by": current_user["id"],
        "created_by_name": current_user["name"],
        "assigned_to": None,
        "assigned_to_name": None,
        "timeline": [timeline_event],
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = await complaints_col.insert_one(new_complaint)
    new_complaint["id"] = str(result.inserted_id)
    
    # Notify Administrators of new ticket
    users_col = get_users_collection()
    admins = await users_col.find({"role": "admin"}).to_list(length=100)
    notifications_col = get_notifications_collection()
    
    admin_notifications = []
    for admin_user in admins:
        admin_notifications.append({
            "user_id": str(admin_user["_id"]),
            "title": f"New Complaint {comp_number}",
            "message": f"Resident {current_user['name']} has logged a complaint ({category}) with {priority} priority.",
            "read": False,
            "type": "complaint",
            "created_at": datetime.utcnow()
        })
    if admin_notifications:
        await notifications_col.insert_many(admin_notifications)
        
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Complaint Logged",
        "performed_by": current_user["id"],
        "target_id": new_complaint["id"],
        "timestamp": datetime.utcnow(),
        "details": f"User logged complaint {comp_number} of category {category}."
    })
    
    return new_complaint

@router.get("", response_model=List[ComplaintResponse])
async def list_complaints(
    status_filter: Optional[ComplaintStatus] = Query(None, alias="status"),
    category: Optional[ComplaintCategory] = Query(None),
    priority: Optional[ComplaintPriority] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: dict = Depends(get_approved_user)
):
    complaints_col = get_complaints_collection()
    query = {}
    
    # Residents can only see their own complaints, Admins see all
    if current_user["role"] != "admin":
        query["created_by"] = current_user["id"]
        
    if status_filter:
        query["status"] = status_filter
    if category:
        query["category"] = category
    if priority:
        query["priority"] = priority
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"complaint_number": {"$regex": search, "$options": "i"}}
        ]
        
    cursor = complaints_col.find(query).skip(offset).limit(limit).sort("created_at", -1)
    complaints = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        complaints.append(doc)
        
    return complaints

@router.get("/{complaint_id}", response_model=ComplaintResponse)
async def get_complaint_details(complaint_id: str, current_user: dict = Depends(get_approved_user)):
    complaints_col = get_complaints_collection()
    if not ObjectId.is_valid(complaint_id):
        raise HTTPException(status_code=400, detail="Invalid complaint ID.")
        
    complaint = await complaints_col.find_one({"_id": ObjectId(complaint_id)})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
        
    # Residents can only view their own complaints
    if current_user["role"] != "admin" and complaint.get("created_by") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied.")
        
    complaint["id"] = str(complaint["_id"])
    return complaint

@router.put("/{complaint_id}", response_model=ComplaintResponse)
async def update_complaint(
    complaint_id: str,
    status_update: Optional[ComplaintStatus] = Form(None),
    priority_update: Optional[ComplaintPriority] = Form(None),
    category_update: Optional[ComplaintCategory] = Form(None),
    assigned_to: Optional[str] = Form(None),
    comment: Optional[str] = Form(None),
    current_user: dict = Depends(get_approved_user)
):
    complaints_col = get_complaints_collection()
    
    if not ObjectId.is_valid(complaint_id):
        raise HTTPException(status_code=400, detail="Invalid complaint ID.")
        
    complaint = await complaints_col.find_one({"_id": ObjectId(complaint_id)})
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found.")
        
    # Validation: Residents can only mark their own complaints as Closed, Admins have full access
    is_admin = current_user["role"] == "admin"
    if not is_admin:
        if complaint.get("created_by") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied.")
        if status_update and status_update != ComplaintStatus.CLOSED:
            raise HTTPException(status_code=400, detail="Residents can only mark tickets as Closed.")
            
    update_fields = {}
    timeline_comment = comment or "Complaint updated."
    
    # Track status change
    status_changed = False
    old_status = complaint.get("status")
    new_status = status_update or old_status
    
    if status_update and status_update != old_status:
        update_fields["status"] = status_update
        status_changed = True
        timeline_comment = comment or f"Status changed from {old_status} to {status_update}."
        
    if priority_update and is_admin:
        update_fields["priority"] = priority_update
        
    if category_update and is_admin:
        update_fields["category"] = category_update
        
    # Assignment tracking
    assignee_name = None
    if assigned_to is not None and is_admin:
        if assigned_to == "":
            update_fields["assigned_to"] = None
            update_fields["assigned_to_name"] = None
            timeline_comment = comment or "Ticket unassigned."
        else:
            if not ObjectId.is_valid(assigned_to):
                raise HTTPException(status_code=400, detail="Invalid assignee user ID.")
            users_col = get_users_collection()
            assignee = await users_col.find_one({"_id": ObjectId(assigned_to)})
            if not assignee:
                raise HTTPException(status_code=404, detail="Assignee admin not found.")
            assignee_name = assignee.get("name")
            update_fields["assigned_to"] = assigned_to
            update_fields["assigned_to_name"] = assignee_name
            update_fields["status"] = ComplaintStatus.ASSIGNED
            new_status = ComplaintStatus.ASSIGNED
            status_changed = True
            timeline_comment = comment or f"Ticket assigned to admin {assignee_name}."
            
    # Add timeline event
    new_event = {
        "status": new_status,
        "updated_by": current_user["id"],
        "updated_by_name": current_user["name"],
        "updated_at": datetime.utcnow(),
        "comment": timeline_comment
    }
    
    # Save to MongoDB
    update_query = {"$set": update_fields, "$push": {"timeline": new_event}}
    update_fields["updated_at"] = datetime.utcnow()
    
    await complaints_col.update_one({"_id": ObjectId(complaint_id)}, update_query)
    
    # Fetch updated complaint
    updated_complaint = await complaints_col.find_one({"_id": ObjectId(complaint_id)})
    updated_complaint["id"] = str(updated_complaint["_id"])
    
    # ----------------- Trigger Notifications -----------------
    notifications_col = get_notifications_collection()
    users_col = get_users_collection()
    
    # Notify creator of status changes
    creator_id = complaint.get("created_by")
    creator = await users_col.find_one({"_id": ObjectId(creator_id)})
    
    if status_changed and creator:
        notification_title = f"Complaint Status Update: {updated_complaint['complaint_number']}"
        notification_msg = f"Your complaint '{complaint.get('title')}' status is now '{new_status}'."
        if new_status == ComplaintStatus.ASSIGNED and assignee_name:
            notification_msg = f"Your complaint '{complaint.get('title')}' has been assigned to administrator '{assignee_name}'."
            
        await notifications_col.insert_one({
            "user_id": creator_id,
            "title": notification_title,
            "message": notification_msg,
            "read": False,
            "type": "complaint",
            "created_at": datetime.utcnow()
        })
        
        # Email alerts
        email_body = (
            f"Dear {creator.get('name')},\n\n"
            f"The status of your complaint {updated_complaint['complaint_number']} ('{complaint.get('title')}') has been updated.\n"
            f"New Status: {new_status}\n"
            f"Update details: {timeline_comment}\n\n"
            f"Thank you,\nPanchayat AI Administrative Team"
        )
        send_email_notification(creator.get("email"), notification_title, email_body)
        
    # Notify assignee if newly assigned
    if assigned_to and assignee_name:
        await notifications_col.insert_one({
            "user_id": assigned_to,
            "title": f"Complaint Assigned: {updated_complaint['complaint_number']}",
            "message": f"You have been assigned the ticket: '{complaint.get('title')}' raised by {complaint.get('created_by_name')}.",
            "read": False,
            "type": "complaint",
            "created_at": datetime.utcnow()
        })
        
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Complaint Updated",
        "performed_by": current_user["id"],
        "target_id": complaint_id,
        "timestamp": datetime.utcnow(),
        "details": f"Complaint {updated_complaint['complaint_number']} status changed to {new_status}."
    })
    
    return updated_complaint
