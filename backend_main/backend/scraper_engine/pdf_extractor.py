"""
Product Scraper -- PDF Extractor  v4.3
Extracts rich product data from vendor PDF catalogs/line sheets.
Supports multiple formats: AP OP, Betsy & Adam, Stella Couture (Bridal).
"""
import re
import fitz  # PyMuPDF
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
STYLE_LABELS = [
    "style number", "style no", "style #", "style",
    "item number", "item no", "item #", "sku", "model",
]

IGNORE_PATTERNS = {
    "total", "code", "color", "size", "page", "date",
    "wholesale", "retail", "season", "description",
    "division", "catalog", "fabric", "origin",
    "delivery", "spring", "summer", "fall", "winter",
}

KNOWN_SIZES = {"0","2","4","6","8","10","12","14","16","18","20","22","24","26","28","30","32"}

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def extract_styles_from_pdf(pdf_path: str) -> list:
    """
    Extract product information from a vendor PDF.
    Automatically detects format and uses specialized parsers.
    """
    pdf_name = Path(pdf_path).name
    doc      = fitz.open(pdf_path)
    all_text = ""
    all_lines = []
    for page in doc:
        page_text = page.get_text()
        all_text += page_text + "\n"
        all_lines.extend([l.strip() for l in page_text.split("\n")])
    doc.close()

    pdf_type = detect_pdf_type(all_text)
    print(f"  [PDF] Format detected: {pdf_type}")

    if pdf_type == "bridal":
        records = parse_bridal(all_lines, pdf_name)
    elif pdf_type == "betsy_closeout":
        records = parse_betsy_closeout(pdf_path, pdf_name)
    elif pdf_type == "ap_op":
        records = parse_ap_op(all_lines, pdf_name)
    elif pdf_type == "off_price":
        records = parse_off_price(pdf_path, pdf_name)
    else:
        # Fallback to general v4.2 logic
        records = _extract_general(all_lines)

    # Format for run.py expectations
    formatted = []
    for r in records:
        formatted.append({
            "Style No":          r.get("Style No", ""),
            "Description":       r.get("Description", ""),
            "Colors":            r.get("Colors") or r.get("Color", ""),
            "Sizes":             r.get("Sizes") or r.get("Sizes Available", ""),
            "Total Qty":         r.get("Total Qty", ""),
            "Inventory Detail":  r.get("Inventory Detail", ""),
            "Wholesale Price":   r.get("Wholesale Price") or r.get("Price", ""),
            "Retail Price":      r.get("Retail Price", ""),
            "Season":            r.get("Season", ""),
            "Fabric":            r.get("Fabric", ""),
            "Country of Origin": r.get("Country of Origin", ""),
            "Code":              r.get("Code", ""),
            "Vendor":            r.get("Vendor", ""),
        })

    print(f"  [PDF] Extracted {len(formatted)} records")
    return formatted


# ---------------------------------------------------------------------------
# DETECTOR
# ---------------------------------------------------------------------------

def detect_pdf_type(text: str) -> str:
    t_upper = text.upper()
    if "STELLA COUTURE" in t_upper or "STY3302" in t_upper or "STYLE INVENTORY SUMMARY" in t_upper:
        return "bridal"
    if "CLOSE OUTS" in t_upper and ("IMAGE INFO" in t_upper or "IMAGEINFO" in t_upper):
        return "betsy_closeout"
    if "OFF PRICE" in t_upper:
        return "off_price"
    if "STYLE NUMBER:" in t_upper and "WHOLESALE:" in t_upper:
        return "ap_op"
    return "general"


# ---------------------------------------------------------------------------
# PARSER 1 -- AP OP 4.28
# ---------------------------------------------------------------------------

