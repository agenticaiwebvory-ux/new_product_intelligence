"""
pdf_to_csv.py -- Rich PDF Product Data Extractor  v3
=====================================================
Extracts Style, Description, Color, Sizes, Inventory, Price, Image Link
from vendor PDFs and writes a flat CSV — one row per style+color.

Supported PDFs:
  1. AP OP 4.28        -- label/value format (Style Number:, Color:, Wholesale:, etc.)
  2. Betsy & Adam      -- closeout catalog (Description:/StyleNo/colors left-col;
                          inv codes + prices right-col dumped at page end)
  3. BRIDAL-11-21      -- Stella Couture inventory (** STYLE: / sizes / color abbrevs)

Fixed bugs (v3):
  AP OP   BUG: Total Qty = first per-size qty (e.g. 19) instead of sum (174).
               Fix: sum all qty_per_size values.
  Betsy   BUG: Inventory codes appear at PAGE END, not inside style blocks.
               Color token and qty are on SEPARATE lines ("BLACK\\n29U").
               Fix: per-page right-column pass collects (color_token, qty) pairs;
               prices zipped to styles in page order.
  Betsy   BUG: 45/51 styles had no price.  Fix: per-page price list zipped to styles.
  Betsy   BUG: Total Qty always blank.  Fix: qty from featured inv entry per style.
  Bridal  BUG: 24 duplicate style+color rows.
               Fix: deduplicate after parsing, keep row with most data.
  All     ADD: Image Link column (blank placeholder — filled by scraper later).
"""

import re
import csv
import os
import sys
import argparse
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    import fitz  # PyMuPDF
except ImportError:
    print("[ERROR] PyMuPDF not installed. Run: pip install PyMuPDF")
    sys.exit(1)

BASE_DIR   = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "output"

CSV_COLUMNS = [
    "Source PDF",
    "Style No",
    "Description",
    "Color",
    "Sizes Available",
    "Total Qty",
    "Inventory Detail",
    "Wholesale Price",
    "Retail Price",
    "Image Link",
    "Season",
    "Fabric",
    "Country of Origin",
    "Vendor",
]


# =============================================================================
# DETECTOR
# =============================================================================

def detect_pdf_type(text: str) -> str:
    if "STELLA COUTURE" in text or "STY3302" in text or "STYLE INVENTORY SUMMARY" in text:
        return "bridal"
    if "CLOSE OUTS" in text.upper() and ("Image Info" in text or "imageinfo" in text.lower()):
        return "betsy_closeout"
    if "Style Number:" in text and "Wholesale:" in text and "Retail:" in text:
        return "ap_op"
    return "ap_op"


# =============================================================================
# PARSER 1 -- AP OP 4.28
# =============================================================================

