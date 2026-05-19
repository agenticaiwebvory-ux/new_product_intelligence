import httpx
import json

def fetch_shopify_image(url: str) -> str | None:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    base_url = url.split("?")[0].split("#")[0].rstrip("/")
    json_url = f"{base_url}.json"
    print(f"Fetching: {json_url}")
    try:
        resp = httpx.get(json_url, headers=headers, timeout=10, follow_redirects=True)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            images = data.get("product", {}).get("images", [])
            if images: return images[0].get("src")
            image = data.get("product", {}).get("image", {})
            return image.get("src")
    except Exception as e:
        print(f"Error: {e}")
    return None

if __name__ == "__main__":
    test_url = "https://newyorkersapparel.com/products/london-times-floral-print-empire-waist-maxi-dress"
    img = fetch_shopify_image(test_url)
    print(f"Result: {img}")
