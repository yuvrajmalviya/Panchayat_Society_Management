from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    RESIDENT = "resident"
    ADMIN = "admin"

class UserStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    SUSPENDED = "suspended"

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)
    phone: str
    house_number: str
    address: str
    role: UserRole = UserRole.RESIDENT

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    house_number: Optional[str] = None
    address: Optional[str] = None
    password: Optional[str] = None

class AdminUserUpdate(BaseModel):
    status: Optional[UserStatus] = None
    role: Optional[UserRole] = None

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    name: str
    phone: str
    house_number: str
    address: str
    role: UserRole
    status: UserStatus
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordReset(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str = Field(..., min_length=6, max_length=6)

class VerifyRegistrationRequest(BaseModel):
    email: EmailStr
    email_otp: str = Field(..., min_length=6, max_length=6)

class ResendRegistrationRequest(BaseModel):
    email: EmailStr
