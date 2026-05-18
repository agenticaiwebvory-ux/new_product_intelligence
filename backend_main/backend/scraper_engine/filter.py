"""
Product Scraper — Result Filter
Cleans, classifies, and deduplicates URLs:
1. Clean URLs (strip ?query params, fragments, trailing slashes)
2. Cross-check against same brand's existing URLs in cache → flag as EXISTING or NEW
3. Deduplicate across styles (same URL → keep first reference only)
4. Remove blacklisted domains / non-product pages
"""
import csv
import re
from urllib.parse import urlparse, urlunparse
from config import CACHE_CSV as CACHE_PATH


SKIP_DOMAINS = {
    "pinterest.com", "pinterest.co.uk", "dk.pinterest.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com",
    "youtube.com", "tiktok.com", "reddit.com", "quora.com",
    # Auto / hardware
    "analog.com", "digikey.com", "thermofisher.com", "napaonline.com",
    "summitracing.com", "partsgeek.com", "vividracing.com", "carid.com",
    "autozone.com", "oatey.com", "turbochargerpros.com", "jegs.com",
    "rockauto.com", "mouser.com", "sigmaaldrich.com", "antibodies.com",
    "biocompare.com", "genecards.org", "uniprot.org", "ncbi.nlm.nih.gov",
    # Golf / outdoor
    "newegg.com", "tourspecgolf.com", "golfavenue.com", "motosport.com",
    "rockymountainatvmc.com", "revzilla.com", "cyclegear.com", "golfgalaxy.com",
    "dickssportinggoods.com", "bhphotovideo.com", "bestbuy.com",
    # Electronics
    "bhphotovideo.com", "adorama.com", "staples.com", "officedepot.com",
    "microcenter.com", "frys.com", "lg.com", "samsung.com", "dell.com",
    "hp.com", "lenovo.com", "apple.com", "microsoft.com",
    # Industrial / scientific
    "grainger.com", "mcmaster.com", "fishersci.com", "vwr.com",
    "globalindustrial.com", "uline.com", "zoro.com", "msc.com",
    # Home / furniture
    "wayfair.com", "overstock.com", "furnituredepot.com", "rooms2go.com",
    "livingspaces.com", "havertys.com", "ashleyfurniturehomestore.com",
    # Pet / other
    "chewy.com", "petco.com", "petsmart.com", "costco.com", "samsclub.com",
    # Appliances / home improvement
    "whirlpool.com", "homedepot.com", "lowes.com", "menards.com",
    "acehardware.com", "build.com", "ferguson.com", "plumbersstock.com",
    "appliancesconnection.com", "aj-madison.com", "pcrichard.com",
    # Medical / legal / gov docs
    "hillrom.com", "medline.com", "fda.gov", "cdc.gov", "nih.gov",
    "sanantonio.gov", "reuters.com", "reutersconnect.com",
    "acsi.org", "chrono24.com", "watchuseek.com", "fratellowatches.com",
    # Firearms / shooting
    "titleistcertified.com", "shootingnewsweekly.com", "cabelas.com",
    "basspro.com", "midwayusa.com",
    # Real estate
    "zillow.com", "realtor.com", "redfin.com", "trulia.com",
    # Watches / jewellery retailers
    "deployant.com", "chrono24.com", "ba111od.com", "gearpatrol.com",
    "hodinkee.com", "fratellowatches.com", "ablogtowatch.com",
    "watchcrunch.com", "watchtime.com", "monochrome-watches.com",
    # Junk doc sites
    "ejcrim.com", "imageinfo.com",
}

SKIP_PATH_PATTERNS = [
    r"/search", r"/blog/", r"/news/", r"/about", r"/contact",
    r"/privacy", r"/terms",
]

