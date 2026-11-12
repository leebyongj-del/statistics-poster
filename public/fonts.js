// Only the two selected families are fetched; poster text is never sent in font URLs.
const posterFonts=[
 ['default','기본 글꼴','기본',''],
 ['noto-sans','본고딕','고딕','Noto Sans KR'],['nanum-gothic','나눔고딕','고딕','Nanum Gothic'],
 ['gothic-a1','고딕 A1','고딕','Gothic A1'],['gowun-dodum','고운돋움','고딕','Gowun Dodum'],
 ['sunflower','해바라기','고딕','Sunflower'],['coding','나눔고딕 코딩','고딕','Nanum Gothic Coding'],
 ['noto-serif','본명조','명조','Noto Serif KR'],['nanum-myeongjo','나눔명조','명조','Nanum Myeongjo'],
 ['gowun-batang','고운바탕','명조','Gowun Batang'],['hahmlet','함렛','명조','Hahmlet'],['song-myung','송명','명조','Song Myung'],
 ['black-han','검은고딕','제목·장식','Black Han Sans'],['dohyeon','도현체','제목·장식','Do Hyeon'],
 ['jua','주아체','제목·장식','Jua'],['gugi','구기체','제목·장식','Gugi'],['stylish','스타일리시','제목·장식','Stylish'],
 ['kirang','기랑해랑','제목·장식','Kirang Haerang'],['cute','귀여운 글꼴','제목·장식','Cute Font'],['dongle','동글체','제목·장식','Dongle'],
 ['gaegu','개구체','손글씨','Gaegu'],['gamja','감자꽃','손글씨','Gamja Flower'],['hi-melody','하이 멜로디','손글씨','Hi Melody'],
 ['poor-story','푸어스토리','손글씨','Poor Story'],['single-day','싱글데이','손글씨','Single Day'],['yeon-sung','연성체','손글씨','Yeon Sung'],
 ['nanum-pen','나눔손글씨 펜','손글씨','Nanum Pen Script'],['nanum-brush','나눔손글씨 붓','손글씨','Nanum Brush Script'],
 ['east-sea','동해 독도','손글씨','East Sea Dokdo'],['dokdo','독도체','손글씨','Dokdo']
];
const fontById=id=>posterFonts.find(f=>f[0]===id)||posterFonts[0];
const fontTasks=new Map();
let fontRenderVersion=0;
function fontStack(id){const f=fontById(id);return f[3]?`"${f[3]}", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`:''}
function fontControls(){
 const picker=(key,label)=>`<label>${label}<select data-scope="design" data-key="${key}">${['기본','고딕','명조','제목·장식','손글씨'].map(group=>`<optgroup label="${group}">${posterFonts.filter(f=>f[2]===group).map(f=>`<option value="${f[0]}" ${fontById(state.design[key])[0]===f[0]?'selected':''}>${f[1]}</option>`).join('')}</optgroup>`).join('')}</select></label>`;
 return `<h3>글꼴 선택 · ${posterFonts.length}가지</h3><div class="row">${picker('titleFont','제목 글꼴')}${picker('bodyFont','본문 글꼴')}</div><div class="font-preview"><strong id="font-title-preview">숫자 속에 숨은 우리의 이야기</strong><p id="font-body-preview">자료를 살펴보니 새로운 사실을 발견했어요. 평균 24.5분 · 68%</p></div><p id="font-status" class="muted" role="status"></p><p class="muted">제목 글꼴은 큰 제목에, 본문 글꼴은 설명·소제목·표와 그래프에 적용돼요. 줄기와 잎 그림은 숫자 정렬을 유지해요. 웹 글꼴을 처음 선택할 때는 인터넷 연결이 필요해요.</p>`;
}
function loadFont(id){
 const family=fontById(id)[3];if(!family)return Promise.resolve(true);
 if(fontTasks.has(family))return fontTasks.get(family);
 const task=new Promise(resolve=>{
  const link=document.createElement('link');link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family='+encodeURIComponent(family).replace(/%20/g,'+')+(family==='Sunflower'?':wght@500':'')+'&display=swap';
  const timeout=setTimeout(()=>{link.remove();resolve(false);fontTasks.delete(family)},12000);
  link.onload=()=>{clearTimeout(timeout);resolve(true)};
  link.onerror=()=>{clearTimeout(timeout);link.remove();fontTasks.delete(family);resolve(false)};
  document.head.appendChild(link);
 });fontTasks.set(family,task);return task;
}
async function readyPosterFonts(){
 const ids=[state.design.titleFont,state.design.bodyFont];
 const results=await Promise.all(ids.map(loadFont));if(results.some(v=>!v))return false;
 if(!document.fonts)return ids.every(id=>!fontById(id)[3]);
 // Load all subsets used by the current poster (including digits and punctuation).
 const text=document.getElementById('poster')?.textContent||'통계포스터 0123456789';
 try{
  const loaded=await Promise.race([
   Promise.all(ids.filter(id=>fontById(id)[3]).map(id=>document.fonts.load(`16px "${fontById(id)[3]}"`,text))),
   new Promise((_,reject)=>setTimeout(()=>reject(Error('font timeout')),12000))
  ]);
  return loaded.every(faces=>faces.length>0);
 }catch{return false}
}
function applyPosterFonts(){
 const poster=document.getElementById('poster');if(!poster)return;
 const title=fontStack(state.design.titleFont),body=fontStack(state.design.bodyFont);
 poster.style.fontFamily=body;poster.style.setProperty('--poster-title-font',title||'inherit');
 const t=document.getElementById('font-title-preview'),b=document.getElementById('font-body-preview');if(t)t.style.fontFamily=title;if(b)b.style.fontFamily=body;
 const version=++fontRenderVersion,status=document.getElementById('font-status');if(status)status.textContent='선택한 글꼴을 확인하고 있어요…';
 readyPosterFonts().then(ok=>{if(version!==fontRenderVersion)return;if(status)status.textContent=ok?'선택한 글꼴이 적용되었습니다.':'글꼴을 불러오지 못해 기본 글꼴로 표시됩니다. 인터넷 연결 후 다시 선택해 주세요.';fitPoster()});
}
if(document.fonts)document.fonts.addEventListener('loadingdone',()=>{if(typeof fitPoster==='function')fitPoster()});
