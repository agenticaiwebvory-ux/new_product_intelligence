"""
Product Scraper — Serper Search
Uses Serper.dev API (Google Search) to find where products are listed online.

v4.1: Parallel search with ThreadPoolExecutor — up to 20 concurrent Serper calls.
"""
import json
import time
import re
import httpx
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import sys
from config import SERPER_API_KEY, MAX_RESULTS_PER_QUERY, SEARCH_DELAY_SECONDS

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


SERPER_URL = "https://google.serper.dev/search"

# ── Parallelism settings ──
MAX_WORKERS = 20           # concurrent Serper requests
REQUEST_TIMEOUT = 20       # seconds per request
MAX_RETRIES = 2            # retry on transient errors

# ── Strict allowlist: BOTH conditions must pass for a URL to be accepted ──
#
# Condition 1 — Title must contain an EXPLICIT garment word.
#   'women', 'evening', 'formal' alone are too vague — a washing machine ad
#   can say "women's formal". We require an actual garment noun.
EXPLICIT_GARMENT_TERMS = {
    "dress", "gown", "jumpsuit", "romper", "bridesmaid", "bridal",
    "prom", "cocktail dress", "evening gown", "ball gown", "ballgown",
    "wedding dress", "party dress", "maxi dress", "midi dress",
    "mini dress", "sheath dress", "bodycon dress", "formal dress",
    "evening dress", "off the shoulder dress", "strapless dress",
    "a-line dress", "crepe dress", "satin dress", "lace dress",
}

# Condition 2 — URL must contain a product-page path segment.
#   /shop/, /collections/, /browse/ are CATEGORY pages — rejected.
#   Only accept URLs with known individual-product path patterns.
PRODUCT_URL_SIGNALS = [
    "/products/",   # Shopify (xscapeevenings, adriannapapell, etc.)
    "/product/",    # David's Bridal, many retailers
    "/p/",          # Belk, Bloomingdale's, etc.
    "/dp/",         # Amazon
    "/item/",       # Nordstrom, JCPenney, etc.
    "/itm/",        # eBay individual items
    "/listing/",    # Poshmark, some boutiques
    "/prod/",       # BeyondStyle and similar
    "/detail/",     # Some department stores
]

def _is_product_url(url: str) -> bool:
    u = url.lower()
    return any(sig in u for sig in PRODUCT_URL_SIGNALS)

def _has_garment_term(title: str) -> bool:
    t = title.lower()
    return any(g in t for g in EXPLICIT_GARMENT_TERMS)

def _allowlist_pass(title: str, url: str) -> bool:
    """Return True only if the result is clearly a retail dress product page."""
    return _has_garment_term(title) and _is_product_url(url)



def fetch_shopify_image(url: str) -> str | None:
    """
    Attempt to fetch the high-res product image by appending .json to Shopify URLs.
    """
    if not url or "/products/" not in url:
        return None
    
    # Clean URL and add .json
    base_url = url.split("?")[0].split("#")[0].rstrip("/")
    json_url = f"{base_url}.json"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        resp = httpx.get(json_url, headers=headers, timeout=5, follow_redirects=True)
        if resp.status_code == 200:
            data = resp.json()
            # 1. Try images list
            images = data.get("product", {}).get("images", [])
            if images and isinstance(images, list):
                return images[0].get("src")
            
            # 2. Try single image object
            single_img = data.get("product", {}).get("image", {})
            if single_img and isinstance(single_img, dict):
                return single_img.get("src")
                
    except Exception:
        pass
    return None


