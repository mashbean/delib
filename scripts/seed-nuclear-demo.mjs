// Run once explicitly; save capability URLs outside the repository, never log them.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {dirname} from 'node:path';
import {configs,roles,voteRows,proposals,notice,replies,sources,date,csv} from './nuclear-demo-data.mjs';
const statePath=process.env.NUCLEAR_DEMO_STATE;
if(!statePath) throw Error('Set NUCLEAR_DEMO_STATE to a private file outside the repository.');
const services={
 'pocket-form':['form','forms','formId','f'], 'pocket-polis':['polis','conversations','conversationId','c'],
 'pocket-harmonica':['harmonica','sessions','sessionId','s'], 'pocket-values':['values','sessions','sessionId','v'],
 'pocket-budget':['budget','budgets','budgetId','b'], 'pocket-check':['checks','checks','checkId','c'],
 'pocket-proposals':['proposals','spaces','spaceId','p'], 'pocket-argument':['argument','debates','debateId','a'],
 'pocket-maple':['maple-tw','hearings','hearingId','t'], 'pocket-tttc':['ttt-city','reports','reportId','r'],
 'pocket-reply':['reply','loops','loopId','r'],
};
let state; try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={rooms:{},done:{},participants:Object.fromEntries(roles.map(r=>[r.id,randomUUID()]))};}
async function save(){await mkdir(dirname(statePath),{recursive:true,mode:0o700});await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});}
async function req(url,body,headers={}){const res=await fetch(url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(120000)});const data=await res.json();if(!res.ok)throw Error(`${res.status} ${JSON.stringify(data).slice(0,300)}`);return data;}
async function once(key,fn){if(state.done[key])return state.done[key];const data=await fn();state.done[key]=data;await save();return data;}
function api(k){const s=services[k];return `https://${s[0]}.mashbean.net/api/${s[1]}/${state.rooms[k][s[2]]}`;}
const mode=process.argv[2]||'create';
if(mode==='create'){
 for(const [k,s] of Object.entries(services)){
  if(state.rooms[k]){console.log(k,'already-created');continue;}
  try{const r=await req(`https://${s[0]}.mashbean.net/api/${s[1]}`,{...configs[k],confirmed:true});state.rooms[k]=r;await save();console.log(k,'created',r[s[2]]);}catch(e){console.log(k,'ERROR',e.message);}
 }
}
if(mode==='seed'){
 for(const r of roles){
  const id=state.participants[r.id];
  for(const [k,suffix,body] of [
   ['pocket-form','responses',{responderId:id,alias:r.alias,answers:{q1:r.stance==='support'?'傾向支持':r.stance==='oppose'?'傾向反對':'附帶條件／尚未決定',q2:`【模擬】${r.statement}`,q3:`【模擬】${r.followup}`,q4:true}}],
   ['pocket-budget','ballots',{voterId:id,alias:r.alias,picks:r.stance==='support'?['o1','o2','o3','o6']:r.stance==='oppose'?['o3','o4','o5']:['o1','o2','o4','o6'],reason:`【模擬選票】${r.value}；點數是練習數字。`}],
   ['pocket-maple','testimonies',{participantId:id,name:r.alias,stance:r.stance,summary:`【模擬】${r.value}`,text:`【模擬證詞，未提交任何機關】${r.statement}\n${r.followup}`}],
   ['pocket-check','attempts',{participantId:id,answers:r.stance==='amend'?[1,0,2,1,0]:r.stance==='support'?[1,0,2,0,0]:[1,1,2,1,0]}],
  ]){await once(`${k}-${r.id}`,()=>req(`${api(k)}/${suffix}`,body));}
  for(const v of voteRows.filter(x=>x.role===r.id))await once(`vote-${r.id}-${v.sid}`,()=>req(`${api('pocket-polis')}/votes`,{pid:id,sid:v.sid,value:v.value}));
  console.log('seeded',r.id);
 }
 for(const p of proposals){
  const author=roles.find(r=>r.id===p.author);
  const result=await once(p.id,()=>req(`${api('pocket-proposals')}/proposals`,{participantId:state.participants[author.id],alias:author.alias,title:p.title,body:p.body}));
  const pid=result.proposal?.id??result.id??result.proposalId;
  if(!pid){console.log('proposal-shape',JSON.stringify(result).slice(0,250));continue;}
  await once(`${p.id}-reply`,()=>req(`${api('pocket-proposals')}/proposals/${pid}/respond`,{participantId:state.participants.R12,alias:'模擬・工作坊主持人',text:'【模擬回覆】已列入下一輪比較清單，尚無政府承諾。請補上評估方式、所需證據與未達條件時的處置；不同意見會一併保留。'}));
  await once(`${p.id}-endorse`,()=>req(`${api('pocket-proposals')}/proposals/${pid}/endorse`,{participantId:state.participants.R09}));
  if(p.id==='P1')await once('P1-amend',()=>req(`${api('pocket-proposals')}/proposals/${pid}/amend`,{participantId:state.participants.R07,alias:roles[6].alias,body:p.body+' 比較還須公開長期核廢、除役及風險成本的假設，並保留未知範圍。',rationale:'【模擬修正理由】避免只比較短期支出而忽略世代責任。'}));
 }
 console.log('non-AI seeding complete');
}
if(mode==='ai'){
 // Four contrasting fictional participants, two turns each; do not flood public AI quotas.
 for(const k of ['pocket-harmonica','pocket-values'])for(const r of [roles[0],roles[4],roles[5],roles[8]]){
  try{
   const participantId=state.participants[r.id];
   await once(`${k}-join-${r.id}`,()=>req(`${api(k)}/join`,{participantId,alias:r.alias}));
   let last;
   for(const [i,t] of [r.statement,r.followup].entries())last=await once(`${k}-turn-${r.id}-${i}`,()=>req(`${api(k)}/messages`,{participantId,text:`【虛構角色模擬回答】${t}`}));
   if(k==='pocket-values'){
    if(!last.card)await once(`${k}-draft-${r.id}`,()=>req(`${api(k)}/draft`,{participantId}));
    await once(`${k}-confirm-${r.id}`,()=>req(`${api(k)}/confirm`,{participantId,card:{title:`模擬・${r.value}`,attention:[`我會注意${r.value}`,'我會注意證據與不確定範圍','我會注意不同意見是否獲得回覆'],story:`【模擬價值卡】${r.statement} ${r.followup}`}}));
   }
   console.log(k,r.id,'dialogue complete');
  }catch(e){console.log(k,r.id,'ERROR',e.message);}
 }
 for(const r of [roles[0],roles[4],roles[5],roles[8]]){
  const participantId=state.participants[r.id];
  try{const p=await req(`${api('pocket-values')}/pairs`,{participantId});for(const [i,pair] of p.pairs.entries())await once(`judge-${r.id}-${i}`,()=>req(`${api('pocket-values')}/judge`,{participantId,wiser:pair[0].cardId,lessWise:pair[1].cardId,note:'【模擬判斷】為展示比較操作而設定，不代表社會價值排序。'}));}catch(e){console.log('judge',r.id,e.message);}
 }
}
if(mode==='repair-arguments'||mode==='seed'){
 // Replace only our original seed nodes (soft removal), keeping the activity URL.
 // A fictional opinion must never display an unrelated official URL as its source.
 for(const r of roles){const old=state.done[`arg-${r.id}`]?.argument?.id;if(old)await once(`arg-retired-${r.id}`,()=>req(`${api('pocket-argument')}/arguments/${old}/remove`,{}, {'X-Debate-Admin':state.rooms['pocket-argument'].adminToken}));}
 const nodes={};
 for(const [i,r] of roles.entries()){
  const parentRole={R09:'R01',R10:'R05',R11:'R09',R12:'R11'}[r.id];
  const side=r.stance==='oppose'||r.id==='R09'?'con':'pro';
  const text=r.id==='R09'?'【模擬反駁・未決立場】列入選項不等於現在就應重啟；在計畫審查、換照與裝填燃料的證據被清楚區分前，我保留判斷。':`【模擬論點${parentRole?'・只針對上層理由，不表示支持整體重啟':''}】${r.statement}`;
  const result=await once(`arg-v2-${r.id}`,()=>req(`${api('pocket-argument')}/arguments`,{participantId:state.participants[r.id],alias:r.alias,parentId:parentRole?nodes[parentRole]:0,side,text,source:'作者設計的虛構角色觀點，非官方引文；考據與意見分開列於 '+ 'https://delib.mashbean.net/nuclear-restart#sources'}));
  nodes[r.id]=result.argument.id;
 }
 for(const r of roles){const target=roles[(roles.indexOf(r)+4)%roles.length];await once(`arg-v2-rating-${r.id}`,()=>req(`${api('pocket-argument')}/arguments/${nodes[target.id]}/vote`,{participantId:state.participants[r.id],value:roles.indexOf(r)%2===0?1:-1}));}
 console.log('12 seed arguments repaired: provenance labels and nested conditions; 12 synthetic ratings added');
}
// A strictly public manifest. Do not copy the raw creation responses here.
const publicRooms=Object.entries(state.rooms).map(([k,r])=>{
 const [host,collection,idKey,path]=services[k], id=r[idKey];
 const origin=`https://${host}.mashbean.net`;
 const slug=k==='pocket-check'?'checks':k==='pocket-tttc'?'tttc':k.slice(7);
 const resultPath=k==='pocket-values'?'g':k==='pocket-form'||k==='pocket-harmonica'?null:'r';
 return {tool:k,id,url:`${origin}/${path}/${id}`,stationUrl:`https://delib.mashbean.net/${slug}/${path}/${id}?lang=zh`,resultUrl:resultPath?`${origin}/${resultPath}/${id}`:null,apiUrl:api(k)};
});
await writeFile(new URL('../public/data/nuclear-restart/rooms.json',import.meta.url),JSON.stringify({date,notice,rooms:publicRooms},null,2)+'\n');
const aiExamples=[];
for(const tool of ['pocket-harmonica','pocket-values'])for(const r of roles){
 const messages=[r.statement,r.followup].flatMap((t,i)=>{const result=state.done[`${tool}-turn-${r.id}-${i}`];return result?[{role:'模擬參與者',text:t},{role:'服務 AI',text:result.reply.text}]:[];});
 if(messages.length)aiExamples.push({tool,roleId:r.id,messages});
}
await writeFile(new URL('../public/data/nuclear-restart/scenario.json',import.meta.url),JSON.stringify({date,notice,sources,roles,voteRows,proposals,replies,aiExamples,method:'12 個虛構角色：支持、反對、條件／未決各 4 位；由作者刻意設計分布以展示工具，非抽樣、非民意估計。AI 訪談與價值圖另取 4 位角色。',seedCounts:{form:12,polisVotes:192,polisStatements:16,budget:12,maple:12,check:12,proposals:6,arguments:12}},null,2)+'\n');
await writeFile(new URL('../public/data/nuclear-restart/statements.csv',import.meta.url),csv);
