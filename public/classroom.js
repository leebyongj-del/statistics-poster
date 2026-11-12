const portal=document.getElementById('classroom-portal'),classbar=document.getElementById('classroom-bar');
let classSession=null,checkTimer=null,saveTimer=null,saveRunning=false,saveAgain=false,roleView='entry';
const classroom=window.classroom={editable:false,storageKey:'',queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveDraft,700)},applyLock(){
 if(document.body.dataset.role!=='student')return;
 document.querySelectorAll('#form input,#form textarea,#form select,#form button[data-action]:not([data-action="print"]),#sample,#open').forEach(el=>el.disabled=!classroom.editable);
 }};
function stored(kind,key){try{return window[kind].getItem(key)||''}catch{return ''}}
const authTokens={teacher:stored('sessionStorage','statlab-teacher-token'),student:stored('localStorage','statlab-student-token')};
async function callApi(path,method='GET',body){
 const role=path.split('/')[0],headers=method==='GET'?{}:{'content-type':'application/json'};
 if(authTokens[role])headers['x-'+role+'-session']=authTokens[role];
 const r=await fetch('/api/'+path,{method,headers,body:method==='GET'?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(8000)});
 const x=await r.json();if(!r.ok){const e=new Error(x.error||'서버 연결 오류');e.status=r.status;e.closed=x.closed;throw e}
 if(x.sessionToken){authTokens[role]=x.sessionToken;try{(role==='teacher'?sessionStorage:localStorage).setItem('statlab-'+role+'-token',x.sessionToken)}catch{}}
 return x
}
let selectedClass='',activityTimer=null,submitting=false,submittedAt=null;
const activityTab=stored('sessionStorage','statlab-tab')||crypto.randomUUID();try{sessionStorage.setItem('statlab-tab',activityTab)}catch{}
let awayEvent=stored('sessionStorage','statlab-away');
function activity(visible=!document.hidden){
 if(roleView!=='student'||!classSession?.class.active)return;
 if(!visible&&!awayEvent){awayEvent=crypto.randomUUID();(()=>{try{sessionStorage.setItem('statlab-away',awayEvent)}catch{}})()}
 const payload={tab:activityTab,event:awayEvent,visible,step};
 fetch('/api/student/activity',{method:'POST',headers:{'content-type':'application/json','x-student-session':authTokens.student},body:JSON.stringify(payload),keepalive:true}).then(r=>{if(r.ok&&visible&&awayEvent===payload.event){awayEvent='';(()=>{try{sessionStorage.removeItem('statlab-away')}catch{}})()}}).catch(()=>{});
}
const timeText=t=>t?new Date(t).toLocaleString('ko-KR'):'—';
const duration=ms=>Math.floor(ms/60000)+'분 '+Math.floor(ms%60000/1000)+'초';
async function refreshStudents(){
 if(roleView!=='teacher'||!selectedClass)return;
 const requested=selectedClass,x=await callApi('teacher/students?class='+encodeURIComponent(selectedClass));
 const el=document.getElementById('student-list');if(!el||requested!==selectedClass)return;
 const opened=new Set([...el.querySelectorAll('details[open]')].map(d=>d.dataset.student));
 el.innerHTML=x.students.length?x.students.map(s=>{
 const online=x.serverTime-(s.last_seen||0)<45000,events=s.events||[],total=events.reduce((n,e)=>n+(e.ended_at?e.ended_at-e.started_at:0),0);
 return `<article class="student-status"><h3>${esc(s.number)} ${esc(s.name)}</h3><p class="presence">${online?(s.visible?'● 접속 중':'◐ 화면 이탈 중'):'○ 접속 확인 안 됨'}</p><p>최근 접속 확인: ${timeText(s.last_seen)}<br>작업 단계: ${esc(names[s.step]||'입장')} · 자료 ${s.datasets}개 · 통계도구 ${s.cards}개</p><p>${esc(s.title||'제목 작성 전')}<br>최근 자동 저장: ${timeText(s.updated_at)}<br><b>${s.submitted_at?'제출 완료: '+timeText(s.submitted_at):'미제출'}</b></p><div class="toolbar"><button data-work="${esc(s.id)}" ${s.updated_at?'':'disabled'}>작성 중인 작업 보기</button><button data-work="${esc(s.id)}" data-submitted="1" ${s.submitted_at?'':'disabled'}>제출본 보기</button></div><details data-student="${esc(s.id)}" ${opened.has(s.id)?'open':''}><summary>화면 이탈 ${events.length}회 · 복귀 확인된 시간 ${duration(total)}</summary>${events.length?events.map(e=>`<p>${timeText(e.started_at)} → ${e.ended_at?timeText(e.ended_at)+' ('+duration(e.ended_at-e.started_at)+')':'복귀 미확인 · 시간 미확정'}</p>`).join(''):'<p>기록된 이탈이 없습니다.</p>'}</details></article>`
 }).join(''):'<p>아직 입장한 학생이 없습니다.</p>';
}
async function openWork(id,submitted){
 const x=await callApi('teacher/work?student='+encodeURIComponent(id)+'&submitted='+(submitted?'1':'0'));
 clearInterval(checkTimer);roleView='review';classroom.editable=false;state=normalize(x.data);active=state.datasets[0].id;step=4;
 document.body.dataset.role='student';portal.hidden=true;classbar.hidden=false;
 classbar.innerHTML=`<b>${submitted?'학생 제출본':'작성 중인 작업'} · ${timeText(x.updated_at)}</b><span>읽기 전용</span><button data-portal="back-teacher">수업 관리로 돌아가기</button>`;render();classroom.applyLock();
}
async function submitWork(){
 if(!classroom.editable||submitting||roleView!=='student')return;
 const missing=rubricMissing();if(missing.length&&!confirm('아직 확인할 항목: '+missing.join(', ')+'\n현재 상태로 제출할까요?'))return;
 submitting=true;showBar('선생님께 제출하는 중…');
 try{const x=await callApi('student/submit','POST',{data:JSON.parse(JSON.stringify(state))});submittedAt=x.submitted_at;showBar('제출 완료 · '+timeText(submittedAt)+' · 이후 수정한 내용은 다시 제출해 주세요.');document.getElementById('saved').textContent='교사에게 제출 완료 ✓'}
 catch(e){showBar('제출되지 않았습니다. '+e.message);if(e.closed){classroom.editable=false;classroom.applyLock()}}
 finally{submitting=false;const b=classbar.querySelector('[data-portal="submit"]');if(b)b.disabled=!classroom.editable}
}
function portalShell(content){document.body.dataset.role='entry';classbar.hidden=true;portal.hidden=false;portal.innerHTML=`<section class="role-card"><span class="tag">우리 반 통계연구소</span>${content}<p id="portal-message" role="status"></p></section>`}
function message(text){const el=document.getElementById('portal-message');if(el)el.textContent=text}
function home(){activity(false);clearInterval(activityTimer);clearInterval(checkTimer);classroom.editable=false;roleView='entry';portalShell('<h1>오늘의 통계 탐구를 시작해요</h1><p>역할을 선택해 주세요.</p><div class="role-buttons"><button data-portal="teacher">교사<span>수업 개설 · 수업 종료</span></button><button data-portal="student">학생<span>수업코드로 참여 · 포스터 만들기</span></button></div>')}
function loginForm(){roleView='teacher-login';portalShell('<h1>교사 입장</h1><form id="teacher-login"><label>교사 입장번호<input name="pin" type="password" inputmode="numeric" autocomplete="off" required></label><button class="primary" type="submit">입장하기</button></form><button data-portal="home">역할 선택으로</button>')}
function studentForm(){roleView='student-join';portalShell('<h1>학생 입장</h1><form id="student-join"><label>수업코드<input name="code" inputmode="numeric" pattern="[123][0-9]{2}" maxlength="3" placeholder="예: 101" required></label><div class="row"><label>번호<input name="number" inputmode="numeric" maxlength="10"></label><label>이름 또는 모둠 이름<input name="name" maxlength="40" required></label></div><button class="primary" type="submit">수업 참여하기</button></form><button data-portal="resume">이 기기의 지난 작업 열기</button><button data-portal="home">역할 선택으로</button><p class="muted">101은 1학년 1반, 102는 1학년 2반이에요. 종료된 수업에는 새로 참여할 수 없어요.</p><p class="tracking-notice">이 수업에서는 접속 상태, 작업·제출 상태와 다른 탭·앱으로 이동하거나 화면이 숨겨진 시각 및 복귀 시각이 선생님께 기록됩니다. 다른 화면의 내용은 수집하지 않으며, 이탈 기록만으로 AI 사용 여부를 판단하지 않습니다.</p>')}
async function teacherView(){
 roleView='teacher';classroom.editable=false;clearInterval(checkTimer);
 portalShell('<h1>수업 관리</h1><form id="class-create"><div class="row"><label>학년<select name="grade"><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option></select></label><label>반<input name="room" type="number" min="1" max="99" value="1" required></label></div><label>수업 이름<input name="title" value="통계포스터 만들기" maxlength="80" required></label><p id="code-preview">자동 수업코드: 101</p><button class="primary" type="submit">수업 개설하기</button></form><h2>개설한 수업</h2><div id="class-list">불러오는 중…</div><section id="student-dashboard"><h2>학생 접속 · 작업 현황</h2><p class="muted">수업의 ‘학생 현황’을 선택하세요. 약 5초마다 갱신됩니다. 45초 이상 응답이 없으면 접속 확인 안 됨으로 표시합니다. 이탈 기록은 AI 사용의 증거가 아니며, 네트워크·브라우저 제한으로 누락될 수 있습니다.</p><div id="student-list"></div></section><button data-portal="home">역할 선택으로</button>');
 await refreshClasses();if(roleView==='teacher')checkTimer=setInterval(refreshClasses,5000);
}
async function refreshClasses(){if(roleView!=='teacher')return;try{const x=await callApi('teacher/classes'),list=document.getElementById('class-list');if(!list)return;list.innerHTML=x.classes.length?x.classes.map(c=>`<article class="class-item"><div><b>${esc(c.grade+'학년 '+c.room+'반')} · ${esc(c.title)}</b><p>수업코드 <strong class="class-code">${esc(c.code)}</strong> · ${c.active?'진행 중':'종료됨'}</p><small>${new Date(c.created_at).toLocaleString('ko-KR')} · 참여 ${c.students} · 저장된 작업 ${c.saved}</small></div><button data-students="${esc(c.id)}">학생 현황</button>${c.active?`<button data-close="${esc(c.id)}">수업 종료</button>`:'<span>읽기 전용</span>'}</article>`).join(''):'<p>아직 개설한 수업이 없습니다.</p>';await refreshStudents()}catch(e){if(e.status===401){clearInterval(checkTimer);loginForm()}message(e.message)}}
function showBar(text){classbar.innerHTML=`<b>${esc(classSession.class.grade+'학년 '+classSession.class.room+'반')} · ${esc(classSession.name)}</b><span role="status">${esc(text)}</span><button class="primary" data-portal="submit" ${!classroom.editable||submitting?'disabled':''}>${submittedAt?'교사에게 다시 제출하기':'교사에게 제출하기'}</button><button data-portal="leave">역할 선택</button>`}
async function enterStudent(info){
 clearInterval(checkTimer);clearInterval(activityTimer);clearTimeout(saveTimer);submittedAt=null;classSession=info;classroom.storageKey='statlab-class-'+info.class.id+'-'+info.student;
 const saved=await callApi('student/draft');submittedAt=saved.submitted_at||null;let data=saved.data;
 // Resume an unsent local draft only while the same run is active.
 if(info.class.active){try{const local=JSON.parse(localStorage.getItem(classroom.storageKey));if(local)data=local}catch{}}
 if(!data&&saved.class.active){try{const legacy=localStorage.getItem('statlab-v2')||localStorage.getItem('statlab-v1');if(legacy&&confirm('이 기기에 저장된 기존 포스터를 이번 수업으로 가져올까요?'))data=JSON.parse(legacy)}catch{}}
 state=data?normalize(data):base();if(!data)state.team=info.class.grade+'학년 '+info.class.room+'반 · '+info.name;
 active=state.datasets[0].id;step=0;roleView='student';document.body.dataset.role='student';portal.hidden=true;classbar.hidden=false;
 classroom.editable=!!saved.class.active;classSession.class=saved.class;
 showBar(classroom.editable?'수업 진행 중 · 작업은 이 기기와 수업 서버에 저장돼요.':'수업이 종료되었습니다. 열람과 파일 저장만 가능합니다.');
 render();classroom.applyLock();checkTimer=setInterval(checkStudent,3000);activity();activityTimer=setInterval(()=>activity(),15000);
 if(classroom.editable)classroom.queueSave();
}
async function checkStudent(){if(roleView!=='student')return;try{const info=await callApi('student/session');
 if(info.student!==classSession.student){classroom.editable=false;showBar('다른 창에서 참여 정보가 변경되었습니다. 역할 선택 후 다시 입장하세요.');classroom.applyLock();return}
 classSession.class=info.class;classroom.editable=!!info.class?.active;
 if(!classroom.editable){clearTimeout(saveTimer);showBar('선생님이 수업을 종료했습니다. 더 이상 작성할 수 없습니다. 열람·파일 저장은 가능합니다.')}
 else if(!submitting)showBar(submittedAt?'마지막 제출: '+timeText(submittedAt)+' · 수정 후에는 다시 제출해 주세요.':'수업 진행 중 · 수업코드 '+info.class.code);
 classroom.applyLock();
 }catch(e){classroom.editable=false;showBar('수업 상태를 확인할 수 없어 편집을 잠시 멈췄어요. 연결되면 다시 확인합니다.');classroom.applyLock()}}
