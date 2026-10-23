(function(M){
    M.comp=function(){var c=app.project.activeItem;M.assert(c instanceof CompItem,'Open an EffectCraft composition first.');return c;};
    M.layerById=function(c,id){for(var i=1;i<=c.numLayers;i++)if(c.layer(i).id===id)return c.layer(i);throw new Error('Created layer was not found.');};
    M.board=function(snapshot,index){var boards=snapshot.doc.artboards;M.assert(boards&&boards.length,'VectorCraft has no artboard.');if(index===-1){var state=M.rpc('ui.inspect',{});index=state.view?state.view.artboard:0;}index=index||0;M.assert(boards[index],'That artboard no longer exists. Reconnect.');return boards[index];};
    M.newComp=function(board,options){options=options||{};var c=app.project.items.addComp(board.name||'VectorCraft',Math.max(1,Math.round(board.width)),Math.max(1,Math.round(board.height)),1,options.duration||10,options.fps||30);c.openInViewer();return c;};
    function sourceTag(snapshot,ids,board,type){return JSON.stringify({effectMaster:1,type:type||'art',source:snapshot.doc.path||snapshot.doc.title,ids:ids,board:board});}
    M.tag=function(l){try{var d=JSON.parse(l.comment);return d.effectMaster===1?d:null;}catch(e){return null;}};
    function textPlan(node){
        M.checkNode(node);var k=node.kind;M.assert(!node.blend||node.blend==='Normal','Text blend modes require Rasterize.');
        M.assert((k.kind.kind==='point'||k.kind.kind==='area')&&!k.vertical,'Path and vertical type require Rasterize in this release.');
        var box=null;
        if(k.kind.kind==='area'){
            var sub=k.kind.frame.subpaths;M.assert(sub.length===1&&sub[0].closed&&sub[0].anchors.length===4,'Nonrectangular area type requires Rasterize.');
            var b=M.nodeBounds({kind:{path:k.kind.frame}}),corners={};sub[0].anchors.forEach(function(a){var p=M.point(a.p);M.assert(!a['in']&&!a.out&&(p[0]===b.x||p[0]===b.x+b.width)&&(p[1]===b.y||p[1]===b.y+b.height),'Nonrectangular area type requires Rasterize.');corners[p.join(',')]=true;});M.assert(Object.keys(corners).length===4,'Invalid area text frame.');
            M.assert(!k.area||!Object.keys(k.area).length,'Advanced area type options require Rasterize.');box=[b.x,b.y,b.width,b.height];
        }
        M.assert(!(k.ruby||[]).length&&!(k.paras||[]).length,'Ruby and paragraph-specific styles require Rasterize.');
        M.assert(!k.para.hyphenate&&!k.para.tabs&&!k.para.drop_caps,'Hyphenation, tabs, and drop caps require Rasterize.');
        var xf=k.xf,sx=Math.sqrt(xf[0]*xf[0]+xf[1]*xf[1]),det=xf[0]*xf[3]-xf[1]*xf[2],sy=det/sx;
        M.assert(sx>0&&Math.abs(xf[0]*xf[2]+xf[1]*xf[3])<1e-6,'Sheared text requires Rasterize.');
        var text='',runs=[];
        k.runs.forEach(function(run){var s=run.style;M.assert(!run.inline&&!s.underline&&!s.strikethrough&&!s.rotation,'Inline art, decorations, and rotated characters require Rasterize.');
            M.assert(!s.font_version&&!s.small_caps&&!s.position&&!s.charAlign&&!s.charDirection&&!s.proportionalMetrics&&!s.digits&&!s.noBreak&&!(s.features||[]).length,'These advanced character settings require Rasterize.');
            M.assert(!s.overprint_fill&&!s.overprint_stroke&&!s.stroke_cap&&!s.stroke_join&&!s.stroke_miter_limit&&!s.stroke_dash&&!s.stroke_align,'Custom text stroke/overprint settings require Rasterize.');
            M.assert(!s.fill||s.fill.type==='none'||s.fill.type==='solid','Text gradients require Rasterize.');M.assert(!s.stroke||s.stroke.type==='none'||s.stroke.type==='solid','Text stroke gradients require Rasterize.');
            var p={font:s.font_family,style:s.font_style,size:s.size,applyFill:!!s.fill&&s.fill.type!=='none',applyStroke:!!s.stroke&&s.stroke.type!=='none',strokeWidth:s.stroke_width||0,tracking:s.tracking||0,baselineShift:s.baseline_shift||0,hScale:s.h_scale||100,vScale:s.v_scale||100,allCaps:!!s.all_caps};
            if(p.applyFill)p.fill=M.rgb(s.fill.color);if(p.applyStroke)p.stroke=M.rgb(s.stroke.color);
            if(typeof s.leading==='number')p.leading=s.leading;
            if(typeof s.kerning==='number')p.kerning=s.kerning;
            if(s.fontAxes)p.variations=s.fontAxes;
            // The engine's range uses Unicode scalar indices, not UTF-16 code units.
            p.range=[Array.from(text).length,Array.from(text+run.text).length];text+=run.text;runs.push(p);
        });
        M.assert(text.length,'Empty text cannot be transferred.');
        var justify={Left:'left',Center:'center',Right:'right',JustifyAll:'justifyAll',JustifyLeft:'justifyLeft',JustifyCenter:'justifyCenter',JustifyRight:'justifyRight'}[k.para.justify];M.assert(justify,'Unsupported paragraph alignment. Use Rasterize.');
        return {node:node,text:text,runs:runs,box:box,scale:[sx*100,sy*100],rotation:Math.atan2(xf[1],xf[0])*180/Math.PI,position:[xf[4],xf[5]],paragraph:{justify:justify,indentLeft:k.para.left_indent||0,indentRight:k.para.right_indent||0,indentFirst:k.para.first_line_indent||0,spaceBefore:k.para.space_before||0,spaceAfter:k.para.space_after||0}};
    }
    M.plan=function(snapshot,options){
        options=options||{};var board=M.board(snapshot,options.artboard),mode=options.mode||'normal',plans=[];
        function item(node,parent){
            if(node.visible===false)return;
            var k=node.kind;
            if((k.type==='group'||k.type==='layer')&&(mode==='split'||!M.isVector(node))){
                M.checkNode(node);M.assert(!k.clip,'Split mixed/clipped groups require Rasterize or a normal vector transfer.');
                M.assert((node.opacity===undefined||node.opacity===1)&&(!node.blend||node.blend==='Normal'),'Splitting translucent or blended groups changes their appearance; transfer normally or Rasterize.');
                M.assert(!(node.appearance&&node.appearance.items&&node.appearance.items.length),'Group appearances require Rasterize.');
                var plan={kind:'group',node:node,parent:parent};plans.push(plan);k.children.forEach(function(c){item(c,plan);});return;
            }
            if(k.type==='text')plans.push({kind:'text',node:node,parent:parent,data:textPlan(node)});
            else if(k.type==='image')plans.push({kind:'image',node:node,parent:parent});
            else {
                var artwork=node,mask=null;
                if(k.clip){
                    var clip=k.children[0];M.assert(clip&&clip.kind.type==='path'&&clip.kind.path.subpaths.length===1&&clip.kind.path.subpaths[0].closed,'Compound/open clipping paths require Rasterize.');
                    mask=M.toShape(clip.kind.path.subpaths[0],[board.x,board.y]);artwork=M.clone(node);artwork.kind.clip=false;artwork.kind.children.shift();
                }
                plans.push({kind:'shape',node:node,parent:parent,mask:mask,svg:M.svg([artwork],board,snapshot.summaries)});
            }
        }
        if(mode==='combine'){
            M.assert(snapshot.nodes.every(M.isVector),'Combine accepts vector shapes. Transfer text and images separately.');
            plans.push({kind:'shape',node:{id:0,name:'Combined artwork'},svg:M.svg(snapshot.nodes,board,snapshot.summaries),ids:snapshot.nodes.map(function(x){return x.id;})});
        }else snapshot.nodes.forEach(function(node){item(node,null);});
        M.assert(plans.length,'The selection contains no visible artwork.');return {board:board,items:plans};
    };
    M.importSnapshot=function(snapshot,options){
        options=options||{};var plan=M.plan(snapshot,options),c=options.newComp?null:M.comp(),created=[],assets=[],newComp=null;
        plan.items.forEach(function(p){if(p.kind==='image')p.asset=M.exportRaster(snapshot.doc,[p.node.id],options);});
        app.beginUndoGroup('Effect Master · Transfer');
        try{
            if(!c){c=M.newComp(plan.board,options);newComp=c;}
            var board=plan.board,dx=options.center?(c.width-board.width)/2:0,dy=options.center?(c.height-board.height)/2:0;
            // Deselect to insert all new layers in deterministic paint order.
            for(var j=1;j<=c.numLayers;j++)c.layer(j).selected=false;
            for(var i=0;i<plan.items.length;i++){
                var p=plan.items[i],l;
                if(p.kind==='group'){
                    l=c.layers.addNull();created.push(l);l.name=p.node.name||'VectorCraft group';l.transform.anchorPoint.setValue([0,0,0]);l.transform.position.setValue([0,0,0]);l.guideLayer=true;
                }else if(p.kind==='image'){
                    var footage=app.project.importFile(new ImportOptions(new File(p.asset.path)));assets.push(footage);l=c.layers.add(footage);created.push(l);l.name=p.node.name||'VectorCraft image';
                    l.transform.scale.setValue([50,50,100]);l.transform.position.setValue([p.asset.bounds.x-board.x+footage.width/4+dx,p.asset.bounds.y-board.y+footage.height/4+dy,0]);
                }else if(p.kind==='text'){
                    var d=p.data;l=c.layers.addText(d.text);created.push(l);l.name=p.node.name||d.text.slice(0,60);
                    l.transform.anchorPoint.setValue([0,0,0]);l.transform.position.setValue([d.position[0]-board.x+dx,d.position[1]-board.y+dy,0]);l.transform.scale.setValue([d.scale[0],d.scale[1],100]);l.transform.rotation.setValue(d.rotation);
                    var paragraph=M.clone(d.paragraph);paragraph.layer=l.id;paragraph.box=d.box;app.run('layer.setText',paragraph);
                    d.runs.forEach(function(run){var params=M.clone(run);params.layer=l.id;app.run('layer.setText',params);});
                    l.transform.opacity.setValue((p.node.opacity===undefined?1:p.node.opacity)*100);
                }else{
                    var display=snapshot.summaries[p.node.id]&&snapshot.summaries[p.node.id].name;
                    var result=app.run('edit.pasteSvg',{svg:p.svg,name:p.node.name||(display?display.replace(/^<|>$/g,''):('VectorCraft '+p.node.id)),comp:c.id});
                    l=M.layerById(c,result.layer);created.push(l);M.assert(!result.skipped||!result.skipped.length,'EffectCraft skipped part of this SVG. Use Rasterize.');
                    if(p.mask){var mask=l.property('ADBE Mask Parade').addProperty('ADBE Mask Atom');mask.name='VectorCraft clipping path';mask.property('ADBE Mask Shape').setValue(p.mask);}
                    var b=snapshot.summaries[p.node.id]&&snapshot.summaries[p.node.id].bounds;
                    var anchor=b?[b.x-board.x+b.width/2,b.y-board.y+b.height/2]:[board.width/2,board.height/2];
                    l.transform.anchorPoint.setValue([anchor[0],anchor[1],0]);l.transform.position.setValue([anchor[0]+dx,anchor[1]+dy,0]);
                    if(p.node.kind&&p.node.kind.guide)l.guideLayer=true;
                }
                l.comment=sourceTag(snapshot,p.ids||[p.node.id],options.artboard||0,p.kind==='group'?'group':'art');
                if(p.parent)l.parent=p.parent.layer;
                p.layer=l;l.moveToBeginning();l.selected=false;
            }
            created.forEach(function(l){l.selected=true;});return {count:created.length,comp:c,layers:created};
        }catch(e){for(var k=created.length-1;k>=0;k--)try{created[k].remove();}catch(ignore){}for(k=assets.length-1;k>=0;k--)try{assets[k].remove();}catch(ignoreAsset){}if(newComp)try{newComp.remove();}catch(ignore2){}throw e;}
        finally{app.endUndoGroup();}
    };
    M.pull=function(options){return M.importSnapshot(M.readSelection(options&&options.all),options);};
    M.updatePaths=function(snapshot,options){
        var c=M.comp(),props=c.selectedProperties.filter(function(p){return p.propertyValueType===PropertyValueType.SHAPE;});
        M.assert(props.length,'Select one or more Path or Mask Path properties in EffectCraft.');
        var first=snapshot.nodes[0];M.assert(first.kind.type==='path'&&first.kind.path.subpaths.length===1,'Select a single-subpath VectorCraft path first.');
        var board=M.board(snapshot,options&&options.artboard),shape=M.toShape(first.kind.path.subpaths[0],[board.x,board.y]);
        props.forEach(function(p){M.assert(!p.expressionEnabled,'Remove the target path expression before updating.');var owner=p;while(owner.parentProperty)owner=owner.parentProperty;M.assert(!owner.locked,'Unlock target layers before updating their paths.');});
        app.beginUndoGroup('Effect Master · Update paths');try{props.forEach(function(p){if(p.numKeys)p.setValueAtTime(c.time,shape);else p.setValue(shape);});}finally{app.endUndoGroup();}
        return props.length;
    };
    M.exportRaster=function(doc,ids,options){
        var folder;
        if(options.assetFolder)folder=new Folder(options.assetFolder);
        else if(app.project.file)folder=new Folder(app.project.file.parent.fsName+'/Effect Master Assets');
        else folder=Folder.selectDialog('Choose a permanent folder for Effect Master images');
        M.assert(folder,'Image transfer cancelled.');M.assert(folder.exists||folder.create(),'Cannot create the image folder.');
        var path=folder.fsName+'/VectorCraft-'+new Date().getTime()+'-'+(++M.serial)+'.png';
        // A batch uses the synchronous engine export; the desktop menu variant starts a background job.
        var result=M.vc('command.batch',{commands:[{command:'select.set',params:{ids:ids}},{command:'document.exportSelection',params:{path:path,format:'png',scale:2}},{command:'select.set',params:{ids:doc.selection}}]}).results[1];
        M.assert(result.bounds,'VectorCraft did not provide image bounds.');
        var b=Array.isArray(result.bounds)?{x:result.bounds[0],y:result.bounds[1],width:result.bounds[2],height:result.bounds[3]}:result.bounds;
        return {path:path,bounds:b,warnings:result.warnings||[]};
    };
    M.rasterize=function(options){
        options=options||{};var c=M.comp(),doc=M.vc('document.inspect',{});M.assert(doc.selection.length,'Select artwork in VectorCraft first.');
        var board=M.board({doc:doc},options.artboard),result=M.exportRaster(doc,doc.selection,options),path=result.path,b=result.bounds,footage,layer;
        app.beginUndoGroup('Effect Master · Rasterize');try{
            footage=app.project.importFile(new ImportOptions(new File(path)));layer=c.layers.add(footage);layer.name='VectorCraft raster';
            layer.transform.scale.setValue([50,50,100]);var dx=options.center?(c.width-board.width)/2:0,dy=options.center?(c.height-board.height)/2:0;
            layer.transform.position.setValue([b.x-board.x+footage.width/4+dx,b.y-board.y+footage.height/4+dy,0]);layer.comment=sourceTag({doc:doc},doc.selection,options.artboard||0,'raster');
        }catch(e){if(layer)layer.remove();if(footage)footage.remove();throw e;}finally{app.endUndoGroup();}
        return {layer:layer,path:path,warnings:result.warnings||[]};
    };
    M.guides=function(options){var c=M.comp(),doc=M.vc('document.inspect',{depth:0}),board=M.board({doc:doc},options.artboard),guides=M.vc('guide.list',{}),count=0;
        app.beginUndoGroup('Effect Master · Guides');try{guides.forEach(function(g){if(!g.shown||(g.artboard!==undefined&&g.artboard!==doc.artboards.indexOf(board)))return;var shift=options.center?(g.vertical?(c.width-board.width)/2:(c.height-board.height)/2):0;app.run('view.addGuide',{orientation:g.vertical?'vertical':'horizontal',position:g.pos-(g.vertical?board.x:board.y)+shift});count++;});}finally{app.endUndoGroup();}return count;
    };
    M.swatches=function(){var c=M.comp(),swatches=M.vc('swatch.list',{}).swatches.filter(function(s){return s.kind==='color'&&s.color&&s.color.model==='rgb'&&s.name!=='[Registration]';});M.assert(swatches.length,'No RGB solid swatches in this document.');
        app.beginUndoGroup('Effect Master · Swatches');try{var l=c.layers.addShape();l.name='VectorCraft swatches';l.guideLayer=true;l.transform.position.setValue([0,0,0]);l.transform.anchorPoint.setValue([0,0,0]);
            swatches.forEach(function(s,i){var group=l.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');group.name=s.name;var contents=group.property('ADBE Vectors Group'),r=contents.addProperty('ADBE Vector Shape - Rect');r.property('ADBE Vector Rect Size').setValue([24,24]);r.property('ADBE Vector Rect Position').setValue([18+(i%8)*30,18+Math.floor(i/8)*30]);var fill=contents.addProperty('ADBE Vector Graphic - Fill');fill.property('ADBE Vector Fill Color').setValue(M.rgb(s.color));});return swatches.length;
        }finally{app.endUndoGroup();}
    };
    M.precomp=function(){var c=M.comp(),selected=c.selectedLayers.slice();M.assert(selected.length,'Select layers or an Effect Master group first.');
        var ids={};selected.forEach(function(l){ids[l.id]=true;});var changed=true;
        while(changed){changed=false;for(var i=1;i<=c.numLayers;i++){var l=c.layer(i);if(l.parent&&ids[l.parent.id]&&!ids[l.id]){ids[l.id]=true;changed=true;}}}
        var indices=[];for(i=1;i<=c.numLayers;i++)if(ids[c.layer(i).id])indices.push(i);
        app.beginUndoGroup('Effect Master · Precompose');try{return c.layers.precompose(indices,selected[0].name+' Comp',true);}finally{app.endUndoGroup();}
    };
    M.toggleGroups=function(){var c=M.comp(),groups=[];for(var i=1;i<=c.numLayers;i++){var l=c.layer(i),tag=M.tag(l);if(tag&&tag.type==='group')groups.push(l);}M.assert(groups.length,'This composition has no Effect Master groups.');
        app.beginUndoGroup('Effect Master · Group visibility');try{var hide=!groups[0].shy;groups.forEach(function(l){l.shy=hide;});c.hideShyLayers=hide;}finally{app.endUndoGroup();}return groups.length;
    };
})(EffectMaster);
