from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from ..core.database import get_auth_db
from ..models import catalog as models
from ..core import auth
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["auth"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[str] = "user"

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_auth_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = auth.create_access_token(
        data={"sub": user.username, "role": user.role}
    )
    
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "perm_dashboard": user.perm_dashboard,
            "perm_settings": user.perm_settings
        }
    }

@router.get("/me")
async def get_me(token: str = Depends(oauth2_scheme), db: Session = Depends(get_auth_db)):
    payload = auth.decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    username = payload.get("sub")
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role,
        "perm_dashboard": user.perm_dashboard,
        "perm_settings": user.perm_settings
    }

@router.get("/users")
async def get_users(db: Session = Depends(get_auth_db)):
    users = db.query(models.User).all()
    return {
        "success": True,
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "role": u.role,
                "perm_dashboard": u.perm_dashboard,
                "perm_settings": u.perm_settings,
                "perm_email": u.perm_email,
                "perm_whatsapp": u.perm_whatsapp,
                "perm_freshdesk": u.perm_freshdesk,
                "perm_inventory": u.perm_inventory,
                "created_at": u.created_at,
                "last_login": u.last_login
            } for u in users
        ]
    }

@router.post("/update_user")
async def update_user(data: dict, db: Session = Depends(get_auth_db)):
    user_id = data.get("id")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if "role" in data: user.role = data["role"]
    if "password" in data and data["password"]:
        user.password_hash = auth.get_password_hash(data["password"])
    
    perms = data.get("permissions", {})
    for k, v in perms.items():
        if hasattr(user, k):
            setattr(user, k, 1 if v else 0)
    
    db.commit()
    return {"success": True}

@router.post("/register")
async def register(user_data: UserCreate, db: Session = Depends(get_auth_db)):
    existing_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    new_user = models.User(
        username=user_data.username,
        password_hash=auth.get_password_hash(user_data.password),
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@router.post("/logout")
async def logout():
    return {"success": True, "message": "Logged out"}
