"""
Shared tag parsing utilities.
Single source of truth for tag categorization logic used across
dashboard_service and merchandising_service.
"""
from ..config import TOP_TAG_PREFIX, BESTSELLER_TAG_PREFIX, SPECIAL_TAGS
from typing import Dict, List


def parse_tags_categorized(tags_str: str) -> Dict[str, List[str]]:
    """
    Parses a flat Shopify tag string into categorized tiers.

    Returns a dict with keys: top, bestseller, special, others.
    """
    result: Dict[str, List[str]] = {"top": [], "bestseller": [], "special": [], "others": []}
    if not tags_str:
        return result

    for raw in tags_str.split(","):
        tag = raw.strip()
        if not tag:
            continue
        tag_lower = tag.lower()

        if any(s.lower() == tag_lower for s in SPECIAL_TAGS):
            result["special"].append(tag)
        elif tag_lower.startswith(TOP_TAG_PREFIX.lower()):
            # Strip prefix before storing so consumers get the clean value
            result["top"].append(tag[len(TOP_TAG_PREFIX):].strip())
        elif tag_lower.startswith(BESTSELLER_TAG_PREFIX.lower()):
            result["bestseller"].append(tag[len(BESTSELLER_TAG_PREFIX):].strip())
        else:
            result["others"].append(tag)

    return result
