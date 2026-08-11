from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from datetime import datetime, timedelta
from bson import ObjectId
from backend.database.connection import get_users_collection, get_audit_logs_collection
from backend.auth.jwt import get_password_hash, verify_password, create_access_token
from backend.auth.dependencies import get_current_user, get_approved_user
from backend.schemas.user import UserRegister, UserLogin, UserUpdate, UserResponse, TokenResponse, UserRole, UserStatus, ForgotPasswordRequest, ForgotPasswordReset, VerifyOTPRequest, VerifyRegistrationRequest, ResendRegistrationRequest

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

import random

# Cache for password reset OTP verification
# Key: email or phone, Value: { "otp": str, "expires_at": datetime, ... }
reset_otps = {}

# Cache for dual-channel registration verification
# Key: email, Value: { "user_data": dict, "email_otp": str, "sms_otp": str, "expires_at": datetime, "last_requested_at": datetime }
pending_registrations = {}

@router.post("/register")
async def register(user_data: UserRegister):
    users_col = get_users_collection()
    
    # Check if user already exists by email
    existing_user = await users_col.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )
        
    # Check if user already exists by phone
    existing_phone = await users_col.find_one({"phone": user_data.phone})
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this phone number is already registered."
        )
        
    now = datetime.utcnow()
    
    # Generate registration verification Email OTP
    email_otp = f"{random.randint(100000, 999999)}"
    
    # Cache user details and OTP codes temporarily
    pending_registrations[user_data.email] = {
        "user_data": user_data.dict(),
        "email_otp": email_otp,
        "expires_at": now + timedelta(minutes=10),
        "last_requested_at": now
    }
    
    # Log OTP code to console
    import logging
    auth_logger = logging.getLogger("panchayat_ai.auth")
    auth_logger.info(f"\n--- [REGISTRATION EMAIL OTP DISPATCH] ---")
    auth_logger.info(f"Target Email: {user_data.email} | Email OTP Code: {email_otp}")
    auth_logger.info(f"----------------------------------------\n")
    
    # Send Email Verification Code via SMTP
    from backend.services.email_service import send_email_notification
    send_email_notification(
        to_email=user_data.email,
        subject="Panchayat AI Registration Verification Code",
        body_text=(
            f"Dear {user_data.name},\n\n"
            f"Thank you for registering. Please enter the following verification code to complete your signup: {email_otp}\n\n"
            f"Note: This code expires in 10 minutes.\n\n"
            f"Regards,\nPanchayat AI Team"
        )
    )
    
    return {"message": "Verification code sent successfully. Please check your email."}

@router.post("/verify-registration")
async def verify_registration(req: VerifyRegistrationRequest):
    email = req.email
    cached = pending_registrations.get(email)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration session expired or not found. Please register again."
        )
        
    now = datetime.utcnow()
    if now > cached["expires_at"]:
        pending_registrations.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired. Please register again."
        )
        
    if cached["email_otp"] != req.email_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please check and try again."
        )
        
    # Validation succeeded! Save user in DB
    user_data = cached["user_data"]
    users_col = get_users_collection()
    
    # Re-verify that user wasn't registered in the meantime
    existing_user = await users_col.find_one({"email": user_data["email"]})
    if existing_user:
        pending_registrations.pop(email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )
        
    # Check if first user
    total_users = await users_col.count_documents({})
    if total_users == 0:
        role = UserRole.ADMIN
        user_status = UserStatus.APPROVED
    else:
        role = user_data["role"]
        user_status = UserStatus.PENDING
        
    hashed_pwd = get_password_hash(user_data["password"])
    
    new_user = {
        "email": user_data["email"],
        "hashed_password": hashed_pwd,
        "name": user_data["name"],
        "phone": user_data["phone"],
        "house_number": user_data["house_number"],
        "address": user_data["address"],
        "role": role,
        "status": user_status,
        "created_at": datetime.utcnow()
    }
    
    result = await users_col.insert_one(new_user)
    new_user["id"] = str(result.inserted_id)
    
    # Audit log
    audit_col = get_audit_logs_collection()
    await audit_col.insert_one({
        "action": "User Registered",
        "performed_by": new_user["id"],
        "target_id": new_user["id"],
        "timestamp": datetime.utcnow(),
        "details": f"User {user_data['name']} ({role}) registered with status {user_status}."
    })
    
    # Clear registration cache
    pending_registrations.pop(email, None)
    
    return {"message": "Registration completed successfully! Your account is pending administrator approval."}

