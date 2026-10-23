import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {request} from '../tools/control.mjs';
const root=new URL('../',import.meta.url),dir=new URL('palette-live/',import.meta.url),p=u=>fileURLToPath(u);
const vc=17983,ec=19881,palette=19882,children=[],passed=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const cmd=(port,command,params={})=>request(port,'engine.execute',{command,params},45000);
async function until(fn,label){let last;for(let i=0;i<80;i++){try{last=await fn();if(last)return last;}catch(e){last=e.message;}await pause(250);}throw new Error(label+': '+JSON.stringify(last));}
function pass(text){passed.push(text);console.log('PASS '+text);}
async function script(code){let result=await cmd(ec,'script.run',{code,name:'Palette verification'});assert.ok(result.ok,JSON.stringify(result));return result;}
async function click(id,expected){await request(palette,'test.click',{id});let result=await until(async()=>{let r=await request(palette,'test.status');if(r.busy)return false;if(r.error)throw new Error(r.message);return r.message.startsWith(expected)&&r;},id+' completes');assert.ok(result.message.startsWith(expected));pass(id+': '+result.message);}
await Promise.all(['vectorcraft/','effectcraft/','palette/','assets/'].map(name=>mkdir(new URL(name,dir),{recursive:true})));
await writeFile(new URL('effectcraft/prefs.json',dir),JSON.stringify({scripting:{allowScriptsWriteFiles:true,warnOnScripts:false}}));
await writeFile(new URL('palette/settings.json',dir),JSON.stringify({vectorPort:vc,effectPort:ec,assetFolder:p(new URL('assets/',dir)),pinned:false,left:100,top:100}));
try{
 children.push(spawn('C:/Program Files/VectorCraft/vectorcraft.exe',[],{windowsHide:true,env:{...process.env,VECTORCRAFT_CONFIG_DIR:p(new URL('vectorcraft/',dir)),VECTORCRAFT_CONTROL_PORT:String(vc)},stdio:'ignore'}));
 children.push(spawn('C:/Program Files/EffectCraft/effectcraft.exe',[],{windowsHide:true,env:{...process.env,EFFECTCRAFT_CONFIG_DIR:p(new URL('effectcraft/',dir)),EFFECTCRAFT_CONTROL_PORT:String(ec)},stdio:'ignore'}));
 await Promise.all([until(()=>request(vc,'ui.inspect',{},1000),'VectorCraft'),until(()=>request(ec,'ui.inspect',{},1000),'EffectCraft')]);
 children.push(spawn(p(new URL('dist/Effect Master.exe',root)),['--profile',p(new URL('palette/',dir)),'--vector-port',String(vc),'--effect-port',String(ec),'--test-port',String(palette)],{windowsHide:false,stdio:'ignore'}));
 await until(async()=>{let s=await request(palette,'test.status');return s.vector&&s.effect;},'Palette automatic connection');pass('Palette automatically connects to both stock apps started with zero command-line arguments');
 await cmd(vc,'file.new',{name:'Palette live test',width:640,height:480,units:'Pixels',colorMode:'rgb'});
 const a=await cmd(vc,'shape.rectangle',{x:80,y:80,width:180,height:140,radius:18});await cmd(vc,'paint.setFill',{color:'#f97354'});
 const b=await cmd(vc,'shape.ellipse',{x:230,y:180,width:140,height:140});await cmd(vc,'paint.setFill',{color:'#4daaf0'});
 await cmd(vc,'select.set',{ids:[a.id,b.id]});
 await click('new','Created matching composition');
 await click('push','Transferred 2 layers');
 await script('var c=app.project.activeItem;if(c.numLayers!==2||c.layer(1).name!=="Ellipse"||c.layer(2).name!=="Rounded Rectangle")throw new Error("Layer count or paint order changed");');pass('Real Push button preserves two editable layers, names and paint order');
 await pause(2200);await script('if(app.project.activeItem.numLayers!==2)throw new Error("Repeated transfer");');pass('Status refresh never repeats a transfer');
 await click('pull','Sent 2 layers');
 assert.equal((await cmd(vc,'document.inspect',{})).layers[0].children.length,2);pass('Real Pull button updates the two original VectorCraft objects without copies');
 await cmd(vc,'select.set',{ids:[a.id,b.id]});
 await click('raster','Imported transparent 2× PNG');
 await script('if(app.project.activeItem.numLayers!==3)throw new Error("Missing PNG layer");');
 await request(palette,'test.click',{id:'split'});assert.equal((await request(palette,'test.status')).mode,'split');pass('Transfer mode button changes the actual palette setting');
 await request(palette,'test.click',{id:'center'});assert.equal((await request(palette,'test.status')).center,true);pass('Center toggle changes the actual palette setting');
 await click('new','Created matching composition');await click('push','Transferred 2 layers');
 const shot=await request(palette,'test.screenshot');await writeFile(new URL('Effect-Master-floating.png',dir),Buffer.from(shot.pngBase64,'base64'));
 await request(ec,'render.frame',{path:p(new URL('transfer.png',dir)),max_side:640});
 await cmd(vc,'select.none');await request(palette,'test.click',{id:'push'});
 const error=await until(async()=>{let s=await request(palette,'test.status');return !s.busy&&s.error&&s;},'Empty selection error');assert.match(error.message,/Select artwork/);pass('An empty selection reports the actual transfer error in the palette');
 await cmd(vc,'select.set',{ids:[a.id,b.id]});await click('push','Transferred 2 layers');pass('A failed transfer does not disable subsequent valid transfers');
 await cmd(ec,'file.installScriptUIPanel',{path:p(new URL('dist/Effect Master.jsx',root))});
 await script('app.settings.saveSetting("Effect Master","settings",'+JSON.stringify(JSON.stringify({connectionVersion:3,port:vc,assetFolder:p(new URL('assets/',dir))}))+');');
 await cmd(ec,'window.scriptPanel',{name:'Effect Master.jsx'});
 await cmd(ec,'scriptui.click',{window:'Effect Master',widget:'pull'});
 await script('if(app.project.activeItem.numLayers!==2)throw new Error("Dockable panel duplicated linked artwork");');
 await cmd(ec,'scriptui.close',{window:'Effect Master'});pass('Optional EffectCraft dockable panel also transfers through the stock connection');
 children[0].kill();children[1].kill();
 await until(async()=>{let s=await request(palette,'test.status');return !s.vector&&!s.effect;},'Disconnected apps');pass('Closing either app is reflected automatically without a frozen palette');
 await pause(800);
 children.push(spawn('C:/Program Files/VectorCraft/vectorcraft.exe',[],{windowsHide:true,env:{...process.env,VECTORCRAFT_CONFIG_DIR:p(new URL('vectorcraft/',dir)),VECTORCRAFT_CONTROL_PORT:String(vc)},stdio:'ignore'}));
 children.push(spawn('C:/Program Files/EffectCraft/effectcraft.exe',[],{windowsHide:true,env:{...process.env,EFFECTCRAFT_CONFIG_DIR:p(new URL('effectcraft/',dir)),EFFECTCRAFT_CONTROL_PORT:String(ec)},stdio:'ignore'}));
 await until(async()=>{let s=await request(palette,'test.status');return s.vector&&s.effect;},'Reconnected apps');pass('Both apps reconnect after restarting without restarting the palette');
 await cmd(vc,'file.new',{name:'Reconnect test',width:640,height:480});await cmd(vc,'shape.rectangle',{x:20,y:20,width:60,height:80});
 await click('new','Created matching composition');await click('push','Transferred 1 layers');pass('Transfers still work after reconnecting');
 await request(palette,'test.click',{id:'effectView'});const effectView=await request(palette,'test.status');assert.ok(effectView.visibleActions.includes('precomp')&&!effectView.visibleActions.includes('swatches'));pass('EffectCraft view shows group actions instead of VectorCraft artboard actions');
 const effectShot=await request(palette,'test.screenshot');await writeFile(new URL('Effect-Master-effect-view.png',dir),Buffer.from(effectShot.pngBase64,'base64'));
 await request(palette,'test.click',{id:'vectorView'});const vectorView=await request(palette,'test.status');assert.ok(vectorView.visibleActions.includes('swatches')&&!vectorView.visibleActions.includes('precomp'));pass('VectorCraft view restores its own artboard actions');
 await click('copyToVector','Created copies of 1');
 let paths=0;function countPaths(n){const items=n.appearance?.items||[];if(n.kind.type==='path'&&items.some(i=>i.kind==='fill'&&i.paint.type!=='none')&&items.some(i=>i.kind==='stroke'&&i.paint.type!=='none'))paths++;(n.kind.children||[]).forEach(countPaths);} for(const l of (await cmd(vc,'document.inspect',{})).layers)countPaths(await cmd(vc,'document.node',{id:l.id}));assert.equal(paths,2);pass('Explicit reverse copy creates one filled and stroked shape, not separate paint shapes');
 await cmd(vc,'select.set',{ids:[2]});await cmd(vc,'stroke.set',{weight:13});
 await script('var l=app.project.activeItem.layer(1);function find(p){if(p.matchName==="ADBE Vector Stroke Width")return p;for(var i=1;i<=p.numProperties;i++){var r=find(p.property(i));if(r)return r;}}l.selected=false;find(l).selected=true;');
 await click('update','Updated 1 properties');pass('Actual Update properties button updates stroke width without creating a layer');
 await request(palette,'test.close');await pause(600);
 const saved=JSON.parse(await readFile(new URL('palette/settings.json',dir),'utf8'));assert.equal(saved.mode,'split');assert.equal(saved.center,true);pass('Palette preferences persist across closing');
 await writeFile(new URL('results.json',dir),JSON.stringify({date:new Date().toISOString(),passed},null,2));console.log('PASS TOTAL '+passed.length);
}finally{if(!process.argv.includes('--keep-apps'))for(const child of children)if(child.exitCode===null)child.kill();}