def parse_ap_op(lines: list, pdf_name: str) -> list:
    """
    Parse AP OP closeout sheet. One record per style+color.

    BUG FIX: Total Qty was set to the FIRST per-size qty instead of the sum.
    Fix: sum all qty_per_size values; use 'Total' keyword line as cross-check.
    """
    records = []

    KNOWN_SIZES   = {"0","2","4","6","8","10","12","14","16","18","20","22","24","26","28","30","32"}
    GROUP_LETTERS = {"M", "W", "P", "X", "G"}

    def next_nonempty(i, n=3):
        for j in range(i + 1, min(i + n + 1, len(lines))):
            v = lines[j].strip()
            if v:
                return v
        return ""

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        if line.lower().startswith("style number"):
            style_no    = next_nonempty(i)
            wholesale   = ""
            retail      = ""
            color       = ""
            season      = ""
            fabric      = ""
            country     = ""
            description = ""

            j = i + 1
            while j < len(lines):
                l       = lines[j].strip()
                l_lower = l.lower().rstrip(":")

                if l_lower == "style number":
                    break

                if   l_lower == "wholesale":
                    wholesale = next_nonempty(j)
                elif l_lower == "retail":
                    retail = next_nonempty(j)
                elif l_lower == "color":
                    color = next_nonempty(j)
                elif l_lower == "season":
                    season = next_nonempty(j)
                elif l_lower in ("main fabric content", "fabric content", "fabric"):
                    fabric = next_nonempty(j)
                elif l.lower().startswith("main fabric content:"):
                    fabric = l.split(":", 1)[1].strip()
                elif l.lower().startswith("description:"):
                    description = l.split(":", 1)[1].strip()
                elif l.lower().startswith("country of origin:"):
                    country = l.split(":", 1)[1].strip()

                j += 1

            # ── Sizes + per-size qtys ──
            sizes_available    = []
            qty_per_size       = []
            total_from_keyword = None
            k     = i + 1
            phase = "before_sizes"

            while k < j:
                l = lines[k].strip()

                if phase == "before_sizes" and l in KNOWN_SIZES:
                    phase = "collecting_sizes"

                if phase == "collecting_sizes":
                    if l in KNOWN_SIZES:
                        sizes_available.append(l)
                        k += 1
                        continue
                    elif l in GROUP_LETTERS:
                        phase = "collecting_qtys"
                        k += 1
                        continue
                    elif sizes_available:
                        phase = "collecting_qtys"

                if phase == "collecting_qtys":
                    if re.fullmatch(r"\d+", l):
                        if len(qty_per_size) < len(sizes_available):
                            qty_per_size.append(int(l))
                        k += 1
                        continue
                    if l == "Total":
                        for m in range(k + 1, min(k + 5, j)):
                            candidate = lines[m].strip()
                            if re.fullmatch(r"\d+", candidate):
                                total_from_keyword = int(candidate)
                                break

                k += 1

            # BUG FIX: sum per-size qtys (was using first qty as total)
            total_qty = sum(qty_per_size) if qty_per_size else None
            if total_from_keyword is not None:
                if total_qty is None or total_from_keyword > total_qty:
                    total_qty = total_from_keyword

            inv_detail = ""
            if sizes_available and qty_per_size:
                inv_detail = " | ".join(f"{s}:{q}" for s, q in zip(sizes_available, qty_per_size))

            if style_no:
                records.append({
                    "Source PDF":        pdf_name,
                    "Style No":          style_no,
                    "Description":       description,
                    "Color":             color,
                    "Sizes Available":   ", ".join(sizes_available),
                    "Total Qty":         total_qty if total_qty is not None else "",
                    "Inventory Detail":  inv_detail,
                    "Wholesale Price":   wholesale,
                    "Retail Price":      retail,
                    "Image Link":        "",
                    "Season":            season,
                    "Fabric":            fabric,
                    "Country of Origin": country,
                    "Vendor":            "AP / Ann Page",
                })
            i = j
        else:
            i += 1

    return records


# =============================================================================
# PARSER 2 -- Betsy & Adam Closeouts
# =============================================================================

