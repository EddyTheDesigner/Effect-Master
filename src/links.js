/* Persistent object links. Stock VectorCraft stores data on nodes; EffectCraft stores it
   in layer comments. Names, selection order and process-local node IDs are not identities. */
(function(M){
    var create=M.importSnapshot,place=M.push;
    M.linkId=function(n){var data=n.attrs&&n.attrs.data||[];for(var i=0;i<data.length;i++)if(data[i][0]==='effect-master')return data[i][1];return null;};
    function uuid(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);});}
    function walk(n,fn){fn(n);(n.kind.children||[]).forEach(function(c){walk(c,fn);});}
    function key(ids){return ids.slice().sort().join('|');}
    function tokens(p,snapshot){return (p.ids||[p.node.id]).map(function(id){var n; snapshot.nodes.forEach(function(root){walk(root,function(x){if(x.id===id)n=x;});});return M.linkId(n);});}
    function leaves(nodes){var out=[];nodes.forEach(function(n){if(n.visible===false)return;if(n.kind.type==='path'||n.kind.type==='compound')out.push(n);else if(n.kind.children)out=out.concat(leaves(n.kind.children));});return out;}
    M.linkDocument=function(doc){var all={},byId={},uneditable={};function scan(n,locked){locked=locked||n.locked||n.visible===false;byId[n.id]=n;uneditable[n.id]=locked;var id=M.linkId(n);if(id){if(!all[id])all[id]=[];all[id].push(n);}(n.kind.children||[]).forEach(function(c){scan(c,locked);});}doc.layers.forEach(function(layer){scan(M.vc('document.node',{id:layer.id}),false);});return {byId:byId,tokens:all,uneditable:uneditable};};
    function prepare(snapshot){
        var all=M.linkDocument(snapshot.doc),commands=[];
        snapshot.nodes.forEach(function(root){walk(root,function(n){var id=M.linkId(n);M.assert(!id||all.tokens[id].length===1,'Duplicate object link in VectorCraft. Use Unlink on the duplicate before transferring.');if(!id){id=uuid();commands.push({command:'object.setProps',params:{id:n.id,data:{'effect-master':id}}});n.attrs=n.attrs||{};n.attrs.data=n.attrs.data||[];n.attrs.data.push(['effect-master',id]);}});});
        if(commands.length)M.vc('command.batch',{commands:commands,label:'Effect Master · Link artwork'});
        return snapshot;
    }
    function tagLayer(l,p,snapshot,board){
        var tag=M.tag(l)||{effectMaster:1,type:p.kind==='group'?'group':'art',priorComment:l.comment||''};
        tag.linkVersion=1;tag.tokens=tokens(p,snapshot);tag.origin={x:board.x,y:board.y};tag.kind=p.kind;
        tag.source=snapshot.doc.path||snapshot.doc.title;tag.ids=p.ids||[p.node.id];tag.parts=[];
        if(p.kind==='shape'&&!p.mask){
            var source=p.ids?snapshot.nodes:[p.node],nodes=leaves(source),records=M.vectorRecords(l,false);
            M.assert(records.length===nodes.length,'This artwork cannot be linked without losing its shape structure.');
            records.forEach(function(r,i){tag.parts.push({token:M.linkId(nodes[i]),route:r.route,ancestorOpacity:r.opacity/(nodes[i].opacity===undefined?1:nodes[i].opacity)});});
        }
        l.comment=JSON.stringify(tag);
    }
    function findLayer(c,ids){var result=[];for(var i=1;i<=c.numLayers;i++){var l=c.layer(i),t=M.tag(l);if(t&&t.tokens&&key(t.tokens)===key(ids))result.push(l);}
        M.assert(result.length<=1,'More than one EffectCraft layer has this link. Unlink the copy before updating.');return result[0]||null;
    }
    function collect(target,source,jobs,explicit){
        M.assert(target.matchName===source.matchName,'The shape structure changed. Keep the existing shape type, or use Send copy.');
        if(source.numProperties){
            // Existing modifiers and effects are left alone. Source children must have an
            // unambiguous counterpart; never remove/recreate a property that may be animated.
            var counts={};for(var i=1;i<=source.numProperties;i++){var sp=source.property(i),m=sp.matchName,n=counts[m]||0;counts[m]=n+1;var matches=[];
                for(var j=1;j<=target.numProperties;j++){var tp=target.property(j);if(tp.matchName===m)matches.push(tp);}
                M.assert(matches[n],'An existing fill, stroke or geometry property is missing. Add the matching property first, or use Send copy.');
                collect(matches[n],sp,jobs,explicit);
            }
            for(var j=1;j<=target.numProperties;j++){
                var extra=target.property(j),match=extra.matchName;
                if(!counts[match]&&['ADBE Vector Graphic - Fill','ADBE Vector Graphic - Stroke','ADBE Vector Graphic - G-Fill','ADBE Vector Graphic - G-Stroke'].indexOf(match)>=0){
                    var opacity=extra.property(match.indexOf('Stroke')>=0?'ADBE Vector Stroke Opacity':'ADBE Vector Fill Opacity');
                    if(opacity){if(opacity.numKeys||opacity.expressionEnabled)jobs.skipped++;else if(opacity.value!==0)jobs.push({property:opacity,value:0,old:opacity.value});}
                }
            }
        }else if(target.propertyValueType!==PropertyValueType.NO_VALUE){
            if(target.expressionEnabled||(!explicit&&target.numKeys)){jobs.skipped++;return;}
            var next=source.value,old=target.value;
            function comparable(v){return v&&v.vertices?{vertices:v.vertices,inTangents:v.inTangents,outTangents:v.outTangents,closed:v.closed}:v;}
            if(JSON.stringify(comparable(next))!==JSON.stringify(comparable(old)))jobs.push({property:target,value:next,old:old});
        }
    }
    function apply(jobs,c){var done=[];try{jobs.forEach(function(j){var p=j.property;j.animated=p.numKeys>0;j.existingKey=0;if(j.animated){for(var k=1;k<=p.numKeys;k++)if(Math.abs(p.keyTime(k)-c.time)<1e-7){j.existingKey=k;j.old=p.keyValue(k);}p.setValueAtTime(c.time,j.value);}else p.setValue(j.value);done.push(j);});}catch(e){for(var i=done.length-1;i>=0;i--)try{var d=done[i];if(!d.animated)d.property.setValue(d.old);else if(d.existingKey)d.property.setValueAtKey(d.existingKey,d.old);else {for(var k=d.property.numKeys;k>=1;k--)if(Math.abs(d.property.keyTime(k)-c.time)<1e-7)d.property.removeKey(k);}}catch(ignore){}throw e;}}
    function root(l,kind){if(kind==='shape')return l.property('ADBE Root Vectors Group');if(kind==='text')return l.property('ADBE Text Properties').property('ADBE Text Document');return null;}
    M.pull=function(options){
        var o=options||{},snapshot=M.readSelection(o.all),plan=M.plan(snapshot,o),c=o.newComp?null:M.comp();
        if(o.copy)return create(snapshot,o);
        prepare(snapshot);var targets=plan.items.map(function(p){var ids=tokens(p,snapshot),found=c&&findLayer(c,ids);if(c&&!found){for(var i=1;i<=c.numLayers;i++){var t=M.tag(c.layer(i));if(t&&t.tokens){var represented=t.tokens.concat((t.parts||[]).map(function(x){return x.token;}));M.assert(!ids.some(function(id){return represented.indexOf(id)>=0;}),'This object belongs to a larger linked layer. Select its original group and transfer mode, or use Send copy.');}}}return found;});
        targets.forEach(function(l,i){if(l){M.assert(!l.locked,'Unlock the linked EffectCraft layer before updating.');M.assert(plan.items[i].kind!=='image','Linked image updates are not supported yet. Use Send copy.');var t=M.tag(l),p=plan.items[i];if(t.parts&&t.parts.length){var keys=leaves(p.ids?snapshot.nodes:[p.node]).map(M.linkId);M.assert(JSON.stringify(keys)===JSON.stringify(t.parts.map(function(x){return x.token;})),'The source group membership or order changed. Keep the linked structure or send a copy.');}}});
        targets.forEach(function(l,i){if(l)M.assert(M.tag(l).kind===plan.items[i].kind,'The linked transfer mode changed. Use the original mode or Send copy.');});
        var result,created=[],jobs=[],selectionBefore=c?c.selectedLayers.slice():[];jobs.skipped=0;
        app.beginUndoGroup('Effect Master · Linked transfer');
        try{
            result=create(snapshot,o);created=result.layers.slice();c=result.comp;
            // Validate every pair before modifying any existing layer.
            targets.forEach(function(l,i){if(l){var p=plan.items[i];if(p.kind==='group')return;var a=root(l,p.kind),b=root(created[i],p.kind);M.assert(a&&b,'Linked layer type has changed.');collect(a,b,jobs,false);if(p.mask)collect(l.property('ADBE Mask Parade'),created[i].property('ADBE Mask Parade'),jobs,false);}});
            created.forEach(function(l,i){if(!targets[i])tagLayer(l,plan.items[i],snapshot,plan.board);});
            apply(jobs,c);
            created.forEach(function(l,i){if(targets[i]){l.remove();result.layers[i]=targets[i];}else if(plan.items[i].parent){var pi=plan.items.indexOf(plan.items[i].parent);l.setParentWithJump(targets[pi]||created[pi]);}});
            for(var i=1;i<=c.numLayers;i++)c.layer(i).selected=false;result.layers.forEach(function(l){l.selected=true;});
            result.updated=targets.filter(function(l){return !!l;}).length;result.created=result.count-result.updated;
            result.warnings=jobs.skipped?[jobs.skipped+' animated or expression-driven properties preserved. Use Update properties to set a pose.']:[];
            return result;
        }catch(e){created.forEach(function(l){try{l.remove();}catch(ignore){}});selectionBefore.forEach(function(l){try{l.selected=true;}catch(ignore){}});throw e;}finally{app.endUndoGroup();}
    };
    M.linkSelected=function(o){
        var snapshot=M.readSelection(),c=M.comp(),selected=c.selectedLayers.slice(),plan=M.plan(snapshot,o||{});
        M.assert(snapshot.nodes.length===1&&selected.length===1&&plan.items.length===1,'Select one object in VectorCraft and one matching layer in EffectCraft to link them.');
        M.assert(!selected[0].locked,'Unlock the layer first.');prepare(snapshot);
        var existing=findLayer(c,tokens(plan.items[0],snapshot));M.assert(!existing||existing.id===selected[0].id,'This object is already linked to another layer in this composition.');
        app.beginUndoGroup('Effect Master · Link selected');try{tagLayer(selected[0],plan.items[0],snapshot,plan.board);}finally{app.endUndoGroup();}return 1;
    };
    M.unlink=function(){var c=M.comp(),ls=c.selectedLayers;M.assert(ls.length,'Select EffectCraft layers to unlink.');app.beginUndoGroup('Effect Master · Unlink');try{ls.forEach(function(l){var t=M.tag(l);if(t){delete t.tokens;delete t.parts;delete t.linkVersion;l.comment=JSON.stringify(t);}});}finally{app.endUndoGroup();}return ls.length;};
    M.unlinkVector=function(){var d=M.vc('document.inspect',{});M.assert(d.selection.length,'Select duplicated VectorCraft objects to unlink.');var commands=[];d.selection.forEach(function(id){walk(M.vc('document.node',{id:id}),function(n){commands.push({command:'object.setProps',params:{id:n.id,data:{'effect-master':null}}});});});M.vc('command.batch',{commands:commands,label:'Effect Master · Unlink'});return d.selection.length;};
    M.updateProperties=function(snapshot,o){
        var c=M.comp(),selected=c.selectedProperties.slice(),layers=c.selectedLayers.slice(),temp,originals=[],jobs=[];jobs.skipped=0;
        M.assert(snapshot.nodes.length===1,'Select exactly one VectorCraft object for Update properties.');
        M.assert(selected.length,'Select a Path, Rectangle, Ellipse, Fill, Stroke, or containing shape group in EffectCraft.');
        layers.forEach(function(l){M.assert(!l.locked,'Unlock the target layer before updating properties.');});
        if(selected.every(function(p){return p.propertyValueType===PropertyValueType.SHAPE;}))return M.updatePaths(snapshot,o);
        for(var k=1;k<=c.numLayers;k++)originals.push(c.layer(k));
        app.beginUndoGroup('Effect Master · Update properties');
        try{
            temp=create(snapshot,{mode:'normal',artboard:o&&o.artboard});M.assert(temp.layers.length===1,'Update properties needs one source shape.');
            var candidates=[];function visit(p){candidates.push(p);for(var i=1;i<=p.numProperties;i++)visit(p.property(i));}visit(temp.layers[0].property('ADBE Root Vectors Group'));
            var chosen=[];selected.forEach(function(p){var parent=p.parentProperty;while(parent){if(selected.some(function(x){return x===parent;}))return;parent=parent.parentProperty;}chosen.push(p);});
            function paintedContents(p,out){out=out||[];if(p.matchName==='ADBE Vectors Group'){for(var i=1;i<=p.numProperties;i++)if(['ADBE Vector Shape - Group','ADBE Vector Shape - Rect','ADBE Vector Shape - Ellipse'].indexOf(p.property(i).matchName)>=0){out.push(p);return out;}}for(var j=1;j<=p.numProperties;j++)paintedContents(p.property(j),out);return out;}
            chosen.forEach(function(p){if(['ADBE Vector Group','ADBE Vectors Group','ADBE Root Vectors Group'].indexOf(p.matchName)>=0){var sources=paintedContents(temp.layers[0].property('ADBE Root Vectors Group')),destinations=paintedContents(p);M.assert(sources.length===1&&destinations.length,'Select one source shape and a group containing editable geometry.');destinations.forEach(function(d){collect(d,sources[0],jobs,true);});}else{var matches=candidates.filter(function(s){return s.matchName===p.matchName;});M.assert(matches.length===1,'Select an unambiguous shape property; the source contains multiple matching properties.');collect(p,matches[0],jobs,true);}});
            apply(jobs,c);return jobs.length;
        }finally{if(temp)temp.layers.forEach(function(l){l.remove();});originals.forEach(function(l){l.selected=layers.some(function(s){return s.id===l.id;});});selected.forEach(function(p){p.selected=true;});app.endUndoGroup();}
    };
    M.push=function(o){
        o=o||{};if(o.copy)return place(o);
        var c=M.comp(),layers=c.selectedLayers.slice(),doc=M.vc('document.inspect',{}),all=M.linkDocument(doc),commands=[],unlinked=[],seen={};
        var groups={};layers.forEach(function(l){var t=M.tag(l);if(t&&t.kind==='group')groups[l.id]=true;});
        for(var i=1;i<=c.numLayers;i++){var candidate=c.layer(i),parent=candidate.parent;while(parent){if(groups[parent.id]&&!layers.some(function(l){return l.id===candidate.id;})){layers.push(candidate);break;}parent=parent.parent;}}
        layers=layers.filter(function(l){var t=M.tag(l);return !t||t.kind!=='group';});
        M.assert(layers.length,'Select EffectCraft layers first.');
        layers.forEach(function(l){var tag=M.tag(l);if(!tag||!tag.tokens){unlinked.push(l);return;}findLayer(c,tag.tokens);
            M.assert(tag.kind==='shape'&&tag.parts&&tag.parts.length,'This linked layer cannot be sent back as editable paths yet.');
            var records=M.vectorRecords(l,false);M.assert(records.length===tag.parts.length,'The linked shape structure changed. Use Send copy for new geometry.');
            records.forEach(function(r,i){var part=tag.parts[i],matches=all.tokens[part.token]||[];
                M.assert(matches.length===1,'The linked VectorCraft object is missing or duplicated. Open the original document or explicitly link the intended pair.');
                M.assert(r.route===part.route,'The linked shape hierarchy changed. Relink the pair after checking its structure.');
                var node=matches[0];M.assert(!seen[node.id],'Multiple layers target the same VectorCraft object.');seen[node.id]=true;M.assert(node.kind.type==='path'&&!all.uneditable[node.id],'Linked return currently needs visible, unlocked native paths (including their parent groups).');M.checkNode(node);
                M.assert(part.ancestorOpacity>0,'A fully transparent parent cannot be updated safely.');r.opacity/=part.ancestorOpacity;
                commands=commands.concat(M.recordCommands(r,node,tag.origin));
            });
        });
        M.assert(!unlinked.length||!commands.length,'Transfer linked and unlinked layers separately.');
        M.assert(!unlinked.length,'This layer has no object link yet. Select its original in VectorCraft and use Link existing pair, or use Send copy for new artwork.');
        M.vc('command.batch',{commands:commands,label:'Effect Master · Update linked artwork'});return layers.length;
    };
})(EffectMaster);
