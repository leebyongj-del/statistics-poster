// Canonical layout is independent of viewport size, so tablet and desktop print alike.
function fitPoster(){
 const poster=document.getElementById('poster'),sheet=document.getElementById('poster-sheet');
 if(!poster||!sheet)return;
 const width=1000,height=1000*419/297;
 poster.style.width=width+'px';
 poster.style.setProperty('--fit-density',1);
 poster.classList.remove('fit-compact');
 if(poster.scrollHeight>height)poster.classList.add('fit-compact');
 // Never widen the layout to fit: a full-width SVG grows with that width,
 // making the old inverse-width search unable to converge for stacked charts.
 // Compact the fixed-width layout first, then uniformly scale as a final fallback.
 let density=1;
 poster.style.setProperty('--fit-density',density);
 for(const candidate of [1,.9,.8,.7,.6]){
  density=candidate;
  poster.style.setProperty('--fit-density',density);
  if(poster.scrollHeight<=height-12)break;
 }
 const contentWidth=Math.max(width,poster.scrollWidth);
 const contentHeight=Math.max(1,poster.scrollHeight);
 const scale=Math.min(1,(width-12)/contentWidth,(height-12)/contentHeight);
 const screen=sheet.clientWidth/width,print=297*96/25.4/width;
 poster.style.transform=`scale(${scale*screen})`;
 poster.style.left=((width-contentWidth*scale)/2*screen)+'px';
 poster.style.setProperty('--print-scale',scale*print);
 poster.style.setProperty('--print-left',((width-contentWidth*scale)/2*print)+'px');
 sheet.style.setProperty('--sheet-paper',getComputedStyle(poster).getPropertyValue('--paper'));
 sheet.dataset.fitScale=String(scale);
 const status=document.getElementById('fit-status');
 if(status)status.textContent=`A3 한 장 자동 맞춤 · ${Math.round(scale*density*100)}%${scale*density<.55?' · 내용이 많아 글씨가 작아졌어요.':''}`;
}
window.addEventListener('beforeprint',fitPoster);
window.addEventListener('afterprint',fitPoster);
window.addEventListener('resize',fitPoster);
if(document.fonts)document.fonts.ready.then(fitPoster);
new ResizeObserver(()=>fitPoster()).observe(document.getElementById('poster-sheet'));