def parse_betsy_closeout(pdf_path: str, pdf_name: str) -> list:
    """
    Parse Betsy & Adam closeout PDF — processes one page at a time.

    CRITICAL structure insight (confirmed from PDF inspection):
      PyMuPDF extracts text column-by-column within a page. Per page:

      LEFT COLUMN (lines 0..N):
        Description: LNG STRPLS VELVT LEG SLIT
        A20144
        Azure
        Black
        ...
        Description: LNG SCUBA 1SHLDR GOWN
        A18798
        ...

      PAGE FOOTER (noise):
        4/21/26  PAGE 1  (c) 2006 Image Info  www.imageinfo.com

      RIGHT COLUMN (dumped after footer):
        BLACK       <- featured color token (ALL-CAPS, may split: "BLK/" + "WHITE")
        29U         <- qty for that color
        BURG
        16U
        ...
        $35         <- prices, ONE per style, in same left-column order
        $35
        $40
        ...

    Mapping: there is exactly ONE (color, qty) pair and ONE price per style per page,
    in the same order as styles appear in the left column.

    BUG FIXES:
      - Inventory never extracted (appeared outside style block boundaries).
      - 45/51 styles had no price (index-based price assignment failed).
      - Color names were polluted with ALL-CAPS inv tokens.
      - Total Qty always blank.
    """
    doc     = fitz.open(pdf_path)
    records = []

    STYLE_RE    = re.compile(r"^(A\d{4,6}[A-Z]?\d?[A-Z]?)$")
    DESC_RE     = re.compile(r"^Description:\s*(.+)", re.IGNORECASE)
    PRICE_RE    = re.compile(r"^\$(\d+(?:\.\d+)?)$")
    QTY_RE      = re.compile(r"^(\d+)U?$", re.IGNORECASE)
    NOISE_RE    = re.compile(
        r"^(\d{1,2}/\d{1,2}/\d{2,4}|PAGE\s*\d+|©|www\.|Image Info"
        r"|CLOSE OUTS|Betsy|Xscape|Blondie|Confidential|May NOT)",
        re.IGNORECASE,
    )
    # ALL-CAPS color token: letters + optional trailing "/"
    INV_TOKEN_RE = re.compile(r"^([A-Z]{2,}(?:/[A-Z]*)?)$")

    def is_color_name(s):
        """True if s looks like a product color name (mixed/title case, short)."""
        if not s or len(s) > 30 or "," in s:
            return False
        if s.replace(" ", "").isdigit():
            return False
        if not re.search(r"[A-Za-z]", s):
            return False
        # Bare ALL-CAPS short tokens are inv codes, not color names
        if re.fullmatch(r"[A-Z][A-Z/\s]*", s) and len(s) <= 15:
            return False
        return True

    for page_num in range(len(doc)):
        page  = doc[page_num]
        lines = [l.strip() for l in page.get_text().split("\n")]

        # ── Find page footer boundary ──
        footer_idx = len(lines)
        for idx, l in enumerate(lines):
            if NOISE_RE.match(l) and re.search(r"\d{4}", l):
                footer_idx = idx
                break

        left_lines  = lines[:footer_idx]
        right_lines = lines[footer_idx:]

        # ── Collect styles + color names from left column ──
        page_styles  = []
        style_colors = {}
        style_desc   = {}
        current_desc  = ""
        current_style = None

        for l in left_lines:
            if not l:
                continue
            dm = DESC_RE.match(l)
            if dm:
                current_desc  = dm.group(1).strip()
                current_style = None
                continue
            sm = STYLE_RE.match(l)
            if sm and current_desc:
                sno = l
                if sno not in style_desc:
                    page_styles.append(sno)
                    style_desc[sno]   = current_desc
                    style_colors[sno] = []
                current_style = sno
                current_desc  = ""
                continue
            if current_style and is_color_name(l):
                style_colors[current_style].append(l)

        # ── Parse right column: inv token+qty pairs then prices ──
        inv_entries = []   # list of [color_token, qty]
        prices      = []

        idx = 0
        # Skip noise lines at start of right section
        while idx < len(right_lines) and (
            not right_lines[idx] or NOISE_RE.match(right_lines[idx])
        ):
            idx += 1

        while idx < len(right_lines):
            l = right_lines[idx]
            if not l:
                idx += 1
                continue

            pm = PRICE_RE.match(l)
            if pm:
                prices.append(f"${pm.group(1)}")
                idx += 1
                continue

            # Qty: fills the pending color token
            qm = QTY_RE.match(l)
            if qm and inv_entries and inv_entries[-1][1] is None:
                inv_entries[-1][1] = int(qm.group(1))
                idx += 1
                continue

            # Color token (ALL-CAPS)
            tm = INV_TOKEN_RE.match(l)
            if tm:
                token = l
                # Join split tokens: "BLK/" + "WHITE" -> "BLK/WHITE"
                if token.endswith("/"):
                    nxt_idx = idx + 1
                    while nxt_idx < len(right_lines) and not right_lines[nxt_idx]:
                        nxt_idx += 1
                    if nxt_idx < len(right_lines):
                        nxt = right_lines[nxt_idx]
                        if INV_TOKEN_RE.match(nxt) and not QTY_RE.match(nxt):
                            token = token + nxt
                            idx   = nxt_idx
                inv_entries.append([token, None])
                idx += 1
                continue

            idx += 1

        # Drop any token that never got a qty
        inv_entries = [e for e in inv_entries if e[1] is not None]

        # ── Zip inv entries + prices to page styles (same order) ──
        for style_idx, sno in enumerate(page_styles):
            featured_color = ""
            featured_qty   = ""
            inv_detail     = ""
            price_str      = ""

            if style_idx < len(inv_entries):
                featured_color = inv_entries[style_idx][0]
                featured_qty   = inv_entries[style_idx][1]
                inv_detail     = f"{featured_color}:{featured_qty}"

            if style_idx < len(prices):
                price_str = prices[style_idx]

            records.append({
                "Source PDF":        pdf_name,
                "Style No":          sno,
                "Description":       style_desc.get(sno, ""),
                "Color":             " | ".join(style_colors.get(sno, [])),
                "Sizes Available":   "N/A",
                "Total Qty":         featured_qty if featured_qty != "" else "",
                "Inventory Detail":  inv_detail,
                "Wholesale Price":   "",
                "Retail Price":      price_str,
                "Image Link":        "",
                "Season":            "",
                "Fabric":            "",
                "Country of Origin": "",
                "Vendor":            "Betsy & Adam",
            })

    doc.close()
    return records


