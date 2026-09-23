// Independent adapter for the GPL-3.0 project's documented export shape; no upstream code copied.
export const HYPHA_REVISION='a9cbcf1efe8a589e24af565b53efba95d1444256';
const fail=()=>{throw Error('Invalid Hypha export / Hypha 匯出格式不符');};
const text=(x,max=12000)=>typeof x==='string'&&x.length<=max;
const rows=x=>{if(!Array.isArray(x)||x.length>1000||new Set(x.map(r=>r.id)).size!==x.length||x.some(r=>!text(r.id,200)||!r.id.trim()))fail();return x;};
export function normalizeHypha(input){
 if(!input||typeof input!=='object')fail();
 const chart=c=>{if(!Array.isArray(c?.series)||c.series.length>20)fail();return {series:c.series.map(s=>{if(!text(s.name,200)||!Array.isArray(s.labels)||!Array.isArray(s.values)||s.labels.length!==s.values.length||s.labels.length>1000||!s.labels.every(x=>text(x,500))||!s.values.every(x=>Number.isFinite(x)&&x>=0))fail();return {name:s.name,labels:[...s.labels],values:[...s.values]};})};};
 const proposals=rows(input.proposals).map(p=>{if(!text(p.title)||!p.title.trim()||!text(p.description)||!Number.isSafeInteger(p.vote_count)||p.vote_count<0||!text(p.vote?.type,100)||!text(p.vote.result,200)||!Array.isArray(p.vote.options)||p.vote.options.length>100||!p.vote.options.every(x=>text(x,200)))fail();return {id:p.id,title:p.title,description:p.description,vote:{type:p.vote.type,options:[...p.vote.options],result:p.vote.result},vote_count:p.vote_count,semantics:'export-labels-only; ballot type and result may be placeholders'};});
 const githubIssues=rows(input.githubIssues).map(i=>{if(!text(i.title)||!i.title.trim()||!text(i.url,2000))fail();if(i.url){let u;try{u=new URL(i.url);}catch{fail();}if(u.protocol!=='https:'||u.username||u.password)fail();}return {id:i.id,title:i.title,url:i.url,status:null,commentsCount:null};});
 const decisionLog=rows(input.decisionLog).map(d=>{if(!['date','short_title','description','deciding_group','resolution'].every(k=>text(d[k]))||!d.short_title.trim())fail();return Object.fromEntries(['id','date','short_title','description','deciding_group','resolution'].map(k=>[k,d[k]]));});
 return {proposals,githubIssues,barChart:chart(input.barChart),lineGraph:chart(input.lineGraph),decisionLog};
}
export function hyphaRecords(input){const p=normalizeHypha(input);return [...p.proposals.map(x=>({id:x.id,kind:'proposal',text:x.title+(x.description?'\n'+x.description:''),fields:x})),...p.githubIssues.map(x=>({id:x.id,kind:'method-result',text:x.title,fields:x})),...p.decisionLog.map(x=>({id:x.id,kind:'method-result',text:x.short_title+(x.resolution?'\n'+x.resolution:''),fields:x}))];}
