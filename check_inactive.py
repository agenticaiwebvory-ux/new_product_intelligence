import sqlite3
conn = sqlite3.connect('D:\\Office\\Product Dashboard\\backend\\app\\DB\\in_stock_3.db')
cursor = conn.cursor()
# Get column info for in_stock_dashboard
cursor.execute('PRAGMA table_info(in_stock_dashboard)')
cols = cursor.fetchall()
print("in_stock_dashboard columns:")
for c in cols:
    print(f"  {c[1]} ({c[2]})")

# Query specific products with inactive stores
cursor.execute("""
    SELECT style, tdo_status, wdo_status, kos_status, im_status 
    FROM in_stock_dashboard 
    WHERE wdo_status = 'DRAFT' OR wdo_status = 'UNKNOWN'
       OR tdo_status = 'DRAFT' OR tdo_status = 'UNKNOWN'
       OR kos_status = 'ACTIVE'
    LIMIT 5
""")
print("\nProducts with inactive/DRAFT stores:")
for r in cursor.fetchall():
    print(f"  {r}")
conn.close()
