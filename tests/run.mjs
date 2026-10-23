import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),here=new URL('./',import.meta.url);
const vc='C:/Program Files/VectorCraft/vectorcraft-cli.exe',ec='C:/Program Files/EffectCraft/effectcraft-cli.exe';
const run=(exe,args)=>execFileSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024});
await mkdir(new URL('fixtures/',here),{recursive:true});
const samples={
 rectangle:[['shape.rectangle',{x:80,y:90,width:160,height:100,radius:14}],['paint.setFill',{color:'#f97354'}]],
 ellipse:[['shape.ellipse',{x:270,y:100,width:90,height:140}],['paint.setFill',{color:'#4daaf0'}]],
 bezier:[['path.create',{anchors:[{x:30,y:40,out:[80,0]},{x:160,y:140,in:[200,20]},{x:40,y:180}],closed:true}],['paint.setFill',{color:'#80d060'}]],
 gradient:[['shape.rectangle',{x:70,y:60,width:250,height:170}],['paint.setFill',{gradient:{kind:'linear',stops:[{offset:0,color:'#ff0000'},{offset:1,color:'#0000ff'}]}}]],
 radial:[['shape.ellipse',{x:70,y:60,width:180,height:180}],['paint.setFill',{gradient:{kind:'radial',stops:[{offset:0,color:'#ffffff'},{offset:1,color:'#0000ff'}]}}]],
 text:[['text.create',{x:60,y:150,text:'Effect Master',font:'Arial',size:36,color:'#f97354'}]],
 area:[['text.create',{x:100,y:200,text:'Effect Master has editable type.\nSecond line.',font:'Arial',size:24,color:'#f97354',area:{width:240,height:120}}]],
 group:[['shape.rectangle',{x:60,y:70,width:130,height:80}],['paint.setFill',{color:'#f97354'}],['shape.ellipse',{x:120,y:110,width:100,height:100}],['paint.setFill',{color:'#4daaf0'}],['select.all',{}],['object.group',{}]],
 clip:[['shape.rectangle',{x:30,y:30,width:80,height:80}],['shape.ellipse',{x:20,y:20,width:130,height:130}],['select.all',{}],['object.clippingMask.make',{}]],
};
const fixtures={};
for(const [name,steps] of Object.entries(samples)){
 const args=['run','--cmd','file.new','--params',JSON.stringify({name:'Effect Master '+name,width:640,height:480,units:'Pixels',colorMode:'rgb'})];
 for(const [id,params] of steps)args.push('--cmd',id,'--params',JSON.stringify(params));
 args.push('--cmd','select.all','--cmd','document.node','--params','{"id":1}','--cmd','document.inspect');
 try{
 const out=run(vc,args).trim().split(/\r?\n/).map(JSON.parse),node=out.find(x=>x.command==='document.node').result,doc=out.find(x=>x.command==='document.inspect').result;
 const summaries={};function walk(nodes){for(const n of nodes){summaries[n.id]=n;if(n.children)walk(n.children);}}walk(doc.layers);
 fixtures[name]={doc,nodes:node.kind.children,summaries};
 await writeFile(new URL('fixtures/'+name+'.json',here),JSON.stringify(fixtures[name],null,2));
 }catch(e){console.error('Fixture failed:',name,e.stdout?.toString(),e.stderr?.toString());throw e;}
}
const source=(await Promise.all(['transport.js','vector.js','host.js','export.js'].map(f=>readFile(new URL('src/'+f,root),'utf8')))).join('\n');
const body=await readFile(new URL('engine-tests.js',here),'utf8');
const script=new URL('generated-engine.jsx',here);
await writeFile(script,source+'\nvar fixtures='+JSON.stringify(fixtures)+';\n'+body);
const output=run(ec,['script',fileURLToPath(script),'--empty','--save-as',fileURLToPath(new URL('engine-demo.ecproj',here))]);
await writeFile(new URL('engine-results.txt',here),output);console.log(output);
