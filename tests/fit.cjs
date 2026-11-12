const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=readFileSync(__dirname+'/../public/fit.js','utf8');
function check(rows,viewport,overflow=1000){
 const props={};const style={setProperty:(k,v)=>props[k]=v};
 const poster={style,classList:{add(){},remove(){}},get scrollWidth(){return overflow},get scrollHeight(){return 400+rows*280*Number(props['--fit-density']||1)}};
 const sheet={clientWidth:viewport,dataset:{},style:{setProperty(){}}},status={};
 const ctx={document:{getElementById:id=>({'poster':poster,'poster-sheet':sheet,'fit-status':status}[id])},window:{addEventListener(){}},getComputedStyle:()=>({getPropertyValue:()=>''}),ResizeObserver:class{observe(){}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);ctx.fitPoster();
 const scale=Number(sheet.dataset.fitScale),density=Number(props['--fit-density']);
 assert.equal(style.width,'1000px','full-width cards must never widen the canvas');
 assert(scale>0&&scale<=1);
 assert(poster.scrollHeight*scale<1000*419/297);
 assert(poster.scrollWidth*scale<=1000);
 const expected=scale*297*96/25.4/1000;
 assert(Math.abs(props['--print-scale']-expected)<1e-12);
 const first=style.transform;ctx.fitPoster();assert.equal(style.transform,first,'repeated fitting must be stable');
 return {scale,density};
}
assert(check(3,700).scale>.9,'three full-width graphs should not collapse to microscopic size');
for(const viewport of [320,700,1122])for(const rows of [0,3,8,72])check(rows,viewport);
check(72,700,1400);
console.log('PASS: fixed-width fitting, 3 full-width charts, overflow, 72 cards, repeated calls, screen/print scaling');
