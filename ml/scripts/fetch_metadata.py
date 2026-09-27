import requests
import json

url = 'https://grammanchitragis.nic.in/grammanchitra/rest/services/panchayat/panchayat_admin/MapServer/3?f=json'
try:
    response = requests.get(url, timeout=15, verify=False)
    data = response.json()
    print('Name:', data.get('name'))
    print('Type:', data.get('type'))
    print('Geometry Type:', data.get('geometryType'))
    print('MaxRecordCount:', data.get('maxRecordCount'))
    print('Fields:')
    for f in data.get('fields', []):
        print(f"  - {f['name']} ({f['type']})")
except Exception as e:
    print('Error:', e)
