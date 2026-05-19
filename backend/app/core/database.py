import os
import platform
platform._wmi_query = lambda *a, **k: ("", "1", "", "", "")
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

from ..config import settings

# Main Database
SQLALCHEMY_DATABASE_URL = f"sqlite:///{settings.DB_URL}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Auth Database
AUTH_DATABASE_URL = f"sqlite:///{settings.AUTH_DB_URL}"
auth_engine = create_engine(AUTH_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
AuthSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=auth_engine)

# Merchandising Analytics Database
raw_merch_url = settings.DATABASE_URL or settings.DB_URL
MERCHANDISING_DATABASE_URL = raw_merch_url if raw_merch_url.startswith(("sqlite://", "postgresql://", "mysql://")) else f"sqlite:///{raw_merch_url}"
merch_engine = create_engine(MERCHANDISING_DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
MerchSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=merch_engine)

Base = declarative_base()
MerchBase = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_auth_db():
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_merch_db():
    db = MerchSessionLocal()
    try:
        yield db
    finally:
        db.close()