def parse_ap_op(lines: list, pdf_name: str) -> list:
    records = []
    GROUP_LETTERS = {"M", "W", "P", "X", "G"}

    def next_nonempty(idx, limit=5):
        for k in range(idx + 1, min(idx + limit + 1, len(lines))):
            v = lines[k].strip()
            if v and ":" not in v: return v
        return ""

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.lower().rstrip(":") == "style number":
            style_no = next_nonempty(i)
            wholesale = ""; retail = ""; color = ""; description = ""
            season = ""; fabric = ""; country = ""; code = ""
            
            j = i + 1
            while j < len(lines):
                l = lines[j].strip()
                l_lower = l.lower()
                if l_lower.rstrip(":").strip() == "style number" and j > i + 1: break
                
                if "wholesale:" in l_lower: wholesale = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "retail:" in l_lower: retail = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "color:" in l_lower: color = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "season:" in l_lower: season = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "country of origin:" in l_lower: country = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "fabric content:" in l_lower: fabric = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "description:" in l_lower: description = l.split(":", 1)[1].strip() or next_nonempty(j)
                elif "code:" in l_lower: code = l.split(":", 1)[1].strip() or next_nonempty(j)
                j += 1

            sizes_available = []
            qty_per_size = []
            total_from_keyword = None
            k = i + 1
            phase = "before_sizes"
            while k < j:
                l = lines[k].strip()
                if phase == "before_sizes" and l in KNOWN_SIZES: phase = "collecting_sizes"
                if phase == "collecting_sizes":
                    if l in KNOWN_SIZES:
                        sizes_available.append(l)
                        k += 1; continue
                    elif l in GROUP_LETTERS:
                        phase = "collecting_qtys"; k += 1; continue
                    elif sizes_available:
                        phase = "collecting_qtys"
                if phase == "collecting_qtys":
                    if re.fullmatch(r"\d+", l):
                        if len(qty_per_size) < len(sizes_available): qty_per_size.append(int(l))
                        k += 1; continue
                    if l == "Total":
                        for m in range(k + 1, min(k + 5, j)):
                            if re.fullmatch(r"\d+", lines[m].strip()):
                                total_from_keyword = int(lines[m].strip()); break
                k += 1

            total_qty = sum(qty_per_size) if qty_per_size else None
            if total_from_keyword is not None and (total_qty is None or total_from_keyword > total_qty):
                total_qty = total_from_keyword

            inv_detail = " | ".join(f"{s}:{q}" for s, q in zip(sizes_available, qty_per_size)) if sizes_available and qty_per_size else ""
            
            if style_no:
                records.append({
                    "Style No": style_no, "Description": description, "Colors": color,
                    "Sizes": ", ".join(sizes_available), "Total Qty": total_qty or "",
                    "Inventory Detail": inv_detail, "Wholesale Price": wholesale,
                    "Retail Price": retail, "Season": season, "Fabric": fabric,
                    "Country of Origin": country, "Code": code, "Vendor": "AP OP"
                })
            i = j
        else:
            i += 1
    return records


# ---------------------------------------------------------------------------
# PARSER 1.5 -- OFF PRICE (v4.4)
# ---------------------------------------------------------------------------

def _calc_qty_from_inv(inv_str: str):
    """Sum quantities from an inventory string (dot or slash format)."""
    if not inv_str:
        return ""
    total = 0
    if "/" in inv_str:
        for n in re.findall(r"(\d+)/\d+", inv_str):
            total += int(n)
    elif "." in inv_str:
        flat = inv_str.replace("|", ".").replace(" ", "")
        for n in re.findall(r"\d+", flat):
            total += int(n)
    return total if total > 0 else ""


def _parse_color_entries(meta_lines, STYLE_RE):
    """
    Parse metadata lines into [(color, sizes_str, inv_str)] triples.
    Accumulates ALL inv lines per color before flushing so that multi-line
    inventory strings (e.g. '11/4, 7/6,' on one line + '11/8' on the next)
    are merged into a single entry.
    Handles slash-split colors: 'ROSE/' + 'GOLD' -> 'ROSE/GOLD'.
    """
    def is_size_range(m):
        return bool(re.match(r'^\(?\s*\d+\s*-\s*\d+\s*\)?$', m.replace(' ', '')))

    def is_inv(m):
        if re.match(r'^[\d\.\s]+$', m) and '.' in m: return True
        if re.search(r'\d+/\d+', m): return True
        return False

    def is_color(m):
        if is_size_range(m) or is_inv(m): return False
        if STYLE_RE.match(m.strip()): return False
        return bool(re.search(r'[a-zA-Z]', m))

    NOISE = ["OFF PRICE", "MEMO", "DESCRIPTION", "IMAGE INFO", "PAGE", "WWW."]
    filtered = [m for m in meta_lines
                if not any(x in m.upper() for x in NOISE)
                and not STYLE_RE.match(m.strip())]

    entries = []
    curr_color = None
    curr_sizes = ""
    curr_inv_parts = []   # accumulate multiple inv lines before flushing

    def _flush():
        if curr_color is not None:
            entries.append((curr_color, curr_sizes, ", ".join(curr_inv_parts)))

    for m in filtered:
        if is_size_range(m):
            curr_sizes = m
        elif is_inv(m):
            # Accumulate — only flush when the next COLOR line appears
            if curr_color is not None:
                curr_inv_parts.append(m)
        elif is_color(m):
            if curr_color is not None:
                if not curr_inv_parts and curr_color.endswith("/"):
                    # Slash-split color name e.g. "ROSE/" + "GOLD" -> "ROSE/GOLD"
                    curr_color = curr_color + m
                else:
                    _flush()
                    curr_color = m
                    curr_inv_parts = []
                    # Keep curr_sizes — next color may reuse same size range
            else:
                curr_color = m

    _flush()  # flush last entry

    # Drop phantom entries that have no inventory at all
    return [(c, s, i) for c, s, i in entries if i]


