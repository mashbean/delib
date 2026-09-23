export function rememberWorkspace(id){
  for(const storage of [()=>sessionStorage,()=>localStorage])try{storage().setItem('delib:last-project',id);}catch{}
}
export function rememberedWorkspace(){
  for(const storage of [()=>sessionStorage,()=>localStorage])try{const id=storage().getItem('delib:last-project');if(id)return id;}catch{}
  return null;
}
