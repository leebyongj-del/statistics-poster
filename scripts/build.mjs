import fs from 'node:fs';
const assets={};
for(const name of fs.readdirSync('public'))assets['/'+name]=fs.readFileSync('public/'+name,'utf8');
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist/server',{recursive:true});
fs.writeFileSync('dist/server/index.js','const ASSETS='+JSON.stringify(assets)+';\n'+fs.readFileSync('worker/index.js','utf8'));
