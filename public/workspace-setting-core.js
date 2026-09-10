// Optional, attributed observations; never inferred from a tool name.
export const settings=['unknown','online','in-person'];
export function validateSettings(p){
 for(const a of p.rounds.flatMap(r=>r.artifacts))if(a.settingHistory!==undefined){
  if(!Array.isArray(a.settingHistory)||!a.settingHistory.length||a.settingHistory.length>60)throw new Error('Invalid setting history');
  const ids=new Set();let previous=0;
  for(const e of a.settingHistory){const at=Date.parse(e.at);if(typeof e.id!=='string'||!e.id||e.id.length>120||typeof e.at!=='string'||ids.has(e.id)||!settings.includes(e.setting)||!Number.isFinite(at)||at<previous||typeof e.by!=='string'||!e.by.trim()||e.by.length>100||typeof e.note!=='string'||!e.note.trim()||e.note.length>1000||Object.keys(e).some(k=>!['id','at','by','note','setting'].includes(k)))throw new Error('Invalid setting observation');ids.add(e.id);previous=at;}
 }
}
export function recordSetting(p,id,{setting,by,note}){
 const a=p.rounds.flatMap(r=>r.artifacts).find(a=>a.id===id);if(!a)throw new Error('Unknown record');
 const entry={id:crypto.randomUUID(),at:new Date().toISOString(),setting,by:by?.trim(),note:note?.trim()};
 const history=a.settingHistory;a.settingHistory=[...(history||[]),entry];try{validateSettings(p);}catch(error){if(history)a.settingHistory=history;else delete a.settingHistory;throw error;}
}