def parse_off_price(pdf_path: str, pdf_name: str) -> list:
    """
    Parser for OFF PRICE grid format.
    Produces ONE RECORD PER COLOR per style.
    """
    doc = fitz.open(pdf_path)
    records = []

    STYLE_RE = re.compile(r"^\d{4,5}X$")
    
    for page in doc:
        words = page.get_text("words")
        # word format: (x0, y0, x1, y1, "text", block_no, line_no, word_no)
        
        page_styles = []
        for w in words:
            text = w[4].strip()
            if STYLE_RE.match(text):
                page_styles.append({
                    "style": text,
                    "x0": w[0], "y0": w[1], "x1": w[2], "y1": w[3]
                })
        
        for s in page_styles:
            sx0, sy0, sx1, sy1 = s["x0"], s["y0"], s["x1"], s["y1"]
            
            # Define a "lane" for this column
            lane_x0 = sx0 - 20
            lane_x1 = sx1 + 100 # allow for wider metadata
            
            # 1. Find metadata words ABOVE style
            meta_words = []
            for w in words:
                wx0, wy0, wx1, wy1, text = w[0], w[1], w[2], w[3], w[4]
                # Metadata is in the same lane and within 250 units above
                if wy0 < sy0 - 10 and wy0 > sy0 - 250 and wx0 >= lane_x0 and wx0 <= lane_x1:
                    meta_words.append(w)
            
            # Group metadata words into lines
            meta_words.sort(key=lambda x: (x[1], x[0]))
            lines = []
            if meta_words:
                curr_line = [meta_words[0][4]]
                curr_y = meta_words[0][1]
                for w in meta_words[1:]:
                    if abs(w[1] - curr_y) < 5:
                        curr_line.append(w[4])
                    else:
                        lines.append(" ".join(curr_line))
                        curr_line = [w[4]]
                        curr_y = w[1]
                lines.append(" ".join(curr_line))

            # 2. Find description and price BELOW or NEAR style
            desc = ""
            price = ""
            for w in words:
                wx0, wy0, wx1, wy1, text = w[0], w[1], w[2], w[3], w[4]
                # Price is often nearby with $
                if "$" in text and abs(wy0 - sy0) < 100 and abs(wx0 - sx0) < 150:
                    price = text
                # Description often follows the word "Description:"
                if "Description:" in text and abs(wy0 - sy0) < 50 and abs(wx0 - sx0) < 60:
                    # Find all words on the same line as "Description:" AND in the same lane
                    desc_words = [w2[4] for w2 in words if abs(w2[1] - wy0) < 5 and wx0 < w2[0] < lane_x1]
                    # Clean up: remove trailing '0' or noise
                    desc = " ".join(desc_words).strip()
                    if desc.endswith(" 0"): desc = desc[:-2].strip()
                    if desc == "0": desc = ""

            # Parse per-color entries from metadata lines
            color_entries = _parse_color_entries(lines, STYLE_RE)

            if color_entries:
                for color, sizes_str, inv_str in color_entries:
                    records.append({
                        "Style No":         s["style"],
                        "Description":      desc,
                        "Colors":           color,
                        "Sizes":            sizes_str,
                        "Total Qty":        _calc_qty_from_inv(inv_str),
                        "Inventory Detail": inv_str,
                        "Wholesale Price":  price,
                        "Vendor":           "OFF PRICE",
                    })
            else:
                records.append({
                    "Style No":         s["style"],
                    "Description":      desc,
                    "Colors":           "",
                    "Sizes":            "",
                    "Total Qty":        "",
                    "Inventory Detail": "",
                    "Wholesale Price":  price,
                    "Vendor":           "OFF PRICE",
                })
            
    doc.close()
    return records


# ---------------------------------------------------------------------------
# PARSER 2 -- Betsy & Adam
# ---------------------------------------------------------------------------