def search_product_listings(style_info: dict, brand_name: str) -> list[dict]:
    """
    Search Google via Serper for a product style number + brand.
    Returns ONLY results that pass the strict allowlist:
      - Title contains an explicit garment term (dress, gown, romper...)
      - URL looks like an individual product page (/products/, /dp/, /p/...)
    If nothing passes, returns empty list — no junk URLs added.
    """
    style_no   = style_info.get("Style No", "") if isinstance(style_info, dict) else style_info
    desc       = style_info.get("Description", "") if isinstance(style_info, dict) else ""

    if not SERPER_API_KEY:
        print(f"  ⚠️ No SERPER_API_KEY set — skipping search for {style_no}")
        return []

    # Build query: style number is the anchor, description helps when style# is obscure
    if desc and len(desc) < 60:
        query = f"{brand_name} {style_no} {desc} dress"
    else:
        query = f"{brand_name} {style_no} dress"

    headers = {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "q": query,
        "num": MAX_RESULTS_PER_QUERY
    }

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            resp = httpx.post(SERPER_URL, json=payload, headers=headers, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
            
            raw_organic = len(data.get("organic", []))
            raw_shopping = len(data.get("shopping", []))
            print(f"  [DEBUG] Serper raw results for {style_no}: {raw_organic} organic, {raw_shopping} shopping")
            break
        except Exception as e:
            last_error = e
            if attempt < MAX_RETRIES:
                time.sleep(1 * (attempt + 1))  # backoff: 1s, 2s
                continue
            print(f"  [ERROR] Serper error for {style_no} (after {MAX_RETRIES + 1} attempts): {e}")
            return []

    results = []

    # Process organic results
    for item in data.get("organic", []):
        url   = item.get("link", "")
        title = item.get("title", "")

        # ── Strict allowlist: must be a real dress product page ──
        if not _allowlist_pass(title, url):
            print(f"  [SKIP] {title[:60]} | {url[:60]}")
            continue

        price  = extract_price(item.get("snippet", "")) or extract_price(title)
        image  = item.get("imageUrl") or item.get("thumbnail")
        shopify_img = fetch_shopify_image(url)
        if shopify_img:
            image = shopify_img

        results.append({
            "Style No":     style_no,
            "Product URL":  url,
            "Price (USD)":  price,
            "Image Link":   image,
            "source_title": title,
        })

    # Process shopping results
    for item in data.get("shopping", []):
        url   = item.get("link", "")
        title = item.get("title", "")

        if not _allowlist_pass(title, url):
            print(f"  [SKIP-shop] {title[:60]}")
            continue

        price  = extract_price(item.get("price", ""))
        image  = item.get("imageUrl") or item.get("thumbnail")
        shopify_img = fetch_shopify_image(url)
        if shopify_img:
            image = shopify_img

        results.append({
            "Style No":     style_no,
            "Product URL":  url,
            "Price (USD)":  price,
            "Image Link":   image,
            "source_title": title,
        })

    # Fallback: if no image was found, do a targeted dress image search
    if not any(r.get("Image Link") for r in results):
        # Use a dress-specific image query so we don't pull in random photos
        img_payload = {"q": query, "num": 5}
        for attempt in range(2):
            try:
                img_resp = httpx.post(
                    "https://google.serper.dev/images", 
                    json=img_payload, 
                    headers=headers, 
                    timeout=REQUEST_TIMEOUT
                )
                if img_resp.status_code == 200:
                    img_data = img_resp.json()
                    # Accept only images whose title has a dress signal
                    first_img = None
                    for img_item in img_data.get("images", []):
                        img_title = img_item.get("title", "").lower()
                        if any(term in img_title for term in EXPLICIT_GARMENT_TERMS):
                            first_img = img_item.get("imageUrl") or img_item.get("thumbnail")
                            if first_img:
                                break
                    # If strict check found nothing, fall back to first image
                    if not first_img:
                        for img_item in img_data.get("images", []):
                            first_img = img_item.get("imageUrl") or img_item.get("thumbnail")
                            if first_img:
                                break

                    if first_img:
                        for r in results:
                            if not r.get("Image Link"):
                                r["Image Link"] = first_img
                        if not results:
                            results.append({
                                "Style No": style_no,
                                "Product URL": "",
                                "Price (USD)": None,
                                "Image Link": first_img,
                                "source_title": "Image Search Fallback"
                            })
                    break
                elif img_resp.status_code == 429:
                    time.sleep(2)
            except Exception:
                pass

    return results


def extract_price(text: str) -> float | None:
    """Extract a USD price from text."""
    if not text:
        return None
    match = re.search(r'\$\s?(\d+(?:\.\d{1,2})?)', text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None


def batch_search(styles: list[dict], brand_name: str, delay: float = None,
                 max_workers: int = None, progress_callback=None) -> list[dict]:
    """
    Search for multiple style numbers in PARALLEL.

    Args:
        styles: list of dicts with "Style No" and optional "Total Qty"
        brand_name: vendor/brand name for search query
        delay: ignored (kept for backward compat) — parallelism replaces serial delay
        max_workers: number of concurrent requests (default: MAX_WORKERS = 20)
        progress_callback: optional callable(completed, total, style_no) for progress tracking

    Returns:
        list of all found listings (flat list)
    """
    if max_workers is None:
        max_workers = MAX_WORKERS

    total = len(styles)
    all_results = []
    completed_count = 0
    lock = threading.Lock()

    print(f"  [SEARCH] Parallel search: {total} styles × {max_workers} workers")

    def _search_one(style_info):
        """Search a single style — runs inside a thread."""
        nonlocal completed_count
        style_no = style_info["Style No"]

        results = search_product_listings(style_info, brand_name)

        # Annotate results with all original metadata from style_info
        for r in results:
            for key, val in style_info.items():
                if key not in r:
                    r[key] = val
            r["Vendor Name"] = brand_name

        with lock:
            completed_count += 1
            c = completed_count
        print(f"  [FOUND] [{c}/{total}] {style_no} → {len(results)} listings")

        if progress_callback:
            progress_callback(c, total, style_no)

        return results

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_search_one, s): s for s in styles}

        for future in as_completed(futures):
            try:
                results = future.result()
                all_results.extend(results)
            except Exception as e:
                style_info = futures[future]
                print(f"  [ERROR] Thread error for {style_info['Style No']}: {e}")

    print(f"  [DONE] Parallel search done: {len(all_results)} total listings from {total} styles")
    return all_results
