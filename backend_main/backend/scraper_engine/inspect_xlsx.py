
import openpyxl

xlsx_path = r"D:\.openclaw\workspace\Product-scraper\product-scraper-v4\output\Adrianna_Papell_20260430_121735.xlsx"
wb = openpyxl.load_workbook(xlsx_path)
sheet = wb.active

print("Headers:")
headers = [cell.value for cell in sheet[1]]
print(headers)

print("\nFirst 3 rows:")
for row in sheet.iter_rows(min_row=2, max_row=4, values_only=True):
    print(row)
