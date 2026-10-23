/* VectorCraft node -> editable SVG. Unsupported artwork fails before project edits. */
(function(M){
    function n(v){M.assert(typeof v==='number'&&isFinite(v),'Invalid coordinate in source artwork.');return Math.round(v*1000000)/1000000;}
    function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    M.xml=esc;
    function pt(p){return Array.isArray(p)?p:[p.x,p.y];}
    M.point=pt;
    M.rgb=function(c){
        M.assert(c&&c.model==='rgb','Editable transfer requires RGB colors. Convert the VectorCraft document to RGB, or use Rasterize.');
        return [c.r,c.g,c.b];
    };
    M.cssColor=function(c){var v=M.rgb(c);return 'rgb('+v.map(function(x){return n(x*100)+'%';}).join(',')+')';};
    M.pathData=function(path){
        var out=[];for(var s=0;s<path.subpaths.length;s++){var sub=path.subpaths[s],a=sub.anchors;if(!a.length)continue;
            var p=pt(a[0].p);out.push('M'+n(p[0])+','+n(p[1]));
            var count=a.length+(sub.closed?1:0);
            for(var j=1;j<count;j++){var prev=a[(j-1)%a.length],next=a[j%a.length],v=pt(next.p),o=pt(prev.out||prev.p),h=pt(next['in']||next.p);
                out.push('C'+n(o[0])+','+n(o[1])+' '+n(h[0])+','+n(h[1])+' '+n(v[0])+','+n(v[1]));}
            if(sub.closed)out.push('Z');
        }return out.join(' ');
    };
    M.isVector=function(node){var k=node.kind;if(k.type==='path'||k.type==='compound')return true;if(k.type==='group'||k.type==='layer')return k.children.every(M.isVector);return false;};
    function noEffects(node){
        M.assert(!node.mask,'Opacity masks require Rasterize.');
        M.assert(!node.isolate&&!node.knockout&&!node.knockout_shape,'Isolated/knockout transparency requires Rasterize.');
        M.assert(!node.appearance||!(node.appearance.effects||[]).length,'Live effects require Rasterize.');
    }
    M.checkNode=noEffects;
    M.svg=function(nodes,board,summaries){
        var defs=[],serial=0;
        function paint(p,b){
            if(!p||p.type==='none')return 'none';if(p.type==='solid')return M.cssColor(p.color);
            M.assert(p.type==='gradient','Patterns require Rasterize.');
            var g=p.gradient,radial=g.kind==='Radial';M.assert(g.kind==='Linear'||radial,'Freeform gradients require Rasterize.');
            var geom=p.geom;
            if(!geom){var a=(p.angle||0)*Math.PI/180,dx=Math.cos(a),dy=-Math.sin(a),cx=b.x+b.width/2,cy=b.y+b.height/2,half=radial?Math.max(b.width,b.height)/2:(b.width*Math.abs(dx)+b.height*Math.abs(dy))/2;
                geom={start:radial?[cx,cy]:[cx-dx*half,cy-dy*half],end:[cx+dx*half,cy+dy*half]};}
            M.assert(!radial||(!geom.focal&&Math.abs((geom.aspect===undefined?1:geom.aspect)-1)<0.00001),'Elliptical or off-center radial gradients require Rasterize.');
            var start=pt(geom.start),end=pt(geom.end),id='emg'+(++serial),attrs=radial?'cx="'+n(start[0])+'" cy="'+n(start[1])+'" r="'+n(Math.sqrt(Math.pow(end[0]-start[0],2)+Math.pow(end[1]-start[1],2)))+'"':'x1="'+n(start[0])+'" y1="'+n(start[1])+'" x2="'+n(end[0])+'" y2="'+n(end[1])+'"';
            var tag=radial?'radialGradient':'linearGradient',stops='';
            for(var i=0;i<g.stops.length;i++){var stop=g.stops[i];M.assert(stop.midpoint===undefined||Math.abs(stop.midpoint-.5)<.00001,'Custom gradient midpoints require Rasterize.');stops+='<stop offset="'+n(stop.offset)+'" stop-color="'+M.cssColor(stop.color)+'" stop-opacity="'+n(stop.opacity===undefined?1:stop.opacity)+'"/>';}
            defs.push('<'+tag+' id="'+id+'" gradientUnits="userSpaceOnUse" '+attrs+'>'+stops+'</'+tag+'>');return 'url(#'+id+')';
        }
        function geometry(node){var k=node.kind;
            if(k.type==='compound'){var d='';k.children.forEach(function(c){M.assert(c.kind.type==='path','Unsupported compound member.');d+=M.pathData(c.kind.path)+' ';});return '<path d="'+d+'"';}
            var live=k.live;
            if(live&&(live.shape==='rectangle'||live.shape==='ellipse')){
                var xf=live.xf,axis=Math.abs(xf[1])<1e-8&&Math.abs(xf[2])<1e-8&&xf[0]>0&&xf[3]>0;
                if(axis&&live.shape==='rectangle'&&live.radii.every(function(r){return r===live.radii[0];})&&(!live.kinds||live.kinds.every(function(t){return t==='Round';}))&&!live.radii_relative){
                    var radius=live.radii[0];if(!radius||Math.abs(xf[0]-xf[3])<1e-8)return '<rect x="'+n(xf[4])+'" y="'+n(xf[5])+'" width="'+n(live.w*xf[0])+'" height="'+n(live.h*xf[3])+'" rx="'+n(radius*xf[0])+'"';
                }
                if(axis&&live.shape==='ellipse'&&Math.abs(live.pie[1]-live.pie[0])>=359.999)return '<ellipse cx="'+n(xf[4]+live.w*xf[0]/2)+'" cy="'+n(xf[5]+live.h*xf[3]/2)+'" rx="'+n(live.w*xf[0]/2)+'" ry="'+n(live.h*xf[3]/2)+'"';
            }
            return '<path d="'+M.pathData(k.path)+'"';
        }
        function draw(node){
            if(node.visible===false)return '';noEffects(node);var k=node.kind,name=node.name||('Object '+node.id),opacity=node.opacity===undefined?1:node.opacity;
            M.assert(!node.blend||node.blend==='Normal','Blend modes require Rasterize in this release.');
            var head='<g id="'+esc(name)+'" opacity="'+n(opacity)+'">';
            if(k.type==='group'||k.type==='layer'){
                M.assert(!k.template,'Template layers are not transferable.');
                M.assert(!(node.appearance&&node.appearance.items&&node.appearance.items.length),'Group appearances require Rasterize.');
                var children=k.children,body='',clip='';
                M.assert(!k.clip,'Nested clipping groups require separate transfers or Rasterize.');
                for(var c=k.clip?1:0;c<children.length;c++)body+=draw(children[c]);
                return head+'<g'+clip+'>'+body+'</g></g>';
            }
            M.assert(k.type==='path'||k.type==='compound','Use Rasterize for '+k.type+' artwork.');
            // Unplaced gradients fit geometric bounds, not the stroke-expanded selection box.
            var b=M.nodeBounds(node);
            var items=node.appearance?node.appearance.items||[]:[],shapes='',paintAttrs=[];
            for(var i=0;i<items.length;i++){var item=items[i];if(item.visible===false||!item.paint||item.paint.type==='none')continue;
                M.assert(!(item.effects||[]).length,'Appearance effects require Rasterize.');
                M.assert(!item.blend||item.blend==='Normal','Appearance blend modes require Rasterize.');
                M.assert(!item.overprint,'Overprint artwork requires Rasterize.');
                var pb=b;if(item.kind==='stroke')pb={x:b.x-item.width/2,y:b.y-item.width/2,width:b.width+item.width,height:b.height+item.width};
                var p=paint(item.paint,pb),attrs=' opacity="'+n(item.opacity===undefined?1:item.opacity)+'"';
                if(item.kind==='fill')attrs+=' fill="'+p+'" fill-rule="'+(k.rule==='EvenOdd'?'evenodd':'nonzero')+'" stroke="none"';
                else{
                    M.assert(!item.brush&&!item.profile&&!item.start_arrow&&!item.end_arrow&&(!item.align||item.align==='Center')&&(!item.gradient_mode||item.gradient_mode==='Within'),'Brushes, variable widths, arrows, and aligned strokes require Rasterize.');
                    attrs+=' fill="none" stroke="'+p+'" stroke-width="'+n(item.width)+'" stroke-linecap="'+({Round:'round',Square:'square'}[item.cap]||'butt')+'" stroke-linejoin="'+({Round:'round',Bevel:'bevel'}[item.join]||'miter')+'" stroke-miterlimit="'+n(item.miter_limit||10)+'"';
                    if(item.dash){var lengths=item.dash.pattern;M.assert(lengths&&lengths.length<=2&&!item.dash.align_corners,'This dash pattern requires Rasterize.');attrs+=' stroke-dasharray="'+lengths.map(n).join(' ')+'" stroke-dashoffset="'+n(item.dash.offset||0)+'"';}
                }
                paintAttrs.push({kind:item.kind,attrs:attrs});shapes+=geometry(node)+attrs+'/>';
            }
            if(paintAttrs.length===2&&paintAttrs[0].kind==='fill'&&paintAttrs[1].kind==='stroke'){
                var fillAttrs=paintAttrs[0].attrs.replace(' opacity=',' fill-opacity=').replace(' stroke="none"','');
                var strokeAttrs=paintAttrs[1].attrs.replace(' opacity=',' stroke-opacity=').replace(' fill="none"','');
                shapes=geometry(node)+fillAttrs+strokeAttrs+'/>';
            }
            return head+shapes+'</g>';
        }
        var body=nodes.map(draw).join('');
        return '<svg xmlns="http://www.w3.org/2000/svg" width="'+n(board.width)+'" height="'+n(board.height)+'" viewBox="0 0 '+n(board.width)+' '+n(board.height)+'"><defs>'+defs.join('')+'</defs><g transform="translate('+n(-board.x)+' '+n(-board.y)+')">'+body+'</g></svg>';
    };
    M.nodeBounds=function(node){
        var points=[];
        function curve(p,a,b,q){
            points.push(p,q);var ts=[];
            for(var d=0;d<2;d++){var A=-p[d]+3*a[d]-3*b[d]+q[d],B=2*(p[d]-2*a[d]+b[d]),C=a[d]-p[d];
                if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)ts.push(-C/B);}else{var disc=B*B-4*A*C;if(disc>=0){ts.push((-B+Math.sqrt(disc))/(2*A),(-B-Math.sqrt(disc))/(2*A));}}}
            ts.forEach(function(t){if(t>0&&t<1){var u=1-t;points.push([0,1].map(function(d){return u*u*u*p[d]+3*u*u*t*a[d]+3*u*t*t*b[d]+t*t*t*q[d];}));}});
        }
        function walk(o){var k=o.kind;if(k.path)k.path.subpaths.forEach(function(s){var a=s.anchors;for(var i=0;i<a.length;i++){points.push(pt(a[i].p));if(i+1<a.length||s.closed){var b=a[(i+1)%a.length];curve(pt(a[i].p),pt(a[i].out||a[i].p),pt(b['in']||b.p),pt(b.p));}}});if(k.children)k.children.forEach(walk);}
        walk(node);M.assert(points.length,'Artwork bounds unavailable.');var xs=points.map(function(p){return p[0];}),ys=points.map(function(p){return p[1];});var x=Math.min.apply(null,xs),y=Math.min.apply(null,ys);return {x:x,y:y,width:Math.max.apply(null,xs)-x,height:Math.max.apply(null,ys)-y};
    };
    M.toShape=function(sub,offset){var shape=new Shape();offset=offset||[0,0];shape.vertices=[];shape.inTangents=[];shape.outTangents=[];shape.closed=!!sub.closed;sub.anchors.forEach(function(a){var p=pt(a.p),h=pt(a['in']||a.p),o=pt(a.out||a.p);shape.vertices.push([p[0]-offset[0],p[1]-offset[1]]);shape.inTangents.push([h[0]-p[0],h[1]-p[1]]);shape.outTangents.push([o[0]-p[0],o[1]-p[1]]);});return shape;};
})(EffectMaster);
