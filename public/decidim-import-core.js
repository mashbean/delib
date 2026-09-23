// Pinned to the documented Metadecidim proposal response shape observed 2026-09-23.
export const DECIDIM_SCHEMA='delib-decidim-proposals/v1';
const fail=()=>{throw Error('Invalid Decidim proposal export / Decidim 提案匯出格式不符');};
const txt=(v,max=12000)=>typeof v==='string'&&v.length<=max;
const id=v=>txt(v,200)&&v.trim().length>0;
const date=v=>v===null||(typeof v==='string'&&Number.isFinite(Date.parse(v)));
const array=v=>Array.isArray(v)&&v.length<=500;
const translated=v=>{if(!v||!array(v.translations)||!v.translations.length)fail();const seen=new Set();return {translations:v.translations.map(t=>{if(!id(t.locale)||!(t.text===null||txt(t.text))||seen.has(t.locale))fail();seen.add(t.locale);return {locale:t.locale,text:t.text};})};};
const display=t=>t.translations.filter(x=>x.text!==null).map(x=>`[${x.locale}] ${x.text}`).join('\n');
export function normalizeDecidim(input){
 if(input?.schema!==DECIDIM_SCHEMA||input.source?.origin!=='https://meta.decidim.org'||!date(input.source?.retrievedAt)||input.source.retrievedAt===null||!(input.source.version===null||id(input.source.version))||input.response?.errors?.length)fail();
 const data=input.response?.data,component=data?.component;if(!id(component?.id)||!array(component.proposals?.edges)||typeof component.proposals.pageInfo?.hasNextPage!=='boolean')fail();
 if(data.decidim?.version!==input.source.version)fail();
 const ids=new Set(),dropped=new Set();
 const proposals=component.proposals.edges.map(({node:n})=>{
  if(!id(n?.id)||ids.has(n.id)||!txt(n.state,200)||!date(n.updatedAt)||!date(n.answeredAt)||typeof n.withdrawn!=='boolean'||typeof n.official!=='boolean'||!Number.isSafeInteger(n.voteCount)||n.voteCount<0||!Number.isSafeInteger(n.versionsCount)||!array(n.versions)||n.versions.length!==n.versionsCount)fail();ids.add(n.id);
  let url;try{url=new URL(n.url);}catch{fail();}if(url.origin!==input.source.origin||url.username||url.password||url.hash||url.search)fail();
  const versionIds=new Set();const versions=n.versions.map(v=>{if(!id(v.id)||versionIds.has(v.id)||!date(v.createdAt)||v.createdAt===null||!v.changeset||typeof v.changeset!=='object'||Array.isArray(v.changeset))fail();versionIds.add(v.id);const changeset={};for(const [key,value] of Object.entries(v.changeset)){if(['title','body','state','answer','answered_at','updated_at'].includes(key)){if(JSON.stringify(value).length>48000)fail();changeset[key]=structuredClone(value);}else dropped.add(key);}return {id:v.id,createdAt:v.createdAt,changeset};});
  return {id:n.id,url:url.href,title:translated(n.title),body:translated(n.body),state:n.state,answer:n.answer===null?null:translated(n.answer),answeredAt:n.answeredAt,updatedAt:n.updatedAt,withdrawn:n.withdrawn,official:n.official,voteCount:n.voteCount,versionsCount:n.versionsCount,versions};
 });
 return {source:{origin:input.source.origin,version:input.source.version,retrievedAt:input.source.retrievedAt},componentId:component.id,hasNextPage:component.proposals.pageInfo.hasNextPage,proposals,excludedChanges:[...dropped]};
}
export function decidimRecords(input){const p=normalizeDecidim(input),out=[];for(const n of p.proposals){const fields={...n,instance:p.source,componentId:p.componentId,partialPage:p.hasNextPage};out.push({id:`proposal-${n.id}`,kind:'proposal',text:display(n.title)+'\n'+display(n.body),origin:n.official?'organizer':'participant',fields,relations:[],withdrawn:n.withdrawn});if(n.answer&&n.answer.translations.some(t=>t.text?.trim()))out.push({id:`answer-${n.id}`,kind:'reply',text:display(n.answer),origin:'organizer',fields:{state:n.state,answeredAt:n.answeredAt,url:n.url,confirmation:'imported-source-status; no-local-authority-confirmation'},relations:[{ref:`proposal-${n.id}`,type:'responds'}],withdrawn:n.withdrawn});}return out;}
