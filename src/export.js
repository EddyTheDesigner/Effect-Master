(function(M){
    function child(node,id){var a=node.children||[];for(var i=0;i<a.length;i++)if(a[i].match===id)return a[i];return null;}
    function value(node,id,fallback){var c=child(node,id);return c?c.value:fallback;}
    function color(v){return 'rgb('+v.slice(0,3).map(function(x){return x*100+'%';}).join(',')+')';}
    function transform(node){var p=value(node,'position',[0,0]),a=value(node,'anchor',[0,0]),s=value(node,'scale',[100,100]),r=value(node,'rotation',0);M.assert(!value(node,'skew',0),'Skewed shape groups are not supported by Push yet.');return 'translate('+p[0]+' '+p[1]+') rotate('+r+') scale('+s[0]/100+' '+s[1]/100+') translate('+(-a[0])+' '+(-a[1])+')';}
    M.exportSvg=function(layers,c,board,viewport){
        var defs=[],serial=0;
        function paint(g){
            if(g.match==='fill'||g.match==='stroke')return color(value(g,'color',[0,0,0,1]));
            var gradient=value(g,'colors',null);if(gradient&&gradient.v)gradient=gradient.v;
            M.assert(gradient&&gradient.colors,'Gradient colors could not be read.');
            M.assert(!value(g,'highlightLength',0),'Offset radial gradients are not supported by Push yet.');
            var start=value(g,'start',[0,0]),end=value(g,'end',[100,0]),radial=value(g,'type',0)===1,id='emout'+(++serial),tag=radial?'radialGradient':'linearGradient';
            var a=radial?'cx="'+start[0]+'" cy="'+start[1]+'" r="'+Math.sqrt(Math.pow(end[0]-start[0],2)+Math.pow(end[1]-start[1],2))+'"':'x1="'+start[0]+'" y1="'+start[1]+'" x2="'+end[0]+'" y2="'+end[1]+'"';
            // Export opacity stops only when they coincide with color stops; no silent approximation.
            var ops=gradient.opacities||[];M.assert(ops.length===gradient.colors.length&&ops.every(function(o,i){return Math.abs(o[0]-gradient.colors[i][0])<1e-6;}),'Independent gradient opacity stops are not supported by Push yet.');
            defs.push('<'+tag+' id="'+id+'" gradientUnits="userSpaceOnUse" '+a+'>'+gradient.colors.map(function(stop,i){return '<stop offset="'+stop[0]+'" stop-color="'+color(stop[1])+'" stop-opacity="'+ops[i][1]+'"/>';}).join('')+'</'+tag+'>');return 'url(#'+id+')';
        }
        function shape(g){
            if(g.match==='path'){var s=value(g,'path',null);s=s&&s.v?s.v:s;M.assert(s&&s.vertices,'Path is unavailable.');var a=s.vertices.map(function(p,i){var h=s.in_tangents[i],o=s.out_tangents[i];return {p:p,'in':[p[0]+h[0],p[1]+h[1]],out:[p[0]+o[0],p[1]+o[1]]};});return '<path d="'+M.pathData({subpaths:[{anchors:a,closed:s.closed}]})+'"';}
            var p=value(g,'position',[0,0]),s=value(g,'size',[100,100]);
            if(g.match==='rect')return '<rect x="'+(p[0]-s[0]/2)+'" y="'+(p[1]-s[1]/2)+'" width="'+s[0]+'" height="'+s[1]+'" rx="'+value(g,'roundness',0)+'"';
            if(g.match==='ellipse')return '<ellipse cx="'+p[0]+'" cy="'+p[1]+'" rx="'+s[0]/2+'" ry="'+s[1]/2+'"';
            throw new Error('Push supports paths, rectangles, and ellipses. Convert other primitives to paths first.');
        }
        function contents(node){
            var children=(node.children||[]).filter(function(g){return g.enabled!==false;}),geometries=[],styles=[],groups=[];
            children.forEach(function(g){if(g.match==='group')groups.push(g);else if(['path','rect','ellipse'].indexOf(g.match)>=0)geometries.push(g);else if(['fill','stroke','gfill','gstroke'].indexOf(g.match)>=0)styles.push(g);else throw new Error('Push does not yet support '+g.name+'.');});
            M.assert(!(geometries.length&&groups.length),'Mixed parent-level paths and nested groups need separate Push transfers.');
            var out='';
            for(var i=groups.length-1;i>=0;i--){var g=groups[i],t=child(g,'transform');M.assert(value(g,'blend',0)===0,'Shape blend modes are not supported by Push yet.');out+='<g id="'+M.xml(g.name)+'" transform="'+transform(t)+'" opacity="'+value(t,'opacity',100)/100+'">'+contents(child(g,'contents'))+'</g>';}
            // A fill spanning multiple subpaths is kept as one compound path.
            var geometry=geometries.map(shape);
            if(geometry.length>1){M.assert(geometries.every(function(g){return g.match==='path';}),'Multiple parametric shapes in one group must be converted to paths before Push.');var path=geometry.map(function(s){return s.slice(9,-1);}).join(' ');geometry=['<path d="'+path+'"'];}
            var paints=[];
            for(i=styles.length-1;i>=0;i--){var st=styles[i],stroke=st.match==='stroke'||st.match==='gstroke';M.assert(value(st,'blend',0)===0,'Paint blend modes are not supported by Push yet.');var attrs=' opacity="'+value(st,'opacity',100)/100+'"';
                if(stroke){var taper=child(st,'taper'),wave=child(st,'wave');M.assert(!value(taper||{},'startLength',0)&&!value(taper||{},'endLength',0)&&!value(wave||{},'amount',0),'Tapered/wave strokes cannot be pushed yet.');attrs+=' fill="none" stroke="'+paint(st)+'" stroke-width="'+value(st,'width',1)+'" stroke-linecap="'+(['butt','round','square'][value(st,'cap',0)])+'" stroke-linejoin="'+(['miter','round','bevel'][value(st,'join',0)])+'"';attrs+=' stroke-miterlimit="'+value(st,'miter',4)+'"';var dash=child(st,'dashes');if(dash&&value(dash,'dash',0)>0){M.assert(!value(dash,'dash2',0)&&!value(dash,'dash3',0),'Extra dash pairs are not supported by Push yet.');attrs+=' stroke-dasharray="'+value(dash,'dash',0)+' '+value(dash,'gap',0)+'" stroke-dashoffset="'+value(dash,'offset',0)+'"';}}
                else attrs+=' fill="'+paint(st)+'" stroke="none" fill-rule="'+(value(st,'rule',0)?'evenodd':'nonzero')+'"';
                paints.push({stroke:stroke,attrs:attrs});
            }
            // SVG fill and stroke belong to the same geometry. Separate elements destroy
            // that relationship on reimport, even though they render identically.
            if(paints.length===2&&!paints[0].stroke&&paints[1].stroke){
                var combined=paints[0].attrs.replace(' opacity=',' fill-opacity=').replace(' stroke="none"','')+paints[1].attrs.replace(' opacity=',' stroke-opacity=').replace(' fill="none"','');
                out+=geometry.map(function(s){return s+combined+'/>';}).join('');
            }else paints.forEach(function(p){out+=geometry.map(function(s){return s+p.attrs+'/>';}).join('');});
            return out;
        }
        var body='';layers=layers.slice().sort(function(a,b){return b.index-a.index;});
        layers.forEach(function(l){
            var tree=app.run('layer.tree',{comp:c.id,layer:l.id,time:c.time});M.assert(tree.type==='Shape'&&!l.threeDLayer,'Push supports 2D shape layers.');
            M.assert(tree.blendMode==='Normal'&&!tree.trackMatte,'Blends and track mattes cannot be pushed yet.');
            M.assert(!(child(tree.properties,'effects').children||[]).length&&!(child(tree.properties,'masks').children||[]).length,'Effects and masks cannot be pushed yet.');
            var p=l.sourcePointToComp([0,0]),x=l.sourcePointToComp([1,0]),y=l.sourcePointToComp([0,1]),matrix=[x[0]-p[0],x[1]-p[1],y[0]-p[0],y[1]-p[1],p[0]+board.x,p[1]+board.y];
            body+='<g id="'+M.xml(l.name)+'" opacity="'+l.transform.opacity.value/100+'" transform="matrix('+matrix.join(' ')+')">'+contents(child(tree.properties,'contents'))+'</g>';
        });
        viewport=viewport||board;
        return '<svg xmlns="http://www.w3.org/2000/svg" width="'+viewport.width+'" height="'+viewport.height+'" viewBox="'+viewport.x+' '+viewport.y+' '+viewport.width+' '+viewport.height+'"><defs>'+defs.join('')+'</defs>'+body+'</svg>';
    };
    function base64(text){var bytes=[];Array.from(text).forEach(function(ch){var x=ch.codePointAt(0);if(x<128)bytes.push(x);else if(x<2048)bytes.push(192|(x>>6),128|(x&63));else if(x<65536)bytes.push(224|(x>>12),128|((x>>6)&63),128|(x&63));else bytes.push(240|(x>>18),128|((x>>12)&63),128|((x>>6)&63),128|(x&63));});var abc='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',out='';for(var i=0;i<bytes.length;i+=3){var a=bytes[i],b=bytes[i+1],d=bytes[i+2];out+=abc[a>>2]+abc[((a&3)<<4)|((b||0)>>4)]+(b===undefined?'=':abc[((b&15)<<2)|((d||0)>>6)])+(d===undefined?'=':abc[d&63]);}return out;}
    M.push=function(options){var c=M.comp(),layers=c.selectedLayers;M.assert(layers.length,'Select EffectCraft shape layers to push.');var doc=M.vc('document.inspect',{depth:0}),board=M.board({doc:doc},options.artboard);
        // Explicit SVG crop preserves its coordinate system. Enclose every transformed source rectangle,
        // including strokes, so the extra outer clipping group cannot cut the transferred artwork.
        var points=[];layers.forEach(function(l){var r=l.sourceRectAtTime(c.time,true);[[r.left,r.top],[r.left+r.width,r.top],[r.left,r.top+r.height],[r.left+r.width,r.top+r.height]].forEach(function(p){var q=l.sourcePointToComp(p);points.push([q[0]+board.x,q[1]+board.y]);});});
        var xs=points.map(function(p){return p[0];}),ys=points.map(function(p){return p[1];}),x=Math.floor(Math.min.apply(null,xs))-16,y=Math.floor(Math.min.apply(null,ys))-16;
        var view={x:x,y:y,width:Math.ceil(Math.max.apply(null,xs))-x+16,height:Math.ceil(Math.max.apply(null,ys))-y+16};
        var svg=M.exportSvg(layers,c,board,view);
        M.vc('command.batch',{commands:[{command:'file.place',params:{name:'Effect Master.svg',dataBase64:base64(svg),link:false,crop:'crop',at:[view.x+view.width/2,view.y+view.height/2]}}],label:'Effect Master · Push'});return layers.length;
    };
    function staticTransform(l){var t=l.property('ADBE Transform Group');for(var i=1;i<=t.numProperties;i++){var p=t.property(i);if(p.numKeys||p.expressionEnabled)return false;}return true;}
    M.releaseGroups=function(){var c=M.comp(),groups=c.selectedLayers.filter(function(l){var tag=M.tag(l);return tag&&tag.type==='group';});M.assert(groups.length,'Select Effect Master group layers to release.');groups.forEach(function(l){M.assert(!l.locked&&!l.threeDLayer&&staticTransform(l),'Animated, locked, or 3D groups must be kept to preserve animation.');var scale=l.transform.scale.value;M.assert(scale[0]>0&&Math.abs(scale[0]-scale[1])<.00001,'Keep groups with flipped or nonuniform scale to preserve their transforms.');for(var i=1;i<=c.numLayers;i++){var childLayer=c.layer(i);if(childLayer.parent&&childLayer.parent.id===l.id){M.assert(!childLayer.locked&&!childLayer.threeDLayer&&staticTransform(childLayer),'Release groups before animating their children; animated, locked, or 3D child transforms must be kept.');}}});
        app.beginUndoGroup('Effect Master · Release groups');try{groups.forEach(function(g){for(var i=1;i<=c.numLayers;i++){var l=c.layer(i);if(l.parent&&l.parent.id===g.id)l.parent=g.parent;}g.remove();});}finally{app.endUndoGroup();}return groups.length;
    };
    M.decomp=function(){var c=M.comp(),selected=c.selectedLayers;M.assert(selected.length===1&&selected[0].source instanceof CompItem,'Select one precomposition layer.');var pre=selected[0],source=pre.source,tree=app.run('layer.tree',{layer:pre.id,comp:c.id});
        M.assert(!pre.locked&&!pre.threeDLayer&&!pre.parent&&staticTransform(pre)&&pre.stretch===100&&pre.startTime===0&&pre.inPoint===0&&Math.abs(pre.outPoint-source.duration)<.0001,'Decompose currently requires an untrimmed precomp at time zero, with static 2D transforms and no parent.');
        var p=pre.transform.position.value,a=pre.transform.anchorPoint.value,s=pre.transform.scale.value;
        M.assert(p[0]===a[0]&&p[1]===a[1]&&s[0]===100&&s[1]===100&&!pre.transform.rotation.value&&pre.transform.opacity.value===100,'Reset precomp transforms before decomposing.');
        M.assert(!(child(tree.properties,'effects').children||[]).length&&!(child(tree.properties,'masks').children||[]).length&&!pre.timeRemapEnabled&&!tree.trackMatte&&tree.blendMode==='Normal','Precomp effects, masks, time remapping, and blending must be kept.');
        // Each copy is inserted immediately before the precomp; copy top-to-bottom to keep order.
        var created=[],map={},originals=[];for(var i=1;i<=source.numLayers;i++)originals.push(source.layer(i));
        app.beginUndoGroup('Effect Master · Decompose');try{
            for(i=0;i<originals.length;i++){var before={};for(var j=1;j<=c.numLayers;j++)before[c.layer(j).id]=true;originals[i].copyToComp(c);var copy=null;for(j=1;j<=c.numLayers;j++)if(!before[c.layer(j).id])copy=c.layer(j);M.assert(copy,'Could not copy a nested layer.');created.push(copy);map[originals[i].id]=copy;copy.moveBefore(pre);}
            for(i=0;i<originals.length;i++){var parent=originals[i].parent;created[i].setParentWithJump(parent?map[parent.id]:null);}
            pre.remove();return created.length;
        }catch(e){for(i=created.length-1;i>=0;i--)created[i].remove();throw e;}finally{app.endUndoGroup();}
    };
})(EffectMaster);
