import {icon} from './icons.js';
import {renderPersonaView} from './persona-view.js';
export function createIterationFive({getLanguage,onSelect}){
 const $=s=>document.querySelector(s),L=(zh,en)=>getLanguage()==='en'?en:zh;
 let pane='data',stageTab='tools',state,profiles=[],toolPage=0;
 const demo=$('#demo'),content=document.createElement('div');content.className='simulation-cockpit';
 $('#demo-rounds').before(content);content.append($('#demo-rounds'));
 const tabs=document.createElement('div');tabs.className='cockpit-tabs';tabs.setAttribute('role','tablist');content.append(tabs);
 const panels={};
 for(const id of ['data','people','step','story']){const p=document.createElement('section');p.className='cockpit-panel';p.id='cockpit-'+id;p.setAttribute('role','tabpanel');p.tabIndex=0;content.append(p);panels[id]=p;}
 panels.data.append($('.pipeline-toolbar'),$('#playback-tools'),$('#mobile-step-summary'),$('.pipeline-pan-hint'),$('#pipeline'),$('#trace-detail'));
 panels.step.append($('.demo-main'));panels.story.append($('#story'));
 panels.people.append($('.demo-side'));
 const persona=document.createElement('div');persona.id='persona-deck';const personaShelf=document.createElement('details');personaShelf.className='persona-shelf';personaShelf.open=false;const personaSummary=document.createElement('summary');personaShelf.append(personaSummary,persona);panels.people.prepend(personaShelf);
 const journey=document.createElement('div');journey.id='persona-journey';panels.people.append(journey);
 const old=$('.demo-board');old.remove();
 const shelf=document.createElement('div');shelf.className='tool-pagination';$('#tool-grid').after(shelf);
 function showPane(id){pane=id;tabs.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.pane===pane));b.tabIndex=b.dataset.pane===pane?0:-1;});Object.entries(panels).forEach(([k,p])=>p.hidden=k!==pane);}
 tabs.addEventListener('click',e=>{const b=e.target.closest('[data-pane]');if(b)showPane(b.dataset.pane);});
 tabs.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const ids=Object.keys(panels),i=ids.indexOf(pane),n=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowRight'?1:3))%4;showPane(ids[n]);tabs.querySelector(`[data-pane="${pane}"]`).focus();});
 $('#step-detail').addEventListener('click',e=>{const b=e.target.closest('[data-stage-tab]');if(b){stageTab=b.dataset.stageTab;stage();$('#stage-inspector-tabs').querySelector(`[data-stage-tab="${stageTab}"]`).focus({preventScroll:true});}});
 $('#stage-buttons').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const b=e.target.closest('[data-step]');if(!b)return;e.preventDefault();const i=Number(b.dataset.step),next=e.key==='Home'?0:e.key==='End'?7:(i+(e.key==='ArrowRight'?1:7))%8;onSelect(next);$('#stage-buttons').querySelector(`[data-step="${next}"]`).focus({preventScroll:true});});
 function stage(index){const columns=$('#step-detail .step-columns');if(!columns)return;
 let t=$('#stage-inspector-tabs');if(!t){t=document.createElement('div');t.id='stage-inspector-tabs';t.className='inspector-tabs';columns.before(t);}
 t.innerHTML=[['tools','route','工具','Tools'],['facilitate','people','主持','Facilitate'],['gate','check','換場條件','Transition']].map(([id,g,zh,en])=>`<button data-stage-tab="${id}" aria-pressed="${stageTab===id}">${icon(g)}${L(zh,en)}</button>`).join('');
 [...columns.children].forEach((c,i)=>c.hidden=['tools','facilitate','gate'][i]!==stageTab);
 if(index!==undefined){$('#step-detail').dataset.stage=index;const rail=$('#stage-buttons'),card=rail.querySelector(`[data-step="${index}"]`);if(card)rail.scrollLeft=Math.max(0,card.offsetLeft-rail.offsetLeft-rail.clientWidth/2+card.clientWidth/2);}
 }
 function paginate(){const cards=[...$('#tool-grid').children],pages=Math.ceil(cards.length/6);toolPage=Math.min(toolPage,Math.max(0,pages-1));cards.forEach((c,i)=>c.hidden=Math.floor(i/6)!==toolPage);shelf.innerHTML=pages>1?`<button class="subtle" data-page="-1" ${toolPage===0?'disabled':''}>${icon('back')}${L('上一頁','Previous')}</button><span class="mono">${toolPage+1} / ${pages} · ${cards.length} TOOLS</span><button class="subtle" data-page="1" ${toolPage===pages-1?'disabled':''}>${L('下一頁','Next')}${icon('arrow')}</button>`:'';}
 new MutationObserver(paginate).observe($('#tool-grid'),{childList:true});shelf.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b){toolPage+=Number(b.dataset.page);paginate();}});
 function render(){tabs.setAttribute('aria-label',L('模擬工作區','Simulation views'));tabs.innerHTML=[['data','branch','資料流程','Data pipeline'],['people','people','人物旅程','People & journeys'],['step','layers','步驟操作','Stage details'],['story','compass','主持練習','Facilitation practice']].map(([id,g,zh,en])=>`<button role="tab" id="tab-${id}" aria-controls="cockpit-${id}" data-pane="${id}">${icon(g)}${L(zh,en)}</button>`).join('');Object.entries(panels).forEach(([id,p])=>p.setAttribute('aria-labelledby','tab-'+id));showPane(pane);paginate();stage();}
 function renderDemo(next){state=next;const {personId}=state;
 const view=renderPersonaView({...state,profiles,language:getLanguage()});if(!view)return;
 const scroll=persona.scrollLeft;persona.innerHTML=view.deck;persona.scrollLeft=scroll;
 personaSummary.innerHTML=`${icon('people')} ${L('角色卡組','Character deck')}<span>${L('14 位角色 · 點選切換','14 characters · choose a perspective')}</span>`;
 const flipped=journey.querySelector('#character-card')?.dataset.face==='back';journey.innerHTML=view.html;const map=journey.querySelector('.journey-map'),stop=map?.querySelector('[aria-pressed=true]');if(stop)map.scrollLeft=Math.max(0,stop.getBoundingClientRect().left-map.getBoundingClientRect().left-map.clientWidth/2+stop.clientWidth/2);
 const flip=journey.querySelector('#flip-persona');
 function turn(back){const card=journey.querySelector('#character-card');if(!card)return;card.dataset.face=back?'back':'front';for(const face of card.querySelectorAll('.card-face')){const hidden=face.classList.contains('card-front')===back;face.setAttribute('aria-hidden',String(hidden));face.inert=hidden;}flip.setAttribute('aria-expanded',String(back));flip.querySelector('span').textContent=back?L('翻回角色正面','Back to the portrait'):L('翻面看動機與限制','Flip for motivations & constraints');}
 if(flip){turn(flipped);flip.onclick=()=>turn(flip.getAttribute('aria-expanded')!=='true');}
 const download=journey.querySelector('#download-persona');if(download)download.onclick=()=>{const blob=new Blob([JSON.stringify({schema:'delib-fictional-journey/v2',simulated:true,authoredFields:['profile','authoredFocus','authoredPrompt'],person:view.person,profile:view.profile,rounds:view.route},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`delib-fictional-${personId}-journey.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 }
 $('#persona-deck').addEventListener('click',e=>{const p=e.target.closest('[data-persona]');if(p){const id=p.dataset.persona;state.onPerson(id);personaShelf.open=false;personaSummary.focus({preventScroll:true});}});
 $('#persona-journey').addEventListener('click',e=>{const evidence=e.target.closest('[data-evidence-step]');if(evidence){$('#demo-rounds').querySelector(`[data-round="${evidence.dataset.evidenceRound}"]`).click();onSelect(Number(evidence.dataset.evidenceStep));journey.querySelector('.personal-stop').scrollIntoView({block:'nearest',behavior:'instant'});journey.querySelector(`[data-evidence-round="${evidence.dataset.evidenceRound}"][data-evidence-step="${evidence.dataset.evidenceStep}"]`).focus({preventScroll:true});return;}const r=e.target.closest('[data-persona-round]');if(r){$('#demo-rounds').querySelector(`[data-round="${r.dataset.personaRound}"]`).click();journey.querySelector(`[data-persona-round="${r.dataset.personaRound}"]`).focus({preventScroll:true});return;}const b=e.target.closest('[data-journey-step]');if(!b)return;$('#demo-rounds').querySelector(`[data-round="${b.dataset.journeyRound}"]`).click();const ri=b.dataset.journeyRound,si=b.dataset.journeyStep;onSelect(Number(si));$('#persona-journey').querySelector(`[data-journey-round="${ri}"][data-journey-step="${si}"]`).focus({preventScroll:true});});
 document.addEventListener('click',e=>{const a=e.target.closest('a');if(a?.getAttribute('href')==='#story')showPane('story');});
 fetch('/data/persona-profiles.json').then(r=>r.json()).then(v=>{profiles=v.profiles;if(state)renderDemo(state);}).catch(()=>{});
 render();return {stage,render,demo:renderDemo};
}
