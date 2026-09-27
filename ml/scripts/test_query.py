import requests
import json

url = 'https://grammanchitragis.nic.in/grammanchitra/rest/services/panchayat/panchayat_admin/MapServer/3/query'
params = {
    'where': "UPPER(stname) = 'MAHARASHTRA' AND UPPER(dtname) = 'PUNE'",
    'outFields': '*',
    'returnCountOnly': 'true',
    'f': 'json'
}
response = requests.get(url, params=params, verify=False)
data = response.json()
print("Count:", data.get('count'))
if data.get('features'):
    print(json.dumps(data['features'][0], indent=2))
else:
    print(data)
