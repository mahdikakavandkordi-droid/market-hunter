"""Single bounded SEC request. Honors the runner's normal network configuration."""
import sys,urllib.request,urllib.parse
url,agent=sys.argv[1:3]
parsed=urllib.parse.urlsplit(url)
if parsed.scheme!='https' or parsed.hostname not in ('data.sec.gov','www.sec.gov') or parsed.username or parsed.password:
 raise ValueError('Only official SEC HTTPS sources are allowed')
request=urllib.request.Request(url,headers={'User-Agent':agent})
with urllib.request.urlopen(request,timeout=20) as response:
 sys.stdout.write(response.read(25*1024*1024).decode('utf-8'))
