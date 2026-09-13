// Loopback-only browser QA fixture. Never serves APIs or sends upstream requests.
// Usage: node scripts/qa-workspace-server.mjs [port] [--fail-first-save]
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('public'),port=Number(process.argv[2]||8791),fail=process.argv.includes('--fail-first-save');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');let name=decodeURIComponent(url.pathname);
 if(req.method!=='GET'||name.startsWith('/api/')){res.writeHead(403);res.end('QA fixture: upstream calls disabled');return;}
 if(name==='/workspace-store.js'&&fail){res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(`import {projectStore as realStore} from '/qa-real-store.js';let first=true;export async function projectStore(action,value){if(action==='save'&&first){first=false;throw new DOMException('Fictional storage failure','QuotaExceededError');}return realStore(action,value);}`);return;}
 if(name==='/qa-real-store.js')name='/workspace-store.js';
 if(name==='/')name='/index.html';else if(!path.extname(name))name+='.html';
 const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw new Error('path');
 const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
}catch{res.writeHead(404);res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log(`QA fixture http://127.0.0.1:${port}; fail first save: ${fail}; upstream disabled`));
