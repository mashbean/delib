// Loopback-only UI acceptance server. No outgoing requests; no real activities.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {parseTttcCsv} from '../public/tttc-csv-core.js';
const root=path.resolve('public'),sessions=new Map();let sequence=0;
const json=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4*1024*1024){req.destroy();return;}}const body=JSON.parse(raw);
   if(url.pathname.startsWith('/api/integrations/pocket-')){
     const tool=url.pathname.split('pocket-')[1];if(!['form','tttc','reply'].includes(tool)||body.confirmed!==true)return json(res,{error:'Invalid fixture request'},400);
     // Explicitly exercise an ambiguous network failure without touching upstream services.
     if(body.title==='Fixture uncertain'){req.socket.destroy();return;}
     const id=`fixture${String(++sequence).padStart(3,'0')}`;sessions.set(id,{tool,body});
     const origin=({form:'https://form.mashbean.net',tttc:'https://ttt-city.mashbean.net',reply:'https://reply.mashbean.net'})[tool];
     return json(res,{[({form:'formId',tttc:'reportId',reply:'loopId'})[tool]]:id,status:'queued',manageUrl:`${origin}/${tool==='form'?'h':'r'}/${id}#admin=${'a'.repeat(32)}`},201);
   }
   if(url.pathname==='/api/workspace/read'){
     const session=sessions.get(body.id);if(!session||session.tool!==body.tool)return json(res,{error:'Unknown fixture activity'},404);
     if(body.tool==='form')return json(res,{csv:'id,interview,comment\na,,Keep accessible drop-off\nb,,Leave deliveries possible'});
     const rows=parseTttcCsv({text:session.body.csv,label:'fixture'}).rows;
     return json(res,{result:body.tool==='tttc'?{progress:{status:'ready'},tree:{topics:[{name:'Access',subtopics:[{name:'Access',claims:[{id:'c1',text:'Preserve accessible drop-off and deliveries',quotes:rows.map(r=>({commentId:r.id,text:r.comment}))}]}]}]}}:{progress:{status:'ready'},receipt:{questions:rows.map((r,i)=>({qid:`q${i}`,sourceId:r.id})),loopbacks:rows.map((r,i)=>({qid:`q${i}`,reply:`Fixture draft: test access for ${r.comment}`}))}}});
   }
   return json(res,{error:'No fixture for this write'},404);
 }
 let name=decodeURIComponent(url.pathname);if(name==='/workspace')name='/workspace.html';if(name==='/')name='/index.html';
 const file=path.resolve(root,`.${name}`);if(!file.startsWith(root+path.sep))return json(res,{error:'Invalid path'},400);
 const data=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
}catch(error){json(res,{error:error.message},500);}}).listen(8791,'127.0.0.1',()=>console.log('Synthetic workspace fixture server at http://127.0.0.1:8791 — no upstream requests.'));
