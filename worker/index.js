const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...headers}});
const hash=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const cookie=(req,key)=>req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(key+'='))?.slice(key.length+1)||'';
const token=()=>crypto.randomUUID()+crypto.randomUUID();
const sessionCookie=(key,value,age)=>`${key}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${age}`;
async function session(req,env,role){const t=req.headers.get('x-'+role+'-session')||cookie(req,role);if(!t)return null;return env.DB.prepare(`SELECT * FROM ${role==='teacher'?'teacher_sessions':'student_sessions'} WHERE token=? AND expires_at>?`).bind(await hash(t),Date.now()).first()}
async function api(req,env){
 const url=new URL(req.url),path=url.pathname,now=Date.now();
 if(!env.DB)return json({error:'수업 서버 연결을 준비하고 있습니다.'},503);
 if(req.method!=='GET'){
  if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)return json({error:'다른 사이트에서 보낸 요청입니다.'},403);
  if(!req.headers.get('content-type')?.includes('application/json'))return json({error:'JSON 요청이 필요합니다.'},415);
 }
 let body={};if(req.method!=='GET'){const raw=await req.text();if(raw.length>2000000)return json({error:'작업 파일이 너무 큽니다.'},413);try{body=JSON.parse(raw)}catch{return json({error:'요청 내용을 확인해 주세요.'},400)}}
 if(path==='/api/teacher/login'&&req.method==='POST'){
  const ip=await hash(req.headers.get('cf-connecting-ip')||'local');
  await env.DB.prepare('INSERT INTO login_limits(ip,attempts,window_start) VALUES(?,1,?) ON CONFLICT(ip) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END, window_start=CASE WHEN window_start<? THEN ? ELSE window_start END').bind(ip,now,now-300000,now-300000,now).run();
  const lim=await env.DB.prepare('SELECT attempts FROM login_limits WHERE ip=?').bind(ip).first();
  if(lim.attempts>10)return json({error:'시도가 많습니다. 5분 후 다시 입력해 주세요.'},429);
  if(!env.TEACHER_PIN||String(body.pin)!==env.TEACHER_PIN)return json({error:'교사 입장번호가 맞지 않습니다.'},401);
  const t=token();await env.DB.prepare('INSERT INTO teacher_sessions(token,expires_at) VALUES(?,?)').bind(await hash(t),now+43200000).run();
  return json({ok:true,sessionToken:t},200,{'set-cookie':sessionCookie('teacher',t,43200)});
 }
 if(path==='/api/teacher/classes'){
  if(!await session(req,env,'teacher'))return json({error:'교사 입장이 필요합니다.'},401);
  if(req.method==='GET'){const rows=await env.DB.prepare('SELECT c.*, (SELECT count(*) FROM student_sessions s WHERE s.class_id=c.id) AS students, (SELECT count(*) FROM drafts d JOIN student_sessions s ON d.student_id=s.id WHERE s.class_id=c.id) AS saved FROM class_runs c ORDER BY created_at DESC LIMIT 100').all();return json({classes:rows.results})}
  if(req.method==='POST'){
   const grade=Number(body.grade),room=Number(body.room),title=String(body.title||'통계포스터 만들기').trim().slice(0,80);
   if(![1,2,3].includes(grade)||!Number.isInteger(room)||room<1||room>99)return json({error:'학년은 1~3, 반은 1~99로 입력해 주세요.'},400);
   const code=String(grade*100+room),id=crypto.randomUUID();
   try{await env.DB.prepare('INSERT INTO class_runs(id,code,grade,room,title,created_at) VALUES(?,?,?,?,?,?)').bind(id,code,grade,room,title,now).run()}catch(e){if(String(e).includes('UNIQUE'))return json({error:'이 반에는 진행 중인 수업이 있습니다. 기존 수업을 종료한 뒤 다시 개설하세요.'},409);throw e}
   return json({id,code,grade,room,title,active:1},201);
  }
 }
 if(path==='/api/teacher/close'&&req.method==='POST'){
  if(!await session(req,env,'teacher'))return json({error:'교사 입장이 필요합니다.'},401);
  await env.DB.prepare('UPDATE class_runs SET active=0,closed_at=? WHERE id=? AND active=1').bind(now,String(body.id)).run();return json({ok:true});
 }
 if(path==='/api/teacher/students'||path==='/api/teacher/work'){
  if(!await session(req,env,'teacher'))return json({error:'교사 입장이 필요합니다.'},401);
  if(req.method!=='GET')return json({error:'허용되지 않는 요청입니다.'},405);
  if(path.endsWith('work')){
   const id=url.searchParams.get('student'),submitted=url.searchParams.get('submitted')==='1';
   const row=await env.DB.prepare(submitted?'SELECT data,submitted_at AS updated_at FROM submissions WHERE student_id=?':'SELECT data,updated_at FROM drafts WHERE student_id=?').bind(id).first();
   return row?json({data:JSON.parse(row.data),updated_at:row.updated_at}):json({error:'아직 저장된 작업이 없습니다.'},404);
  }
  const id=url.searchParams.get('class');
  const rows=await env.DB.prepare('SELECT s.id,s.name,s.number,p.last_seen,p.visible,p.step,d.updated_at,d.revision,d.data,u.submitted_at FROM student_sessions s LEFT JOIN presence p ON p.student_id=s.id LEFT JOIN drafts d ON d.student_id=s.id LEFT JOIN submissions u ON u.student_id=s.id WHERE s.class_id=? ORDER BY CAST(s.number AS INTEGER),s.name').bind(id).all();
  const events=await env.DB.prepare('SELECT a.student_id,a.id,a.started_at,a.ended_at FROM away_events a JOIN student_sessions s ON a.student_id=s.id WHERE s.class_id=? ORDER BY a.started_at DESC LIMIT 2000').bind(id).all();
  return json({students:rows.results.map(r=>{const data=r.data?JSON.parse(r.data):null;delete r.data;return {...r,title:data?.title||'',datasets:data?.datasets?.filter(d=>d.raw?.trim()).length||0,cards:data?.cards?.length||0,events:events.results.filter(e=>e.student_id===r.id)}}),serverTime:now});
 }
 if(path==='/api/student/join'&&req.method==='POST'){
  const code=String(body.code||'').trim(),name=String(body.name||'').trim().slice(0,40),number=String(body.number||'').trim().slice(0,10);
  if(!/^[123]\d{2}$/.test(code)||!name)return json({error:'수업코드와 이름을 입력해 주세요.'},400);
  const cls=await env.DB.prepare('SELECT * FROM class_runs WHERE code=? AND active=1').bind(code).first();
  if(!cls)return json({error:'진행 중인 수업이 없습니다. 수업코드를 확인하거나 선생님께 문의하세요.'},409);
  const old=await session(req,env,'student');
  if(old&&old.class_id===cls.id&&old.name===name&&old.number===number)return json({student:old.id,class:cls,name:old.name});
  const t=token(),id=crypto.randomUUID();await env.DB.prepare('INSERT INTO student_sessions(token,id,class_id,name,number,expires_at) VALUES(?,?,?,?,?,?)').bind(await hash(t),id,cls.id,name,number,now+2592000000).run();
  return json({student:id,class:cls,name,sessionToken:t},200,{'set-cookie':sessionCookie('student',t,2592000)});
 }
 if(['/api/student/session','/api/student/draft','/api/student/submit','/api/student/activity'].includes(path)){
  const s=await session(req,env,'student');if(!s)return json({error:'수업코드로 입장해 주세요.'},401);
  const cls=await env.DB.prepare('SELECT * FROM class_runs WHERE id=?').bind(s.class_id).first();
  if(path.endsWith('activity')&&req.method==='POST'){
   if(!cls.active)return json({ok:true,closed:true});
   const tab=String(body.tab||'').slice(0,80),event=String(body.event||'').slice(0,80);
   if(!tab)return json({error:'접속 정보를 확인해 주세요.'},400);
   const visible=body.visible===true;
   await env.DB.prepare('INSERT INTO presence(student_id,last_seen,visible,step) VALUES(?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET last_seen=excluded.last_seen,visible=excluded.visible,step=excluded.step').bind(s.id,now,visible?1:0,Math.max(0,Math.min(4,Number(body.step)||0))).run();
   if(!visible&&event)await env.DB.prepare('INSERT OR IGNORE INTO away_events(id,student_id,tab,started_at) VALUES(?,?,?,?)').bind(event,s.id,tab,now).run();
   if(visible)await env.DB.prepare('UPDATE away_events SET ended_at=? WHERE student_id=? AND tab=? AND ended_at IS NULL').bind(now,s.id,tab).run();
   return json({ok:true});
  }
  if(path.endsWith('session'))return json({student:s.id,name:s.name,number:s.number,class:cls});
  if(req.method==='GET'){const d=await env.DB.prepare('SELECT data,updated_at,revision FROM drafts WHERE student_id=?').bind(s.id).first();const u=await env.DB.prepare('SELECT submitted_at FROM submissions WHERE student_id=?').bind(s.id).first();return json({data:d?JSON.parse(d.data):null,revision:d?.revision||0,class:cls,submitted_at:u?.submitted_at||null})}
  if(req.method==='PUT'||(path.endsWith('submit')&&req.method==='POST')){
   if(!body.data||!Array.isArray(body.data.datasets)||!Array.isArray(body.data.cards)||body.data.datasets.length>12||body.data.cards.length>72)return json({error:'작업 자료의 형식이 올바르지 않습니다.'},400);
   if(path.endsWith('submit')){
    const result=await env.DB.prepare('INSERT INTO submissions(student_id,data,submitted_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM class_runs WHERE id=? AND active=1) ON CONFLICT(student_id) DO UPDATE SET data=excluded.data,submitted_at=excluded.submitted_at WHERE EXISTS(SELECT 1 FROM class_runs WHERE id=? AND active=1)').bind(s.id,JSON.stringify(body.data),now,s.class_id,s.class_id).run();
    if(!result.meta.changes)return json({error:'수업이 종료되어 제출할 수 없습니다.',closed:true},423);
    return json({ok:true,submitted_at:now});
   }
   // Status is part of this write statement, so a stale client cannot save after closure.
   const result=await env.DB.prepare('INSERT INTO drafts(student_id,data,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM class_runs WHERE id=? AND active=1) ON CONFLICT(student_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at,revision=drafts.revision+1 WHERE EXISTS(SELECT 1 FROM class_runs WHERE id=? AND active=1)').bind(s.id,JSON.stringify(body.data),now,s.class_id,s.class_id).run();
   if(!result.meta.changes)return json({error:'수업이 종료되어 더 이상 수정할 수 없습니다.',closed:true},423);
   return json({ok:true});
  }
 }
 return json({error:'요청을 찾을 수 없습니다.'},404);
}
export default {async fetch(req,env){
 try{
  const path=new URL(req.url).pathname;
  if(path.startsWith('/api/'))return await api(req,env);
  const key=path==='/'?'/index.html':path,body=ASSETS[key];
  if(body===undefined)return new Response('Not found',{status:404});
  const type=key.endsWith('.js')?'text/javascript':key.endsWith('.css')?'text/css':'text/html';
  return new Response(body,{headers:{'content-type':type+'; charset=utf-8','cache-control':'no-cache','x-content-type-options':'nosniff'}});
 }catch(e){console.error('classroom request failed',e.message);return json({error:'서버 연결에 문제가 있습니다. 잠시 후 다시 시도하세요.'},500)}
}};
