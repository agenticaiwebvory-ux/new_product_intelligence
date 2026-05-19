"""
Product Scraper -- CSV Reader  v4.2
Reads style numbers + extended product fields from an input CSV file.
Auto-detects columns for Style No, Qty, Colors, Sizes, Description, Price.
"""
import csv


def read_styles_from_csv(csv_path: str) -> list:
    """
    Read product data from a CSV.
    Returns list of dicts compatible with the rest of the pipeline:
    {
        "Style No":         str,
        "Total Qty":        int | None,
        "Colors":           str,          # pipe-separated if multiple
        "Sizes":            str,
        "Description":      str,
        "Price":            float | None,
        "Inventory":        {},           # empty for CSV inputs
    }
    """
    styles = []
    seen   = set()

    with open(csv_path, "r", encoding="utf-8-sig", errors="replace") as f:
        sample = f.read(2048)
        f.seek(0)
        try:
            dialect = csv.Sniffer().sniff(sample)
        except csv.Error:
            dialect = csv.excel

        reader  = csv.DictReader(f, dialect=dialect)
        headers = [h.strip().lower() for h in (reader.fieldnames or [])]

        # ---- Column detection keywords ----
        style_keywords = [
            "style no", "style_no", "style", "sku", "item",
            "model", "style number", "styleno", "item no", "item_no",
        ]
        qty_keywords = [
            "total qty", "total_qty", "qty", "quantity",
            "units", "total quantity", "count", "stock",
        ]
        color_keywords  = ["color", "colours", "colors", "colour"]
        size_keywords   = ["size", "sizes", "size range", "size_range"]
        desc_keywords   = ["description", "desc", "product name", "name"]
        price_keywords  = ["price", "wholesale", "cost", "wholesale price", "retail"]

        def find_col(keywords):
            for orig in (reader.fieldnames or []):
                if orig.strip().lower() in keywords:
                    return orig
            return None

        style_col = find_col(style_keywords)
        qty_col   = find_col(qty_keywords)
        color_col = find_col(color_keywords)
        size_col  = find_col(size_keywords)
        desc_col  = find_col(desc_keywords)
        price_col = find_col(price_keywords)

        # Fallback: use first column for style if nothing matched
        if not style_col and reader.fieldnames:
            style_col = reader.fieldnames[0]
            print(f"  [WARN] No 'Style No' header found, using first column: '{style_col}'")

        for row in reader:
            style = (row.get(style_col) or "").strip()
            if not style or style in seen:
                continue
            seen.add(style)

            # Qty
            qty = None
            if qty_col:
                try:
                    raw = (row.get(qty_col) or "").strip()
                    qty = int(float(raw)) if raw else None
                except (ValueError, TypeError):
                    qty = None

            # Price
            price = None
            if price_col:
                try:
                    raw = (row.get(price_col) or "").replace("$", "").strip()
                    price = float(raw) if raw else None
                except (ValueError, TypeError):
                    price = None

            styles.append({
                "Style No":    style,
                "Total Qty":   qty,
                "Colors":      (row.get(color_col) or "").strip() if color_col else "",
                "Sizes":       (row.get(size_col)  or "").strip() if size_col  else "",
                "Description": (row.get(desc_col)  or "").strip() if desc_col  else "",
                "Price":       price,
                "Inventory":   {},
            })

    print(f"  [CSV] Read {len(styles)} style numbers from CSV")
    return styles
