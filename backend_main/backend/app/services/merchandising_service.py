import csv
import io
import json
import logging
import time
from typing import Any, Dict, List, Optional

from sqlalchemy import case, desc, func, or_
from sqlalchemy.orm import Session

from ..config import BESTSELLER_TAG_PREFIX, SPECIAL_TAGS, TOP_TAG_PREFIX
from ..models.merchandising import (
    MerchAnalytics,
    MerchProduct,
    MerchProductAsset,
    MerchProductVariant,
    MerchShopifyProduct,
)

logger = logging.getLogger("product-intelligence.merchandising")


class MerchandisingService:
    def __init__(self, db: Session):
        self.db = db

    def get_report(
        self,
        page: int = 1,
        limit: int = 50,
        sort_by: Optional[str] = None,
        vendor: Optional[str] = None,
        search: Optional[str] = None,
        time_range: str = "90",
    ) -> Dict[str, Any]:
        start_time = time.time()
        query = self._report_query(vendor=vendor, search=search, sort_by=sort_by, time_range=time_range)

        total_count = query.count()
        results = query.offset((page - 1) * limit).limit(limit).all()
        product_ids = [row[0].product_id for row in results if row[0].product_id]
        image_map = self._bulk_fetch_images(product_ids)
        variant_map = self._bulk_fetch_variants(product_ids)

        data = [
            self._format_item(product, analytics, shopify_product, image_map, variant_map)
            for product, analytics, shopify_product in results
        ]

        logger.info(
            "Merchandising report built in %.3fs: page=%s limit=%s total=%s",
            time.time() - start_time,
            page,
            limit,
            total_count,
        )
        return {"total_count": total_count, "page": page, "limit": limit, "data": data}

    def get_stats(self, vendor: Optional[str] = None, search: Optional[str] = None, time_range: str = "90") -> Dict[str, Any]:
        base_query = self._base_filtered_query(vendor=vendor, search=search)
        total_styles = base_query.count()

        aggregate = (
            self.db.query(
                func.coalesce(func.sum(MerchProduct.total_inventory), 0),
                func.coalesce(func.sum(MerchAnalytics.pageview_90), 0),
                func.coalesce(func.sum(MerchAnalytics.shipstation_30), 0),
                func.coalesce(func.sum(MerchAnalytics.shipstation_60), 0),
                func.coalesce(func.sum(MerchAnalytics.shipstation_90), 0),
                func.avg(MerchAnalytics.returnrate_90),
            )
            .outerjoin(MerchAnalytics, MerchProduct.product_id == MerchAnalytics.product_id)
            .join(MerchShopifyProduct, MerchProduct.product_id == MerchShopifyProduct.product_id)
        )
        aggregate = self._apply_exclusion_filters(aggregate)
        aggregate = self._apply_common_filters(aggregate, vendor=vendor, search=search)
        row = aggregate.first()

        vendor_rows = (
            self.db.query(MerchShopifyProduct.vendor, func.count(MerchProduct.product_id))
            .join(MerchProduct, MerchShopifyProduct.product_id == MerchProduct.product_id)
        )
        vendor_rows = self._apply_exclusion_filters(vendor_rows)
        vendor_rows = self._apply_common_filters(vendor_rows, vendor=vendor, search=search)
        vendors = [
            {"name": name, "style_count": count}
            for name, count in vendor_rows.group_by(MerchShopifyProduct.vendor).all()
            if name
        ]
        vendors.sort(key=lambda item: item["style_count"], reverse=True)

        return {
            "total_styles": total_styles,
            "total_inventory": int(row[0] or 0) if row else 0,
            "total_pageviews": int(row[1] or 0) if row else 0,
            "avg_return_rate": round(float(row[5] or 0), 1) if row else 0.0,
            "total_sold": int(row[4] or 0) if row else 0,
            "total_sold_30": int(row[2] or 0) if row else 0,
            "total_sold_60": int(row[3] or 0) if row else 0,
            "total_sold_90": int(row[4] or 0) if row else 0,
            "vendors": vendors,
        }

    def get_csv(self, sort_by: Optional[str] = None, vendor: Optional[str] = None, search: Optional[str] = None, time_range: str = "90") -> str:
        query = self._report_query(vendor=vendor, search=search, sort_by=sort_by, time_range=time_range)
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "Style",
                "Title",
                "Vendor",
                "Retail Price",
                "Total Inventory",
                "Pageviews 30d",
                "Pageviews 60d",
                "Pageviews 90d",
                "Units Sold 30d",
                "Units Sold 60d",
                "Units Sold 90d",
                "Returns 90d",
                "Return Rate 90d",
            ],
        )
        writer.writeheader()
        for product, analytics, shopify_product in query.all():
            writer.writerow(
                {
                    "Style": product.style,
                    "Title": shopify_product.title if shopify_product else "",
                    "Vendor": shopify_product.vendor if shopify_product else "",
                    "Retail Price": product.price,
                    "Total Inventory": product.total_inventory or 0,
                    "Pageviews 30d": analytics.pageview_30 if analytics else 0,
                    "Pageviews 60d": analytics.pageview_60 if analytics else 0,
                    "Pageviews 90d": analytics.pageview_90 if analytics else 0,
                    "Units Sold 30d": analytics.shipstation_30 if analytics else 0,
                    "Units Sold 60d": analytics.shipstation_60 if analytics else 0,
                    "Units Sold 90d": analytics.shipstation_90 if analytics else 0,
                    "Returns 90d": analytics.return_90 if analytics else 0,
                    "Return Rate 90d": analytics.returnrate_90 if analytics else 0,
                }
            )
        return output.getvalue()

    def find_product_id(self, style: str) -> Optional[int]:
        product = self.db.query(MerchProduct).filter(MerchProduct.style == style).first()
        if not product:
            variant = self.db.query(MerchProductVariant).filter(MerchProductVariant.sku == style).first()
            if variant:
                product = self.db.query(MerchProduct).filter(MerchProduct.product_id == variant.product_id).first()
        if not product:
            return None
        return product.product_id

    def update_local_tags(self, product_id: int, tag_string: str) -> None:
        product = self.db.query(MerchProduct).filter(MerchProduct.product_id == product_id).first()
        shopify_product = self.db.query(MerchShopifyProduct).filter(MerchShopifyProduct.product_id == product.product_id).first()
        product.tags = tag_string
        if shopify_product:
            shopify_product.tags = tag_string
        self.db.commit()

    def _report_query(self, vendor: Optional[str], search: Optional[str], sort_by: Optional[str], time_range: str):
        query = (
            self.db.query(MerchProduct, MerchAnalytics, MerchShopifyProduct)
            .outerjoin(MerchAnalytics, MerchProduct.product_id == MerchAnalytics.product_id)
            .outerjoin(MerchShopifyProduct, MerchProduct.product_id == MerchShopifyProduct.product_id)
        )
        query = self._apply_exclusion_filters(query)
        query = self._apply_common_filters(query, vendor=vendor, search=search)
        return query.order_by(*self._order_by(sort_by=sort_by, search=search, time_range=time_range))

    def _base_filtered_query(self, vendor: Optional[str], search: Optional[str]):
        query = self.db.query(MerchProduct).join(MerchShopifyProduct, MerchProduct.product_id == MerchShopifyProduct.product_id)
        query = self._apply_exclusion_filters(query)
        return self._apply_common_filters(query, vendor=vendor, search=search)

    @staticmethod
    def _apply_exclusion_filters(query):
        return query.filter(
            MerchProduct.style.isnot(None),
            ~MerchProduct.style.like("D/%"),
            ~MerchProduct.style.like("S/%"),
            or_(MerchProduct.tags == None, ~MerchProduct.tags.ilike("%Sales%")),
            or_(MerchProduct.tags == None, ~MerchProduct.tags.ilike("%discontinue%")),
            or_(MerchShopifyProduct.tags == None, ~MerchShopifyProduct.tags.ilike("%discontinued%")),
        )

    @staticmethod
    def _apply_common_filters(query, vendor: Optional[str], search: Optional[str]):
        if vendor and vendor != "ALL":
            query = query.filter(MerchShopifyProduct.vendor == vendor)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    MerchProduct.style.ilike(search_term),
                    MerchShopifyProduct.sku.ilike(search_term),
                    MerchShopifyProduct.vendor.ilike(search_term),
                    MerchShopifyProduct.title.ilike(search_term),
                    MerchProduct.tags.ilike(search_term),
                    MerchShopifyProduct.tags.ilike(search_term),
                )
            )
        return query

    @staticmethod
    def _order_by(sort_by: Optional[str], search: Optional[str], time_range: str):
        suffix = {"30": "_30", "60": "_60", "90": "_90"}.get(str(time_range), "_90")
        priority = case((MerchProduct.style.like("#%"), 1), else_=0)
        clauses = []
        if search:
            clauses.append(case((MerchProduct.style == search, 0), (MerchProduct.style.ilike(f"{search}%"), 1), else_=2))
        clauses.append(priority)
        if sort_by == "pageviews_desc":
            clauses.append(desc(getattr(MerchAnalytics, f"pageview{suffix}", MerchAnalytics.pageview_90)))
        elif sort_by == "sell_thru_desc":
            clauses.append(desc(getattr(MerchAnalytics, f"shipstation{suffix}", MerchAnalytics.shipstation_90)))
        elif sort_by == "return_rate_desc":
            clauses.append(desc(getattr(MerchAnalytics, f"returnrate{suffix}", MerchAnalytics.returnrate_90)))
        elif sort_by == "top_tags_first":
            clauses.append(desc(MerchProduct.tags.ilike(f"%{TOP_TAG_PREFIX}%")))
        elif sort_by == "bestseller_first":
            clauses.append(desc(MerchProduct.tags.ilike(f"%{BESTSELLER_TAG_PREFIX}%")))
        elif sort_by == "special_first":
            clauses.append(desc(or_(*[MerchProduct.tags.ilike(f"%{tag}%") for tag in SPECIAL_TAGS])))
        clauses.append(desc(MerchProduct.created_at))
        return clauses

    def _bulk_fetch_images(self, product_ids: List[int]) -> Dict[int, str]:
        if not product_ids:
            return {}
        image_map = {}
        rows = (
            self.db.query(MerchProductAsset.product_id, MerchProductAsset.url)
            .filter(MerchProductAsset.product_id.in_(product_ids), MerchProductAsset.asset_type == "image")
            .order_by(MerchProductAsset.position.asc())
            .all()
        )
        for product_id, url in rows:
            image_map.setdefault(product_id, url)
        return image_map

    def _bulk_fetch_variants(self, product_ids: List[int]) -> Dict[int, List[MerchProductVariant]]:
        variant_map: Dict[int, List[MerchProductVariant]] = {}
        if not product_ids:
            return variant_map
        for variant in self.db.query(MerchProductVariant).filter(MerchProductVariant.product_id.in_(product_ids)).all():
            variant_map.setdefault(variant.product_id, []).append(variant)
        return variant_map

    def _format_item(self, product: MerchProduct, analytics: Optional[MerchAnalytics], shopify_product: Optional[MerchShopifyProduct], image_map, variant_map):
        sales_30 = self._parse_sku_sales(analytics.notes, "30") if analytics else {}
        sales_60 = self._parse_sku_sales(analytics.notes, "60") if analytics else {}
        sales_90 = self._parse_sku_sales(analytics.notes, "90") if analytics else {}
        variants = []
        sold_maps = {"30": {}, "60": {}, "90": {}}
        for variant in variant_map.get(product.product_id, []):
            key = f"{str(variant.color).lower()}-{str(variant.size).lower()}"
            sold_30 = self._variant_sold(variant, sales_30)
            sold_60 = self._variant_sold(variant, sales_60)
            sold_90 = self._variant_sold(variant, sales_90)
            sold_maps["30"][key] = sold_30
            sold_maps["60"][key] = sold_60
            sold_maps["90"][key] = sold_90
            variants.append(
                {
                    "id": variant.id,
                    "color": variant.color,
                    "size": variant.size,
                    "inventory": variant.inventory or 0,
                    "price": variant.price,
                    "sold": sold_90,
                    "sold_30": sold_30,
                    "sold_60": sold_60,
                    "sold_90": sold_90,
                }
            )

        tags = product.tags or (shopify_product.tags if shopify_product else "") or ""
        return {
            "sku": shopify_product.sku if shopify_product and shopify_product.sku else product.style,
            "style": product.style,
            "product_id": product.product_id,
            "handle": shopify_product.handle if shopify_product else None,
            "vendor": shopify_product.vendor if shopify_product else None,
            "image_url": image_map.get(product.product_id),
            "retail_price": product.price,
            "status": "ACTIVE" if product.product_id else "UNLINKED",
            "total_inventory": product.total_inventory or 0,
            "top_tags": self._parse_top_tags(tags, analytics.notes if analytics else None),
            "tags_categorized": self._parse_tags_categorized(tags),
            "notes": self._clean_notes(analytics.notes if analytics else ""),
            "variants": variants,
            "units_sold_30_by_variant": sold_maps["30"],
            "units_sold_60_by_variant": sold_maps["60"],
            "units_sold_by_variant": sold_maps["90"],
            "pageviews": {
                "days_30": analytics.pageview_30 or 0 if analytics else 0,
                "days_60": analytics.pageview_60 or 0 if analytics else 0,
                "days_90": analytics.pageview_90 or 0 if analytics else 0,
            },
            "pageviews_details": {
                "days_30": analytics.pageview_30 or 0 if analytics else 0,
                "days_60": analytics.pageview_60 or 0 if analytics else 0,
                "days_90": analytics.pageview_90 or 0 if analytics else 0,
            },
            "units_sold": {
                "days_30": self._total_sold(analytics.notes, "30") if analytics else 0,
                "days_60": self._total_sold(analytics.notes, "60") if analytics else 0,
                "days_90": self._total_sold(analytics.notes, "90") if analytics else 0,
            },
            "sell_thru_details": {
                "days_30": self._total_sold(analytics.notes, "30") if analytics else 0,
                "days_60": self._total_sold(analytics.notes, "60") if analytics else 0,
                "days_90": self._total_sold(analytics.notes, "90") if analytics else 0,
            },
            "returns": {
                "days_30": analytics.return_30 or 0 if analytics else 0,
                "days_60": analytics.return_60 or 0 if analytics else 0,
                "days_90": analytics.return_90 or 0 if analytics else 0,
            },
            "return_rates": {
                "days_30": analytics.returnrate_30 or 0 if analytics else 0,
                "days_60": analytics.returnrate_60 or 0 if analytics else 0,
                "days_90": analytics.returnrate_90 or 0 if analytics else 0,
            },
            "admin_link": product.admin_link,
        }

    @staticmethod
    def _parse_sku_sales(notes: Optional[str], time_range: str) -> Dict[str, int]:
        if not notes or not notes.strip().startswith("{"):
            return {}
        try:
            data = json.loads(notes)
            breakdown = data.get(f"{time_range}d") or data.get(time_range) or data.get("sku_breakdown", {})
            return breakdown if isinstance(breakdown, dict) else {}
        except Exception:
            return {}

    def _total_sold(self, notes: Optional[str], time_range: str) -> int:
        if not notes or not notes.strip().startswith("{"):
            return 0
        try:
            data = json.loads(notes)
            direct_key = f"{time_range}d_total_sold"
            if direct_key in data:
                return int(data[direct_key])
            if time_range == "90" and "total_sold" in data:
                return int(data["total_sold"])
            return int(sum(self._parse_sku_sales(notes, time_range).values()))
        except Exception:
            return 0

    @staticmethod
    def _variant_sold(variant: MerchProductVariant, breakdown: Dict[str, int]) -> int:
        color = str(variant.color or "").lower().strip()
        size = str(variant.size or "").lower().strip()
        for full_sku, count in breakdown.items():
            parts = [part.strip() for part in str(full_sku).lower().split("-")]
            if len(parts) >= 2 and parts[-1] == size and color in "-".join(parts[:-1]):
                return int(count)
        return 0

    @staticmethod
    def _parse_tags_categorized(tags: str) -> Dict[str, List[str]]:
        result = {"top": [], "bestseller": [], "special": [], "others": []}
        for raw in (tags or "").split(","):
            tag = raw.strip()
            tag_lower = tag.lower()
            if not tag:
                continue
            if any(special.lower() == tag_lower for special in SPECIAL_TAGS):
                result["special"].append(tag)
            elif tag_lower.startswith(TOP_TAG_PREFIX.lower()) or tag_lower.startswith("top"):
                result["top"].append(tag)
            elif tag_lower.startswith(BESTSELLER_TAG_PREFIX.lower()) or "best seller" in tag_lower or "bestseller" in tag_lower:
                result["bestseller"].append(tag)
            else:
                result["others"].append(tag)
        return result

    @staticmethod
    def _parse_top_tags(tags: str, notes: Optional[str] = None) -> List[str]:
        result = [tag.strip() for tag in (tags or "").split(",") if tag.strip().lower().startswith(("top", "best"))]
        notes_lower = (notes or "").lower()
        if "best" in notes_lower and not any("best" in tag.lower() for tag in result):
            result.append("Best Seller")
        if "top" in notes_lower and not any("top" in tag.lower() for tag in result):
            result.append("Top Performer")
        return result

    @staticmethod
    def _clean_notes(notes: Optional[str]) -> str:
        return (notes or "").replace("\u2192", "->").replace("\u2794", "->")