# Keywords that indicate a result is NOT a clothing product
JUNK_KEYWORDS = [
    # Auto / mechanical
    "antibody", "exhaust", "muffler", "catalytic", "valve", "air dryer",
    "adhesive", "mounting bracket", "rivet", "airworthiness",
    "helicopter", "subfloor", "primer", "diaphragm", "grease",
    "o-ring", "gasket", "piston", "engine", "brake", "ignition",
    "turbocharger", "alternator", "carburetor", "radiator",
    # Electronics
    "lighting", "electronic", "datasheet", "sensor", "component",
    "headset", "mouse", "keyboard", "monitor", "laptop", "printer",
    "toner", "camera", "lens", "hard drive", "ssd", "motherboard",
    "processor", "graphics card", "router", "modem", "cable",
    # Scientific / industrial
    "scientific", "lab supply", "pipette", "reagent", "microplate",
    "industrial", "hardware", "software", "subscription",
    "chemical", "solvent", "microscope", "centrifuge",
    # Sport / outdoor
    "putter", "golf", "club", "shaft", "dirtbike", "enduro", "atv",
    "utv", "motorcycle", "automotive", "bicycle", "kayak", "canoe",
    "fishing", "hunting", "rifle", "ammunition", "firearm", "gun",
    # Shoes / bags
    "shoe", "shoes", "sneaker", "boot", "boots", "heel", "sandal",
    "handbag", "purse", "wallet", "backpack", "luggage", "suitcase",
    # Accessories that are NOT dress
    "sunglasses", "watch", "belt", "ring", "necklace", "bracelet",
    "earring", "hat", "cap", "scarf", "gloves", "socks", "lingerie",
    # Home / furniture
    "furniture", "chair", "table", "sofa", "couch", "mattress",
    "bedding", "curtain", "rug", "flooring", "carpet", "wallpaper",
    "paint", "faucet", "toilet", "tile",
    # Health / food / other
    "vitamin", "supplement", "protein", "medication", "medicine",
    "food", "snack", "beverage", "coffee", "tea",
    # Menswear / kids (not female dress)
    "men's suit", "men's shirt", "men's pants", "men's jacket",
    "boys", "infant", "toddler", "diaper",
    # Part / component catch-all
    "part number", "part no", "item no",
    # Appliances / home
    "oven", "range", "refrigerator", "dishwasher", "washer", "dryer",
    "microwave", "blender", "coffee maker", "air fryer", "toaster",
    "vacuum", "air conditioner", "air purifier", "water heater",
    # Undergarments / swimwear (not formal dresses)
    "underwear", "bra", "panty", "panties", "thong", "bikini",
    "swimsuit", "swimwear", "lingerie", "shapewear", "boxer",
    # Watches
    "tourbillon", "chronograph", "watchband", "watch strap",
    "wristwatch", "timepiece", "movement", "bezel", "rolex",
    "omega watch", "tudor watch", "tag heuer",
    # Real estate / docs
    "real estate", "property", "home for sale", "apartment",
    "accreditation", "newsletter", "press release", "invoice",
]

# Keywords that suggest a result IS a clothing product
CLOTHING_KEYWORDS = [
    "dress", "gown", "romper", "jumpsuit", "clothing", "apparel", "fashion",
    "sleeve", "neck", "waist", "skirt", "print", "knit", "crepe", "beaded",
    "sequin", "lace", "floral", "cocktail", "evening", "party", "bridal",
    "wedding", "maxi", "midi", "mini", "sheath", "chiffon", "velvet",
    "satin", "tulle", "prom", "homecoming", "quinceanera", "mother of the bride",
    "mother of the groom", "wedding guest", "formal", "semi-formal", "pageant",
    "sweet 16", "special occasion", "two piece", "pantsuit", "pant suit",
    "plus size", "curve", "maternity", "modest", "bat mitzvah", "damas",
    "bridesmaid", "bodycon", "a-line", "ballgown", "halter", "v-neck", "off the shoulder",
    "strapless", "women", "womens", "short", "ladies", "designer", "boutique",
]

# MANDATORY: at least ONE of these must appear in the title or URL
# for ANY result to pass — this is the primary "is it a dress?" gate.
MANDATORY_DRESS_TERMS = {
    "dress", "gown", "bridal", "bridesmaid", "prom", "cocktail",
    "evening gown", "ball gown", "ballgown", "jumpsuit", "romper",
    "quinceanera", "quincea\u00f1era", "formal wear", "formalwear",
    "wedding dress", "party dress", "maxi dress", "midi dress",
    "mini dress", "sheath dress", "bodycon dress",
}

# URL path segments that immediately disqualify a result
JUNK_URL_PATHS = [
    "/shoes/", "/shoe/", "/boots/", "/sneakers/", "/heels/",
    "/handbags/", "/bags/", "/purses/", "/wallets/",
    "/watches/", "/jewelry/", "/sunglasses/",
    "/furniture/", "/electronics/", "/computers/", "/laptops/",
    "/auto/", "/automotive/", "/tools/", "/hardware/",
    "/sports/", "/outdoors/", "/mens/", "/men/", "/boys/",
    "/kids/", "/baby/", "/toys/",
    "/food/", "/grocery/", "/health/", "/vitamins/",
    "/kitchen/", "/cooking/", "/appliances/", "/gas-range/",
    "/ranges/", "/ovens/", "/laundry/", "/refrigerators/",
    "/watches/", "/watch/", "/timepieces/",
    "/gun/", "/ammo/", "/shooting/", "/firearms/",
    "/property/", "/real-estate/", "/homes-for-sale/",
    "/swimwear/", "/swimsuit/", "/bikini/", "/lingerie/",
    "/underwear/", "/bra/", "/panties/",
    "/documents/", "/docs/", "/portals/", "/content/dam/",
]


