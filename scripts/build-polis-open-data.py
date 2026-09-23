"""Build small attributed excerpts; originals stay under local research. No authors/voters."""
import csv,hashlib,json,io,sys
from pathlib import Path
root=Path(sys.argv[1]);rev='3be5785c3f5975d31f4578ee8bbf4426d45b7bf2'
cases=[('vtaiwan.uberx','vTaiwan UberX','2015-vtaiwan-uberx'),('15-per-hour-seattle','Seattle $15/hour','2014-seattle-15-per-hour'),('canadian-electoral-reform','Canadian electoral reform','2016-canadian-electoral-reform')]
manifest=[]
for slug,title,case in cases:
 raw=(root/slug/'comments.csv').read_bytes();rows=list(csv.DictReader(io.StringIO(raw.decode('utf-8-sig'))))
 selected=[r for r in rows if r['moderated']=='1'][:6]
 evidence={'title':title,'revision':rev,'license':'CC BY 4.0','attribution':'Data gathered using Polis; attribution to The Computational Democracy Project.','caseStudy':f'https://compdemocracy.org/case-studies/{case}','sourceUrl':f'https://github.com/compdemocracy/openData/tree/{rev}/{slug}','sha256':hashlib.sha256(raw).hexdigest(),'sourceRows':len(rows),'selection':'First six approved rows in source order. Editorial test subset; not representative.','omitted':['author-id','timestamps','individual votes'],'analysisUnavailable':['groups','pass counts','coverage','algorithm version']}
 value={'schema':'delib-polis-analysis/v1','conversationId':slug,'sourceFormat':'polis-open-data','sourceRevision':rev,'statements':[{'statementId':int(r['comment-id']),'text':r['comment-body'],'status':'approved','isSeed':None,'agrees':int(r['agrees']),'disagrees':int(r['disagrees']),'passes':None} for r in selected],'analysis':None,'synthesis':None,'evidence':evidence}
 path=f'public/fixtures/polis/{slug}.json';Path(path).parent.mkdir(parents=True,exist_ok=True);Path(path).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
 manifest.append({'id':slug,'title':title,'path':f'/fixtures/polis/{slug}.json',**evidence})
Path('public/data/polis-datasets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
