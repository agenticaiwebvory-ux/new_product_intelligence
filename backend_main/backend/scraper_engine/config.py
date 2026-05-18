"""
Product Scraper -- Configuration  v4.2
"""
import os

# -- Paths --
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
CACHE_CSV  = os.path.join(BASE_DIR, "scraper_cache.csv")
INPUT_DIR  = os.path.join(BASE_DIR, "input")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

# -- Serper API Key --
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")

# -- Search Settings --
MAX_RESULTS_PER_QUERY = 20       # max Google results per style search
SEARCH_DELAY_SECONDS  = 1.5      # delay between Serper calls

# -- Google Sheet --
GSHEET_URL = "https://docs.google.com/spreadsheets/d/1ZOeaerLy57a75OYkB6baNgizkmHD7dat1NrSSIwg2iM/edit"

# -- Cache CSV Columns  (extended with rich product fields) --
CACHE_COLUMNS = [
    "Style No",
    "Description",
    "Colors",
    "Sizes",
    "Total Qty",
    "Inventory Detail",
    "Product URL",
    "Price (USD)",
    "Wholesale Price",
    "Retail Price",
    "Image Link",
    "Season",
    "Fabric",
    "Country of Origin",
    "Code",
    "Vendor Name",
]
