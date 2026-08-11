from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from bson import ObjectId
from backend.auth.jwt import decode_access_token
from backend.database.connection import get_users_collection
from backend.schemas.user import UserRole, UserStatus

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception
        
    users_col = get_users_collection()
    user = await users_col.find_one({"email": email})
    if user is None:
        raise credentials_exception
        
    # Convert ObjectId to string for usability
    user["id"] = str(user["_id"])
    
    # Check suspension
    if user.get("status") == UserStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been suspended by the administrator."
        )
        
    return user

async def get_approved_user(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("status") == UserStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your registration is pending approval by the administrator."
        )
    return current_user

async def get_current_admin(current_user: dict = Depends(get_approved_user)) -> dict:
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have administrative privileges."
        )
    return current_user
