const tools=[
 ['pocket-check','先核對幾個事實','Pocket Check','做 5 題有出處的理解關卡。測的是程序與資料，不是你支持哪一方。','開始答題','5 題・約 3 分鐘'],
 ['pocket-form','說出你的關心','Pocket Form','留下立場、在意的事，以及可能讓你改變想法的證據。','填寫表單','已預載 12 份模擬回答'],
 ['pocket-harmonica','讓 AI 多問一句','Pocket Harmonica','用兩輪一對一訪談，把簡單的贊成或反對，說成具體理由。','開始訪談','含 4 位虛構角色的示範對話'],
 ['pocket-polis','找到分歧與交集','Pocket Polis','對 16 個陳述按同意、不同意或略過，觀察條件共識與政策分歧。','開始投票','預載 192 票・12 位模擬角色'],
 ['pocket-tttc','看見意見的主題','Pocket TTTC','把 24 段虛構發言整理成議題樹，從摘要回看原話。','探索議題樹','模型整理・原話為模擬資料'],
 ['pocket-values','比較你在乎的價值','Pocket Values','對話後確認價值卡，再比較在這個情境下，你認為更適切的考量。','建立價值卡','示範比較不代表社會價值排序'],
 ['pocket-argument','替理由找理由','Pocket Argument','支持或反駁具體論點，試著把主張、依據與條件拆開。','走進論點樹','預載 12 個論點・可新增與評分'],
 ['pocket-proposals','提出可修改的方案','Pocket Proposals','六份模擬提案涵蓋重啟、暫緩、替代方案與配套。你可以修正、附議、回應。','打開提案空間','含模擬修正案與逐案回覆'],
 ['pocket-budget','試著分配有限資源','Pocket Budget','把 100 個練習點分配給評估與配套，看看不同取捨的結果。','分配練習點','虛構點數・不是核電工程估價'],
 ['pocket-maple','留下有結構的證詞','Pocket Maple','選擇支持、反對或修正，寫一句摘要，再補上理由與建議。','參與模擬公聽','不會送交立法院或任何政府機關'],
 ['pocket-reply','看看問題如何被回覆','Pocket Reply','12 個模擬提問都有模型回覆。4 段立場沒有提供引文；模型使用的「承諾／共識」只是虛構敘事，不代表機關或參與者。','閱讀模擬回覆','虛構主持人・不是政府答覆'],
];
const labels={support:'傾向支持',oppose:'傾向反對',amend:'附條件／未決'};
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
const link=(text,href)=>{const a=el('a',text);a.href=href;return a;};
async function load(path){const r=await fetch(path);if(!r.ok)throw Error('資料讀取失敗');return r.json();}
try{
 const [manifest,data]=await Promise.all([load('/data/nuclear-restart/rooms.json'),load('/data/nuclear-restart/scenario.json')]);
 const grid=document.querySelector('#tool-grid');grid.replaceChildren();
 tools.forEach(([id,title,name,description,cta,state],i)=>{
  const room=manifest.rooms.find(x=>x.tool===id);if(!room)return;
  const card=el('article',undefined,'tool');const a=link('',room.url);a.className='tool-main';a.append(el('span',String(i+1).padStart(2,'0')+' / '+name.toUpperCase(),'tool-number'),el('h3',title),el('span',name,'tool-name'),el('p',description),el('span',cta+' ↗','tool-cta'));card.append(a,el('div',state,'tool-state'));
  const row=el('div',undefined,'tool-links');row.append(link('在 Delib 內開啟',room.stationUrl));if(room.resultUrl&&room.resultUrl!==room.url)row.append(link('看目前結果',room.resultUrl));card.append(row);grid.append(card);
 });
 function renderRoles(filter){
  const root=document.querySelector('#roles');root.replaceChildren();
  for(const r of data.roles.filter(x=>filter==='all'||x.stance===filter)){
   const a=el('article',undefined,'role');a.append(el('span',labels[r.stance]+' / '+r.value,'tag'),el('h3',r.alias),el('p',r.statement));
   const d=el('details');d.append(el('summary','追問與模擬回覆'),el('p','角色補充：'+r.followup),el('p',data.replies.find(x=>x.id===r.id).reply));
   const b=el('button','複製這段角色發言');b.type='button';b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText('【模擬角色】'+r.alias+'：'+r.statement);document.querySelector('#status').textContent='已複製，可貼入你正在試玩的工具';setTimeout(()=>document.querySelector('#status').textContent='',3000);}catch{document.querySelector('#status').textContent='無法自動複製，請選取上方文字。';}});d.append(b);a.append(d);
   for(const example of (data.aiExamples||[]).filter(x=>x.roleId===r.id)){const e=el('details');e.append(el('summary',example.tool==='pocket-harmonica'?'看 AI 訪談示範':'看 AI 價值對話示範'));for(const m of example.messages)e.append(el('p',m.role+'：'+m.text));a.append(e);}
   root.append(a);
  }
 }
 renderRoles('all');document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderRoles(b.dataset.filter);}));
 for(const s of data.sources){const row=el('article',undefined,'source');const body=el('div');const a=link(s.title+' ↗',s.url);a.target='_blank';a.rel='noopener noreferrer';body.append(a,el('p',s.fact));row.append(el('span',s.id),body);document.querySelector('#source-list').append(row);}
}catch(error){const root=document.querySelector('#tool-grid');root.replaceChildren(el('p','連結清單暫時無法載入。請重新整理，或下載活動清單。','error'),link('下載活動連結','/data/nuclear-restart/rooms.json'));}
