import requests
import re

url = "https://data.chc.ucsb.edu/products/CHIRPS-2.0/global_daily/netcdf/p05/"
try:
    html = requests.get(url).text
    matches = re.findall(r'href="(.*?2023.*?\.nc)"', html)
    print("Matches:", matches)
except Exception as e:
    print("Error:", e)