async function saveDraft(){
 if(!classroom.editable||roleView!=='student')return;
 if(saveRunning){saveAgain=true;return}saveRunning=true;
 try{await callApi('student/draft','PUT',{data:state});document.getElementById('saved').textContent='수업 서버에 저장됨 ✓'}
 catch(e){if(e.closed){classroom.editable=false;clearTimeout(saveTimer);showBar('수업이 종료되어 서버 저장이 중단되었습니다.');classroom.applyLock()}else document.getElementById('saved').textContent='서버 저장 실패 · 이 기기에 보관 중, 연결 후 다시 저장합니다.'}
 finally{saveRunning=false;if(saveAgain){saveAgain=false;classroom.queueSave()}}
}
portal.addEventListener('input',e=>{const f=e.target.closest('#class-create');if(f)document.getElementById('code-preview').textContent='자동 수업코드: '+(Number(f.grade.value)*100+Number(f.room.value))});
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-portal],[data-close],[data-students],[data-work]');if(!b)return;
 try{
  if(b.dataset.students){selectedClass=b.dataset.students;await refreshStudents();return}
  if(b.dataset.work){await openWork(b.dataset.work,b.dataset.submitted==='1');return}
  if(b.dataset.close){if(!confirm('이 수업을 종료할까요? 학생의 서버 저장은 즉시 차단되고, 연결된 학생 화면은 약 3초 안에 읽기 전용으로 바뀝니다.'))return;await callApi('teacher/close','POST',{id:b.dataset.close});await refreshClasses();return}
  switch(b.dataset.portal){case'submit':await submitWork();break;case'back-teacher':await teacherView();break;case'home':home();break;case'teacher':loginForm();break;case'student':studentForm();break;case'resume':await enterStudent(await callApi('student/session'));break;case'leave':if(classroom.editable)await saveDraft();home();break}
 }catch(err){message(err.message)}
});
portal.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,button=f.querySelector('button[type="submit"]');if(button)button.disabled=true;message('처리 중…');
 try{if(f.id==='teacher-login'){await callApi('teacher/login','POST',{pin:f.pin.value});await teacherView()}
 else if(f.id==='class-create'){const c=await callApi('teacher/classes','POST',{grade:f.grade.value,room:f.room.value,title:f.elements.title.value});message('수업이 개설되었습니다. 학생들에게 수업코드 '+c.code+'을 알려 주세요.');await refreshClasses()}
 else if(f.id==='student-join')await enterStudent(await callApi('student/join','POST',{code:f.code.value,name:f.elements.name.value,number:f.number.value}));
 }catch(err){message(err.message)}finally{if(button)button.disabled=false}
});
// Block stale UI events, including a file picker opened just before closure.
for(const type of ['click','input','change'])document.addEventListener(type,e=>{
 if(e.target.closest('#classroom-portal,#classroom-bar'))return;
 if(document.body.dataset.role!=='student'){e.stopImmediatePropagation();return}
 if(classroom.editable)return;
 const button=e.target.closest('button'),allowed=button&&(button.id==='save'||button.id==='prev'||button.id==='next'||['step','print'].includes(button.dataset.action));
 if(type==='click'&&allowed)return;
 if(e.target.closest('input,textarea,select,button')){e.preventDefault();e.stopImmediatePropagation();classroom.applyLock()}
},true);
document.addEventListener('visibilitychange',()=>{activity();if(!document.hidden&&roleView==='student')checkStudent()});
window.addEventListener('pagehide',()=>activity(false));
window.addEventListener('pageshow',()=>activity());
home();