def clean_url(url: str) -> str:
    """Strip query params, fragments, trailing slash."""
    if not url:
        return ""
    try:
        parsed = urlparse(url.strip())
        cleaned = urlunparse((parsed.scheme, parsed.netloc, parsed.path.rstrip("/"), "", "", ""))
        return cleaned
    except Exception:
        return url.strip()


def normalize_vendor(vendor: str) -> str:
    """Normalize vendor names so Betsy & Adam variants match."""
    v = vendor.lower().strip()
    if "betsy" in v or "adam" in v:
        return "betsy & adam"
    if "london" in v:
        return "london times"
    if "maggy" in v:
        return "maggy london"
    if "donna" in v:
        return "donna morgan"
    return v


def build_brand_url_index() -> dict:
    """
    Build index from cache: {normalized_vendor → {cleaned_url_lower → style_no}}
    Used to check if a URL already belongs to another style in the same brand.
    """
    index = {}  # vendor → {url → style}
    try:
        with open(CACHE_PATH, "r", encoding="utf-8-sig", errors="replace") as f:
            rows = list(csv.DictReader(f))
    except FileNotFoundError:
        return index

    for r in rows:
        vendor = normalize_vendor(r.get("Vendor", ""))
        style = (r.get("Style No") or "").strip()
        url = clean_url(r.get("Product URL", "")).lower()
        if not url or not vendor or not style:
            continue
        if vendor not in index:
            index[vendor] = {}
        index[vendor][url] = style

    return index


def classify_url(url: str, style: str) -> str:
    """Classify URL type."""
    if not url:
        return "NO_URL"
    parsed = urlparse(url)
    path = parsed.path.lower()
    domain = parsed.netloc.lower()

    if "/stores/" in path and "/products/" not in path:
        return "BRAND_PAGE"
    if any(p in path for p in ["/collections/", "/brands/"]):
        if style.lower() not in path:
            return "CATEGORY_PAGE"
    if "/shop/" in path and "/products/" not in path and "/product/" not in path:
        if style.lower() not in url.lower():
            return "CATEGORY_PAGE"
    if "foxliquidation" in domain or "liquidation" in domain:
        return "LIQUIDATION"
    return "PRODUCT"


