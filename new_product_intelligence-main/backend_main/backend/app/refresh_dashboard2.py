import os
import sys
import sqlite3
import requests
import time
import argparse
import re
from datetime import datetime

from config import settings

DB_PATH = settings.DB_URL
ALL_STORES = ["TDO", "WDO", "KOS", "IM"]

ADMIN_URLS = {
    "TDO": "https://admin.shopify.com/store/thedressoutlet/products/{id}",
    "WDO": "https://admin.shopify.com/store/wholesaledressoutlet/products/{id}",
    "KOS": "https://admin.shopify.com/store/discountdresses/products/{id}",
}

KNOWN_PREFIXES = ["NY-", "D-AE", "S-AE", "PC-", "PC", "S-S-"]

def db_conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn

def clean_color(c):
    if not c: return ""
    # Strip #...# patterns
    c = re.sub(r'#.*?#', '', c).strip()
    return c.upper()

def parse_sku(sku):
    if not sku: return None, None, None
    # Strip known prefixes
    original_sku = sku
    for prefix in KNOWN_PREFIXES:
        if sku.upper().startswith(prefix.upper()):
            sku = sku[len(prefix):]
            break
            
    # Handle #STYLE#CODE COLOR-SIZE
    if sku.startswith("#") and sku.count("#") >= 2:
        parts = sku.rsplit(" ", 1)
        base = parts[0]
        size = parts[1] if len(parts) > 1 else None
        if size and "-" in size:
            color, size = size.split("-", 1)
        else:
            color = base.rsplit(" ", 1)[1] if " " in base else None
        return base, color, size
        
    parts = sku.split("-")
    if len(parts) >= 3:
        return "-".join(parts[:-2]), parts[-2], parts[-1]
    return sku, None, None

def strip_prefix(style_number):
    if not style_number: return style_number
    upper = style_number.upper()
    for prefix in KNOWN_PREFIXES:
        if upper.startswith(prefix.upper()): return style_number[len(prefix):]
    return style_number

def extract_style_number(style, color):
    if color and style.lower().endswith(f"-{color.lower()}"): return style[:-(len(color) + 1)]
    if "-" in style: return style.rsplit("-", 1)[0]
    return style

