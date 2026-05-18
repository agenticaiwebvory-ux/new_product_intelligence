import csv

filename = 'scraper_cache.csv'
try:
    with open(filename, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            pass
    print("Success reading with utf-8-sig")
except UnicodeDecodeError as e:
    print(f"Failed with utf-8-sig: {e}")
    # Try to find exactly where
    with open(filename, 'rb') as f:
        lines = f.readlines()
        for i, line in enumerate(lines):
            try:
                line.decode('utf-8-sig')
            except UnicodeDecodeError as e:
                print(f"Error at line {i+1}: {e}")
                print(f"Line content (hex): {line.hex()}")
                print(f"Line content (latin-1): {line.decode('latin-1')}")
                break
except Exception as e:
    print(f"Error: {e}")
