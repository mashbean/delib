// Rebuild synthetic analysis from the pinned, locally checked-out Pocket Polis math.
import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {buildPolisAnalysis,POLIS_SOURCE_REVISION} from '../public/polis-analysis-core.js';
const root=process.argv[2];if(!root)throw Error('Pass a local Pocket Polis checkout');
if(execFileSync(process.env.DELIB_GIT||'git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim()!==POLIS_SOURCE_REVISION)throw Error('Source revision differs');
const output='/private/tmp/delib-polis-math.mjs';await build({entryPoints:[`${root}/src/math/pipeline.ts`],bundle:true,format:'esm',platform:'node',outfile:output});
const {computeMath,privacySafeMathResult}=await import(output);
const statements=Array.from({length:8},(_,i)=>({statementId:i+1,text:`Fictional school access option ${i+1} / 虛構校門方案 ${i+1}`,status:'approved',isSeed:i===0,agrees:0,disagrees:0,passes:0}));
const votes=[];for(let p=0;p<24;p++)for(const s of statements){const value=s.statementId<=2?1:((p<12)===(s.statementId%2===0)?1:-1);votes.push({pid:`fictional-${p}`,sid:s.statementId,value});s[value===1?'agrees':'disagrees']++;}
const math=privacySafeMathResult(computeMath({conversationId:'fictional-school',votes,statementIds:statements.map(s=>s.statementId),computedAt:1790164800000}).publicResult);
const raw={conversationId:'fictional-school',statements,result:{result:math,you:null},sourceRevision:POLIS_SOURCE_REVISION};
await writeFile('test/fixtures/polis-analysis-input.json',JSON.stringify(raw,null,2)+'\n');
await writeFile('public/data/exchange-examples/polis-analysis.json',JSON.stringify(buildPolisAnalysis(raw),null,2)+'\n');
console.log('Built aggregate-only synthetic fixture:',math.groups.length,'groups');
