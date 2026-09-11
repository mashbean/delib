import {createProject,record,reviseRecord} from './workspace-core.js';
import {addMetagovActor,recordMetagovMapping} from './metagov-mapping-core.js';
import {prepareMetagovExport} from './metagov-export-core.js';
export async function interopDemo(lang='zh'){
 const L=(zh,en)=>lang==='en'?en:zh,p=createProject({title:L('校門口的二十分鐘','Twenty minutes at the school gate'),audience:'Fictional fixture',goal:'Inspect provenance and revisions',deadline:'2026-12-01',language:lang});p.simulated=true;
 const a=record('question',L('封街後，輪椅接送如何靠近入口？','How can wheelchair drop-off reach the entrance during the closure?'),{tool:'form',id:'fictional-access'}),b=record('statement',L('早上配送需要短暫停靠。','Morning deliveries need a short loading stop.'),{tool:'form',id:'fictional-delivery'}),c=record('proposal',L('保留無障礙接送，配送改用鄰近停靠區。','Keep accessible drop-off and use a nearby delivery bay.'),{tool:'reply',id:'fictional-proposal'},[a.id,b.id]);
 c.relations=[{ref:a.id,type:'responds'},{ref:b.id,type:'context'}];p.rounds[0].artifacts.push(a,b,c);
 const person=addMetagovActor(p,{kind:'Participant',label:L('虛構居民','Fictional resident'),evidence:L('虛構案例代稱，不是真實身分。','Synthetic example, not a real identity')}),host=addMetagovActor(p,{kind:'Host',label:L('虛構主持人','Fictional facilitator'),evidence:L('虛構案例的主持人歸屬。','Explicit synthetic fixture attribution')});
 for(const [r,role,creator] of [[a,'Question',person],[b,'Belief',person],[c,'Proposal',host]])recordMetagovMapping(p,r.id,{role,madeBy:creator.id,classifiedBy:host.id,evidence:L('依虛構案例原文，明確指定內容角色。','Explicitly classified synthetic example'),confirmed:true});
 const plan=await prepareMetagovExport(p,[a.id,c.id]);
 // A later local revision is a new record, not a rewrite of exported source text.
 reviseRecord(p,c.id,L('先現勘無障礙動線，再與商家確認配送停靠區。','Survey accessible routes first, then agree a delivery bay with shopkeepers.'),'Fictional facilitator');
 return {nativeText:plan.nativeJson,companionText:JSON.stringify(plan.companion,null,2),project:p};
}
