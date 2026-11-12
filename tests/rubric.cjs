const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('public/app.js','utf8');
const ctx={crypto:require('node:crypto').webcrypto,Stats:require('../public/stats.js')};vm.createContext(ctx);
vm.runInContext(fs.readFileSync('public/fonts.js','utf8').split('const fontTasks')[0],ctx);
vm.runInContext(src.slice(0,src.indexOf('let state=base()'))+';this.normalizeState=normalize;',ctx);
const original={motivation:'선정 계기',proposal:'실천 방안',reflection:'느낀 점',datasets:[{id:'a',name:'자료',source:'우리 반 설문',frequencyUnit:'명',unit:'분'}],cards:[{datasetId:'a',tool:'histogram'}]};
const roundtrip=ctx.normalizeState(JSON.parse(JSON.stringify(original)));
for(const k of ['motivation','proposal','reflection'])assert.equal(roundtrip[k],original[k]);
assert.equal(roundtrip.datasets[0].source,'우리 반 설문');assert.equal(roundtrip.datasets[0].frequencyUnit,'명');
const old=ctx.normalizeState({datasets:[{id:'a',name:'old'}],cards:[]});assert.equal(old.motivation,'');assert.equal(old.datasets[0].source,'');
assert(src.includes('esc(state.proposal)'));assert(src.includes('esc(state.reflection)'));assert(src.includes('esc(d.source)'));
console.log('PASS: rubric fields survive file normalization; old files remain compatible.');

const fonts=ctx.normalizeState({...original,design:{titleFont:'jua',bodyFont:'nanum-myeongjo'}});assert.equal(fonts.design.titleFont,'jua');assert.equal(fonts.design.bodyFont,'nanum-myeongjo');assert.equal(old.design.titleFont,'default');assert.equal(ctx.normalizeState({design:{titleFont:'bad'}}).design.titleFont,'default');console.log('PASS: independent fonts survive saved work; legacy/invalid fonts fall back.');
