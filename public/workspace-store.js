const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('delib-workspace',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function projectStore(action,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('projects',action==='list'?'readonly':'readwrite'),store=tx.objectStore('projects');let result,error;
 const rejectConflict=()=>{error=new Error('Issue changed in another tab. Reload before saving / 另一分頁已更新議題，請重新載入');tx.abort();};
 if(action==='save'||action==='compare-save'){
  const next=action==='compare-save'?value.next:value,read=store.get(next.id);
  read.onsuccess=()=>{const old=read.result;if(action==='compare-save'?JSON.stringify(old)!==value.expected:old&&JSON.stringify(old.operations)!==JSON.stringify(next.operations)){rejectConflict();return;}const request=store.put(next);request.onsuccess=()=>{result=request.result;};};
 }else{const request=action==='list'?store.getAll():store.delete(value);request.onsuccess=()=>{result=request.result;};}
 tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(error||tx.error);};tx.onabort=()=>{db.close();reject(error||tx.error||new Error('Local storage unavailable'));};});}
