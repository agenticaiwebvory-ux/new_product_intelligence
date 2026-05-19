import sqlite3

db = r"D:\Office\Product Dashboard\backend\app\DB\in_stock_3.db"
conn = sqlite3.connect(db)
cur = conn.cursor()

# Check if column exists
cur.execute("PRAGMA table_info(in_stock_dashboard)")
cols = [r[1] for r in cur.fetchall()]
if "backup_created_at" not in cols:
    cur.execute("ALTER TABLE in_stock_dashboard ADD COLUMN backup_created_at DATETIME")
    print("Added backup_created_at to in_stock_dashboard")

cur.execute("PRAGMA table_info(the_dress_outlet)")
cols = [r[1] for r in cur.fetchall()]
if "backup_created_at" not in cols:
    cur.execute("ALTER TABLE the_dress_outlet ADD COLUMN backup_created_at DATETIME")
    print("Added backup_created_at to the_dress_outlet")

conn.commit()
conn.close()
print("Done")
