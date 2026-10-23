var M=EffectMaster,passed=0;
function check(ok,message){if(!ok)throw new Error('FAIL: '+message);passed++;writeLn('PASS '+message);}
function near(a,b){return Math.abs(a-b)<.001;}
function find(n,id,out){out=out||[];if(n.match===id)out.push(n);(n.children||[]).forEach(function(c){find(c,id,out);});return out;}
function tree(l){return app.run('layer.tree',{layer:l.id,comp:l.containingComp.id}).properties;}
function val(n,id){return find(n,id)[0].value;}
var c=app.project.items.addComp('Transfer checks',640,480,1,10,30);c.openInViewer();
Object.keys(fixtures).forEach(function(name){
 var before=c.numLayers,r=M.importSnapshot(fixtures[name],{mode:'normal'});check(c.numLayers>before,name+' creates layers');
 var l=r.layers[0],t=tree(l);
 if(name==='rectangle'){check(find(t,'rect').length>0,'rectangle remains parametric');var color=val(find(t,'fill')[0],'color');check(near(color[0],249/255)&&near(color[1],115/255),'RGB colors preserved');check(near(l.transform.position.value[0]-l.transform.anchorPoint.value[0],0),'rectangle position preserved');}
 if(name==='ellipse')check(find(t,'ellipse').length>0,'ellipse remains parametric');
 if(name==='bezier'){var path=find(t,'path').filter(function(x){return x.type==='path';})[0].value.v;check(near(path.out_tangents[0][0],50)&&near(path.out_tangents[0][1],-40),'absolute Bezier handles become relative tangents');}
 if(name==='gradient'||name==='radial')check(find(t,'gfill').length>0,name+' remains an editable gradient');
 if(name==='text'){check(l instanceof TextLayer,'text remains editable');check(l.property('ADBE Text Properties').property('ADBE Text Document').value.text==='Effect Master','text content preserved');}
 if(name==='area'){check(l instanceof TextLayer,'area type stays editable');check(l.property('ADBE Text Properties').property('ADBE Text Document').value.boxText,'area type keeps text box');}
 if(name==='group')check(r.layers.length===1,'normal vector group stays one layer');
 if(name==='clip')check(find(t,'masks').some(function(x){return x.children.length;})||find(t,'merge').length,'clip has native mask or intersect');
});
var s=M.importSnapshot(fixtures.group,{mode:'split'});check(s.layers.length===3,'split group makes controller and children');check(s.layers[1].parent.id===s.layers[0].id&&s.layers[2].parent.id===s.layers[0].id,'split preserves parent hierarchy');
var combined=M.clone(fixtures.group);combined.nodes=combined.nodes[0].kind.children;
var together=M.importSnapshot(combined,{mode:'combine'});check(together.layers.length===1,'combine makes one layer');
var bad=M.clone(fixtures.rectangle);bad.nodes[0].appearance.items[0].paint={type:'pattern',pattern:'Missing'};var count=c.numLayers,threw=false;try{M.importSnapshot(bad,{});}catch(e){threw=true;}check(threw&&c.numLayers===count,'unsupported paint rejects before edits');
var before=c.numLayers;M.importSnapshot(fixtures.rectangle,{});app.run('edit.undo',{});check(c.numLayers===before,'one Undo restores transfer');
var translated=M.clone(fixtures.rectangle);translated.doc.artboards[0].x=50;translated.doc.artboards[0].y=30;var result=M.importSnapshot(translated,{}),tr=tree(result.layers[0]);var rect=find(tr,'rect')[0];check(near(val(rect,'position')[0],110)&&near(val(rect,'position')[1],110),'artboard origin is removed from geometry');
var svg=M.exportSvg(together.layers,c,{x:0,y:0,width:640,height:480});check(svg.indexOf('<rect')>=0&&svg.indexOf('<ellipse')>=0,'reverse exporter preserves native shapes');
var a=M.importSnapshot(fixtures.group,{mode:'split'});for(var i=1;i<=c.numLayers;i++)c.layer(i).selected=false;a.layers[0].selected=true;check(M.releaseGroups()===1,'release removes only selected owned group');check(!a.layers[1].parent&&!a.layers[2].parent,'release leaves artwork unparented');
var group=M.importSnapshot(fixtures.group,{mode:'split'});for(i=1;i<=c.numLayers;i++)c.layer(i).selected=false;group.layers[0].selected=true;var pc=M.precomp();check(pc instanceof CompItem&&pc.numLayers===3,'precomp collects descendants');
for(i=1;i<=c.numLayers;i++)c.layer(i).selected=false;for(i=1;i<=c.numLayers;i++)if(c.layer(i).source&&c.layer(i).source.id===pc.id)c.layer(i).selected=true;
var originalOrder=[];for(i=1;i<=pc.numLayers;i++)originalOrder.push(pc.layer(i).comment);
check(M.decomp()===3,'decomp restores nested layers');
check(c.layer(1).comment===originalOrder[0]&&c.layer(2).comment===originalOrder[1]&&c.layer(3).comment===originalOrder[2],'decomp preserves paint order');
// Update replaces static paths and keys animated ones at the playhead without changing transforms.
var updated=M.importSnapshot(fixtures.bezier,{}).layers[0];
function paths(prop,out){out=out||[];for(var k=1;k<=prop.numProperties;k++){var p=prop.property(k);if(p.propertyValueType===PropertyValueType.SHAPE)out.push(p);if(p.numProperties)paths(p,out);}return out;}
for(i=1;i<=c.numLayers;i++)c.layer(i).selected=false;
var target=paths(updated)[0];target.selected=true;
var rectVertices=fixtures.rectangle.nodes[0].kind.path.subpaths[0].anchors.length;
M.updatePaths(fixtures.rectangle,{});check(target.value.vertices.length===rectVertices,'static path update changes geometry');
var firstShape=target.value;target.setValueAtTime(0,firstShape);c.time=1;
M.updatePaths(fixtures.bezier,{});check(target.numKeys===2&&near(target.keyTime(2),1),'animated path update adds key at playhead');
check(target.keyValue(1).vertices.length===rectVertices&&target.keyValue(2).vertices.length===3,'path update preserves earlier keyframe');
var position=updated.transform.position.value;check(near(position[0],fixtures.bezier.summaries[2].bounds.x+fixtures.bezier.summaries[2].bounds.width/2),'path update preserves layer transform');
target.selected=false;c.time=0;
var bounds=M.nodeBounds(fixtures.bezier.nodes[0]);check(bounds.width<170,'Bezier bounds use curve extrema, not handle hull');
var rectSvg=M.svg(fixtures.rectangle.nodes,fixtures.rectangle.doc.artboards[0],fixtures.rectangle.summaries);check((rectSvg.match(/<rect /g)||[]).length===1,'fill plus stroke shares one editable rectangle');
var reverseRect=M.importSnapshot(fixtures.rectangle,{}).layers[0],reverseSvg=M.exportSvg([reverseRect],c,{x:0,y:0,width:640,height:480});check((reverseSvg.match(/<rect /g)||[]).length===1&&reverseSvg.indexOf('stroke-width=')>=0,'reverse fill and stroke stay on one SVG geometry');
var gradientSvg=M.svg(fixtures.gradient.nodes,fixtures.gradient.doc.artboards[0],fixtures.gradient.summaries);check(gradientSvg.indexOf('x1="70"')>=0&&gradientSvg.indexOf('x2="320"')>=0,'gradient fits geometry rather than stroke bounds');
writeLn('PASS TOTAL '+passed);
