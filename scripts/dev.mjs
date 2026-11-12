import http from 'node:http';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
fs.mkdirSync('.local',{recursive:true});
const db=new DatabaseSync('.local/classroom.sqlite');
if(!db.prepare("SELECT name FROM sqlite_master WHERE name='class_runs'").get())db.exec(fs.readFileSync('drizzle/0000_classroom.sql','utf8'));
if(!db.prepare("SELECT name FROM sqlite_master WHERE name='presence'").get())db.exec(fs.readFileSync('drizzle/0001_progress.sql','utf8'));
const DB={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}};
http.createServer(async(req,res)=>{try{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
 const result=await worker.fetch(request,{DB,TEACHER_PIN:process.env.TEACHER_PIN||'123456'});
 res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
}catch(e){res.writeHead(500);res.end('Preview error')}}).listen(Number(process.argv.includes('--port')?process.argv[process.argv.indexOf('--port')+1]:(process.env.PORT||3000)),'0.0.0.0');