@router.post("/resend-registration-otps")
async def resend_registration_otps(req: ResendRegistrationRequest):
    email = req.email
    cached = pending_registrations.get(email)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active registration session found. Please register again."
        )
        
    now = datetime.utcnow()
    # Rate limit check (60 seconds cooldown)
    last_req = cached.get("last_requested_at")
    if last_req and (now - last_req).total_seconds() < 60:
        cooldown_rem = int(60 - (now - last_req).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Please wait {cooldown_rem} seconds before requesting a new verification code."
        )
        
    # Generate new Email OTP
    email_otp = f"{random.randint(100000, 999999)}"
    
    # Update cache
    cached["email_otp"] = email_otp
    cached["expires_at"] = now + timedelta(minutes=10)
    cached["last_requested_at"] = now
    
    # Send email
    from backend.services.email_service import send_email_notification
    send_email_notification(
        to_email=email,
        subject="Panchayat AI Registration Code (Resent)",
        body_text=f"Your email verification code is: {email_otp}\n\nNote: This code expires in 10 minutes."
    )
    
    # Log to console
    import logging
    auth_logger = logging.getLogger("panchayat_ai.auth")
    auth_logger.info(f"\n--- [REGISTRATION OTP RESEND DISPATCH] ---")
    auth_logger.info(f"Target Email: {email} | Email OTP: {email_otp}")
    auth_logger.info(f"-----------------------------------------\n")
    
    return {"message": "Verification code resent successfully."}

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    users_col = get_users_collection()
    user = await users_col.find_one({"email": credentials.email})
    
    if not user or not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user["id"] = str(user["_id"])
    
    # Check if suspended
    if user.get("status") == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended by the administrator."
        )
        
    # Generate token
    token_data = {"sub": user["email"]}
    access_token = create_access_token(data=token_data)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

# Endpoint supporting OAuth2 standard format logins (Swagger, etc.)
@router.post("/token")
async def login_oauth(form_data: OAuth2PasswordRequestForm = Depends()):
    users_col = get_users_collection()
    user = await users_col.find_one({"email": form_data.username})
    
    if not user or not verify_password(form_data.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    token_data = {"sub": user["email"]}
    access_token = create_access_token(data=token_data)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

@router.put("/me", response_model=UserResponse)
async def update_profile(profile_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    users_col = get_users_collection()
    
    update_fields = {}
    if profile_data.name is not None:
        update_fields["name"] = profile_data.name
    if profile_data.phone is not None:
        update_fields["phone"] = profile_data.phone
    if profile_data.house_number is not None:
        update_fields["house_number"] = profile_data.house_number
    if profile_data.address is not None:
        update_fields["address"] = profile_data.address
    if profile_data.password is not None:
        update_fields["hashed_password"] = get_password_hash(profile_data.password)
        
    if not update_fields:
        return current_user
        
    await users_col.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": update_fields}
    )
    
    updated_user = await users_col.find_one({"_id": ObjectId(current_user["id"])})
    updated_user["id"] = str(updated_user["_id"])
    return updated_user

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    users_col = get_users_collection()
    
    # Check if email exists in database
    user = await users_col.find_one({"email": req.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A user with this email address was not found in the database."
        )
        
    now = datetime.utcnow()
    
    # Rate limit check (60 seconds cooldown)
    if req.email in reset_otps:
        last_req = reset_otps[req.email].get("last_requested_at")
        if last_req and (now - last_req).total_seconds() < 60:
            cooldown_rem = int(60 - (now - last_req).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {cooldown_rem} seconds before requesting a new OTP."
            )
            
    # Generate 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    
    # Store OTP details in cache (expires in 5 minutes)
    reset_otps[req.email] = {
        "otp": otp,
        "expires_at": now + timedelta(minutes=5),
        "attempts": 0,
        "verified": False,
        "last_requested_at": now
    }
    
    # Log OTP code to console
    import logging
    auth_logger = logging.getLogger("panchayat_ai.auth")
    auth_logger.info(f"\n--- [FORGOT PASSWORD EMAIL OTP DISPATCH] ---")
    auth_logger.info(f"Target Email: {req.email} | User: {user.get('name')} | OTP Code: {otp}")
    auth_logger.info(f"---------------------------------------------\n")
    
    # Send email notification via SMTP
    from backend.services.email_service import send_email_notification
    send_email_notification(
        to_email=req.email,
        subject="Panchayat AI Password Reset Code",
        body_text=(
            f"Dear {user.get('name')},\n\n"
            f"We received a request to reset your password. Please enter this email verification OTP code to complete the reset: {otp}\n\n"
            f"Note: This code expires in 5 minutes.\n\n"
            f"Regards,\nPanchayat AI Team"
        )
    )
    
    return {"message": "OTP verification code sent to your registered email address."}

@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest):
    # Retrieve cached reset session
    cached = reset_otps.get(req.email)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP."
        )
        
    now = datetime.utcnow()
    
    # Check expiry
    if now > cached["expires_at"]:
        reset_otps.pop(req.email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP."
        )
        
    # Check maximum verification attempts (max 5)
    if cached.get("attempts", 0) >= 5:
        reset_otps.pop(req.email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum verification attempts exceeded. Please request a new OTP."
        )
        
    # Increment attempts
    cached["attempts"] = cached.get("attempts", 0) + 1
    
    # Verify OTP code
    if cached["otp"] != req.otp:
        # Return generic error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP."
        )
        
    # Success: Set verified flag and reset attempts
    cached["verified"] = True
    cached["attempts"] = 0
    
    return {"message": "OTP verified successfully. You may now reset your password."}

