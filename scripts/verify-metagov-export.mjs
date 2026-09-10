import {readFile} from 'node:fs/promises';
import {verifyMetagovFiles} from '../public/metagov-files-core.js';
const [nativePath,companionPath]=process.argv.slice(2);
if(!nativePath||!companionPath){console.error('Usage: node scripts/verify-metagov-export.mjs statements.json private-companion.json');process.exit(1);}
try{console.log(JSON.stringify(await verifyMetagovFiles(await readFile(nativePath,'utf8'),JSON.parse(await readFile(companionPath,'utf8'))),null,2));}catch(error){console.error(error.message);process.exit(1);}
