import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone/index.js';
import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';

// All references resolve locally. No runtime schema fetching or eval in the browser.
const ajv=new Ajv({strict:false,allErrors:false,code:{source:true}});
addFormats(ajv);
for(const name of ['delib-exchange','delib-workspace-import','delib-workspace-transfer','delib-workspace']) {
  ajv.addSchema(JSON.parse(await readFile(`public/schemas/${name}/v1.json`,'utf8')));
}
const validate=ajv.getSchema('https://delib.mashbean.net/schemas/delib-workspace/v1.json');
const code=standaloneCode(ajv,validate);
const result=await build({stdin:{contents:code,resolveDir:process.cwd(),sourcefile:'workspace-validator.cjs',loader:'js'},bundle:true,format:'esm',minify:true,write:false,platform:'browser',target:'es2022'});
await writeFile('public/vendor/workspace-validator.js','// Generated from Delib workspace v1 and its local schema dependencies. Run npm run build:contracts.\n'+result.outputFiles[0].text);
