// Reads only an explicitly public, existing pilot; never requests synthesis or writes.
import assert from 'node:assert/strict';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {parsePocketPolisExports,buildPocketPolisBundle} from '../public/pocket-polis-data-core.js';
import {pocketPolisBundleToDelibData} from '../public/delib-data-core.js';
import {importExchange,validateExchange} from '../public/exchange-core.js';
import {createProject,validateProject} from '../public/workspace-core.js';
import {planNativeImport,applyNativeImport} from '../public/workspace-import-core.js';
if(!process.argv.includes('--public-read-only'))throw new Error('Requires --public-read-only');
const config=JSON.parse(await readFile(new URL('../pilots/defense-budget.json',import.meta.url),'utf8'));
const base='https://polis.mashbean.net/api/conversations/3ovoxq5c6o';
const get=async path=>{const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Public export HTTP ${r.status}`);return r.text();};
const info=JSON.parse(await get(''));assert.equal(info.openData,true);assert.equal(info.title,config.expectedTitle);
const [statementsCsv,votesCsv]=await Promise.all([get('/export/statements.csv'),get('/export/votes.csv')]);
const sha=s=>createHash('sha256').update(s).digest('hex');
const files=[['statements',statementsCsv],['votes',votesCsv]].map(([role,raw])=>({role,name:role+'.csv',size:Buffer.byteLength(raw),sha256:sha(raw)}));
const parsed=parsePocketPolisExports({statementsCsv,votesCsv});
const native=buildPocketPolisBundle({title:info.title,description:info.description,reportUrl:config.reportUrl,parsed,exportedAt:new Date().toISOString(),files});
const data=pocketPolisBundleToDelibData(native),fileSha256=sha(JSON.stringify(data));
// The public pilot may include visitor responses; do not label all records fictional.
const bundle=importExchange(data,{tool:'delib-data',sha256:fileSha256,simulated:false});validateExchange(bundle);
const p=createProject({title:'Read-only interoperability check',audience:'Public export',goal:'Check typed values and lineage',deadline:'2026-12-01'});
applyNativeImport(p,planNativeImport(p,{bundle,fileSha256}));validateProject(JSON.parse(JSON.stringify(p)));
const evidence={checkedAt:new Date().toISOString(),scope:'Read-only public statements.csv and votes.csv → delib-data → exchange → workspace backup reload',source:config.reportUrl,files,records:bundle.records.length,typedResponses:bundle.records.filter(r=>r.kind==='response').length,writes:0,boundary:'No analysis, clustering, representativeness, synthesis generation or reverse import tested. Pilot text is fictional but may include visitor responses.'};
await writeFile('/private/tmp/delib-polis-evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
