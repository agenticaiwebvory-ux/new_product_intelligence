import fitz, csv, re

# ============================================================
# BETSY & ADAM -- A22921 check
# ============================================================
doc = fitz.open("Betsy  Adam Closeouts 042126.pdf")
full_text = ""
for page in doc:
    full_text += page.get_text()
doc.close()

lines = full_text.split("\n")
print("=== Lines containing A22921 in Betsy PDF ===")
for i, l in enumerate(lines):
    if "A22921" in l.strip():
        print(f"  Line {i}: {repr(l)}")

print()

# ============================================================
# BETSY CSV -- missing fields
# ============================================================
with open("output/Betsy  Adam Closeouts 042126.csv", encoding="utf-8-sig") as f:
    betsy_rows = list(csv.DictReader(f))

no_price = [r["Style No"] for r in betsy_rows if not r["Retail Price"]]
no_inv   = [r["Style No"] for r in betsy_rows if not r["Inventory Detail"]]
no_color = [r["Style No"] for r in betsy_rows if not r["Color"]]

print(f"Betsy: Rows with NO Retail Price  : {len(no_price)}")
print(f"Betsy: Rows with NO Inventory     : {len(no_inv)}  (expected - PDF does not have per-unit breakdown)")
print(f"Betsy: Rows with NO Color         : {len(no_color)}")
print()

print("Sample rows:")
for r in betsy_rows[:3]:
    style   = r["Style No"]
    price   = r["Retail Price"]
    inv     = r["Inventory Detail"]
    color   = r["Color"][:50]
    print(f"  Style={style}  Price={price!r}  Color={color!r}  Inv={inv!r}")

# ============================================================
# BRIDAL -- check unique style counts and empty rows
# ============================================================
print()
print("=== BRIDAL ===")
doc = fitz.open("BRIDAL-11-21.pdf")
full_text = ""
for page in doc:
    full_text += page.get_text()
doc.close()

import re as _re
style_marker = _re.compile(r"^\*\*\s*STYLE\s*:?\s*$", _re.IGNORECASE)
bridal_lines = full_text.split("\n")
marker_count = sum(1 for l in bridal_lines if style_marker.match(l.strip()))
print(f"BRIDAL: ** STYLE: markers in PDF = {marker_count}")

with open("output/BRIDAL-11-21.csv", encoding="utf-8-sig") as f:
    bridal_rows = list(csv.DictReader(f))

bridal_unique = set(r["Style No"] for r in bridal_rows)
no_color_br  = [r["Style No"] for r in bridal_rows if not r["Color"]]
no_qty_br    = [r["Style No"] for r in bridal_rows if not r["Total Qty"]]
no_sizes_br  = [r["Style No"] for r in bridal_rows if not r["Sizes Available"]]

print(f"BRIDAL CSV: total rows = {len(bridal_rows)}")
print(f"BRIDAL CSV: unique styles = {len(bridal_unique)}")
print(f"BRIDAL CSV: rows with NO Color   = {len(no_color_br)}")
print(f"BRIDAL CSV: rows with NO Qty     = {len(no_qty_br)}")
print(f"BRIDAL CSV: rows with NO Sizes   = {len(no_sizes_br)}")

print()
print("BRIDAL Sample rows:")
for r in bridal_rows[:4]:
    style = r["Style No"]
    color = r["Color"]
    sizes = r["Sizes Available"][:30]
    qty   = r["Total Qty"]
    inv   = r["Inventory Detail"][:40]
    print(f"  Style={style}  Color={color!r}  Sizes={sizes!r}  Qty={qty}  Inv={inv!r}")

# ============================================================
# AP OP -- Total Qty mismatch check
# ============================================================
print()
print("=== AP OP: Total Qty accuracy check (first 5 rows) ===")
with open("output/AP OP 4.28 (1) (1).csv", encoding="utf-8-sig") as f:
    ap_rows = list(csv.DictReader(f))

mismatches = 0
for r in ap_rows:
    inv_detail = r["Inventory Detail"]
    total_csv  = r["Total Qty"]
    if inv_detail and total_csv:
        pairs = inv_detail.split(" | ")
        computed = sum(int(p.split(":")[1]) for p in pairs if ":" in p)
        if str(computed) != total_csv:
            print(f"  MISMATCH Style={r['Style No']} Color={r['Color']!r}: CSV Total={total_csv}  Sum-of-sizes={computed}")
            mismatches += 1

if mismatches == 0:
    print("  All Total Qty values match sum of Inventory Detail pairs!")
else:
    print(f"  Total mismatches found: {mismatches}")
