import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
await build({entryPoints:['public/scene3d.js'],outfile:'public/vendor/scene3d.bundle.js',bundle:true,minify:true,format:'esm',target:['es2022'],legalComments:'linked'});
await copyFile('node_modules/three/LICENSE','public/vendor/THREE-LICENSE.txt');