# =============================================================================
# PARSER 3 -- BRIDAL-11-21 (Stella Couture Style Inventory Summary)
# =============================================================================

def parse_bridal(lines: list, pdf_name: str) -> list:
    """
    Parse Stella Couture bridal inventory PDF.

    BUG FIX: 24 duplicate style+color rows — each real entry had an empty ghost.
    Fix: deduplicate after parsing, keeping the row with the most populated fields.
    """
    records = []

    STYLE_MARKER    = re.compile(r"^\*\*\s*STYLE\s*:?\s*$", re.IGNORECASE)
    SUBTOTAL_MARKER = re.compile(r"^\*\*\s*Subtotal", re.IGNORECASE)

    COLOR_ABBREVS = {
        "BLK":  "BLACK",  "WHO":  "OFF WHITE", "CHAM": "CHAMPAGNE",
        "NUDE": "NUDE",   "IVY":  "IVORY",     "WHT":  "WHITE",
        "PINK": "PINK",   "RED":  "RED",
    }

    KNOWN_SIZES = {
        "0","2","4","6","8","10","12","14","16","18","20",
        "22","24","26","28","30","32",
    }

    COLOR_FULLNAMES = {
        "BLACK","OFF WHITE","CHAMPAGNE","NUDE","IVORY","WHITE",
        "PINK","HUNTER","NAVY","RED","BLUSH","SAGE","GOLD","SILVER",
    }

    PAGE_NOISE_RE = re.compile(
        r"^(PAGE NO\.|STELLA COUTURE|STY3302|STYLE INVENTORY SUMMARY"
        r"|DESCRIPTION|SZ\d+|TOTAL|COLOR"
        r"|\d{1,2}/\d{1,2}/\d{4}|\d{2}:\d{2}:\d{2}|\s*)$",
        re.IGNORECASE,
    )

    # Pass 1: find ** STYLE: markers + style number before each
    style_positions = []
    for idx, line in enumerate(lines):
        if STYLE_MARKER.match(line.strip()):
            style_no = ""
            for k in range(idx - 1, max(idx - 6, -1), -1):
                candidate = lines[k].strip()
                if not candidate or PAGE_NOISE_RE.match(candidate):
                    continue
                if STYLE_MARKER.match(candidate):
                    break
                if re.match(r"^[\w\-]+$", candidate) and len(candidate) >= 3:
                    style_no = candidate
                    break
            style_positions.append((style_no, idx))

    # Pass 2: parse each style block
    for block_idx, (style_no, marker_line) in enumerate(style_positions):
        block_end = (
            style_positions[block_idx + 1][1]
            if block_idx + 1 < len(style_positions)
            else len(lines)
        )
        block = lines[marker_line + 1 : block_end]

        # Size headers
        sizes_in_block = []
        j = 0
        while j < len(block) and block[j].strip() in KNOWN_SIZES:
            sizes_in_block.append(block[j].strip())
            j += 1

        # Color entries until ** Subtotal **
        color_entries = []
        k = j
        while k < len(block):
            l = block[k].strip()
            if not l:
                k += 1
                continue
            if SUBTOTAL_MARKER.match(l):
                break

            if re.fullmatch(r"[A-Z]{2,5}", l) and l not in KNOWN_SIZES:
                color_abbrev   = l
                color_fullname = COLOR_ABBREVS.get(color_abbrev, color_abbrev)
                k += 1
                qty_nums = []

                while k < len(block):
                    inner = block[k].strip()
                    if not inner:
                        k += 1
                        continue
                    if SUBTOTAL_MARKER.match(inner):
                        break
                    if re.fullmatch(r"[A-Z]{2,5}", inner) and inner not in KNOWN_SIZES:
                        break
                    is_fullname = (
                        inner.upper() in COLOR_FULLNAMES
                        or (
                            not inner.replace(" ", "").isdigit()
                            and not re.fullmatch(r"[A-Z]{2,5}", inner)
                            and len(inner) > 3
                            and re.fullmatch(r"[A-Z][a-zA-Z\s]+", inner)
                        )
                    )
                    if is_fullname:
                        color_fullname = inner
                        k += 1
                        break
                    qty_nums.extend(int(n) for n in re.findall(r"\d+", inner))
                    k += 1

                # Last number = subtotal if it equals sum of others
                total_qty = ""
                if qty_nums:
                    if len(qty_nums) >= 2 and qty_nums[-1] == sum(qty_nums[:-1]):
                        total_qty = qty_nums[-1]
                        qty_nums  = qty_nums[:-1]
                    else:
                        total_qty = max(qty_nums)

                inv_pairs  = list(zip(sizes_in_block, qty_nums))
                inv_detail = " | ".join(f"{s}:{q}" for s, q in inv_pairs) if inv_pairs else ""

                color_entries.append((color_fullname, total_qty, inv_detail))
            else:
                k += 1

        if style_no:
            if not color_entries:
                records.append({
                    "Source PDF": pdf_name, "Style No": style_no,
                    "Description": "", "Color": "",
                    "Sizes Available": ", ".join(sizes_in_block),
                    "Total Qty": "", "Inventory Detail": "",
                    "Wholesale Price": "", "Retail Price": "", "Image Link": "",
                    "Season": "", "Fabric": "", "Country of Origin": "",
                    "Vendor": "Stella Couture",
                })
            else:
                for color_full, total_qty, inv_detail in color_entries:
                    records.append({
                        "Source PDF": pdf_name, "Style No": style_no,
                        "Description": "", "Color": color_full,
                        "Sizes Available": ", ".join(sizes_in_block),
                        "Total Qty": total_qty, "Inventory Detail": inv_detail,
                        "Wholesale Price": "", "Retail Price": "", "Image Link": "",
                        "Season": "", "Fabric": "", "Country of Origin": "",
                        "Vendor": "Stella Couture",
                    })

    # BUG FIX: deduplicate (style_no, color) — keep row with most data
    def row_score(r):
        return sum(1 for v in r.values() if v not in ("", None))

    deduped = {}
    order   = []
    for rec in records:
        key = (rec["Style No"], rec["Color"])
        if key not in deduped:
            deduped[key] = rec
            order.append(key)
        elif row_score(rec) > row_score(deduped[key]):
            deduped[key] = rec

    removed = len(records) - len(deduped)
    if removed:
        print(f"   [Bridal] Removed {removed} duplicate style+color rows")

    return [deduped[k] for k in order]


