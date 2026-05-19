"""
Product Scraper — Google Sheet Writer
Writes scrape results back to the same Google Sheet in the same format.
Format: Style No | Total Qty | Product URL | Price (USD) | Image Link
Each style grouped with URLs in rows below it.
"""
import asyncio
import time
import re
from urllib.parse import urlparse


SHEET_URL = "https://docs.google.com/spreadsheets/d/1ZOeaerLy57a75OYkB6baNgizkmHD7dat1NrSSIwg2iM/edit"


async def write_results_to_sheet(brand_name: str, results: list[dict]):
    """
    Write scrape results to the Google Sheet as a new tab.
    Uses browser automation since API auth isn't available.
    
    Args:
        brand_name: Used as the tab name
        results: List of dicts with Style No, Total Qty, Product URL, Price (USD), Image Link
    """
    from sdk.utils.browser import get_browser
    
    browser = await get_browser("gsheet_write")
    await browser.goto(SHEET_URL)
    time.sleep(3)
    
    # Group results by style
    grouped = group_by_style(results)
    
    # Build the rows to write
    rows = build_sheet_rows(grouped)
    
    # Create new tab with brand name
    tab_name = f"{brand_name} - Results"
    
    # TODO: Use browser to create tab and paste data
    # For now, return the sheet URL
    return SHEET_URL


def group_by_style(results: list[dict]) -> dict:
    """Group results by style number, preserving PDF-extracted metadata."""
    grouped = {}
    for r in results:
        style = (r.get("Style No") or "").strip()
        if not style:
            continue
        
        if style not in grouped:
            grouped[style] = {
                "Style No": style,
                "Description": r.get("Description", ""),
                "Colors": r.get("Colors", ""),
                "Sizes": r.get("Sizes", ""),
                "Total Qty": r.get("Total Qty", ""),
                "Inventory Detail": r.get("Inventory Detail", ""),
                "listings": []
            }
        
        url = (r.get("Product URL") or "").strip()
        if url:
            # Deduplicate by URL within each style
            existing_urls = {l["Product URL"] for l in grouped[style]["listings"]}
            if url not in existing_urls:
                grouped[style]["listings"].append({
                    "Product URL": url,
                    "Price (USD)": r.get("Price (USD)", ""),
                    "Image Link": r.get("Image Link", ""),
                })
    return grouped


def build_sheet_rows(grouped: dict) -> list[list]:
    """
    Build rows in the same format as the Google Sheet:
    Row 1 (style): Style No | Total Qty | URL | Price | Image
    Row 2+ (listings): (empty) | (empty) | URL | Price | Image
    """
    rows = []
    rows.append(["Style No", "Total Qty", "Product URL", "Price (USD)", "Image Link"])
    
    for style, data in sorted(grouped.items()):
        listings = data["listings"]
        qty = data["Total Qty"]
        
        if listings:
            # First listing goes on same row as style
            first = listings[0]
            rows.append([
                style,
                qty or "",
                first.get("Product URL", ""),
                first.get("Price (USD)", ""),
                first.get("Image Link", ""),
            ])
            # Additional listings on subsequent rows
            for listing in listings[1:]:
                rows.append([
                    "",
                    "",
                    listing.get("Product URL", ""),
                    listing.get("Price (USD)", ""),
                    listing.get("Image Link", ""),
                ])
        else:
            # Style with 0 listings
            rows.append([style, qty or "", "", "", ""])
        
        # Empty row separator between styles
        rows.append(["", "", "", "", ""])
    
    return rows
