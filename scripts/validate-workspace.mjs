#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {inspectWorkspaceText,CONTRACT_FILE_LIMIT} from '../public/workspace-contract-core.js';

const args=process.argv.slice(2);
if(args.length!==1||args[0].startsWith('--')){
  console.error('Usage: npm run validate:workspace -- path/to/private-backup.json');
  process.exitCode=2;
}else{
  let file;
  try{
    file=await open(args[0],'r');
    // Bound the read even if the file changes after stat. Nothing is uploaded or rewritten.
    const info=await file.stat();
    if(!info.isFile()||info.size>CONTRACT_FILE_LIMIT)throw new Error('size');
    const data=Buffer.alloc(CONTRACT_FILE_LIMIT+1);let size=0;
    while(size<data.length){const r=await file.read(data,size,data.length-size,null);if(!r.bytesRead)break;size+=r.bytesRead;}
    if(size>CONTRACT_FILE_LIMIT)throw new Error('size');
    const report=inspectWorkspaceText(new TextDecoder('utf-8',{fatal:true}).decode(data.subarray(0,size)));
    console.log(JSON.stringify(report,null,2));process.exitCode=report.valid?0:1;
  }catch{
    console.error(JSON.stringify({valid:false,code:'file-unreadable-or-too-large',externalAcceptance:false}));process.exitCode=2;
  }finally{await file?.close();}
}
