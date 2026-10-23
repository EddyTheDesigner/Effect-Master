import net from 'node:net';
export function request(port,method,params={},timeout=15000){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host:'127.0.0.1',port}),id=Date.now(),chunks=[];let length=0,done=false;
  function finish(error,result){if(done)return;done=true;socket.destroy();error?reject(error):resolve(result);}
  socket.setTimeout(timeout,()=>finish(new Error(`${method} timed out`)));
  socket.on('error',e=>finish(e));socket.on('end',()=>finish(new Error('Connection closed before a reply')));
  socket.on('connect',()=>socket.write(JSON.stringify({id,method,params})+'\n'));
  socket.on('data',chunk=>{length+=chunk.length;if(length>32*1024*1024)return finish(new Error('Reply too large'));chunks.push(chunk);if(chunk.includes(10)){
   try{const r=JSON.parse(Buffer.concat(chunks).toString('utf8').split('\n')[0]);if(r.id!==id)throw new Error('Reply ID mismatch');r.ok?finish(null,r.result):finish(new Error(r.error));}catch(e){finish(e);}
  }});
 });
}
if(process.argv[1]&&new URL(import.meta.url).pathname.toLowerCase().endsWith(process.argv[1].replaceAll('\\','/').split('/').pop().toLowerCase())){
 if(process.argv[2])console.log(JSON.stringify(await request(Number(process.argv[2]),process.argv[3],JSON.parse(process.argv[4]||'{}')),null,2));
}