def parse_betsy_closeout(pdf_path: str, pdf_name: str) -> list:
    doc = fitz.open(pdf_path)
    records = []
    STYLE_RE = re.compile(r"^(A\d{4,6}[A-Z]?\d?[A-Z]?)$")
    DESC_RE = re.compile(r"^Description:\s*(.+)", re.IGNORECASE)
    PRICE_RE = re.compile(r"^\$(\d+(?:\.\d+)?)$")
    QTY_RE = re.compile(r"^(\d+)U?$", re.IGNORECASE)
    NOISE_RE = re.compile(r"^(\d{1,2}/\d{1,2}/\d{2,4}|PAGE\s*\d+|©|www\.|Image Info|CLOSE OUTS|Betsy|Xscape|Blondie|Confidential|May NOT)", re.IGNORECASE)
    INV_TOKEN_RE = re.compile(r"^([A-Z]{2,}(?:/[A-Z]*)?)$")

    def is_color_name(s):
        if not s or len(s) > 30 or "," in s: return False
        if s.replace(" ", "").isdigit(): return False
        if not re.search(r"[A-Za-z]", s): return False
        if re.fullmatch(r"[A-Z][A-Z/\s]*", s) and len(s) <= 15: return False
        return True

    for page in doc:
        lines = [l.strip() for l in page.get_text().split("\n")]
        footer_idx = len(lines)
        for idx, l in enumerate(lines):
            if NOISE_RE.match(l) and re.search(r"\d{4}", l): footer_idx = idx; break
        
        left_lines = lines[:footer_idx]; right_lines = lines[footer_idx:]
        page_styles = []; style_colors = {}; style_desc = {}
        current_desc = ""; current_style = None

        for l in left_lines:
            if not l: continue
            dm = DESC_RE.match(l)
            if dm: current_desc = dm.group(1).strip(); current_style = None; continue
            sm = STYLE_RE.match(l)
            if sm and current_desc:
                sno = l
                if sno not in style_desc:
                    page_styles.append(sno); style_desc[sno] = current_desc; style_colors[sno] = []
                current_style = sno; current_desc = ""; continue
            if current_style and is_color_name(l): style_colors[current_style].append(l)

        inv_entries = []; prices = []; idx = 0
        while idx < len(right_lines):
            l = right_lines[idx]
            if not l or NOISE_RE.match(l): idx += 1; continue
            pm = PRICE_RE.match(l)
            if pm: prices.append(f"${pm.group(1)}"); idx += 1; continue
            qm = QTY_RE.match(l)
            if qm and inv_entries and inv_entries[-1][1] is None: inv_entries[-1][1] = int(qm.group(1)); idx += 1; continue
            tm = INV_TOKEN_RE.match(l)
            if tm:
                token = l
                if token.endswith("/"):
                    # Peek ahead
                    for nxt_idx in range(idx + 1, min(idx + 3, len(right_lines))):
                        nxt = right_lines[nxt_idx]
                        if INV_TOKEN_RE.match(nxt) and not QTY_RE.match(nxt): token += nxt; idx = nxt_idx; break
                inv_entries.append([token, None]); idx += 1; continue
            idx += 1
        
        inv_entries = [e for e in inv_entries if e[1] is not None]
        for s_idx, sno in enumerate(page_styles):
            color = ""; qty = ""; detail = ""; price = ""
            if s_idx < len(inv_entries):
                color = inv_entries[s_idx][0]; qty = inv_entries[s_idx][1]; detail = f"{color}:{qty}"
            if s_idx < len(prices): price = prices[s_idx]
            
            records.append({
                "Style No": sno, "Description": style_desc.get(sno, ""),
                "Colors": " | ".join(style_colors.get(sno, [])), "Sizes": "N/A",
                "Total Qty": qty, "Inventory Detail": detail, "Price": price,
                "Vendor": "Betsy & Adam"
            })
    doc.close()
    return records


# ---------------------------------------------------------------------------
# PARSER 3 -- Bridal
# ---------------------------------------------------------------------------

