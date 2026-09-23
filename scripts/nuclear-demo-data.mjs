// Authored simulation. These people, statements and allocations are fictional.
export const date = '2026-09-23';
export const title = '【模擬】台灣重啟核電：哪些條件缺一不可？';
export const notice = '這是工具試玩用的虛構審議，種子人物、發言、票數、提案與回覆皆為模擬，不是民調、不代表政府或任何組織。後續試玩輸入會與種子資料一起顯示，仍不可當成民意。請勿填入真實個資。';
export const hub = 'https://delib.mashbean.net/nuclear-restart';
export const sources = [
  {id:'S1', title:'核安會：2026/3/27 收到核三換照申請', url:'https://www.nusc.gov.tw/newsdetail/headline/7552.html', fact:'核三兩部機組執照已屆滿；台電於 2026 年 3 月 27 日提出換照申請，安全評估文件採分階段提送。'},
  {id:'S2', title:'核安會：再運轉審查管制專區', url:'https://www.nusc.gov.tw/核安管制/核電廠再運轉審查管制--3_50001.html', fact:'查閱日為 2026/9/23，專區仍列部分文件尚未提交。本站不宣稱已取得重啟許可；最新核定狀態請回原站核對。'},
  {id:'S3', title:'核子反應器設施運轉執照申請審核辦法，第 16-1、16-2 條', url:'https://erss.nusc.gov.tw/law/LawContent.aspx?id=FL032670', fact:'再運轉計畫核定、執行結果審查與換發執照是不同階段；依第 16-2 條，須核定相關文件並換發執照後，始得裝填核子燃料。'},
  {id:'S4', title:'中選會：114 年第 21 案投票結果', url:'https://web.cec.gov.tw/referendum/article/61395', fact:'2025/8/23 核三公投同意 4,341,432 票、不同意 1,511,693 票；投票權人 20,002,091 人，同意票未達四分之一，結果不通過。這是歷史投票，不是本次模擬的分布。'},
  {id:'S5', title:'核安會：用過核子燃料乾式貯存', url:'https://www.nusc.gov.tw/便民服務/民眾關切問答資訊/放射性物料管制/用過核子燃料乾式貯存--220_237_2275_3617.html', fact:'用過燃料須先冷卻，再安排乾式貯存及最終處置。乾式貯存與最終處置是不同工作。'},
  {id:'S6', title:'IPCC AR6 第三工作組第 6 章：能源系統', url:'https://www.ipcc.ch/report/ar6/wg3/chapter/chapter-6/', fact:'核能是低碳能源選項之一；各地能源組合仍須考量不同條件。低碳並不能單獨證明特定機組的安全、成本或重啟日期。'},
  {id:'S7', title:'台電：核三 2 號機執照屆期停止運轉', url:'https://hc2.taipower.com.tw/2764/2804/2805/63562/normalPost', fact:'核三 2 號機在 2025/5/17 結束 40 年運轉執照期間。歷史停機事實不等於現在的換照審查結論。'},
];
export const context = `${notice}\n考據截至 ${date}。以核三既有機組再運轉為主要案例，核二需另案審查，不混同核四或新建核電。再運轉計畫不等於運轉執照。核能可作低碳選項，但安全、核廢、成本、供電時程與地方參與須分別討論。來源與模擬資料：${hub}#sources`;
// Equal-sized stance groups demonstrate disagreement, not population prevalence.
export const roles = [
 ['R01','模擬・製造業排程員','support','供電可靠度','我支持把通過安全審查的核電納入選項，但想看完工時程、停機備援與替代方案的同尺度比較。','若整備成本或工期超出公開門檻，我願意重新評估，不把支持當成無條件授權。'],
 ['R02','模擬・減碳倡議者','support','減碳','我希望比較重啟與節能、儲能和再生能源在相同期間的減排效果，不能只比較發電時的排放。','若核電重啟擠壓更快減碳的投資，我會要求重新排優先順序。'],
 ['R03','模擬・用電商家','support','成本透明','我在意電費可負擔，支持評估既有機組，但不能把過去的平均成本直接當成未來重啟成本。','請公開整備、燃料、保險與核廢管理假設，用區間而非單一數字溝通。'],
 ['R04','模擬・能源韌性研究者','support','多元供應','我傾向保留多元低碳供電選項，也要求比較集中設施故障、燃料供應與電網修復能力。','核電、燃氣、再生能源與需求管理各有風險，不能讓某一種技術免於檢驗。'],
 ['R05','模擬・鄰近居民','oppose','地方安全','我目前反對重啟。生活在廠址附近的人需要理解事故應變、撤離交通與照顧者的負擔，不能只收到說明簡報。','若有獨立複核、可理解的風險資訊與地方實質參與，我願意繼續對話，但不預先承諾改變立場。'],
 ['R06','模擬・核廢關注者','oppose','長期責任','我反對在核廢長期責任不清楚時增加負擔。乾式貯存不是最終處置，選址與受影響者權利要公開討論。','既有核廢無論重不重啟都必須管理，不能把反對重啟誤寫成不用處理核廢。'],
 ['R07','模擬・青年預算監督者','oppose','世代公平','我擔心重啟把不確定成本與長期照顧義務轉給下一代，所以目前主張先投入節能與電網。','我要看相同折現率與風險假設下的替代方案，也接受替代方案並非零成本。'],
 ['R08','模擬・分散能源使用者','oppose','機會成本','我傾向不用重啟核電，優先降低尖峰需求與強化分散供電；這些方案也應公開土地、設備和可靠度限制。','若替代路徑無法在期限內提供相同可靠度，我希望承認缺口，再討論補救。'],
 ['R09','模擬・尚未決定的家長','amend','證據可理解','我尚未決定，想先知道哪一份文件證明什麼。完成計畫審查與實際可以裝填燃料，不能用同一句話帶過。','我需要支持與反對方共同承認的事實清單，以及仍有爭議的假設。'],
 ['R10','模擬・照顧服務工作者','amend','弱勢參與','不管能源選哪條路，醫療照護機構的備援、長者與障礙者撤離，都應列成可查核的配套。','參與不能只靠晚上線上填表，要有交通、口譯與照顧支持；這是我的提議，不是現行承諾。'],
 ['R11','模擬・工程品質關注者','amend','獨立監督','我只接受逐機組評估。支持研議不等於預先認定設備合格，反對也不能略過具體審查證據。','請列出老化與耐震問題、改善期限、查證方式與未通過就停止的條件。'],
 ['R12','模擬・地方議題主持人','amend','回覆責任','我在意提問最後有沒有得到回覆。多數支持某個條件，不代表大家同意整體重啟。','希望建立公開問題清單，分成可回答、待補資料、價值分歧三類，每項都保留不同意見。'],
].map(([id,alias,stance,value,statement,followup])=>({id,alias,stance,value,statement,followup}));
export const statements = [
 '只有完成法定安全審查並取得有效運轉執照，才可推進核電再運轉。',
 '應把通過審查的既有核電列入台灣低碳供電選項。',
 '在核廢長期責任未有可接受安排前，不應重啟核電。',
 '核電與替代方案應用相同期間、可靠度與成本假設比較。',
 '即使安全審查通過，我仍偏好以節能、再生能源與電網取代重啟。',
 '應公開逐機組老化與耐震評估的結論、限制及待改善項目。',
 '廠址及核廢設施周邊受影響者應獲得實質參與與回覆。',
 '為了減碳，可以接受在符合審查與配套條件下重啟既有核電。',
 '乾式貯存的推進不能被當成核廢最終處置已完成。',
 '不能只用本場模擬投票或公投的有效票比例宣稱全民共識。',
 '應先完成可比較的替代供電計畫，再決定是否支持重啟。',
 '若成本或時程超出事前公開門檻，應重新檢討重啟方案。',
 '能源配套應包含醫療照護備援及弱勢者應變需求。',
 '通過程序門檻的資料應能供外部專家獨立複核。',
 '地方參與應包含不同意見，不能用回饋措施代替安全與權利討論。',
 '在證據不足時保留「尚未決定」是合理的參與選項。',
].map(x=>`【模擬陳述】${x}`);
export const voteRows = roles.flatMap(r=>statements.map((_,j)=>({role:r.id,sid:j+1,value:1}))).map(v=>{
 const r=roles.find(x=>x.id===v.role), j=v.sid;
 if([2,8].includes(j)) v.value=r.stance==='support'?1:r.stance==='oppose'?-1:0;
 else if([3,5,11].includes(j)) v.value=r.stance==='oppose'?1:r.stance==='support'?-1:0;
 else v.value=(r.id==='R03'&&j===7)||(r.id==='R08'&&j===12)?0:1;
 return v;
});
export const questions = [
 {prompt:'再運轉計畫通過，是否就可以立即裝填核燃料？',choices:['是，計畫就是運轉執照','否，仍須完成法定審查並換發執照','只要模擬投票過半就可以'],answer:1,source:sources[2].url,explanation:sources[2].fact},
 {prompt:'2025 年核三第 21 案公投結果為何？',choices:['不通過；同意票未達投票權人四分之一','通過；有效票中同意過半即可','與本次 12 個模擬角色相同'],answer:0,source:sources[3].url,explanation:sources[3].fact},
 {prompt:'乾式貯存與最終處置的關係？',choices:['完全相同','有乾貯就沒有長期管理問題','是不同工作，不能混稱'],answer:2,source:sources[4].url,explanation:sources[4].fact},
 {prompt:'IPCC 將核能視為低碳選項，能否據此認定核三一定安全且最便宜？',choices:['可以，低碳代表所有條件合格','不可以，個別機組仍須各項評估'],answer:1,source:sources[5].url,explanation:sources[5].fact},
 {prompt:'核三換照申請的安全評估文件是否採分階段提送？',choices:['是，不能把收到申請解讀成所有審查完成','否，提出申請就等於完成所有審查'],answer:0,source:sources[0].url,explanation:sources[0].fact},
];
export const proposals = [
 ['公開重啟與替代路徑比較','在作出政策選擇前，公開核電重啟、節能、儲能與電網等路徑的相同期間成本、可靠度及減排假設；不確定值用區間，交由不同立場共同檢視。','R01'],
 ['暫緩重啟並提出替代供電里程碑','主張暫緩重啟，把資源先投入節能與電網；同時必須列出供電缺口、完成期限與未達標的補救方法，接受外部檢驗。','R08'],
 ['附條件逐機組評估與退出門檻','逐機組列出老化、耐震與設備改善證據；任何關鍵安全條件未通過即不進入下一階段。預算與時程超過公開門檻時重新討論。','R11'],
 ['建立受影響者參與與核廢責任清單','把廠址及核廢設施受影響者納入討論；區分乾式貯存、最終處置及既有核廢責任，公開費用假設、權利保障與尚未解決的事項。','R06'],
 ['優先補足照護與撤離配套','核電是否重啟都應盤點長照、醫療與障礙者的停電備援和應變需求，提出演練、交通與照顧支援；本提案不宣稱已取得任何機關承諾。','R10'],
 ['建立有期限的公開回覆表','每項問題指定模擬承辦角色、預計回覆期限與證據欄，區分已回答、待補資料和價值分歧；保留少數意見，不把完成回覆當成取得同意。','R12'],
].map(([title,body,author],i)=>({id:`P${i+1}`,title:`【模擬提案】${title}`,body:`【模擬方案，非政府政策】${body}`,author}));
export const options = [
 ['獨立安全與成本複核',35,'公開假設、異議與可重現比較'],['照護機構備援與撤離演練',25,'弱勢需求與交通盤點'],['核廢責任與地方參與',30,'長期管理、權利與回覆'],['節能與需求管理試點',30,'先檢驗替代路徑的可行性'],['電網與儲能情境評估',40,'檢查可靠度與失效情境'],['公開資料與逐題回覆',10,'讓每一項問題找得到後續'],
].map(([name,cost,description])=>({name,cost,description:`模擬成本，不是工程估價。${description}`,category:'模擬配套'}));
export const replies = roles.map(r=>({id:r.id,alias:r.alias,question:r.statement,reply:`【模擬主持人回覆，非政府承諾】你提出的「${r.value}」會列入待檢驗事項。你補充說：「${r.followup}」我們建議下一輪以公開資料及異議紀錄檢查此要求；若資料不足，保留待答，不據此認定你已同意重啟。`,status:'模擬建議，尚無真實機關承諾'}));
export const csv = 'id,interview,comment\n'+roles.flatMap(r=>[r.statement,r.followup].map((text,i)=>[`${r.id}-${i+1}`,r.alias,`【模擬發言】${text}`].map(x=>JSON.stringify(x)).join(','))).join('\n')+'\n';
export const replyCsv = 'id,interview,comment\n'+roles.map(r=>[r.id,r.alias,`【模擬提問】${r.statement}`].map(x=>JSON.stringify(x)).join(',')).join('\n')+'\n';
export const configs = {
 'pocket-form': {title,description:context,askAlias:true,questions:[{type:'choice',label:'目前你對既有核電重啟的立場？',required:true,options:['傾向支持','傾向反對','附帶條件／尚未決定']},{type:'long',label:'你最在意什麼？',required:true},{type:'long',label:'什麼證據或條件會讓你重新考慮？',required:true},{type:'consent',label:'我理解這是公開試玩、含模擬資料，不填真實個資'}]},
 'pocket-polis':{title,description:context,seedStatements:statements,autoApprove:true,allowSubmissions:true,openData:false},
 'pocket-harmonica':{topic:title,goal:'理解支持、反對與未決立場的理由和改變想法的條件，不追求說服或製造共識。',context,critical:'不可杜撰核准、安全、工程成本與政府承諾。所有預載角色為模擬，未知資料就明說。',questions:['你最在意核電重啟的哪一個影響？','你希望先取得什麼證據，再作決定？'],maxTurns:2,maxParticipants:80,askAlias:true},
 'pocket-values':{topic:title,situation:'在安全法定程序未可跳過的前提下，你如何取捨低碳供電、核廢責任、成本、地方參與與世代公平？可以反對或保留判斷。',context,maxTurns:2,maxParticipants:80,judgmentsPerParticipant:3,askAlias:true},
 'pocket-budget':{title,description:`${notice}\n請把 100 個虛構「練習點」分配給評估與配套，非核電工程預算、非新台幣、非正式分配。${hub}`,unit:'練習點',total:100,mode:'knapsack',options,askAlias:true,askReason:true},
 'pocket-check':{title,intro:`${notice}\n只測試來源理解，不測政治立場。${hub}#sources`,questions,passMark:4,nextUrl:hub,nextLabel:'回到核電試玩入口'},
 'pocket-proposals':{title,description:context,prompt:'提出重啟、暫緩或替代路徑的具體方案：證據、條件、負責角色與如何檢查。',allowAmendments:true,allowResponses:true,askAlias:true},
 'pocket-argument':{claim:'【模擬辯題】台灣應在法定安全與配套條件滿足後重啟既有核電。',description:context,maxDepth:4,askAlias:true},
 'pocket-maple':{title,description:context,agenda:{name:'【模擬公聽】既有核電再運轉的條件、替代方案與長期責任',proposer:'虛構審議工作坊（不是立法院或政府機關）',status:'教學模擬，未送交任何機關',laws:['核子反應器設施管制法','核子反應器設施運轉執照申請審核辦法'],url:sources[2].url,reason:notice},askOrg:false,requireSummary:true},
 'pocket-tttc':{title,description:context,language:'zh-Hant',csv},
 'pocket-reply':{title,speaker:'模擬工作坊主持人（虛構角色，非官方）',standfirst:notice,positions:`${context}\n只以模擬主持人身分提出下一輪建議，不能代表任何機關承諾或宣稱達成共識。已核對的基礎：${sources.map(s=>`${s.fact} ${s.url}`).join('\n')}\n逐題可用回覆：${replies.map(r=>r.reply).join('\n')}`,language:'zh-Hant',csv:replyCsv},
};
