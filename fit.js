// Canonical layout is independent of viewport size, so tablet and desktop print alike.
function fitPoster(){
 const poster=document.getElementById('poster'),sheet=document.getElementById('poster-sheet');
 if(!poster||!sheet)return;
 const width=1000,height=1000*419/297;
 poster.style.width=width+'px';
 poster.classList.remove('fit-compact');
 if(poster.scrollHeight>height)poster.classList.add('fit-compact');
 // Reflow at the available width while shrinking: preserve the full sheet width.
 let low=0.0001,high=1;
 for(let i=0;i<16;i++){
  const candidate=(low+high)/2;
  poster.style.width=(width/candidate)+'px';
  if(poster.scrollHeight*candidate<=height-12 && poster.scrollWidth*candidate<=width+1)low=candidate;
  else high=candidate;
 }
 const scale=low;
 poster.style.width=(width/scale)+'px';
 const contentWidth=width/scale;
 const screen=sheet.clientWidth/width,print=297*96/25.4/width;
 poster.style.transform=`scale(${scale*screen})`;
 poster.style.left=((width-contentWidth*scale)/2*screen)+'px';
 poster.style.setProperty('--print-scale',scale*print);
 poster.style.setProperty('--print-left',((width-contentWidth*scale)/2*print)+'px');
 sheet.style.setProperty('--sheet-paper',getComputedStyle(poster).getPropertyValue('--paper'));
 sheet.dataset.fitScale=String(scale);
 const status=document.getElementById('fit-status');
 if(status)status.textContent=`A3 한 장 자동 맞춤 · ${Math.round(scale*100)}%${scale<.55?' · 내용이 많아 글씨가 작아졌어요.':''}`;
}
window.addEventListener('beforeprint',fitPoster);
window.addEventListener('afterprint',fitPoster);
window.addEventListener('resize',fitPoster);
if(document.fonts)document.fonts.ready.then(fitPoster);
new ResizeObserver(()=>fitPoster()).observe(document.getElementById('poster-sheet'));
