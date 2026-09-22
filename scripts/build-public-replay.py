"""Rebuild the attributed teaching subset from pinned upstream files kept in local research."""
import csv, json, hashlib, sys, io
from pathlib import Path
root=Path(sys.argv[1] if len(sys.argv)>1 else '../../research/vtaiwan-uberx')
raw=(root/'comments.csv').read_bytes()
rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8'))))
ids=[3,4,7,8,12,17]
selected=[]
translations={3:'I think fares may increase flexibly during peak hours.',4:'I think drivers should be allowed to accept dispatches from multiple companies.',7:'I think all drivers carrying passengers should have accident insurance.',8:'I think Uber should pay taxes to the government where it operates.',12:'Uber is a matching platform, like an auction website, and belongs to the information industry.',17:'Uber dispatches workers, like a bus company employing drivers, and belongs to the service industry.'}
for id in ids:
 r=next(r for r in rows if int(r['comment-id'])==id)
 selected.append({'id':id,'text':r['comment-body'],'translation':translations[id],'timestamp':r['timestamp'],'moderated':int(r['moderated']),'agree':int(r['agrees']),'disagree':int(r['disagrees'])})
result={'schema':'delib-public-replay-source/v1','source':'vTaiwan UberX / Computational Democracy Project openData','url':'https://github.com/compdemocracy/openData/tree/3be5785c3f5975d31f4578ee8bbf4426d45b7bf2/vtaiwan.uberx','revision':'3be5785c3f5975d31f4578ee8bbf4426d45b7bf2','license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/','commentsSha256':hashlib.sha256(raw).hexdigest(),'retrieved':'2026-09-22','selection':ids,'selectionRule':'Editorial teaching subset: pricing, dispatch, insurance, taxation and conflicting platform definitions. Not random, representative or selected by support. All selected rows have raw moderated=1; no new moderation decision is inferred.','omitted':['author-id','individual votes','participant identifiers'],'sourceRows':len(rows),'summaryReportedVoters':1921,'summaryReportedCommenters':105,'records':selected}
Path('public/data/uberx-replay.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