@router.post("/reset-password")
async def reset_password(reset_data: ForgotPasswordReset):
    users_col = get_users_collection()
    
    # Check if user exists
    user = await users_col.find_one({"email": reset_data.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A user with this email address was not found in the database."
        )
        
    # Retrieve cached reset session
    cached = reset_otps.get(reset_data.email)
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP."
        )
        
    now = datetime.utcnow()
    
    # Check expiry
    if now > cached["expires_at"]:
        reset_otps.pop(reset_data.email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP."
        )
        
    # Check if OTP matches
    if cached["otp"] != reset_data.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP."
        )
        
    # Check if OTP was verified
    if not cached.get("verified", False):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has not been verified."
        )
        
    # Hash new password and update user record
    hashed_pwd = get_password_hash(reset_data.new_password)
    res = await users_col.update_one(
        {"email": reset_data.email},
        {"$set": {"hashed_password": hashed_pwd}}
    )
    
    if res.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update password in the database."
        )
        
    # Clear cache
    reset_otps.pop(reset_data.email, None)
    
    return {"message": "Password updated successfully."}

@router.post("/resend-otp")
async def resend_otp(req: ForgotPasswordRequest):
    users_col = get_users_collection()
    
    # Check if email exists
    user = await users_col.find_one({"email": req.email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="A user with this email address was not found in the database."
        )
        
    # Check if active session exists
    if req.email not in reset_otps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active password reset session found. Please request a new code."
        )
        
    now = datetime.utcnow()
    
    # Rate limit check (60 seconds cooldown)
    if req.email in reset_otps:
        last_req = reset_otps[req.email].get("last_requested_at")
        if last_req and (now - last_req).total_seconds() < 60:
            cooldown_rem = int(60 - (now - last_req).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Please wait {cooldown_rem} seconds before requesting a new OTP."
            )
            
    # Generate new 6-digit OTP
    otp = f"{random.randint(100000, 999999)}"
    
    # Update cache (reset attempts and verified status, renew expiry)
    reset_otps[req.email] = {
        "otp": otp,
        "expires_at": now + timedelta(minutes=5),
        "attempts": 0,
        "verified": False,
        "last_requested_at": now
    }
    
    # Log OTP code to console
    import logging
    auth_logger = logging.getLogger("panchayat_ai.auth")
    auth_logger.info(f"\n--- [FORGOT PASSWORD EMAIL OTP RESEND DISPATCH] ---")
    auth_logger.info(f"Target Email: {req.email} | User: {user.get('name')} | OTP Code: {otp}")
    auth_logger.info(f"---------------------------------------------\n")
    
    # Send email notification via SMTP
    from backend.services.email_service import send_email_notification
    send_email_notification(
        to_email=req.email,
        subject="Panchayat AI Password Reset Code (Resent)",
        body_text=(
            f"Dear {user.get('name')},\n\n"
            f"Here is your new password reset verification code: {otp}\n\n"
            f"Note: This code expires in 5 minutes.\n\n"
            f"Regards,\nPanchayat AI Team"
        )
    )
    
    return {"message": "A new OTP verification code has been sent."}
