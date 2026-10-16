import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

// Execute the actual workflow shell, rather than a duplicate routing function.
const yaml = readFileSync(new URL('../.github/workflows/asset-freshness-refresh.yml', import.meta.url), 'utf8');
const step = yaml.split('      - name: Select asset group\n')[1].split('\n      - name:')[0];
const script = step.split('        run: |\n')[1].split('\n').map(line => line.replace(/^          /, '')).join('\n');
assert.ok(!script.includes('date -u'), 'routing must not depend on delayed execution time');
assert.match(step, /REFRESH_SCHEDULE: \$\{\{ github.event.schedule \}\}/);
assert.match(step, /REFRESH_GROUP: \$\{\{ inputs.group \}\}/);
const dir = mkdtempSync(join(tmpdir(), 'mh-refresh-routing-'));
try {
  const cases = [
    ['schedule', '15 0 * * *', '', 'crypto'],
    ['schedule', '15 1 * * *', '', 'crypto'],
    ['schedule', '15 4 * * 2-6', '', 'metals'],
    ['schedule', '15 5 * * 2-6', '', 'metals'],
    ['workflow_dispatch', '', 'crypto', 'crypto'],
    ['workflow_dispatch', '', 'metals', 'metals'],
    ['schedule', '', '', null],
    ['schedule', 'unknown', '', null],
    ['workflow_dispatch', '', 'invalid', null],
    ['workflow_dispatch', '', '', null],
  ];
  cases.forEach(([event, schedule, group, expected], i) => {
    const output = join(dir, String(i));
    const result = spawnSync('bash', ['-c', script], {encoding:'utf8', env:{...process.env,
      GITHUB_EVENT_NAME:event, REFRESH_SCHEDULE:schedule, REFRESH_GROUP:group, GITHUB_OUTPUT:output}});
    if (!expected) { assert.notEqual(result.status, 0); return; }
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(output, 'utf8'), `keys=${expected==='crypto'?'BTC,ETH':'GOLD,SILVER'}\ngroup=${expected}\n`);
  });
  console.log('Asset refresh routing: 10 cases passed');
} finally { rmSync(dir, {recursive:true, force:true}); }
