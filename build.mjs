import {readFile,writeFile,mkdir} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
const files=['transport.js','vector.js','host.js','export.js','records.js','links.js','adapter.js','panel.js'];
const source=(await Promise.all(files.map(f=>readFile(new URL('src/'+f,root),'utf8')))).join('\n');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/Effect Master.jsx',root),'// Effect Master 0.4.0 — Linked stock-app integration\n// Generated with node build.mjs; edit src/.\n'+source);
await writeFile(new URL('dist/Effect Master Core.js',root),(await Promise.all(files.slice(0,-1).map(f=>readFile(new URL('src/'+f,root),'utf8')))).join('\n'));
console.log('Built dist/Effect Master.jsx');
