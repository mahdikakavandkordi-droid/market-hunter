"""Reduce saved SEC responses and reconcile facts against original inline XBRL.

Usage: python3 scripts/prepare-fundamental-fixtures.py INPUT_DIR OUTPUT_DIR
Only factual excerpts are emitted. Original filings remain outside the repository.
"""
import hashlib
import json
import pathlib
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser

TAGS = {'RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues',
        'OperatingIncomeLoss', 'NetIncomeLoss',
        'NetIncomeLossFromContinuingOperationsAvailableToCommonShareholdersDiluted',
        'NetCashProvidedByUsedInOperatingActivities',
        'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
        'PaymentsToAcquirePropertyPlantAndEquipment', 'CashAndCashEquivalentsAtCarryingValue',
        'LongTermDebtCurrent', 'LongTermDebtNoncurrent'}


class InlineFacts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = None
        self.depth = 0
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if self.active:
            self.depth += 1
        elif tag == 'ix:nonfraction':
            self.active = {'attrs': dict(attrs), 'text': ''}
            self.depth = 1

    def handle_startendtag(self, tag, attrs):
        pass

    def handle_endtag(self, tag):
        if self.active:
            self.depth -= 1
            if self.depth == 0:
                self.rows.append(self.active)
                self.active = None

    def handle_data(self, data):
        if self.active:
            self.active['text'] += data


def extract_proofs(raw, cik):
    text = raw.decode('utf-8')
    contexts, units = {}, {}
    for match in re.finditer(r'<(?:xbrli:)?context\b[^>]*id="([^"]+)"[^>]*>(.*?)</(?:xbrli:)?context>', text, re.S):
        body = match[2]
        # Entity-wide contexts only; no dimension or scenario assumptions.
        if re.search(r'<(?:xbrli:)?(?:segment|scenario)\b', body):
            continue
        identifier = re.search(r'<(?:xbrli:)?identifier\b[^>]*>([^<]+)', body)
        if not identifier or identifier[1].zfill(10) != cik:
            continue
        def field(tag):
            result = re.search(r'<(?:xbrli:)?' + tag + r'\b[^>]*>([^<]+)', body)
            return result[1] if result else None
        contexts[match[1]] = {'start': field('startDate'), 'end': field('endDate') or field('instant')}
    for match in re.finditer(r'<(?:xbrli:)?unit\b[^>]*id="([^"]+)"[^>]*>(.*?)</(?:xbrli:)?unit>', text, re.S):
        body = match[2]
        if 'divide' not in body and re.search(r'<(?:xbrli:)?measure\b[^>]*>iso4217:USD</', body):
            units[match[1]] = 'USD'
    parser = InlineFacts()
    parser.feed(text)
    result = []
    for row in parser.rows:
        a = row['attrs']
        name = a.get('name', '')
        if not name.startswith('us-gaap:') or name.split(':')[1] not in TAGS:
            continue
        context = contexts.get(a.get('contextref'))
        if not context or a.get('unitref') not in units or a.get('xsi:nil') == 'true':
            continue
        if a.get('format') not in (None, 'ixt:num-dot-decimal', 'ixt:numdotdecimal', 'ixt-sec:numwordsen'):
            continue
        # Unsupported word transforms are rejected rather than guessed.
        numeric = row['text'].strip().replace(',', '').replace('\u00a0', '').replace(' ', '')
        if not re.fullmatch(r'\d+(?:\.\d+)?', numeric):
            continue
        value = float(numeric) * 10 ** int(a.get('scale', '0'))
        if a.get('sign') == '-':
            value = -value
        result.append({'tag': name, 'unit': 'USD', **context, 'value': value,
                       'id': a.get('id'), 'contextId': a.get('contextref')})
    return result


def main():
    source, target = map(pathlib.Path, sys.argv[1:3])
    target.mkdir(parents=True, exist_ok=True)
    selections = json.loads((source / 'selection.json').read_text())
    symbols = [sys.argv[3]] if len(sys.argv)>3 else list(selections)
    for symbol in symbols:
        facts = json.loads((source / f'{symbol}-facts.json').read_text())
        submissions = json.loads((source / f'{symbol}-submissions.json').read_text())
        recent = submissions['filings']['recent']
        selected = selections[symbol]
        i = recent['accessionNumber'].index(selected['accession'])
        accession = recent['accessionNumber'][i]
        cik = str(submissions['cik']).zfill(10)
        compact_facts = {'cik': facts['cik'], 'entityName': facts['entityName'], 'facts': {'us-gaap': {}}}
        for tag in sorted(TAGS):
            entry = facts['facts']['us-gaap'].get(tag)
            if entry:
                values = [r for r in entry.get('units', {}).get('USD', []) if r.get('accn') == accession]
                if values:
                    compact_facts['facts']['us-gaap'][tag] = {'units': {'USD': values}}
        # Retain recent financial filing metadata to exercise as-of selection.
        indices = [j for j, f in enumerate(recent['form']) if f in ['10-Q', '10-K', '10-Q/A', '10-K/A']][:12]
        fields = ['accessionNumber', 'form', 'filingDate', 'acceptanceDateTime', 'reportDate', 'primaryDocument']
        compact_submissions = {'cik': submissions['cik'], 'name': submissions['name'],
                               'filings': {'recent': {k: [recent[k][j] for j in indices] for k in fields}}}
        raw = (source / f'{symbol}-filing.html').read_bytes()
        proof = {'accession': accession,
                 'sourceUrl': f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{accession.replace('-', '')}/{recent['primaryDocument'][i]}",
                 'sha256': hashlib.sha256(raw).hexdigest(), 'facts': extract_proofs(raw, cik)}
        response_files = [source / f'{symbol}-{kind}' for kind in ['facts.json', 'submissions.json', 'filing.html']]
        retrieved_at = selected['retrievedAt']
        output = {'facts': compact_facts, 'submissions': compact_submissions, 'proofs': proof,
                  'retrievedAt': retrieved_at, 'reviewedAt': None, 'collectionCutoff': selected['asOf'],
                  'responseHashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in response_files}}
        (target / f'{symbol}.json').write_text(json.dumps(output, indent=2) + '\n')
        print(symbol, 'inline fact excerpts:', len(proof['facts']))


if __name__ == '__main__':
    main()
