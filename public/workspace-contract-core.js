import validateShape from './vendor/workspace-validator.js';
import {validateProject} from './workspace-core.js';

export const CONTRACT_REVISION='2026-09-23';
export const CONTRACT_FILE_LIMIT=6*1024*1024;
const result=(valid,code,extra={})=>({schema:'delib-workspace-contract-report/v1',revision:CONTRACT_REVISION,valid,code,externalAcceptance:false,workspaceModified:false,...extra});

// Return categories and counts only. Never echo source text, IDs, filenames, or parser errors.
export function inspectWorkspaceContract(value) {
  if(!value||value.schema!=='https://delib.mashbean.net/schemas/delib-workspace/v1.json')return result(false,'unsupported-schema');
  if(!validateShape(value))return result(false,'schema-invalid',{keyword:validateShape.errors?.[0]?.keyword||'unknown'});
  try{validateProject(value);}catch{return result(false,'semantics-invalid');}
  const missingContext=['goal','audience','deadline'].filter(k=>value[k]===undefined);
  return result(true,'valid',{missingContext,counts:{rounds:value.rounds.length,records:value.rounds.reduce((n,r)=>n+r.artifacts.length,0),transfers:value.transfers?.length||0,imports:value.imports?.length||0},simulated:value.simulated});
}

export function inspectWorkspaceText(text) {
  if(typeof text!=='string')return result(false,'invalid-json');
  if(new TextEncoder().encode(text).byteLength>CONTRACT_FILE_LIMIT)return result(false,'size-limit');
  let value;try{value=JSON.parse(text);}catch{return result(false,'invalid-json');}
  return inspectWorkspaceContract(value);
}

// Recovery keeps unrecognized/invalid stored objects intact; never drop or migrate them.
export function partitionWorkspaceBackups(values) {
  const valid=[],recovery=[];
  for(const value of values){try{validateProject(value);valid.push(value);}catch{recovery.push(value);}}
  return {valid,recovery};
}
