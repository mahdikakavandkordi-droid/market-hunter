"""Restore compact research inputs without altering any frozen artifact.

Pass --development-only before reproducing development; otherwise also restores
the consumed 2024–2025 test data. Does not download or retrain anything.
"""
from pathlib import Path
import base64,gzip,hashlib,json,sys

root=Path(__file__).resolve().parents[1]/'data/research/gold-v1'
payload=json.loads(gzip.decompress(base64.b64decode((root/'daily-inputs.json.gz.b64').read_text())))
manifest=json.loads((root/'inputs-manifest.json').read_text())
count=0
for name,content in payload.items():
    assert name in manifest and Path(name).name==name
    if '--development-only' in sys.argv and name in ['daily-2024.json','daily-2025.json']:continue
    assert hashlib.sha256(content.encode()).hexdigest()==manifest[name]
    path=root/name
    if path.exists():assert path.read_text()==content, f'Conflicting input: {name}'
    else:path.write_text(content)
    count+=1
print(f'{count} inputs verified/restored')