def get_stores(conn, filter_store=None):
    conn.row_factory = sqlite3.Row
    if filter_store:
        rows = conn.execute("SELECT * FROM store_credentials WHERE lower(store_name) = lower(?)", (filter_store,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM store_credentials").fetchall()
    conn.row_factory = None
    return [dict(r) for r in rows]

def phase1_local_match(conn, dry_run=False):
    cur = conn.cursor()
    print("  [DEBUG] Bulk-loading variants for memory match...")
    variant_map = {}
    cur.execute("SELECT store_name, style_number, color, product_id, sku FROM product_variants")
    for store, sn, col, pid, sku in cur.fetchall():
        store_up = store.upper()
        if sn:
            variant_map[(store_up, sn.upper(), (col or "").upper())] = pid
            variant_map[(store_up, strip_prefix(sn).upper(), (col or "").upper())] = pid
        if sku:
            psn, pcol, psz = parse_sku(sku)
            if psn:
                variant_map[(store_up, psn.upper(), (pcol or "").upper())] = pid
                variant_map[(store_up, strip_prefix(psn).upper(), (pcol or "").upper())] = pid

    new_links = 0
    for table in ["in_stock_dashboard", "the_dress_outlet"]:
        sql = f"SELECT id, style, color, tdo_product_id, wdo_product_id, kos_product_id FROM {table}"
        if table == "in_stock_dashboard":
            sql += " WHERE style LIKE '%107%'"
        cur.execute(sql)
        rows = cur.fetchall()
        for row_id, style, color, tdo_pid, wdo_pid, kos_pid in rows:
            style_num = extract_style_number(style, color)
            color_val = (color or "").upper()
            if not color_val and "-" in style:
                color_val = clean_color(style.rsplit("-", 1)[0].rsplit(" ", 1)[-1])
            
            sn_up = style_num.upper()
            sn_stripped = strip_prefix(style_num).upper()
            pids = {"TDO": tdo_pid, "WDO": wdo_pid, "KOS": kos_pid}
            for store in ALL_STORES:
                if pids[store]: continue
                found_pid = variant_map.get((store, sn_up, color_val)) or variant_map.get((store, sn_stripped, color_val))
                if found_pid:
                    if not dry_run:
                        cur.execute(f"UPDATE {table} SET {store.lower()}_product_id = ?, {store.lower()}_admin_link = ? WHERE id = ?", (found_pid, ADMIN_URLS[store].format(id=found_pid), row_id))
                    new_links += 1
    if not dry_run: conn.commit()
    return new_links

def phase2_shopify_fetch(conn, stores, dry_run=False):
    cur = conn.cursor()
    style_lookup = {}
    for t in ["in_stock_dashboard", "the_dress_outlet"]:
        sql = f"SELECT id, style, color FROM {t}"
        if t == "in_stock_dashboard":
            sql += " WHERE style LIKE '%107%'"
        cur.execute(sql)
        for r_id, s, c in cur.fetchall():
            sn = extract_style_number(s, c).upper()
            if sn not in style_lookup: style_lookup[sn] = []
            style_lookup[sn].append({"row_id": r_id, "table": t})

    stats = {"searched": 0, "found": 0}
    for store in stores:
        sname = store["store_name"].upper()
        # Use the access token from the database directly
        token = store.get("access_token")
        if not token:
            print(f"  [ERROR] No access token found for {sname}")
            continue
            
        url = f"https://{store['shop_domain']}/admin/api/2024-04/graphql.json"
        headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}

        print(f"\n  Fetching 'The Dress Outlet' vendor from {sname}...")
        has_next, cursor = True, None
        while has_next:
            q = """query getBatch($cursor: String, $q: String) { products(first: 50, after: $cursor, query: $q) { pageInfo { hasNextPage } edges { cursor node { legacyResourceId title handle vendor status bodyHtml seo { title description } variants(first: 50) { edges { node { id sku price compareAtPrice inventoryQuantity } } } images(first: 5) { edges { node { url } } } } } } }"""
            try:
                r = requests.post(url, headers=headers, json={"query": q, "variables": {"cursor": cursor, "q": "vendor:'The Dress Outlet'"}}).json()
                if "errors" in r:
                    print(f"  [ERROR] Shopify API error: {r['errors']}")
                    break
                    
                data = r.get("data", {}).get("products", {})
                edges = data.get("edges", [])
                if not edges: break
                for edge in edges:
                    product = edge["node"]
                    cursor = edge["cursor"]
                    stats["searched"] += 1
                    pid = int(product["legacyResourceId"])
                    if not dry_run: _insert_product_into_db(conn, product, sname)
                    for v in product["variants"]["edges"]:
                        vsn, vcol, vsz = parse_sku(v["node"]["sku"])
                        if vsn and vsn.upper() in style_lookup:
                            for entry in style_lookup[vsn.upper()]:
                                if not dry_run: cur.execute(f"UPDATE {entry['table']} SET {sname.lower()}_product_id = ? WHERE id = ?", (pid, entry["row_id"]))
                has_next = data.get("pageInfo", {}).get("hasNextPage", False)
                print(f"    Processed {stats['searched']} products...", end="\r")
                if not dry_run: conn.commit()
            except Exception as e: 
                print(f"  [ERROR] Phase 2 failed for {sname}: {e}")
                break
    return stats

def phase2b_refresh_linked(conn, store_creds, dry_run=False):
    cur = conn.cursor()
    store_pids = {s: set() for s in ALL_STORES}
    for t in ["in_stock_dashboard", "the_dress_outlet"]:
        sql = f"SELECT tdo_product_id, wdo_product_id, kos_product_id FROM {t}"
        if t == "in_stock_dashboard":
            sql += " WHERE style LIKE '%107%'"
        cur.execute(sql)
        for r in cur.fetchall():
            if r[0]: store_pids["TDO"].add(str(r[0]))
            if r[1]: store_pids["WDO"].add(str(r[1]))
            if r[2]: store_pids["KOS"].add(str(r[2]))
    stats = {"refreshed": 0}
    for sname, pids in store_pids.items():
        if not pids: continue
        sc = store_creds.get(sname.upper())
        if not sc: continue
        token = sc.get("access_token")
        if not token:
            print(f"  [ERROR] No access token found for {sname}")
            continue
            
        url = f"https://{sc['shop_domain']}/admin/api/2024-04/graphql.json"
        headers = {"X-Shopify-Access-Token": token, "Content-Type": "application/json"}
        print(f"\n  Refreshing {len(pids)} linked products in {sname}...")
        plist = list(pids)
        for i in range(0, len(plist), 50):
            batch = plist[i : i + 50]
            nq = "{\n"
            for idx, pid in enumerate(batch):
                nq += f"  p{idx}: node(id: \"gid://shopify/Product/{pid}\") {{ ... on Product {{ legacyResourceId title handle vendor status bodyHtml seo {{ title description }} variants(first: 50) {{ edges {{ node {{ title price compareAtPrice inventoryQuantity sku }} }} }} images(first: 5) {{ edges {{ node {{ url }} }} }} }} }}\n"
            nq += "}"
            try:
                r = requests.post(url, headers=headers, json={"query": nq}).json()
                if "data" in r:
                    for k, product in r["data"].items():
                        if product:
                            _insert_product_into_db(conn, product, sname)
                            stats["refreshed"] += 1
                if not dry_run: conn.commit()
            except: pass
            print(f"    Processed {min(i+50, len(plist))}/{len(plist)}...", end="\r")
    return stats

def _insert_product_into_db(conn, product, store_name):
    cur = conn.cursor()
    pid = int(product["legacyResourceId"])
    cur.execute("DELETE FROM product_variants WHERE product_id = ? AND store_name = ?", (pid, store_name))
    cur.execute("DELETE FROM product_assets WHERE product_id = ? AND store_name = ?", (pid, store_name))
    seo = product.get("seo") or {}
    cur.execute("INSERT OR REPLACE INTO products (product_id, store_name, handle, title, body_html, vendor, status, seo_title, seo_description, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))", (pid, store_name, product["handle"], product["title"], product["bodyHtml"], product["vendor"], product["status"], seo.get("title"), seo.get("description")))
    for v in product["variants"]["edges"]:
        v_node = v["node"]
        sn, col, sz = parse_sku(v_node["sku"])
        cur.execute("INSERT INTO product_variants (product_id, store_name, sku, style_number, color, size, price, compare_at_price, inventory, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))", (pid, store_name, v_node["sku"], sn, col, sz, v_node["price"], v_node["compareAtPrice"], v_node["inventoryQuantity"]))
    for img in product["images"]["edges"]:
        cur.execute("INSERT INTO product_assets (product_id, store_name, asset_type, url) VALUES (?, ?, 'image', ?)", (pid, store_name, img["node"]["url"]))

def phase3_refresh_dashboard(conn, dry_run=False):
    cur = conn.cursor()
    combined_rows = []
    for t in ["in_stock_dashboard", "the_dress_outlet"]:
        sql = f"SELECT id, style, color, tdo_product_id, wdo_product_id, kos_product_id, '{t}' FROM {t}"
        if t == "in_stock_dashboard":
            sql += " WHERE style LIKE '%107%'"
        cur.execute(sql)
        combined_rows.extend(cur.fetchall())
    print("  [DEBUG] Pre-loading memory maps...")
    cur.execute("SELECT product_id, store_name, title, body_html, seo_title, seo_description, status, vendor FROM products")
    pmap = {(r[0], r[1].upper()): r[2:] for r in cur.fetchall()}
    cur.execute("SELECT product_id, store_name, price, compare_at_price, inventory, color, size FROM product_variants")
    vmap = {}
    for r in cur.fetchall():
        k = (r[0], r[1].upper())
        if k not in vmap: vmap[k] = []
        vmap[k].append(r[2:])
    cur.execute("SELECT product_id, store_name, asset_type, url FROM product_assets")
    amap = {}
    for r in cur.fetchall():
        k = (r[0], r[1].upper())
        if k not in amap: amap[k] = []
        amap[k].append(r[2:])
    
    updated = 0
    for row_id, style, color_db, tdo_pid, wdo_pid, kos_pid, table in combined_rows:
        store_pids = {"TDO": tdo_pid, "WDO": wdo_pid, "KOS": kos_pid}
        def _get_p(pid, s):
            vs = vmap.get((pid, s.upper()), [])
            for p, c, i, col, sz in vs:
                if p and p > 0: return p, c
            return 0, 0
        tp, tc = _get_p(tdo_pid, "TDO")
        wp, wc = _get_p(wdo_pid, "WDO")
        kp, kc = _get_p(kos_pid, "KOS")
        rp, whp = tp, (wp if wp else (kp if kp else 0))
        lt, ld, vn, sts = None, None, None, {}
        for s in ALL_STORES:
            pid = store_pids.get(s)
            if not pid: sts[s] = "none"; continue
            pd = pmap.get((pid, s.upper()))
            if pd:
                t, b, st, sd, stt, v = pd
                sts[s] = (stt or "").strip() or "none"
                if not lt and t: lt = t.strip()
                if not ld and b: ld = b.strip()
                if not vn and v: vn = v.strip()
            else: sts[s] = "none"
            
        mt, md = None, None
        main_pid = tdo_pid or wdo_pid or kos_pid
        main_s = "TDO" if tdo_pid else ("WDO" if wdo_pid else "KOS")
        if main_pid:
            pd = pmap.get((main_pid, main_s.upper()))
            if pd: mt, md = pd[2], pd[3]

        color_filter = clean_color(color_db)
        if not color_filter and "-" in style:
             color_filter = clean_color(style.rsplit("-", 1)[0].rsplit(" ", 1)[-1])

        asz = {}
        for s in ALL_STORES:
            pid = store_pids.get(s)
            if not pid: continue
            for p, c, inv, vc, sz in vmap.get((pid, s.upper()), []):
                v_color = clean_color(vc)
                # Flexible match: either they match exactly, or one contains the other
                if not color_filter or v_color == color_filter or v_color.startswith(color_filter) or color_filter.startswith(v_color) or v_color == "":
                    ss = str(sz).strip() if sz else "?"
                    asz[ss] = asz.get(ss, 0) + (inv or 0)
        sorted_sz = sorted(asz.keys(), key=lambda x: (0, float(x.replace("W",""))) if x.replace("W","").replace(".","").isdigit() else (1, x))
        sz_str = ", ".join(f"{s}({asz[s]})" for s in sorted_sz) if sorted_sz else "none"
        tinv = sum(asz.values())
        hv = 0
        for s in ALL_STORES:
            pid = store_pids.get(s)
            if not pid: continue
            for at, au in amap.get((pid, s.upper()), []):
                if at == "video" or (au and au.lower().endswith(".mp4")): hv = 1; break
            if hv: break
        matched = 1 if any(store_pids.values()) else 0
        if not dry_run:
            cur.execute(f"""UPDATE {table} SET 
                vendor=?, tdo_admin_link=?, wdo_admin_link=?, kos_admin_link=?, compare_at_price=?, 
                retail_price=?, wholesale_price=?, tdo_price=?, tdo_compare_at_price=?, 
                wdo_price=?, wdo_compare_at_price=?, kos_price=?, kos_compare_at_price=?, 
                color=?, sizes=?, total_inventory=?, tdo_status=?, wdo_status=?, kos_status=?, 
                local_title=?, local_description=?, local_meta_title=?, local_meta_description=?, 
                backup_meta_title=?, backup_meta_description=?, has_video=?, matched=? WHERE id=?""", 
                (vn, ADMIN_URLS["TDO"].format(id=tdo_pid) if tdo_pid else None, ADMIN_URLS["WDO"].format(id=wdo_pid) if wdo_pid else None, ADMIN_URLS["KOS"].format(id=kos_pid) if kos_pid else None, tc, rp, whp, tp, tc, wp, wc, kp, kc, color_db, sz_str, tinv, sts.get("TDO","none"), sts.get("WDO","none"), sts.get("KOS","none"), lt, ld, mt, md, mt, md, hv, matched, row_id))
            if table == "in_stock_dashboard": cur.execute("UPDATE in_stock_dashboard SET price=? WHERE id=?", (rp, row_id))
            updated += 1
            if updated % 100 == 0: conn.commit()
    if not dry_run: conn.commit()
    return updated

def refresh_dashboard(db_path=None, store_filter=None, dry_run=True):
    global DB_PATH
    if db_path: DB_PATH = db_path
    conn = db_conn()
    print(f"--- FINAL SELECTIVE REFRESH (Target: {DB_PATH}) ---")
    print(f"PHASE 1: Local Match")
    links = phase1_local_match(conn, dry_run=dry_run)
    print(f"PHASE 2: Selective Fetch")
    stores = get_stores(conn, store_filter)
    phase2_shopify_fetch(conn, stores, dry_run=dry_run)
    print(f"PHASE 2b: Linked Refresh")
    phase2b_refresh_linked(conn, {s["store_name"].upper(): s for s in stores}, dry_run=dry_run)
    print(f"PHASE 3: Dashboard Update")
    refreshed = phase3_refresh_dashboard(conn, dry_run=dry_run)
    print(f"DONE: Refreshed {refreshed} rows.")
    conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=None)
    parser.add_argument("--store", default=None)
    parser.add_argument("--commit", action="store_true")
    args = parser.parse_args()
    refresh_dashboard(db_path=args.db, store_filter=args.store, dry_run=not args.commit)
