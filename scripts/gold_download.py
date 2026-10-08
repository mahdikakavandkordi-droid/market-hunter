"""Download public HistData annual XAUUSD M1 archives; aggregate without filling gaps.

The form POST downloads a public file. No account, payment or orders are involved.
Usage: python scripts/gold_download.py 2009 2023
Raw zips stay in tmp; compact daily bars plus hashes are reproducible research inputs.
"""
from pathlib import Path
import concurrent.futures, hashlib, http.cookiejar, io, json, re, sys
import urllib.request, urllib.parse, zipfile
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/research/gold-v1'
RAW = ROOT / 'tmp/gold-raw'

def download(year):
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    path = RAW / f'{year}.zip'
    url = f'https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/xauusd/{year}'
    if not path.exists():
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        page = opener.open(url, timeout=40).read().decode()
        form = re.search(r'<form id="file_down".*?</form>', page, re.S)
        if not form:
            raise ValueError(f'{year}: annual download form missing')
        fields = dict(re.findall(r'name="([^"]+)"[^>]*value="([^"]*)"', form.group()))
        assert fields['fxpair'] == 'XAUUSD' and fields['datemonth'] == str(year)
        req = urllib.request.Request('https://www.histdata.com/get.php', data=urllib.parse.urlencode(fields).encode(), headers={'Referer': url})
        body = opener.open(req, timeout=60).read()
        if not body.startswith(b'PK'):
            raise ValueError(f'{year}: response is not a zip')
        path.write_bytes(body)
    body = path.read_bytes()
    with zipfile.ZipFile(io.BytesIO(body)) as z:
        names = [n for n in z.namelist() if n.lower().endswith('.csv')]
        frames = [pd.read_csv(z.open(n), sep=';', header=None, names=['timestamp','open','high','low','close','volume']) for n in names]
    df = pd.concat(frames, ignore_index=True)
    df['timestamp'] = pd.to_datetime(df.timestamp, format='%Y%m%d %H%M%S')
    assert not df.timestamp.duplicated().any(), 'duplicate source minute'
    assert df.timestamp.is_monotonic_increasing, 'unordered source'
    a = df[['open','high','low','close']]
    assert np.isfinite(a).all().all() and (a > 0).all().all()
    assert (df.high >= df[['open','close','low']].max(axis=1)).all()
    assert (df.low <= df[['open','close','high']].min(axis=1)).all()
    assert (df.timestamp.dt.year == year).all()
    daily = []
    for date, group in df.groupby(df.timestamp.dt.date, sort=True):
        if date.weekday() > 4:
            continue
        times = group.timestamp
        gap = times.diff().dt.total_seconds().max() / 60
        first = int(times.iloc[0].hour * 60 + times.iloc[0].minute)
        last = int(times.iloc[-1].hour * 60 + times.iloc[-1].minute)
        quality = bool(len(group) >= 900 and gap <= 120 and first <= 30 and (date.weekday() == 4 or last >= 1409))
        daily.append({'date':str(date), 'open':float(group.open.iloc[0]),'high':float(group.high.max()),'low':float(group.low.min()),'close':float(group.close.iloc[-1]),'minutes':len(group),'first_minute':first,'last_minute':last,'max_gap_minutes':None if pd.isna(gap) else float(gap),'quality':quality})
    result = {'year':year,'source_url':url,'raw_sha256':hashlib.sha256(body).hexdigest(),'raw_bytes':len(body),'minute_rows':len(df),'timezone':'UTC-05:00 fixed','quote_side':'bid','daily':daily}
    target = OUT / f'daily-{year}.json'
    encoded = json.dumps(result, separators=(',',':')) + '\n'
    if target.exists() and target.read_text() != encoded:
        raise ValueError(f'{year}: immutable input differs')
    target.write_text(encoded)
    print(json.dumps({'year':year,'minutes':len(df),'daily':len(daily),'quality_days':sum(x['quality'] for x in daily)}), flush=True)
    return result

if __name__ == '__main__':
    years = range(int(sys.argv[1]), int(sys.argv[2])+1)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(download, years))
