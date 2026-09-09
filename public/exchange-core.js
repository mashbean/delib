import {proposalArchiveRecords} from './proposals-archive-core.js';
import {parseTttcCsv,tttcRowsToCsv} from './tttc-csv-core.js';
export const EXCHANGE_SCHEMA='https://delib.mashbean.net/schemas/delib-exchange/v1.json';
export const nativeAdapters=Object.freeze(['form','harmonica','tttc','reply','values','budget','check','proposals','argument','maple','civic-talk','sensemaker','delib-data']);
const secret=/^(adminToken|adminHash|token|responderHash|authorization|hostUrl|manageUrl|apiKey|password)$/i;
const privateField=/^(alias|name|interview|participant|responder|email|phone|contact|org|author_name|author_email|author_id|show_email|participantRef)$/i;
const text=(v,label)=>{if(typeof v!=='string'||!v.trim()||v.length>12000)throw new Error(`Invalid ${label} / 欄位無效`);return v;};
const arr=(v,label)=>{if(!Array.isArray(v)||v.length>5000)throw new Error(`Invalid ${label} / 陣列無效`);return v;};
function forbidSecrets(value,depth=0){if(depth>35)throw new Error('Data nesting limit / 資料層級過深');if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(secret.test(k))throw new Error('Remove credentials before import / 請移除管理憑證後再匯入');if(typeof v==='string'&&/(?:[#?](?:admin|token)=|Bearer\s+[A-Za-z0-9._-]{10})/i.test(v))throw new Error('Credential URL detected / 資料含管理連結');forbidSecrets(v,depth+1);}}
const ref=(scope,id)=>`${scope}:${encodeURIComponent(String(id))}`;
function clean(value,path,losses){if(Array.isArray(value))return value.map((v,i)=>clean(v,`${path}/${i}`,losses));if(value&&typeof value==='object'){const out=Object.create(null);for(const [key,v] of Object.entries(value)){const p=`${path}/${key}`;if(privateField.test(key)){// Topic/option names are content, not aliases.
 if(key==='name'&&!('alias' in value)&&!('qid' in value)&&!('participant' in value)&&!('stance' in value))out[key]=clean(v,p,losses);else losses.push({path:p,action:'blocked',reason:'Identity/linking fields excluded; content consent is separate.'});
 }else out[key]=clean(v,p,losses);}return out;}return value;}
export function importExchange(input,{tool,sourceId,sha256,simulated=false,filename='source',generatedAt=new Date().toISOString()}={}){
 if(!/^[a-f0-9]{64}$/.test(sha256||''))throw new Error('Source SHA-256 required');
 if(input?.schema===EXCHANGE_SCHEMA)return validateExchange(structuredClone(input));
 if(input?.schema==='https://delib.mashbean.net/schemas/delib-data/v1.json')tool='delib-data';
 if(!nativeAdapters.includes(tool)&&tool!=='csv')throw new Error('Unsupported native format; use TTTC CSV / 請使用 TTTC CSV');
 if(new TextEncoder().encode(typeof input==='string'?input:JSON.stringify(input)).length>3*1024*1024)throw new Error('Maximum 3 MiB');forbidSecrets(input);
 const activity=String(sourceId||input?.form?.formId||input?.session?.sessionId||input?.reportId||input?.taskId||input?.loopId||input?.bundleId||input?.budget?.budgetId||input?.check?.checkId||input?.space?.spaceId||input?.debate?.debateId||input?.hearing?.hearingId||(tool==='civic-talk'&&input?.[0]?.issue_id)||sha256.slice(0,16));
 if(!activity||activity.length>200)throw new Error('Invalid activity reference');
 const scope=`${tool}:${encodeURIComponent(activity)}`,losses=[],records=[],externalSources=[];
 const add=(id,kind,value,origin,relations=[],fields={},eligible=false)=>{records.push({id:ref(scope,id),sourceId:scope,originalId:String(id),kind,text:text(value,'record text'),origin,status:origin==='model'?'draft':'unreviewed',relations,fields,transferEligible:eligible});return ref(scope,id);};
 let methodData={};
 if(tool==='csv'){
 const rows=parseTttcCsv({text:input,label:filename}).rows;
 rows.forEach(r=>add(r.id,'statement',r.comment,'participant',[],{},true));
 losses.push({path:'/interview',action:'blocked',reason:'Source group labels excluded; no cross-tool identity matching.'},{path:'/',action:'unavailable',reason:'CSV has no votes, question types, consent, withdrawal or revision history.'});
 }else{
 methodData=clean(input,'',losses);
 if(tool==='form'){
 const questions=arr(input.form?.questions,'form.questions');for(const response of arr(input.responses,'responses')){
 if(!Number.isInteger(response.seq)||!response.answers||typeof response.answers!=='object')throw new Error('Invalid form response');
 for(const q of questions){text(q.id,'question id');text(q.label,'question label');text(q.type,'question type');const answer=response.answers[q.id];if(answer===undefined||answer==='')continue;
 const isText=typeof answer==='string';add(`p${response.seq}-${q.id}`,q.type==='consent'?'consent-answer':'answer',isText?answer:JSON.stringify(answer),'participant',[],{questionId:q.id,question:q.label,questionType:q.type,answer,exportText:q.exportText===true,createdAt:response.createdAt,updatedAt:response.updatedAt},q.exportText===true&&isText&&q.type!=='consent');
 }}losses.push({path:'/form/questions/*/type=consent',action:'review',reason:'A consent answer is not authorization for another destination or purpose.'});
 }else if(tool==='harmonica'){
 if(!input.session?.sessionId)throw new Error('Missing session');for(const c of arr(input.conversations,'conversations')){let previous=null;
 for(const m of arr(c.messages,'messages')){if(!['participant','interviewer'].includes(m.role))throw new Error('Unknown speaker role');const id=`p${c.participant}-m${m.seq}`;
 const link=previous?[{ref:previous,type:'context'}]:[];previous=add(id,m.role==='participant'?'statement':'interview-prompt',m.text,m.role==='participant'?'participant':'model',link,{role:m.role,at:m.at},m.role==='participant');}}
 }else if(tool==='tttc'){
 const tree=input.tree||input;let quoteIndex=0;for(const topic of arr(tree.topics,'topics'))for(const sub of arr(topic.subtopics,'subtopics'))for(const claim of arr(sub.claims,'claims')){
 const relations=arr(claim.quotes,'quotes').map(q=>{text(q.commentId,'commentId');const sourceRef=`external:${scope}:${encodeURIComponent(q.commentId)}`;if(!externalSources.some(s=>s.id===sourceRef))externalSources.push({id:sourceRef,originalId:q.commentId,status:'unresolved'});
 const quote=add(`quote-${claim.id}-${++quoteIndex}`,'quote',q.text,'source-excerpt',[{ref:sourceRef,type:'quotes'}],{commentId:q.commentId},false);return {ref:quote,type:'derived'};});
 if(!relations.length)throw new Error('Claim lacks source quotes / 主張缺少來源引文');add(`claim-${claim.id}`,'theme',claim.text,'model',relations,{topic:topic.name,subtopic:sub.name,sourceGroupCount:claim.people},false);}
 losses.push({path:'/topics/*/subtopics/*/claims/*/quotes',action:'review',reason:'Quote text is an excerpt. Match commentId to the original file; group counts are not unique people.'});
 }else if(tool==='reply'){
 const receipt=input.receipt||input,qs=arr(receipt.questions,'questions'),map=new Map();for(const q of qs){const id=add(`question-${q.qid}`,'question',q.text,'participant',[],{sourceId:q.sourceId,upvotes:q.upvotes,lens:q.lens},true);if(map.has(q.qid))throw new Error('Duplicate qid');map.set(q.qid,id);}
 for(const r of arr(receipt.loopbacks,'loopbacks')){if(!map.has(r.qid))throw new Error('Broken reply source / 回覆來源斷鏈');add(`reply-${r.qid}`,'reply',r.reply,'model',[{ref:map.get(r.qid),type:'responds'}],{beatId:r.beatId,role:r.role},false);}
 losses.push({path:'/loopbacks',action:'review',reason:'Generated replies are drafts; owner confirmation is not present in this export.'});
 }else if(tool==='values'){
 const graph=input.graph;if(!input.session?.sessionId)throw new Error('Missing values session');
 for(const n of arr(graph?.nodes,'graph.nodes'))add(n.cardId,'values-card',n.story||n.title,'participant-confirmed-synthesis',[],{title:n.title,attention:n.attention,wins:n.wins,losses:n.losses,compared:n.compared,strength:n.strength,rank:n.rank},false);
 for(const e of arr(graph.edges,'graph.edges')){if(!records.some(r=>r.originalId===e.from)||!records.some(r=>r.originalId===e.to))throw new Error('Broken values edge');}
 losses.push({path:'/graph',action:'preserved',reason:'Pairwise judgments remain a graph, not votes or consensus. Card wording is confirmed synthesis, not verbatim interview text.'});
 }else if(tool==='budget'){
 if(!input.budget?.budgetId||!input.results)throw new Error('Missing budget results');
 for(const o of arr(input.results.options,'results.options'))add(o.id,'budget-option',o.description||o.name,'organizer',[],{...o},false);
 losses.push({path:'/results',action:'aggregated',reason:'Totals, ballot counts and allocation bundles are retained. Individual ballots and reasons are not in results.json.'});
 }else if(tool==='check'){
 if(!input.check?.checkId||!input.results)throw new Error('Missing check results');
 for(const q of arr(input.results.questions,'results.questions'))add(q.id,'knowledge-check',q.prompt,'organizer',[],{...q},false);
 losses.push({path:'/results',action:'aggregated',reason:'Question accuracy is retained; it is not agreement. Individual feedback and attempts require their separate exports.'});
 }else if(tool==='proposals'){
 if(!input.space?.spaceId)throw new Error('Missing proposal space');
 if(input.schema!==undefined){
 for(const r of proposalArchiveRecords(input))add(r.id,r.kind,r.text,'participant',r.relations.map(e=>({...e,ref:ref(scope,e.ref)})),r.fields,r.eligible);
 losses.push({path:'/proposals',action:'preserved',reason:'Full versions, amendment bodies and rationales, acceptance states, responses and endorsement totals retained. Acceptance is the proposal author’s action, not group consensus. Response-time version is unknown.'});
 }else{
 for(const q of arr(input.proposals,'proposals')){const {alias,...fields}=q;add(q.id,'proposal',q.body,'participant',[],fields,true);}
 losses.push({path:'/proposals',action:'unavailable',reason:'Legacy space.json contains current proposals and counts only. Use archive.json for full amendments, responses and versions.'});
 }
 }else if(tool==='argument'){
 if(!input.debate?.debateId)throw new Error('Missing debate');
 const visit=(n,parent,depth)=>{if(depth>30)throw new Error('Argument depth exceeds limit');if(!['pro','con'].includes(n.side)||n.parentId!==(parent??0))throw new Error('Invalid argument parent or side');const {alias,children,...fields}=n;add(n.id,'argument',n.text,'participant',parent?[{ref:ref(scope,parent),type:n.side==='pro'?'supports':'opposes'}]:[],fields,true);for(const c of arr(children,'children'))visit(c,n.id,depth+1);};
 for(const n of arr(input.tree?.roots,'tree.roots'))visit(n,null,0);
 losses.push({path:'/tree',action:'preserved',reason:'Support/opposition edges and calculated strengths are retained. Strength is not a consensus score.'});
 }else if(tool==='maple'){
 if(!input.hearing?.hearingId)throw new Error('Missing hearing');
 for(const q of arr(input.testimonies,'testimonies')){const {name,org,...fields}=q;add(q.id,'testimony',q.text,'participant',[],fields,true);}
 losses.push({path:'/testimonies',action:'unavailable',reason:'Only visible testimonies are exported. Missing entries do not prove withdrawal; no remote withdrawal history is included.'});

 }else if(tool==='civic-talk'){
 const opinions=arr(input,'Civic Talk public opinions');const issue=opinions[0]?.issue_id;
 if(!Number.isInteger(issue))throw new Error('Missing Civic Talk issue');
 for(const o of opinions){if(o.issue_id!==issue||!Number.isInteger(o.id)||![0,1,2,3].includes(o.abuse_flagged))throw new Error('Mixed issue or invalid moderation status');
 if(o.abuse_flagged!==0||typeof o.summary!=='string'||!o.summary.trim()){losses.push({path:`/opinions/${o.id}`,action:'blocked',reason:'Flagged, hidden or empty opinion excluded from transfer.'});continue;}
 add(o.id,'opinion',o.summary,'participant',[],{issueId:o.issue_id,createdAt:o.created_at,abuseFlagged:o.abuse_flagged},true);}
 methodData=clean(opinions.filter(o=>o.abuse_flagged===0&&o.summary),'',[]);
 losses.push({path:'/',action:'unavailable',reason:'Civic Talk public opinions only; briefing, evidence materials, terms acceptance and remote moderation history are separate. Public visibility does not grant transfer permission.'});

 }else if(tool==='sensemaker'){
 if(input.success!==true||input.status!=='completed'||!text(input.taskId,'taskId')||!Number.isSafeInteger(input.commentsProcessed)||input.commentsProcessed<0||!Number.isFinite(Date.parse(input.completedAt)))throw new Error('Sensemaker requires a completed result JSON / 請使用完成後的結果 JSON');
 add('summary','method-result',input.summary,'model',[],{model:input.model,commentsProcessed:input.commentsProcessed,completedAt:input.completedAt,outputLanguage:input.outputLanguage},false);
 losses.push({path:'/summary',action:'review',reason:'Markdown summary is an unreviewed model result. The result API has no machine-readable comment lineage or vote table; commentsProcessed is not a participant count. No source links or consensus are inferred.'});
 }else if(tool==='delib-data'){
 if(input.schema!=='https://delib.mashbean.net/schemas/delib-data/v1.json'||input.kind!=='delib-data-bundle'||!input.source)throw new Error('Invalid delib-data bundle');
 for(const i of arr(input.items,'items')){if(!['participant','organizer','model'].includes(i.origin))throw new Error('Unknown item origin');const {text:body,...fields}=i;add(i.id,i.type,body,i.origin,[],clean(fields,'/items',losses),i.origin==='participant'&&i.type==='statement'&&i.status==='approved');}
 for(const v of arr(input.responses,'responses')){const {participantRef,...fields}=v;if(!Number.isInteger(v.count)||v.count<0)throw new Error('Invalid response count');add(v.id,'response',v.response,'participant',[{ref:ref(scope,v.subjectRef),type:'responds'},...(v.objectRef?[{ref:ref(scope,v.objectRef),type:'context'}]:[])],fields,false);}
 for(const o of arr(input.outcomes,'outcomes'))add(o.id,'method-result',o.type,'calculated',o.itemRef?[{ref:ref(scope,o.itemRef),type:'derived'}]:[],clean(o,'/outcomes',losses),false);
 losses.push({path:'/responses/participantRef',action:'blocked',reason:'Response values and counts retained; participant linkage excluded from the exchange companion. Keep the original privately for participation analysis.'});

 }
 }
 losses.push({path:'/records',action:'transformed',reason:'IDs are namespaced by tool and activity; original IDs remain.'},{path:'/methodData',action:'preserved',reason:'Non-identity native fields remain in the private companion; not all destination tools interpret them.'},{path:'/consent',action:'unavailable',reason:'Destination-specific permission and retention are not inferred.'});
 return validateExchange({schema:EXCHANGE_SCHEMA,version:1,simulated,generatedAt,sources:[{id:scope,tool,activity,sha256,filename,methodData}],records,externalSources,tombstones:[],losses,privacy:{visibility:'private',identityLinking:false,consent:'unknown',remoteDeletionConfirmed:false}});
}
export function validateExchange(bundle){
 if(!bundle||bundle.schema!==EXCHANGE_SCHEMA||bundle.version!==1||typeof bundle.simulated!=='boolean'||bundle.privacy?.visibility!=='private'||bundle.privacy?.identityLinking!==false||bundle.privacy?.consent!=='unknown'||bundle.privacy?.remoteDeletionConfirmed!==false)throw new Error('Invalid exchange envelope');
 if(new TextEncoder().encode(JSON.stringify(bundle)).length>12*1024*1024)throw new Error('Exchange exceeds 12 MiB');forbidSecrets(bundle);
 const sourceIds=new Set();for(const s of arr(bundle.sources,'sources')){text(s.id,'source id');if(sourceIds.has(s.id)||!/^[a-f0-9]{64}$/.test(s.sha256))throw new Error('Duplicate or invalid source');sourceIds.add(s.id);}
 const ids=new Set(),external=new Set(arr(bundle.externalSources,'external sources').map(s=>s.id));if(external.size!==bundle.externalSources.length)throw new Error('Duplicate external reference');
 const records=arr(bundle.records,'records');for(const r of records){text(r.id,'record id');text(r.text,'text');text(r.originalId,'original id');text(r.kind,'kind');if(!r.fields||typeof r.fields!=='object'||Array.isArray(r.fields)||!['participant','model','source-excerpt','organizer','participant-confirmed-synthesis','calculated'].includes(r.origin))throw new Error('Invalid record semantics');if(ids.has(r.id)||external.has(r.id)||!sourceIds.has(r.sourceId)||!['draft','unreviewed','reviewed','withdrawn','needs-review'].includes(r.status)||typeof r.transferEligible!=='boolean')throw new Error('Duplicate or invalid record');ids.add(r.id);}
 const known=new Set([...ids,...external]);for(const r of records)for(const edge of arr(r.relations,'relations'))if(!known.has(edge.ref)||edge.ref===r.id||!['context','derived','responds','quotes','revises','supports','opposes'].includes(edge.type))throw new Error('Broken lineage / 來源斷鏈');
 const index=new Map(records.map(r=>[r.id,r])),visited=new Set(),visiting=new Set();const walk=id=>{if(visited.has(id)||!index.has(id))return;if(visiting.has(id))throw new Error('Cyclic lineage');visiting.add(id);index.get(id).relations.forEach(e=>walk(e.ref));visiting.delete(id);visited.add(id);};records.forEach(r=>walk(r.id));
 for(const t of arr(bundle.tombstones,'tombstones'))if(!ids.has(t.ref)||!text(t.reason,'withdrawal reason')||!text(t.by,'withdrawal recorder')||!Number.isFinite(Date.parse(t.at)))throw new Error('Invalid withdrawal');const blocked=new Set(bundle.tombstones.map(t=>t.ref));let change=true;while(change){change=false;for(const r of records)if(!blocked.has(r.id)&&r.relations.some(e=>blocked.has(e.ref))){blocked.add(r.id);change=true;}}
 for(const r of records)if(blocked.has(r.id)&&(!['withdrawn','needs-review'].includes(r.status)||r.transferEligible))throw new Error('Withdrawal cannot be restored by import');
 arr(bundle.losses,'losses');return bundle;
}
export function withdrawExchange(bundle,id,{reason,by,at=new Date().toISOString()}){
 const out=structuredClone(validateExchange(bundle));text(reason,'withdrawal reason');text(by,'recorder');if(!out.records.some(r=>r.id===id))throw new Error('Unknown source');const affected=new Set([id]);let changed=true;while(changed){changed=false;for(const r of out.records)if(!affected.has(r.id)&&r.relations.some(e=>affected.has(e.ref))){affected.add(r.id);changed=true;}}
 for(const r of out.records)if(affected.has(r.id)){r.status=r.id===id?'withdrawn':'needs-review';r.transferEligible=false;if(r.id===id){r.text='[withdrawn]';r.fields={};}else if(r.kind==='quote'){r.text='[withdrawn source excerpt]';r.fields={};}}
 // The privately retained native payload may still contain the original, so omit it from onward packages.
 out.sources.forEach(s=>{if(out.records.some(r=>affected.has(r.id)&&r.sourceId===s.id))s.methodData={};});out.tombstones.push({ref:id,reason,by,at});out.losses.push({path:'/tombstones',action:'blocked',reason:'Local withdrawal only. Descendants require review; remote deletion has not been confirmed.'});return validateExchange(out);
}
export function exchangeToCsv(bundle,{destination='tttc',reviewed=false}={}){
 validateExchange(bundle);if(!['tttc','reply'].includes(destination))throw new Error('Unknown destination');
 const rows=bundle.records.filter(r=>r.transferEligible&&!['withdrawn','needs-review'].includes(r.status)&&r.origin==='participant');if(!rows.length)throw new Error('No eligible participant source text / 沒有可交接的參與者原話');
 if(!reviewed)throw new Error('Review text, purpose and consent first / 請先檢查文字、用途與同意');
 const max=destination==='reply'?400:600;if(rows.length>max)throw new Error(`${destination}: maximum ${max} rows`);
 // Short transport IDs are explicit mappings, never truncated source IDs.
 const mappings=rows.map((r,i)=>({outputId:`d${i+1}`,recordId:r.id,originalId:r.originalId}));
 const csv=tttcRowsToCsv(rows.map((r,i)=>{if(r.text.length>2000)throw new Error('Text exceeds 2000 characters; no truncation / 文字過長，不自動截斷');return {id:mappings[i].outputId,interview:'',comment:r.text};}));if(new TextEncoder().encode(csv).length>3*1024*1024)throw new Error('CSV exceeds 3 MiB');
 return {csv,manifest:{schema:'delib-exchange-transfer/v1',simulated:bundle.simulated,destination,private:true,mappings,losses:[...bundle.losses,{path:'/records',action:'dropped',reason:'Only eligible participant text enters CSV. Model drafts, typed relations, method fields and consent stay in the companion.'},{path:'/text',action:'transformed',reason:'CSV formula-leading text is escaped for spreadsheet safety.'}],rowCount:rows.length}};
}
export function mergeExchange(bundles,transfer){
 if(!bundles.length)throw new Error('Choose source packages');bundles.forEach(validateExchange);
 if(bundles.some(b=>b.simulated!==bundles[0].simulated))throw new Error('模擬與真實資料不可合併 / Fictional and real data cannot be merged');
 const result=structuredClone(bundles[0]);result.simulated=bundles.every(b=>b.simulated);for(const b of bundles.slice(1))for(const key of ['sources','records','externalSources','tombstones','losses']){
 for(const entry of b[key]){const old=entry.id?result[key].find(x=>x.id===entry.id):null;if(old){if(JSON.stringify(old)!==JSON.stringify(entry))throw new Error('Conflicting source revision / 同一來源有不同版本，請分開檢查');}else result[key].push(structuredClone(entry));}}
 if(transfer){if(transfer.schema!=='delib-exchange-transfer/v1'||!Array.isArray(transfer.mappings))throw new Error('Invalid transfer manifest');
 const mappings=new Map();for(const m of transfer.mappings){if(mappings.has(m.outputId))throw new Error('Ambiguous source mapping');mappings.set(m.outputId,m.recordId);}
 const resolved=new Set();for(const ext of result.externalSources){const target=result.records.find(r=>r.id===mappings.get(ext.originalId));if(!target)continue;
 const quotes=result.records.filter(r=>r.relations.some(e=>e.ref===ext.id));if(quotes.some(q=>!target.text.includes(q.text)))throw new Error('Quote differs from source / 引文與原話不符，請人工核對');
 for(const q of quotes)q.relations=q.relations.map(e=>e.ref===ext.id?{...e,ref:target.id}:e);resolved.add(ext.id);}
 result.externalSources=result.externalSources.filter(e=>!resolved.has(e.id));result.losses.push({path:'/externalSources',action:'transformed',reason:`${resolved.size} source references matched using an explicit transfer manifest and exact quote text.`});
 }
 return validateExchange(result);
}

// Verified backend file shape, not a claim that the current CSV-only web picker accepts JSON.
export function exchangeToSensemaker(bundle,{reviewed=false}={}){
 const transfer=exchangeToCsv(bundle,{destination:'tttc',reviewed});
 const comments=transfer.manifest.mappings.map(m=>({id:m.outputId,text:bundle.records.find(r=>r.id===m.recordId).text}));
 return {json:{comments},manifest:{...transfer.manifest,destination:'sensemaker-backend-json',losses:[...transfer.manifest.losses,{path:'/comments/voteInfo',action:'unavailable',reason:'No voteInfo synthesized from missing votes. Verified backend JSON shape; current web upload picker requires a separate JSON entry path.'}]}};
}