# =============================================================================
# MAIN EXTRACTOR
# =============================================================================

def extract_from_pdf(pdf_path: str) -> list:
    pdf_name = Path(pdf_path).name
    print(f"\n[PDF] Processing: {pdf_name}")

    doc       = fitz.open(pdf_path)
    all_text  = ""
    all_lines = []
    for page in doc:
        page_text = page.get_text()
        all_text  += page_text + "\n"
        all_lines.extend(page_text.split("\n"))
    doc.close()

    pdf_type = detect_pdf_type(all_text)
    print(f"   Format detected : {pdf_type}")

    if pdf_type == "ap_op":
        records = parse_ap_op(all_lines, pdf_name)
    elif pdf_type == "betsy_closeout":
        records = parse_betsy_closeout(pdf_path, pdf_name)
    elif pdf_type == "bridal":
        records = parse_bridal(all_lines, pdf_name)
    else:
        records = parse_ap_op(all_lines, pdf_name)

    print(f"   [OK] Extracted {len(records)} records")
    return records


def enrich_with_image_links(records: list) -> None:
    """
    Fetch Image Links using Serper (Google Search) for styles that don't have them in the cache.
    """
    from cache import get_cached_results_for_vendor, append_to_cache
    from serper_search import batch_search

    # Group by vendor to optimize cache loading
    by_vendor = {}
    for r in records:
        v = r.get("Vendor")
        if v:
            by_vendor.setdefault(v, []).append(r)

    for vendor, v_records in by_vendor.items():
        # Load cache for this vendor
        cached = get_cached_results_for_vendor(vendor)
        cache_map = {}
        for c in cached:
            s = c.get("Style No")
            img = c.get("Image Link")
            if s and img:
                cache_map[s] = img

        missing_styles = set()
        for r in v_records:
            s = r.get("Style No")
            if s and s not in cache_map:
                missing_styles.add(s)

        if missing_styles:
            print(f"   [Images] Fetching missing image links via Google for {len(missing_styles)} styles ({vendor})...")
            search_input = [{"Style No": s} for s in missing_styles]
            
            # This calls the parallel batch_search from serper_search.py
            new_results = batch_search(search_input, vendor)
            
            new_cache_rows = []
            for item in new_results:
                s = item.get("Style No")
                img = item.get("Image Link")
                if s and img and s not in cache_map:
                    cache_map[s] = img
                    # Keep other fields empty or fallback so append_to_cache doesn't crash
                    item["Vendor Name"] = vendor
                    new_cache_rows.append(item)
                    
            if new_cache_rows:
                append_to_cache(new_cache_rows)

        # Apply found or cached image links
        for r in v_records:
            s = r.get("Style No")
            r["Image Link"] = cache_map.get(s, "")


