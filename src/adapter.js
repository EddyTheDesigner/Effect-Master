/* UI-independent commands shared by the floating palette and future host adapters. */
(function(M){
    M.perform=function(action,options){
        var o=options||{},r,message;
        if(action==='toEffectCraft'||action==='all'){
            o.all=action==='all';r=M.pull(o);message='Transferred '+r.count+' layers to EffectCraft.';
            if(r.updated)message+=' Updated '+r.updated+' linked; created '+r.created+'.';
            if(r.warnings&&r.warnings.length)message+=' '+r.warnings.join('; ');
        }else if(action==='toVectorCraft')message='Sent '+M.push(o)+' layers to VectorCraft.';
        else if(action==='raster'){r=M.rasterize(o);message='Imported transparent 2× PNG.';if(r.warnings.length)message+=' '+r.warnings.join('; ');}
        else if(action==='update')message='Updated '+M.updateProperties(M.readSelection(),o)+' properties.';
        else if(action==='link')message='Linked '+M.linkSelected(o)+' object pair.';
        else if(action==='unlink')message='Unlinked '+M.unlink()+' layers.';
        else if(action==='unlinkVector')message='Unlinked '+M.unlinkVector()+' VectorCraft objects.';
        else if(action==='copyToEffect'){o.copy=true;r=M.pull(o);message='Created '+r.count+' new layers.';}
        else if(action==='copyToVector'){o.copy=true;message='Created copies of '+M.push(o)+' layers in VectorCraft.';}
        else if(action==='new'){
            var d=M.vc('document.inspect',{depth:0});app.beginUndoGroup('Effect Master · New composition');
            try{M.newComp(M.board({doc:d},o.artboard),o);}finally{app.endUndoGroup();}message='Created matching composition.';
        }else if(action==='swatches')message='Created '+M.swatches()+' swatches.';
        else if(action==='guides')message='Created '+M.guides(o)+' guides.';
        else if(action==='precomp'){M.precomp();message='Selection precomposed.';}
        else if(action==='decomp')message='Decomposed '+M.decomp()+' layers.';
        else if(action==='eye')message='Toggled '+M.toggleGroups()+' groups.';
        else if(action==='trash')message='Released '+M.releaseGroups()+' groups.';
        else throw new Error('Unknown Effect Master action.');
        return {message:message};
    };
})(EffectMaster);
