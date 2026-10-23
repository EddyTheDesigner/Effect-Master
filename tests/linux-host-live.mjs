// Exercise the Linux host protocol against isolated official Windows apps.
// This validates the adapter, not Linux desktop or application compatibility.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import bridge from '../linux/bridge.cjs';
const folder=new URL('linux-host-live/',import.meta.url),root=new URL('../',import.meta.url),p=fileURLToPath;
const vc=17985,ec=19885,children=[],passed=[];
const prefs={...bridge.settings(),vectorPort:vc,effectPort:ec};
const core=await readFile(new URL('dist/Effect Master Core.js',root),'utf8');
const cmd=(port,name,params={})=>bridge.command(port,name,params,60000);
const run=(action,newComp=false)=>bridge.execute(core,action,prefs,newComp,p(new URL('assets/',folder)));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const script=async code=>{const result=await cmd(ec,'script.run',{code:core+'\n'+code,name:'Linux host validation'});assert.ok(result.ok,JSON.stringify(result));return result.result;};
function pass(message){passed.push(message);console.log('PASS '+message);}
await Promise.all(['vc/','ec/'].map(x=>mkdir(new URL(x,folder),{recursive:true})));
await writeFile(new URL('ec/prefs.json',folder),JSON.stringify({scripting:{allowScriptsWriteFiles:true,warnOnScripts:false}}));
try{
 children.push(spawn('C:/Program Files/VectorCraft/vectorcraft.exe',[],{env:{...process.env,VECTORCRAFT_CONFIG_DIR:p(new URL('vc/',folder)),VECTORCRAFT_CONTROL_PORT:String(vc)},windowsHide:true,stdio:'ignore'}));
 children.push(spawn('C:/Program Files/EffectCraft/effectcraft.exe',[],{env:{...process.env,EFFECTCRAFT_CONFIG_DIR:p(new URL('ec/',folder)),EFFECTCRAFT_CONTROL_PORT:String(ec)},windowsHide:true,stdio:'ignore'}));
 let ready;for(let i=0;i<60;i++){ready=await bridge.inspect(prefs);if(ready.vector&&ready.effect)break;await pause(250);}assert.ok(ready.vector&&ready.effect);pass('Linux host identifies both official apps');
 await cmd(vc,'file.new',{name:'Linux host test',width:640,height:480});
 const id=(await cmd(vc,'shape.rectangle',{x:80,y:90,width:160,height:100,radius:14})).id;
 await cmd(vc,'paint.setFill',{color:'#f97354'});await cmd(vc,'stroke.set',{weight:7});
 assert.match(await run('toEffectCraft',true),/Transferred 1 layers/);pass('Host creates a matching comp and native shape');
 const layerId=await script('EffectMaster.comp().layer(1).id;');
 await script('var l=EffectMaster.comp().layer(1);l.transform.position.setValueAtTime(0,[100,100,0]);l.transform.position.setValueAtTime(2,[220,180,0]);');
 await cmd(vc,'paint.setFill',{id,color:'#4daaf0'});assert.match(await run('toEffectCraft'),/Updated 1 linked/);
 assert.equal(await script('var c=EffectMaster.comp();if(c.numLayers!==1||c.layer(1).transform.position.numKeys!==2)throw new Error("Lost identity or keys");c.layer(1).id;'),layerId);pass('Linked forward updates preserve identity and animation');
 assert.match(await run('toVectorCraft'),/Sent 1 layers/);const node=await cmd(vc,'document.node',{id});assert.equal(node.appearance.items.filter(x=>x.kind==='stroke').length,1);assert.equal(node.appearance.items.find(x=>x.kind==='stroke').width,7);assert.equal((await cmd(vc,'document.inspect')).layers[0].children.length,1);pass('Return preserves original object and editable stroke');
 assert.match(await run('copyToEffect'),/Created 1 new layers/);assert.equal(Number(await script('EffectMaster.comp().numLayers;')),2);pass('Explicit copy creates a separate layer');
 await writeFile(new URL('results.json',folder),JSON.stringify({date:new Date().toISOString(),platform:process.platform,passed},null,2));
}finally{for(const child of children)if(child.exitCode===null)child.kill();}
