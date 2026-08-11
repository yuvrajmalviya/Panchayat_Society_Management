from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from typing import List, Optional
from datetime import datetime
from backend.database.connection import get_users_collection, get_audit_logs_collection
from backend.auth.dependencies import get_current_admin
from backend.auth.jwt import get_password_hash
from backend.schemas.user import UserResponse, UserRegister, AdminUserUpdate, UserStatus, UserRole

router = APIRouter(prefix="/api/users", tags=["Resident Management"])

@router.get("", response_model=List[UserResponse])
async def list_residents(
    search: Optional[str] = Query(None, description="Search by name, email, phone or house number"),
    role: Optional[UserRole] = Query(None),
    status_filter: Optional[UserStatus] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: dict = Depends(get_current_admin)
):
    users_col = get_users_collection()
    query = {}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"house_number": {"$regex": search, "$options": "i"}}
        ]
        
    if role:
        query["role"] = role
    if status_filter:
        query["status"] = status_filter
        
    cursor = users_col.find(query).skip(offset).limit(limit).sort("created_at", -1)
    users = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        users.append(doc)
        
    return users

@router.post("", response_model=UserResponse)
async def add_resident_manually(user_data: UserRegister, admin: dict = Depends(get_current_admin)):
    users_col = get_users_collection()
    
    # Check if user already exists
    existing_user = await users_col.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )
        
    hashed_pwd = get_password_hash(user_data.password)
    
    new_user = {
        "email": user_data.email,
        "hashed_password": hashed_pwd,
        "name": user_data.name,
        "phone": user_data.phone,
        "house_number": user_data.house_number,
        "address": user_data.address,
        "role": user_data.role,
        "status": UserStatus.APPROVED, # Manually created residents are pre-approved
        "created_at": datetime.utcnow()
    }
    
    result = await users_col.insert_one(new_user)
    new_user["id"] = str(result.inserted_id)
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Admin Created User",
        "performed_by": admin["id"],
        "target_id": new_user["id"],
        "timestamp": datetime.utcnow(),
        "details": f"Admin manually created user {user_data.name} ({user_data.role})."
    })
    
    return new_user

@router.put("/{user_id}", response_model=UserResponse)
async def update_resident_status(
    user_id: str,
    update_data: AdminUserUpdate,
    admin: dict = Depends(get_current_admin)
):
    users_col = get_users_collection()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format.")
        
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Prevent self-suspension or self-demotion
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot modify your own role or status.")
        
    update_fields = {}
    if update_data.status is not None:
        update_fields["status"] = update_data.status
    if update_data.role is not None:
        update_fields["role"] = update_data.role
        
    if not update_fields:
        user["id"] = str(user["_id"])
        return user
        
    await users_col.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": update_fields}
    )
    
    updated_user = await users_col.find_one({"_id": ObjectId(user_id)})
    updated_user["id"] = str(updated_user["_id"])
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Admin Updated User Status",
        "performed_by": admin["id"],
        "target_id": user_id,
        "timestamp": datetime.utcnow(),
        "details": f"Admin modified user status: {update_fields}."
    })
    
    return updated_user

@router.delete("/{user_id}")
async def delete_resident(user_id: str, admin: dict = Depends(get_current_admin)):
    users_col = get_users_collection()
    
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format.")
        
    user = await users_col.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot delete yourself.")
        
    await users_col.delete_one({"_id": ObjectId(user_id)})
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "Admin Deleted User",
        "performed_by": admin["id"],
        "target_id": user_id,
        "timestamp": datetime.utcnow(),
        "details": f"Admin deleted user {user.get('name')} ({user.get('email')})."
    })
    
    return {"message": f"User {user.get('name')} successfully deleted."}
