import {inspectInteropPair,compareInterop,interopReport,FILE_LIMIT} from './interop-core.js';
import {interopDemo} from './interop-demo.js';
import {inspectorResult,esc} from './interop-view.js';
import {projectStore} from './workspace-store.js';
import {validateProject} from './workspace-core.js';
import {icon} from './icons.js';
const $=s=>document.querySelector(s);
let lang=new URLSearchParams(location.search).get('lang')==='en'?'en':'zh',packet=null,comparison=null,selected='',localId='',demoProject=null,epoch=0,busy=false;
const L=(zh,en)=>lang==='en'?en:zh;
function notice(text){$('#interop-status').textContent=text;}
function renderOutput(){ $('#interop-output').innerHTML=packet?inspectorResult(packet,comparison,selected,lang):''; }
function intro(){
 document.documentElement.lang=lang==='en'?'en':'zh-Hant';document.title=L('Delib · 交接驗收台','Delib · Handoff inspector');$('#interop-language').textContent=lang==='en'?'中文':'EN';$('#workspace-link').textContent=L('議題工作台','Workspace');$('#workspace-link').href=`/workspace?lang=${lang}&view=transfer`;
 $('#interop-intro').innerHTML=`<span class="eyebrow">${icon('route')} ${L('交接驗收台','HANDOFF INSPECTOR')}</span><h1>${L('資料接上了。<br><span class="accent">脈絡還在嗎？</span>','The data arrived.<br><span class="accent">Did the context?</span>')}</h1><p>${L('檢查 Statement 與私人附檔是否配對，追溯每筆內容，再對回原議題的目前版本。','Check Statements against their private companion, trace each record, then compare with the current version of the original issue.')}</p>`;
 $('#interop-input').innerHTML=`<div class="inspection-input"><form id="inspect-files"><div class="inspection-file-grid"><label><strong>01 · statements.json</strong><span class="small">${L('選定原文與內容角色','Selected text and content roles')}</span><input id="native-file" type="file" accept=".json,application/json" required></label><label><strong>02 · private-companion.json</strong><span class="small">${L('來源、代碼與歸屬對照','Source, ID and attribution mappings')}</span><input id="companion-file" type="file" accept=".json,application/json" required></label></div><div class="actions"><button class="btn" data-load>${icon('check')}${L('檢查這兩份檔案','Check both files')}</button><button class="subtle" type="button" id="inspect-demo" data-load>${icon('play')}${L('用模擬案例驗收','Try a fictional handoff')}</button><button class="subtle" type="button" id="clear-files">${L('清除本頁資料','Clear this page')}</button></div></form><p class="storage-note">${icon('lock')}${L('檔案只在此分頁讀取，不上傳、不自動保存。每檔最多 20 MiB。','Files are read in this tab only, without uploading or automatic saving. Up to 20 MiB per file.')}</p><p class="small">${L('接受 Delib 匯出的配對檔案。若手上只有 Statement，請向提供者索取對應私人附檔。','Accepts paired Delib exports. If you only have Statements, ask the provider for the matching private companion.')}</p></div>`;
}
function invalidate(){epoch++;packet=null;comparison=null;selected='';localId='';demoProject=null;busy=false;renderOutput();document.querySelectorAll('[data-load]').forEach(x=>x.disabled=false);}
async function inspect(load){
 if(busy)return;invalidate();const ticket=epoch;busy=true;document.querySelectorAll('[data-load]').forEach(x=>x.disabled=true);notice(L('正在本機檢查兩份檔案…','Checking both files locally…'));
 try{const data=await load();const result=await inspectInteropPair(data.nativeText,data.companionText);if(ticket!==epoch)return;packet=result;demoProject=data.project||null;comparison=demoProject?{...compareInterop(packet,demoProject),demo:true}:null;selected=packet.companion.records[0].id;renderOutput();notice(demoProject?L('模擬檢查完成：一筆仍一致，一筆已有本機新修訂；另一筆來源只保留代碼。','Fictional check complete: one record matches, one has a newer local revision, and another source is referenced by ID only.'):L('兩份檔案配對成功。接著選擇本機議題，比對後續變化。','Files match. Choose a local issue to compare later changes.'));$('#interop-status').scrollIntoView({block:'start'});
 }catch{if(ticket!==epoch)return;notice(L('檢查未通過：請選擇同一次匯出的 Statement 與私人附檔，確認格式及大小；修改過的檔案請重新匯出。沒有保存或覆寫任何紀錄。','Check failed. Choose matching Statements and companion from the same export, verify format and size, or export again after edits. No records were saved or overwritten.'));}
 finally{if(ticket===epoch){busy=false;document.querySelectorAll('[data-load]').forEach(x=>x.disabled=false);}}
}
async function localIssues(){return (await projectStore('list')).filter(p=>{try{return !!validateProject(p);}catch{return false;}});}
async function refreshComparison(){const active=packet,id=localId,demo=demoProject;if(!active)return null;if(demo)return {...compareInterop(active,demo),demo:true};if(id){const projects=await localIssues(),p=projects.find(x=>x.id===id);return p?compareInterop(active,p):{scope:'different',rows:[]};}return null;}
function downloadReport(value){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='delib-interop-check.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#interop-main').addEventListener('submit',e=>{if(e.target.id!=='inspect-files')return;e.preventDefault();const native=$('#native-file').files[0],companion=$('#companion-file').files[0];inspect(async()=>{if(!native||!companion||native.size>FILE_LIMIT||companion.size>FILE_LIMIT)throw new Error('size');return {nativeText:await native.text(),companionText:await companion.text()};});});
$('#interop-main').addEventListener('change',async e=>{
 if(['native-file','companion-file'].includes(e.target.id)){invalidate();notice(L('檔案已變更，請重新檢查。','Files changed. Run the check again.'));return;}
 if(e.target.id!=='compare-project'||!packet)return;const ticket=++epoch;localId=e.target.value;demoProject=null;
 try{const result=await refreshComparison();if(ticket!==epoch)return;comparison=result;renderOutput();notice(L('已比對本機快照，沒有修改議題。','Compared the local snapshot without modifying the issue.'));}catch{if(ticket===epoch){comparison=null;renderOutput();notice(L('無法讀取本機議題。檔案檢查結果仍保留。','Local issue unavailable. File inspection remains available.'));}}
});
$('#interop-main').addEventListener('click',async e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.id==='clear-files'){invalidate();intro();notice(L('已清除本頁資料；本機議題與磁碟上的檔案仍保留。','Page cleared; local issues and files on disk are retained.'));return;}
 if(busy)return;
 if(button.id==='inspect-demo'){await inspect(()=>interopDemo(lang));return;}
 if(button.dataset.record&&packet){selected=button.dataset.record;renderOutput();$('#inspection-detail').scrollIntoView({block:'start'});return;}
 if(button.id==='load-local'&&packet){const ticket=epoch;try{const projects=await localIssues();if(ticket!==epoch)return;$('#local-picker').innerHTML=projects.length?`<label>${L('選擇要比對的原議題','Choose the original issue to compare')}<select id="compare-project"><option value="" disabled selected>${L('請選擇','Choose an issue')}</option>${projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}${p.simulated?L('（虛構）',' (fictional)'):''}</option>`).join('')}</select></label>`:`<p>${L('此瀏覽器尚無有效議題。請先回工作台匯入完整私人備份。','No valid local issues. Import a full private backup in the workspace first.')}</p>`;}catch{notice(L('無法讀取此瀏覽器的議題；仍可檢查檔案內容。','Local issues are unavailable; file inspection still works.'));}return;}
 if(button.id==='download-report'&&packet){const ticket=epoch;busy=true;try{const result=await refreshComparison();if(ticket!==epoch)return;comparison=result;downloadReport(interopReport(packet,comparison));renderOutput();notice(L('已準備不含原文的檢查報告下載；這不是接收端收據。','Source-free report download prepared; this is not a receiver receipt.'));}catch{if(ticket===epoch)notice(L('無法重新確認本機版本，請重新比對後下載。','Could not recheck the local version. Compare again before downloading.'));}finally{if(ticket===epoch)busy=false;}}
});
$('#interop-language').addEventListener('click',()=>{if(busy)return;lang=lang==='zh'?'en':'zh';const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);intro();renderOutput();notice('');});
intro();
