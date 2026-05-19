import httpx
import json

def fetch_shopify_image(url: str) -> str | None:
    """
    Attempt to fetch the high-res product image by appending .json to Shopify URLs.
    """
    if not url or "/products/" not in url:
        return None
    
    # Clean URL and add .json
    base_url = url.split("?")[0].split("#")[0].rstrip("/")
    json_url = f"{base_url}.json"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    print(f"Fetching: {json_url}")
    try:
        resp = httpx.get(json_url, headers=headers, timeout=10, follow_redirects=True)
        print(f"Status: {resp.status_code}")

        if resp.status_code == 200:
            data = resp.json()
            # Extract high-res image src from product images
            product = data.get("product", {})
            images = product.get("images", [])
            if images:
                return images[0].get("src")
            else:
                image = product.get("image", {})
                return image.get("src")
        else:
            print(f"Failed to fetch JSON: {resp.status_code}")
    except Exception as e:
        print(f"Error: {e}")
    return None

if __name__ == "__main__":
    # Test with a known Shopify store (The Dress Outlet)
    test_url = "https://www.thedressoutlet.com/products/betsy-adam-long-satin-gown-a25333"
    img = fetch_shopify_image(test_url)
    print(f"Result: {img}")