def filter_results(results: list[dict], brand_name: str = None) -> list[dict]:
    """
    Filter, clean, and classify search results.

    For each URL:
    1. Clean it (strip query junk)
    2. Skip blacklisted domains / non-product paths
    3. Cross-check against same brand's existing URLs in cache
       - If URL already exists under a DIFFERENT style in same brand →
         mark as EXISTING_IN_BRAND (it's not a new product, it's noise from same brand)
       - If URL is new → mark as NEW_PRODUCT
    4. Dedupe across styles (same URL → first reference only)
    5. Classify URL type (PRODUCT / BRAND_PAGE / CATEGORY_PAGE / LIQUIDATION)
    """
    # Load existing brand URL index from cache
    brand_index = build_brand_url_index()
    norm_brand = normalize_vendor(brand_name) if brand_name else ""

    filtered = []
    seen_urls = set()

    new_count = 0
    existing_count = 0

    for r in results:
        url = (r.get("Product URL") or "").strip()
        style = (r.get("Style No") or "").strip()
        title = (r.get("source_title") or "").lower()

        if not url or not style:
            if style and not url:
                r["Link Status"] = "NO_URL"
                r["URL Type"] = "NO_URL"
                filtered.append(r)
            continue

        # 1. Clean URL
        cleaned = clean_url(url)

        # 2. Parse & skip blacklisted domains
        try:
            parsed = urlparse(cleaned)
            domain = parsed.netloc.lower().replace("www.", "")
        except Exception:
            continue

        if any(skip in domain for skip in SKIP_DOMAINS):
            print(f"  [DEBUG-DROP] domain {domain} in SKIP_DOMAINS: {url}")
            continue

        path = parsed.path.lower()
        if any(re.search(pat, path) for pat in SKIP_PATH_PATTERNS):
            print(f"  [DEBUG-DROP] path {path} in SKIP_PATH_PATTERNS: {url}")
            continue

        # 2a. Explicit Style Mismatch Check
        # If the URL path explicitly contains a DIFFERENT style number of the same format, drop it.
        # This prevents picking up '3497X' when searching for '7274X'.
        style_clean = style.upper()
        if re.match(r'^\d{3,5}[A-Z]$', style_clean):
            # E.g. 7274X -> 4 digits + 1 letter. We look for exactly that shape in the URL path.
            digit_len = len(style_clean) - 1
            shape_regex = rf'\b\d{{{digit_len}}}[A-Za-z]\b'
            found_shapes = re.findall(shape_regex, path)
            if any(fs.upper() != style_clean for fs in found_shapes):
                print(f"  [DEBUG-DROP] URL path contains a DIFFERENT style number {found_shapes} (expected {style_clean}): {url}")
                continue

        # 2a. URL-path junk check: reject if URL path has a known non-dress segment
        if any(jp in path for jp in JUNK_URL_PATHS):
            print(f"  [DEBUG-DROP] junk path {path}: {url}")
            continue

        # 2b. Junk Keyword Check (Title validation) - Immediate rejection
        # Use regex word boundaries to avoid 'cap' matching 'xscape' or 'shoe' matching 'shoulder'
        junk_found = next((junk for junk in JUNK_KEYWORDS if re.search(r'\b' + re.escape(junk) + r'\b', title)), None)
        if junk_found:
            print(f"  [DEBUG-DROP] junk keyword '{junk_found}' in title '{title}': {url}")
            continue

        # 2c. MANDATORY DRESS CHECK — Title OR URL must prove it’s a female dress.
        # This is the primary gate. Even a trusted fashion domain must pass.
        title_plus_url = title + " " + (cleaned or url).lower()
        snippet = (r.get("snippet") or "").lower()
        full_signal = title_plus_url + " " + snippet
        if not any(dt in full_signal for dt in CLOTHING_KEYWORDS):
            print(f"  [REJECT] No clothing keyword found — '{title[:70]}'")
            continue

        # 2d. Apparel-First Validation
        # List of domains that are 100% dedicated to fashion/dresses
        TRUSTED_FASHION_DOMAINS = [
            "thedressoutlet.com", "adriannapapell.com", "davidsbridal.com",
            "lulus.com", "revolve.com", "asos.com", "zara.com", "couturecandy.com",
            "adasa.com", "curatedbrands.co", "next.us", "macys.com", "nordstrom.com",
            "belk.com", "dillards.com", "bloomingdales.com", "saksfifthavenue.com",
            "neimanmarcus.com", "lordandtaylor.com", "dressthepopulation.com",
            "jovani.com", "teranicouture.com", "sherrihill.com",
        ]
        
        is_trusted_fashion = any(k in domain for k in TRUSTED_FASHION_DOMAINS)
        has_clothing_keyword = any(cw in title for cw in CLOTHING_KEYWORDS)
        
        # STRICTOR RULE: If it's not a trusted fashion domain, it MUST have a clothing keyword.
        # Even for trusted domains, if it has a JUNK keyword (checked above), it's already gone.
        if not is_trusted_fashion and not has_clothing_keyword:
            # This blocks random tech/golf/auto sites that don't explicitly mention 'Dress', 'Gown', etc.
            print(f"  [DEBUG-DROP] not trusted domain and no clothing keyword in title '{title}': {url}")
            continue
            


        # 3. Cross-style dedup (Global for this batch)
        url_key = cleaned.lower()
        if url_key in seen_urls:
            # Skip if we already found this URL for another style in this run
            print(f"  [DEBUG-DROP] URL already seen in this batch: {url}")
            continue
        seen_urls.add(url_key)

        # 4. Cross-check against same brand's existing URLs in cache
        brand_lookup = brand_index.get(norm_brand, {})
        existing_style = brand_lookup.get(url_key)

        if existing_style and existing_style != style:
            r["Link Status"] = f"EXISTING_IN_BRAND ({existing_style})"
            existing_count += 1
        else:
            r["Link Status"] = "NEW_PRODUCT"
            new_count += 1

        # 5. Classify URL type
        r["URL Type"] = classify_url(cleaned, style)
        r["Product URL"] = cleaned
        filtered.append(r)

    print(f"  🔍 Filter results:")
    print(f"     Input:              {len(results)}")
    print(f"     After clean+dedup:  {len(filtered)}")
    print(f"     NEW_PRODUCT:        {new_count}")
    print(f"     EXISTING_IN_BRAND:  {existing_count} (skipped - found under different style in cache)")

    return filtered
