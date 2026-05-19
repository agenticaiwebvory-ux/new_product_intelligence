filename = 'scraper_cache.csv'
try:
    with open(filename, 'rb') as f:
        data = f.read()
    
    # Try to find where it fails
    lines = data.split(b'\n')
    for i, line in enumerate(lines):
        try:
            line.decode('utf-8')
        except UnicodeDecodeError as e:
            print(f"Line {i+1} failed to decode with utf-8: {e}")
            print(f"Content (hex): {line.hex()}")
            print(f"Content (latin-1): {line.decode('latin-1')}")
            print("-" * 20)
except Exception as e:
    print(f"Error: {e}")