def write_csv(records: list, output_path: str):
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    
    # Populate Image Links before saving
    enrich_with_image_links(records)

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for r in records:
            writer.writerow({col: r.get(col, "") for col in CSV_COLUMNS})
    print(f"\n[DONE] CSV saved : {output_path}")
    print(f"   Total records  : {len(records)}")


def main():
    parser = argparse.ArgumentParser(description="Extract product data from PDFs -> CSV")
    parser.add_argument("--pdfs",   nargs="+", help="PDF file paths")
    parser.add_argument("--outdir", "-o", default=str(OUTPUT_DIR), help="Output directory")
    args = parser.parse_args()

    if not args.pdfs:
        default_pdfs = [
            BASE_DIR / "AP OP 4.28 (1) (1).pdf",
            BASE_DIR / "Betsy  Adam Closeouts 042126.pdf",
            BASE_DIR / "BRIDAL-11-21.pdf",
        ]
        pdf_paths = [str(p) for p in default_pdfs if p.exists()]
        if not pdf_paths:
            print("[ERROR] No PDFs found. Use --pdfs to specify paths.")
            sys.exit(1)
    else:
        pdf_paths = args.pdfs

    os.makedirs(args.outdir, exist_ok=True)
    total_saved = 0

    for pdf_path in pdf_paths:
        if not os.path.exists(pdf_path):
            print(f"[WARN] File not found, skipping: {pdf_path}")
            continue
        records = extract_from_pdf(pdf_path)
        if not records:
            print(f"[WARN] No records extracted from: {pdf_path}")
            continue
        csv_path = os.path.join(args.outdir, Path(pdf_path).stem + ".csv")
        write_csv(records, csv_path)
        total_saved += len(records)

    print(f"\n[SUMMARY] Total records saved: {total_saved}")


if __name__ == "__main__":
    main()