def parse_bridal(lines: list, pdf_name: str) -> list:
    records = []
    STYLE_MARKER = re.compile(r"^\*\*\s*STYLE\s*:?\s*$", re.IGNORECASE)
    SUBTOTAL_MARKER = re.compile(r"^\*\*\s*Subtotal", re.IGNORECASE)
    COLOR_ABBREVS = {"BLK": "BLACK", "WHO": "OFF WHITE", "CHAM": "CHAMPAGNE", "NUDE": "NUDE", "IVY": "IVORY", "WHT": "WHITE"}
    COLOR_FULLNAMES = {"BLACK","OFF WHITE","CHAMPAGNE","NUDE","IVORY","WHITE","PINK","HUNTER","NAVY","RED","BLUSH","SAGE","GOLD","SILVER"}
    PAGE_NOISE_RE = re.compile(r"^(PAGE NO\.|STELLA COUTURE|STY3302|STYLE INVENTORY SUMMARY|DESCRIPTION|SZ\d+|TOTAL|COLOR|\d{1,2}/\d{1,2}/\d{4}|\s*)$", re.IGNORECASE)

    style_positions = []
    for idx, line in enumerate(lines):
        if STYLE_MARKER.match(line.strip()):
            style_no = ""
            for k in range(idx - 1, max(idx - 6, -1), -1):
                cand = lines[k].strip()
                if not cand or PAGE_NOISE_RE.match(cand): continue
                if STYLE_MARKER.match(cand): break
                if re.match(r"^[\w\-]+$", cand) and len(cand) >= 3: style_no = cand; break
            style_positions.append((style_no, idx))

    for b_idx, (style_no, marker) in enumerate(style_positions):
        end = style_positions[b_idx + 1][1] if b_idx + 1 < len(style_positions) else len(lines)
        block = lines[marker + 1 : end]
        sizes = []; j = 0
        while j < len(block) and block[j].strip() in KNOWN_SIZES: sizes.append(block[j].strip()); j += 1
        
        k = j
        while k < len(block):
            l = block[k].strip()
            if not l: k += 1; continue
            if SUBTOTAL_MARKER.match(l): break
            if re.fullmatch(r"[A-Z]{2,5}", l) and l not in KNOWN_SIZES:
                abbrev = l; fullname = COLOR_ABBREVS.get(abbrev, abbrev); k += 1; qtys = []
                while k < len(block):
                    inner = block[k].strip()
                    if not inner or SUBTOTAL_MARKER.match(inner): break
                    if re.fullmatch(r"[A-Z]{2,5}", inner) and inner not in KNOWN_SIZES: break
                    if inner.upper() in COLOR_FULLNAMES: fullname = inner; k += 1; break
                    qtys.extend(int(n) for n in re.findall(r"\d+", inner)); k += 1
                
                total = ""
                if qtys:
                    if len(qtys) >= 2 and qtys[-1] == sum(qtys[:-1]): total = qtys[-1]; qtys = qtys[:-1]
                    else: total = max(qtys)
                
                inv_detail = " | ".join(f"{s}:{q}" for s, q in zip(sizes, qtys)) if sizes and qtys else ""
                records.append({
                    "Style No": style_no, "Description": "", "Colors": fullname,
                    "Sizes": ", ".join(sizes), "Total Qty": total, "Inventory Detail": inv_detail,
                    "Vendor": "Stella Couture"
                })
            else: k += 1

    # Return one record per style+color (no merging)
    # Simple dedup: keep first occurrence of each (style, color) pair
    seen_keys = set()
    deduped = []
    for r in records:
        key = (r["Style No"], r.get("Colors", ""))
        if key not in seen_keys:
            seen_keys.add(key)
            deduped.append(r)
    return deduped


# ---------------------------------------------------------------------------
# GENERAL extractor (Fallback)
# ---------------------------------------------------------------------------

def _extract_general(lines: list) -> list:
    seen = set(); styles = []
    DESC_RE = re.compile(r"^Description:\s*(.+)", re.IGNORECASE)
    PRICE_RE = re.compile(r"\$(\d+(?:\.\d+)?)")
    current_desc = ""; current_price = None

    for i, line in enumerate(lines):
        l = line.strip()
        dm = DESC_RE.match(l)
        if dm: current_desc = dm.group(1).strip(); continue
        pm = PRICE_RE.search(l)
        if pm and l.startswith("$"):
            try: current_price = float(pm.group(1))
            except: pass
            continue
        
        matches = re.findall(r"\b([A-Z0-9]{4,15})\b", l)
        for style in matches:
            if style in seen: continue
            if not re.search(r"[0-9]", style) or not re.search(r"[A-Z]", style): continue
            if len(style) < 5 or style.lower() in IGNORE_PATTERNS: continue
            seen.add(style)
            styles.append({
                "Style No": style, "Description": current_desc, "Price": current_price,
                "Colors": "", "Inventory Detail": "", "Total Qty": ""
            })
            current_desc = ""; current_price = None
    return styles
