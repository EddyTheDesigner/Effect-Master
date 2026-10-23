/* Local JSON-line connection to VectorCraft. No daemon, HTTP server, or cloud. */
var EffectMaster = (function () {
    var M={version:'0.4.0',port:7979,serial:0,timeout:8};
    M.assert=function(ok,message){if(!ok)throw new Error(message);};
    M.clone=function(v){return JSON.parse(JSON.stringify(v));};
    M.rpc=function(method,params){
        M.assert(M.port>=1024&&M.port<=65535&&Math.floor(M.port)===M.port,'Connection port must be 1024–65535.');
        var socket;
        try{socket=new Socket();}catch(e){throw new Error('Enable Allow Scripts to Write Files and Access Network in EffectCraft Settings > Scripting & Expressions.');}
        socket.timeout=M.timeout;
        try{
            M.assert(socket.open('127.0.0.1:'+M.port,'UTF-8'),'VectorCraft is not connected. Open Effect Master, then open VectorCraft. After first setup, save and restart VectorCraft once.');
            var id=++M.serial,request=JSON.stringify({id:id,method:method,params:params||{}});
            M.assert(request.length<1000000,'Transfer is too large for one request. Transfer a smaller selection.');
            M.assert(socket.writeln(request),'Could not send to VectorCraft: '+socket.error);
            var line=socket.readln();
            M.assert(line&&line.length,'VectorCraft did not reply. Check its window before retrying; a timed-out edit might still finish.');
            var reply=JSON.parse(line);
            M.assert(reply.id===id,'Unexpected VectorCraft reply.');
            M.assert(reply.ok,reply.error||'VectorCraft rejected this action.');
            return reply.result;
        }finally{socket.close();}
    };
    M.vc=function(command,params){return M.rpc('engine.execute',{command:command,params:params||{}});};
    M.readSelection=function(all){
        var doc=M.vc('document.inspect',{}),ids=all?[]:doc.selection.slice(),flat={},order=[],parents={};
        function walk(nodes,parent,hidden){for(var i=nodes.length-1;i>=0;i--){var n=nodes[i];flat[n.id]=n;parents[n.id]=parent;order.push(n.id);var hide=hidden||n.visible===false||n.template;if(all&&!hide&&n.kind!=='Layer'&&parent!==null&&flat[parent].kind==='Layer')ids.push(n.id);if(n.children)walk(n.children,n.id,hide);}}
        walk(doc.layers,null,false);
        var chosen={};for(var i=0;i<ids.length;i++)chosen[ids[i]]=true;
        ids=order.filter(function(id){if(!chosen[id])return false;var p=parents[id];while(p!==null&&p!==undefined){if(chosen[p])return false;p=parents[p];}return true;});
        ids.forEach(function(id){var p=parents[id];while(p!==null&&p!==undefined){var a=flat[p];M.assert(!a.clip&&(a.opacity===undefined||a.opacity===1)&&(!a.blend||a.blend==='Normal'),'Select the enclosing clipped/translucent group instead of its child.');p=parents[p];}});
        M.assert(ids.length,'Select artwork in VectorCraft first.');
        M.assert(ids.length<=500,'Transfer at most 500 top-level objects at once.');
        var nodes=ids.map(function(id){return M.vc('document.node',{id:id});});
        var after=M.vc('document.inspect',{depth:0});
        M.assert(after.revision===doc.revision&&after.title===doc.title&&after.path===doc.path,'VectorCraft changed during the read. Try again.');
        return {doc:doc,nodes:nodes,summaries:flat};
    };
    return M;
})();
