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
        elif tag_lower.startswith("top") and (
            tag_lower.startswith(TOP_TAG_PREFIX.lower()) 
            or (len(tag) > 3 and (tag[3].isupper() or tag[3] in (" ", ":")))
        ):
            prefix_len = 3
            if len(tag) > 3 and tag[3] in (":", " "):
                prefix_len = 4
            result["top"].append(tag[prefix_len:].strip())
        elif tag_lower.startswith("best") and (
            tag_lower.startswith(BESTSELLER_TAG_PREFIX.lower())
            or (len(tag) > 4 and (tag[4].isupper() or tag[4] in (" ", ":")))
        ):
            prefix_len = 4
            if len(tag) > 4 and tag[4] in (":", " "):
                prefix_len = 5
            result["bestseller"].append(tag[prefix_len:].strip())
        else:
            result["others"].append(tag)

    return result
