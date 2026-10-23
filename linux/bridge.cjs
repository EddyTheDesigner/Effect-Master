const net = require('node:net');
let serial = 0;
const actions = new Set(['toEffectCraft','toVectorCraft','raster','update','link','unlink','unlinkVector','copyToEffect','copyToVector','new','all','swatches','guides','precomp','decomp','eye','trash']);
const defaults = {vectorPort:7979,effectPort:7978,accent:'Coral',roundness:8,mode:'normal',center:false,artboard:-1,fps:30,duration:10,assetFolder:'',pinned:true,view:'vector',vectorPath:'',effectPath:''};
function settings(input={}) {
  const o={...defaults};
  for(const key of ['vectorPort','effectPort','roundness','artboard','fps','duration']) {
    const ranges={vectorPort:[1024,65535],effectPort:[1024,65535],roundness:[0,16],artboard:[-1,9999],fps:[1,120],duration:[0.1,10800]};
    const n=Number(input[key]),[min,max]=ranges[key];
    if(Number.isFinite(n)&&n>=min&&n<=max&&(key==='duration'||Number.isInteger(n)))o[key]=n;
  }
  for(const [key,values] of Object.entries({accent:['Coral','Lime','Blue','Violet'],mode:['normal','split','combine'],view:['vector','effect']}))if(values.includes(input[key]))o[key]=input[key];
  for(const key of ['center','pinned'])if(typeof input[key]==='boolean')o[key]=input[key];
  for(const key of ['assetFolder','vectorPath','effectPath'])if(typeof input[key]==='string'&&input[key].length<4096&&!/[\r\n\0]/.test(input[key]))o[key]=input[key];
  return o;
}
function rpc(port,method,params={},timeout=2500) {
  return new Promise((resolve,reject)=>{
    const id=++serial,socket=net.createConnection({host:'127.0.0.1',port});
    let data='',done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(deadline);socket.destroy();error?reject(error):resolve(value);};
    const deadline=setTimeout(()=>finish(new Error('No completion reply. Check the app before retrying; the operation may still finish.')),timeout);
    socket.setEncoding('utf8');
    socket.on('connect',()=>socket.write(JSON.stringify({id,method,params})+'\n'));
    socket.on('error',e=>finish(e));
    socket.on('end',()=>finish(new Error('Connection closed before a reply. Check the app before retrying.')));
    socket.on('data',chunk=>{
      data+=chunk;
      if(data.length>33554432)return finish(new Error('Application reply is too large.'));
      const end=data.indexOf('\n');if(end<0)return;
      try{const reply=JSON.parse(data.slice(0,end));if(reply.id!==id)throw new Error('Unexpected application reply.');if(!reply.ok)throw new Error(typeof reply.error==='string'?reply.error:JSON.stringify(reply.error));finish(null,reply.result);}catch(e){finish(e);}
    });
  });
}
const command=(port,name,params={},timeout)=>rpc(port,'engine.execute',{command:name,params},timeout);
async function inspect(o) {
  const state={vector:false,effect:false,document:'Offline — click to open',composition:'Offline — click to open'};
  await Promise.all([
    (async()=>{try{const ui=await rpc(o.vectorPort,'ui.inspect');if(!ui||!('documents'in ui)||!('tool'in ui))return;state.vector=true;state.document='No document';try{state.document=(await command(o.vectorPort,'document.inspect',{depth:0})).title||'Untitled';}catch{}}catch{}})(),
    (async()=>{try{const cap=await command(o.effectPort,'app.capabilities');if(!cap?.scripting)return;state.effect=true;state.composition='No composition';try{state.composition=(await command(o.effectPort,'comp.info')).name||'Composition';}catch{}}catch{}})()
  ]);return state;
}
function script(core,action,o,newComp,assetFolder) {
  if(!actions.has(action))throw new Error('Unknown transfer action.');
  const options={...settings(o),port:o.vectorPort,newComp:!!newComp};
  return core+'\n(function(){var M=EffectMaster,o='+JSON.stringify(options)+';M.port=o.port;if(!o.assetFolder&&!app.project.file)o.assetFolder='+JSON.stringify(assetFolder)+';return JSON.stringify(M.perform('+JSON.stringify(action)+',o));})();';
}
async function execute(core,action,o,newComp,assetFolder) {
  const result=await command(o.effectPort,'script.run',{code:script(core,action,o,newComp,assetFolder),name:'Effect Master — '+action},120000);
  if(!result?.ok)throw new Error(typeof result?.error==='string'?result.error:result?.error?.message||'EffectCraft rejected the script.');
  try{return JSON.parse(result.result).message||'Transfer completed.';}catch{throw new Error('Unexpected completion result. Check EffectCraft before retrying.');}
}
module.exports={settings,rpc,command,inspect,script,execute};
