import logging
from datetime import datetime

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ..models.catalog import ChangeLog

logger = logging.getLogger("product-intelligence.changelog")

CHANGE_TYPES = [
    {"value": "ALL", "label": "All Actions"},
    {"value": "PRICE_UPDATE", "label": "Price Updates"},
    {"value": "TAG_UPDATE", "label": "Tags Updates"},
]

STORES = [
    {"value": "ALL", "label": "All Storefronts"},
    {"value": "TDO", "label": "The Dress Outlet (TDO)"},
    {"value": "WDO", "label": "World Dress Outlet (WDO)"},
    {"value": "IM", "label": "Intimate (IM)"},
    {"value": "KOS", "label": "Main KOS"},
]


class ChangeLogService:

    def __init__(self, db: Session):
        self.db = db

    def get_logs(self, page: int = 1, limit: int = 20, style: str = None, change_type: str = None, store: str = None):
        query = self.db.query(ChangeLog)

        if style:
            query = query.filter(ChangeLog.style_number.ilike(f"%{style}%"))
        if change_type and change_type != "ALL":
            query = query.filter(ChangeLog.change_type == change_type)
        if store and store != "ALL":
            query = query.filter(ChangeLog.store_name == store)

        total_count = query.count()
        total_pages = max(1, (total_count + limit - 1) // limit)

        logs = (
            query.order_by(desc(ChangeLog.created_at))
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        return {
            "success": True,
            "logs": [
                {
                    "id": log.id,
                    "change_type": log.change_type,
                    "style": log.style_number,
                    "store": log.store_name or "TDO",
                    "changed_by": log.user_name or "Admin",
                    "old_value": log.old_value,
                    "new_value": log.new_value,
                    "created_at": log.created_at.isoformat() if log.created_at else None,
                }
                for log in logs
            ],
            "total_count": total_count,
            "total_pages": total_pages,
        }

    def get_filters(self):
        return {
            "success": True,
            "change_types": CHANGE_TYPES,
            "stores": STORES,
        }

    def log_change(self, change_type: str, style: str, store: str = None, changed_by: str = "Admin", old_value: str = None, new_value: str = None):
        log = ChangeLog(
            change_type=change_type,
            style_number=style,
            store_name=store,
            user_name=changed_by,
            old_value=old_value,
            new_value=new_value,
            created_at=datetime.utcnow(),
        )
        self.db.add(log)
        self.db.commit()
        logger.info(f"Change logged: {change_type} for {style} on {store} by {changed_by}")
