// Explicitly gated production acceptance. Deletes only the space created here.
import assert from 'node:assert/strict';
import {writeFile,unlink,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {importExchange} from '../public/exchange-core.js';
import {createProject,validateProject,allRecords} from '../public/workspace-core.js';
import {planNativeImport,applyNativeImport} from '../public/workspace-import-core.js';
if(!process.argv.includes('--live-synthetic'))throw new Error('Requires --live-synthetic');
const origin='https://proposals.mashbean.net',recovery='/private/tmp/delib-proposals-cleanup.json';
try {await access(recovery);throw new Error('Clean up the previous owned test before retrying');}catch(e){if(e.code!=='ENOENT')throw e;}
let owned,evidence;
const sha=s=>createHash('sha256').update(s).digest('hex');
async function request(path,{method='GET',body,admin}={}){
 const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(admin?{'X-Space-Admin':admin}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw new Error(`Proposal service HTTP ${r.status}`);return r.json();
}
try {
 const health=await request('/api/health');
 const c=await request('/api/spaces',{method:'POST',body:{title:'[Fictional software test] Delib archive',description:'No real participants or decisions. Deleted after verification.',prompt:'Test an accessible school street',askAlias:false,confirmed:true}});
 assert.match(c.spaceId,/^[a-z0-9]{10}$/);assert.match(c.adminToken,/^[a-f0-9]{32}$/);
 owned={id:c.spaceId,token:c.adminToken};await writeFile(recovery,JSON.stringify(owned),{mode:0o600,flag:'wx'});
 const base=`/api/spaces/${owned.id}`,owner=crypto.randomUUID(),visitor=crypto.randomUUID();
 const original='Keep an accessible drop-off bay during the school-street pilot.';
 const revised=original+' Review delivery access after two weeks.';
 const post=(path,body)=>request(base+path,{method:'POST',body});
 const p=await post('/proposals',{participantId:owner,title:'Accessible arrival',body:original});
 const pid=p.proposal.id;
 const before=await request(base+'/export/archive.json',{admin:owned.token});
 const a=await post(`/proposals/${pid}/amend`,{participantId:visitor,body:revised,rationale:'Delivery access needs a scheduled review.'});
 await post(`/amendments/${a.amendment.id}/endorse`,{participantId:owner});
 await post(`/amendments/${a.amendment.id}/decide`,{participantId:owner,accept:true});
 await post(`/proposals/${pid}/respond`,{participantId:visitor,text:'Can wheelchair users join the review?'});
 const archive=await request(base+'/export/archive.json',{admin:owned.token});
 assert.equal(archive.schema,'pocket-proposals-archive/v1');
 assert.equal(archive.proposals[0].versions.length,2);
 assert.equal(archive.proposals[0].amendments[0].state,'accepted');
 assert.equal(archive.proposals[0].amendments[0].endorsements,1);
 assert.equal(archive.proposals[0].responses.length,1);
 assert(!JSON.stringify(archive).match(/"(alias|author|hash|adminHash|mine|endorsed)":/));
 const project={...createProject({title:'Fictional school street',audience:'Fictional participants',goal:'Check archive fidelity',deadline:'2026-12-01'}),simulated:true};
 let last;
 for(const data of [before,archive]){
  const fileSha256=sha(JSON.stringify(data));const bundle=importExchange(data,{tool:'proposals',sha256:fileSha256,simulated:true});
  last=planNativeImport(project,{bundle,fileSha256});applyNativeImport(project,last);
 }
 assert.equal(last.comparison.added.length,3);assert.equal(last.comparison.changed.length,1);
 assert.equal(allRecords(project).length,7);validateProject(JSON.parse(JSON.stringify(project)));
 const legacy=await request(base+'/export/space.json',{admin:owned.token});
 assert.equal(typeof legacy.proposals[0].amendments,'number');
 evidence={checkedAt:new Date().toISOString(),serviceBuild:health.sha,scope:'Synthetic proposal creation, amendment, endorsement, acceptance, response, two authenticated archives, legacy compatibility, Delib graph/version comparison and backup reload',counts:{proposals:1,amendments:1,responses:1,versions:2,normalizedRecords:5},archiveSha256:sha(JSON.stringify(archive)),cleanup:'pending'};
}finally{
 if(owned){await request(`/api/spaces/${owned.id}`,{method:'DELETE',admin:owned.token});const r=await fetch(`${origin}/api/spaces/${owned.id}`,{signal:AbortSignal.timeout(12000)});assert([404,410].includes(r.status));await unlink(recovery);if(evidence)evidence.cleanup='deleted-and-verified';console.log('Owned proposal test deleted and verified.');}
}
if(evidence){await writeFile('/private/tmp/delib-proposals-evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));}
