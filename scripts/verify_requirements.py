import csv,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def rows(path):return list(csv.DictReader(path.open(encoding='utf-8-sig')))
req=rows(next((root/'docs').glob('09*')));cov=rows(root/'verification/requirements_coverage.csv');tc=rows(next((root/'docs').glob('10*')));checks=rows(root/'verification/checklist.csv')
assert len({r['REQ-ID'] for r in cov})==len(req)==len(cov)
assert {r['REQ-ID'] for r in req}=={r['REQ-ID'] for r in cov}
assert {r['TC-ID'] for r in tc}<={r['TC-ID'] for r in checks}
for r in cov:
 assert r['status'] and r['testStatus'] and r['issues']
 for p in r['implementationFiles'].split(';'):
  if p:assert (root/p).is_file(),p
 assert r['deviceStatus']=='未検証'
app=json.loads((root/'app/src/coverage.json').read_text());assert {r['id'] for r in app}=={r['REQ-ID'] for r in cov}
print(json.dumps({'requirements':len(req),'coverage':len(cov),'initialCases':len(tc),'checklist':len(checks),'devicePassed':0,'passed':True},ensure_ascii=False))
