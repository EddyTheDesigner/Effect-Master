/* Native editable geometry for linked returns. Layer animation is deliberately not baked
   into design coordinates: returning a pose and reapplying it would double transforms. */
(function(M){
    function child(n,id){return (n&&n.children||[]).filter(function(x){return x.match===id;})[0];}
    function val(n,id,fallback){var p=child(n,id);return p?p.value:fallback;}
    function mul(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
    function inverse(a){var d=a[0]*a[3]-a[1]*a[2];M.assert(Math.abs(d)>1e-10,'A zero-scale shape cannot be updated.');return [a[3]/d,-a[1]/d,-a[2]/d,a[0]/d,(a[2]*a[5]-a[3]*a[4])/d,(a[1]*a[4]-a[0]*a[5])/d];}
    function point(a,p){return [a[0]*p[0]+a[2]*p[1]+a[4],a[1]*p[0]+a[3]*p[1]+a[5]];}
    function xf(t){var p=val(t,'position',[0,0]),a=val(t,'anchor',[0,0]),s=val(t,'scale',[100,100]),r=val(t,'rotation',0)*Math.PI/180,co=Math.cos(r),si=Math.sin(r);M.assert(!val(t,'skew',0),'Skewed groups cannot be returned yet.');return mul([co*s[0]/100,si*s[0]/100,-si*s[1]/100,co*s[1]/100,p[0],p[1]],[1,0,0,1,-a[0],-a[1]]);}
    M.vectorRecords=function(layer,world){
        var c=layer.containingComp,t=app.run('layer.tree',{comp:c.id,layer:layer.id,time:c.time}),out=[];
        M.assert(t.type==='Shape'&&!layer.threeDLayer,'Linked return supports 2D shape layers.');
        M.assert(t.blendMode==='Normal'&&!t.trackMatte,'Blends and track mattes cannot be returned as editable artwork.');
        M.assert(!(child(t.properties,'masks').children||[]).length,'Masked layers cannot be returned as linked paths yet.');
        // Effects stay in EffectCraft. This is a design edit, not a rendered-frame export.
        function visit(n,m,opacity,route){
            var cs=(n.children||[]).filter(function(x){return x.enabled!==false;}),geo=[],styles=[],groups=[];
            cs.forEach(function(x,i){if(x.match==='group')groups.push({node:x,index:i});else if(['rect','ellipse','path'].indexOf(x.match)>=0)geo.push(x);else if(['fill','stroke','gfill','gstroke'].indexOf(x.match)>=0)styles.push(x);else throw new Error('Linked return cannot represent '+x.name+' as editable geometry.');});
            M.assert(!(geo.length&&groups.length),'Mixed geometry and nested groups need separate layers for linked returns.');
            for(var i=groups.length-1;i>=0;i--){var g=groups[i],tr=child(g.node,'transform');M.assert(!val(g.node,'blend',0),'Blended shape groups cannot be returned.');visit(child(g.node,'contents'),mul(m,xf(tr)),opacity*val(tr,'opacity',100)/100,route+'/'+g.index+':'+g.node.name);}
            if(geo.length){var fills=styles.filter(function(s){return s.match==='fill'||s.match==='gfill';}),strokes=styles.filter(function(s){return s.match==='stroke'||s.match==='gstroke';});M.assert(fills.length<=1&&strokes.length<=1,'Multiple stacked paints cannot be returned to a basic linked shape.');M.assert(geo.length===1||geo.every(function(g){return g.match==='path';}),'Multiple parametrics in one group require separate shapes.');out.push({geometry:geo,matrix:m,opacity:opacity,fill:fills[0],stroke:strokes[0],route:route});}
        }
        var matrix=[1,0,0,1,0,0];if(world){var p=layer.sourcePointToComp([0,0]),x=layer.sourcePointToComp([1,0]),y=layer.sourcePointToComp([0,1]);matrix=[x[0]-p[0],x[1]-p[1],y[0]-p[0],y[1]-p[1],p[0],p[1]];}
        visit(child(t.properties,'contents'),matrix,1,'');return out;
    };
    function paint(st,m){
        if(!st)return {none:true};M.assert(!val(st,'blend',0),'Paint blends cannot be returned.');
        if(st.match==='fill'||st.match==='stroke')return {color:val(st,'color',[0,0,0]).slice(0,3),keepModel:true};
        var g=val(st,'colors',null);if(g&&g.v)g=g.v;M.assert(g&&g.colors,'Unreadable gradient.');var op=g.opacities||[];
        M.assert(op.length===g.colors.length&&op.every(function(o,i){return Math.abs(o[0]-g.colors[i][0])<1e-6;}),'Independent gradient opacity stops cannot be returned.');
        M.assert(!val(st,'highlightLength',0),'Offset radial gradients cannot be returned.');
        if(val(st,'type',0)===1)M.assert(Math.abs(m[0]*m[0]+m[1]*m[1]-m[2]*m[2]-m[3]*m[3])<.00001&&Math.abs(m[0]*m[2]+m[1]*m[3])<.00001,'Nonuniform radial gradients cannot be returned without changing their appearance.');
        return {gradient:{kind:val(st,'type',0)===1?'radial':'linear',start:point(m,val(st,'start',[0,0])),end:point(m,val(st,'end',[100,0])),stops:g.colors.map(function(s,i){return {offset:s[0],color:s[1].slice(0,3),opacity:op[i][1]};})},keepModel:true};
    }
    M.recordCommands=function(r,node,origin){
        var id=node.id,commands=[],m=mul([1,0,0,1,origin.x,origin.y],r.matrix),geo=r.geometry,live=node.kind.live;
        function cmd(command,params){if(command==='path.setAnchors')params.id=id;else params.ids=[id];commands.push({command:command,params:params});}
        var sx=Math.sqrt(m[0]*m[0]+m[1]*m[1]),sy=Math.sqrt(m[2]*m[2]+m[3]*m[3]);
        M.assert(!r.stroke||Math.abs(sx-sy)<.00001,'Nonuniformly scaled strokes cannot be represented faithfully as one stroke.');
        if(geo.length===1&&geo[0].match!=='path'){
            var g=geo[0],pos=val(g,'position',[0,0]),size=val(g,'size',[100,100]),kind=g.match==='rect'?'rectangle':'ellipse';
            M.assert(live&&live.shape===kind,'The linked source no longer has the matching live shape type.');
            var desired=mul(m,[size[0]/live.w,0,0,size[1]/live.h,pos[0]-size[0]/2,pos[1]-size[1]/2]);
            cmd('object.transform',{matrix:mul(desired,inverse(live.xf)),strokes:false,corners:false,patterns:false});
            if(kind==='rectangle'){M.assert(Math.abs(desired[1])<.00001&&Math.abs(desired[2])<.00001&&desired[0]>0,'Rotated live rectangles need a path conversion before a linked return.');cmd('object.setLiveShape',{radius:val(g,'roundness',0)*sx,kind:'round',relativeRadii:false});}
        }else{
            M.assert(geo.every(function(g){return g.match==='path';}),'Unsupported geometry mix.');
            cmd('path.setAnchors',{subpaths:geo.map(function(g){var s=val(g,'path',null);if(s&&s.v)s=s.v;M.assert(s&&s.vertices,'Unreadable Bezier path.');return {closed:s.closed,anchors:s.vertices.map(function(p,i){var v=point(m,p),a=point(m,[p[0]+s.in_tangents[i][0],p[1]+s.in_tangents[i][1]]),b=point(m,[p[0]+s.out_tangents[i][0],p[1]+s.out_tangents[i][1]]);return {x:v[0],y:v[1],'in':a,out:b};})};})});
        }
        var items=node.appearance&&node.appearance.items||[];
        M.assert(items.length<=2&&items.every(function(i){return (i.kind==='fill'||i.kind==='stroke')&&!(i.effects||[]).length;}),'The linked source has an unsupported appearance stack.');
        ['fill','stroke'].forEach(function(kind){var st=r[kind],params=paint(st,m),index=-1;items.forEach(function(it,i){if(it.kind===kind)index=i;});params.item=null;cmd(kind==='fill'?'paint.setFill':'paint.setStroke',params);
            if(index>=0)cmd('appearance.setItem',{index:index,opacity:st?val(st,'opacity',100):100,visible:true});
        });
        if(r.fill)cmd('path.setFillRule',{rule:val(r.fill,'rule',0)?'evenOdd':'nonZero'});
        if(r.stroke){var st=r.stroke,d=child(st,'dashes'),t=child(st,'taper'),w=child(st,'wave');M.assert(!val(t,'startLength',0)&&!val(t,'endLength',0)&&!val(w,'amount',0),'Tapered or wave strokes cannot be returned.');M.assert(!val(d,'dash2',0)&&!val(d,'dash3',0),'Extra dash pairs cannot be returned.');cmd('stroke.set',{weight:val(st,'width',1)*sx,cap:['butt','round','square'][val(st,'cap',0)],join:['miter','round','bevel'][val(st,'join',0)],miterLimit:val(st,'miter',4),align:'center',dash:d&&val(d,'dash',0)>0?[val(d,'dash',0)*sx,val(d,'gap',0)*sx]:null,dashOffset:val(d,'offset',0)*sx,alignDashes:false});}
        cmd('object.setProps',{opacity:r.opacity*100});return commands;
    };
})(EffectMaster);
