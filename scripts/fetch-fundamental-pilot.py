"""Manual read-only pilot collection, without a cron, paid provider or credentials."""
import argparse
import json
import pathlib
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument('output_directory', type=pathlib.Path, help='Keep full raw responses outside the repository')
parser.add_argument('--user-agent', required=True, help='Identify your application and provide a real contact URL/address')
args = parser.parse_args()
if len(args.user_agent.strip()) < 15:
    parser.error('Provide a meaningful identifying User-Agent')
args.output_directory.mkdir(parents=True, exist_ok=True)


def fetch(url, filename):
    request = urllib.request.Request(url, headers={'User-Agent': args.user_agent})
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read()
    (args.output_directory / filename).write_bytes(raw)
    return raw


# Sequential, bounded requests; no access-control bypass or unbounded retry.
for symbol, cik in [('BHC', '0000885590'), ('SSRM', '0000921638'), ('META', '0001326801'), ('MSFT', '0000789019')]:
    fetch(f'https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json', f'{symbol}-facts.json')
    submissions = json.loads(fetch(f'https://data.sec.gov/submissions/CIK{cik}.json', f'{symbol}-submissions.json'))
    recent = submissions['filings']['recent']
    index = next(i for i, form in enumerate(recent['form']) if form in ['10-Q', '10-K']
                 and recent['reportDate'][i] == '2026-06-30' and recent['filingDate'][i] <= '2026-10-08')
    accession = recent['accessionNumber'][index].replace('-', '')
    document = recent['primaryDocument'][index]
    fetch(f'https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession}/{document}', f'{symbol}-filing.html')
    print(f'{symbol}: three primary SEC responses saved')
