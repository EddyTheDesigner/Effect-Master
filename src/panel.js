(function(thisObj){
    var M=EffectMaster,ui=thisObj instanceof Panel?thisObj:new Window('palette','Effect Master',undefined,{resizeable:true});
    var defaultPort=7979;
    var settings={connectionVersion:3,port:defaultPort,artboard:-1,mode:'normal',center:false,accent:'Coral',roundness:8,fps:30,duration:10,assetFolder:''},busy=false,connected=false,lastError='',doc=null;
    try{var saved=JSON.parse(app.settings.getSetting('Effect Master','settings'));for(var k in settings)if(saved[k]!==undefined)settings[k]=saved[k];if(saved.connectionVersion!==3){settings.port=defaultPort;settings.connectionVersion=3;}}catch(ignore){}
    M.port=settings.port;
    var accents={Coral:[.98,.45,.35,1],Lime:[.67,.83,.33,1],Blue:[.36,.66,.94,1],Violet:[.68,.52,.94,1]};
    var C={bg:[.105,.11,.12,1],well:[.075,.08,.09,1],border:[.25,.27,.30,1],text:[.83,.85,.88,1],muted:[.48,.52,.57,1]};
    function accent(){return accents[settings.accent]||accents.Coral;}
    function rgb(c){return c.slice(0,3).map(function(v){return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).concat([c[3]===undefined?1:c[3]]);}
    function size(c){return [c.size.width||c.size[0],c.size.height||c.size[1]];}
    function pen(g,c,w){return g.newPen(g.PenType.SOLID_COLOR,rgb(c),w||1.4);}
    function brush(g,c){return g.newBrush(g.BrushType.SOLID_COLOR,rgb(c));}
    function poly(g,p,c,fill){g.newPath();p.forEach(function(v,i){if(i)g.lineTo(v[0],v[1]);else g.moveTo(v[0],v[1]);});if(fill){g.closePath();g.fillPath(brush(g,c));}else g.strokePath(pen(g,c));}
    function box(g,x,y,w,h,r,fill,stroke){r=Math.max(0,Math.min(r,w/2,h/2));g.newPath();var centers=[[x+w-r,y+r],[x+w-r,y+h-r],[x+r,y+h-r],[x+r,y+r]];
        centers.forEach(function(p,i){for(var s=0;s<=6;s++){var a=(-90+i*90+s*15)*Math.PI/180,xx=p[0]+r*Math.cos(a),yy=p[1]+r*Math.sin(a);if(!i&&!s)g.moveTo(xx,yy);else g.lineTo(xx,yy);}});g.closePath();if(fill)g.fillPath(brush(g,fill));if(stroke)g.strokePath(pen(g,stroke,1));}
    function text(g,t,x,y,c,fs){g.drawString(String(t),pen(g,c,1),x,y,ScriptUI.newFont('dialog','REGULAR',fs||11));}
    function icon(g,id,x,y,c,scale){scale=scale||1;function p(v,fill){poly(g,v.map(function(v){return [x+v[0]*scale,y+v[1]*scale];}),c,fill);}function r(a,b,w,h){box(g,x+a*scale,y+b*scale,w*scale,h*scale,1,null,c);}
        if(id==='pull'||id==='push'){var d=id==='pull'?1:-1;p([[-4,-8*d],[4,-8*d],[4,0],[8,0],[0,8*d],[-8,0],[-4,0]],true);p([[-9,8*d],[-9,11*d],[9,11*d],[9,8*d]],false);}
        else if(id==='raster'){r(-9,-9,18,18);p([[-8,6],[-2,-1],[2,3],[6,-3],[9,2]],false);r(-5,-6,2,2);}
        else if(id==='normal'){r(-8,-7,12,12);r(-3,-2,12,12);}
        else if(id==='split'){r(-9,-8,7,7);r(2,-8,7,7);r(-9,3,7,7);r(2,3,7,7);}
        else if(id==='combine'){r(-8,-8,16,16);p([[-4,0],[4,0]],false);p([[0,-4],[0,4]],false);}
        else if(id==='center'){r(-8,-8,16,16);p([[-11,0],[11,0]],false);p([[0,-11],[0,11]],false);}
        else if(id==='update'){p([[-8,-1],[-5,-7],[3,-8],[8,-4],[8,0]],false);p([[4,-2],[8,2],[11,-3]],false);p([[8,5],[3,9],[-5,7],[-8,3]],false);}
        else if(id==='new'){r(-9,-7,18,14);p([[-4,0],[4,0]],false);p([[0,-4],[0,4]],false);}
        else if(id==='precomp'){r(-9,-8,18,16);r(-4,-4,8,8);}
        else if(id==='decomp'){p([[-9,-2],[-9,-8],[-3,-8]],false);p([[3,-8],[9,-8],[9,-2]],false);p([[9,2],[9,8],[3,8]],false);p([[-3,8],[-9,8],[-9,2]],false);r(-4,-4,8,8);}
        else if(id==='eye'){p([[-10,0],[-5,-5],[0,-6],[5,-5],[10,0],[5,5],[0,6],[-5,5],[-10,0]],false);r(-2,-2,4,4);}
        else if(id==='trash'){p([[-5,-4],[-4,9],[4,9],[5,-4]],false);p([[-8,-6],[8,-6]],false);p([[-3,-9],[3,-9]],false);}
        else if(id==='swatches'){r(-9,-7,6,14);r(-3,-7,6,14);r(3,-7,6,14);}
        else if(id==='guides'){p([[-8,-10],[-8,10]],false);p([[-11,-6],[11,-6]],false);p([[-3,1],[7,1],[7,8],[-3,8],[-3,1]],false);}
        else if(id==='all'){r(-8,-9,12,14);p([[-4,9],[8,9],[8,-5]],false);}
        else if(id==='connect'){p([[-9,0],[-5,-5],[0,-5],[4,-1]],false);p([[-4,1],[0,5],[5,5],[9,0]],false);p([[-4,3],[4,-3]],false);}
        else if(id==='menu'){for(var i=-1;i<=1;i++)p([[-6,i*4],[6,i*4]],false);}
        else if(id==='mark'){p([[-8,8],[-8,-8],[8,-8],[8,-4],[-4,-4],[-4,-1],[5,-1],[5,3],[-4,3],[-4,8]],true);}
    }
    ui.orientation='column';ui.alignChildren=['fill','top'];ui.margins=10;ui.spacing=6;ui.preferredSize=[280,320];
    ui.onDraw=function(){var s=size(this);box(this.graphics,0,0,s[0],s[1],0,C.bg,null);};
    function row(parent){var r=parent.add('group');r.orientation='row';r.alignChildren=['fill','center'];r.spacing=5;return r;}
    function save(){app.settings.saveSetting('Effect Master','settings',JSON.stringify(settings));}
    function status(s,error){statusText.text=s;statusText.helpTip=s;lastError=error?s:'';}
    function act(fn){if(busy)return;busy=true;try{fn();}catch(e){status(e.message||String(e),true);}finally{busy=false;ui.layout.layout(true);}}
    var buttons=[];
    function button(parent,id,label,action,w,h){var b=parent.add('button',undefined,label,{name:id});b.preferredSize=[w||38,h||34];b.helpTip=label;
        b.onDraw=function(){var g=this.graphics,s=size(this),a=accent(),active=this.active,primary=id==='pull';box(g,1,1,s[0]-2,s[1]-2,settings.roundness,active?[a[0]*.18,a[1]*.18,a[2]*.18,1]:C.well,active||primary?a:C.border);icon(g,id,s[0]/2,s[1]/2,active||primary?a:C.text,h>45?1.25:.85);};
        b.addEventListener('mousedown',function(e){b.mods={shift:e.shiftKey,alt:e.altKey,ctrl:e.ctrlKey};});b.onClick=function(){var mods=b.mods||{};b.mods=null;act(function(){action(mods);});};buttons.push(b);return b;}
    var header=row(ui),brand=header.add('group');brand.preferredSize=[198,24];
    brand.onDraw=function(){icon(this.graphics,'mark',9,12,accent(),.75);text(this.graphics,'Effect Master',26,3,C.text,13);};
    button(header,'menu','Settings and help',showSettings,26,24);
    var connection=row(ui),host=connection.add('statictext',undefined,'VectorCraft · click to connect');host.preferredSize=[210,18];
    host.onDraw=function(){var g=this.graphics;box(g,1,7,5,5,2,connected?accent():C.muted,null);text(g,this.text,13,2,C.muted,10);};
    button(connection,'connect','Connect to VectorCraft',connect,25,23);
    var transfer=row(ui);
    button(transfer,'pull','Pull selection from VectorCraft · Shift: new composition',function(mod){var o=M.clone(settings);o.newComp=!!mod.shift;var result=M.pull(o);status('Transferred '+result.count+' layers.');},82,58);
    button(transfer,'push','Push selected shape layers to VectorCraft',function(){status('Sent '+M.push(settings)+' layers to VectorCraft.');},82,58);
    button(transfer,'raster','Rasterize selection as a transparent 2× PNG',function(){var result=M.rasterize(settings);status(result.warnings.length?'Imported PNG · '+result.warnings.join('; '):'Imported transparent 2× PNG.');},82,58);
    var modes=row(ui),modeButtons={};['normal','split','combine'].forEach(function(mode){var labels={normal:'Normal transfer · groups become shape layers',split:'Split shapes · preserve groups as parents',combine:'Combine selected vectors into one shape layer'};modeButtons[mode]=button(modes,mode,labels[mode],function(){settings.mode=mode;save();refreshModes();status(labels[mode]);},47,30);});
    var center=button(modes,'center','Center the artboard in the composition',function(){settings.center=!settings.center;save();refreshModes();status(settings.center?'Artboard centered in composition.':'Preserve artboard coordinates.');},47,30);
    button(modes,'update','Update selected shape, fill, stroke or geometry properties; animated properties get a key at the playhead',function(){status('Updated '+M.updateProperties(M.readSelection(),settings)+' properties.');},47,30);
    function label(s){var l=ui.add('statictext',undefined,s);l.preferredSize=[250,13];l.onDraw=function(){text(this.graphics,s,1,0,C.muted,9);};}
    label('GROUPS');var groups=row(ui);
    button(groups,'precomp','Precompose selection and group descendants',function(){M.precomp();status('Selection precomposed.');},60,32);
    button(groups,'decomp','Decompose a compatible precomposition',function(){status('Decomposed '+M.decomp()+' layers.');},60,32);
    button(groups,'eye','Hide / show Effect Master groups in the timeline',function(){status('Toggled '+M.toggleGroups()+' groups.');},60,32);
    button(groups,'trash','Release selected Effect Master groups',function(){status('Released '+M.releaseGroups()+' groups.');},60,32);
    label('ARTBOARD');var extras=row(ui);
    button(extras,'new','Create a matching composition from the chosen artboard',function(){var d=M.vc('document.inspect',{depth:0});app.beginUndoGroup('Effect Master · New composition');try{M.newComp(M.board({doc:d},settings.artboard),settings);}finally{app.endUndoGroup();}status('Created matching composition.');},60,32);
    button(extras,'all','Pull all visible artwork from the document',function(){var o=M.clone(settings);o.all=true;status('Transferred '+M.pull(o).count+' layers.');},60,32);
    button(extras,'swatches','Transfer RGB document swatches as a guide layer',function(){status('Created '+M.swatches()+' swatches.');},60,32);
    button(extras,'guides','Transfer visible ruler guides for this artboard',function(){status('Created '+M.guides(settings)+' guides.');},60,32);
    var statusText=ui.add('statictext',undefined,'Select in VectorCraft. Pull here.');statusText.preferredSize=[255,22];
    statusText.onDraw=function(){var g=this.graphics,w=size(this)[0],s=this.text;while(s.length>3&&g.measureString(s,ScriptUI.newFont('dialog','REGULAR',10))[0]>w)s=s.slice(0,-2)+'…';text(g,s,1,4,lastError?accent():C.muted,10);};
    statusText.addEventListener('click',function(){if(statusText.text)alert(statusText.text,'Effect Master');});
    function refreshModes(){for(var mode in modeButtons)modeButtons[mode].active=settings.mode===mode;center.active=settings.center;}
    function connect(){M.port=settings.port;doc=M.vc('document.inspect',{depth:0});connected=true;host.text='VectorCraft · '+doc.title;status(doc.selection.length+' selected · '+doc.artboards.length+' artboards');}
    function showSettings(){
        var d=new Window('dialog','Effect Master settings');d.orientation='column';d.alignChildren=['fill','top'];d.margins=16;d.spacing=9;
        function field(title,value){var r=row(d);var l=r.add('statictext',undefined,title);l.preferredSize=[110,22];var f=r.add('edittext',undefined,String(value));f.characters=24;return f;}
        var artboard=field('Artboard (0=active)',settings.artboard+1),fps=field('New comp FPS',settings.fps),duration=field('Duration (seconds)',settings.duration),assets=field('Image folder',settings.assetFolder);
        var appearance=row(d);appearance.add('statictext',undefined,'Accent');var color=appearance.add('dropdownlist',undefined,['Coral','Lime','Blue','Violet']);color.selection=['Coral','Lime','Blue','Violet'].indexOf(settings.accent);appearance.add('statictext',undefined,'Corners');var radius=appearance.add('edittext',undefined,String(settings.roundness));radius.characters=3;
        var help=d.add('statictext',undefined,'Open both apps normally after running Effect Master setup.\nEnable script file/network access in EffectCraft settings.\nUse the floating Effect Master palette or this dockable panel.\nShift + pull creates a matching composition.\n\nNormal: groups stay together. Split: each object is a layer.\nCombine: vectors only. Update: select Path properties first.\nRasterize preserves complex artwork as a 2× PNG.\n\nPhotoCraft and FigCraft are reserved for a later release.',{multiline:true});help.preferredSize=[400,164];
        var note=d.add('statictext',undefined,'Blank image folder uses Effect Master Assets beside the project.');note.preferredSize=[400,30];
        var actions=row(d),ok=actions.add('button',undefined,'Save',{name:'saveSettings'});ok.onClick=function(){
            var a=Number(artboard.text),f=Number(fps.text),t=Number(duration.text),r=Number(radius.text);
            if(!isFinite(a)||a<0||a%1||!isFinite(f)||f<1||f>120||!isFinite(t)||t<=0||t>10800||!isFinite(r)||r<0||r>16){note.text='Use a valid artboard, FPS 1–120, duration, and corners 0–16.';return;}
            settings.artboard=a-1;settings.fps=f;settings.duration=t;settings.roundness=r;settings.assetFolder=assets.text;settings.accent=color.selection.text;save();d.close();ui.layout.layout(true);
        };var cancel=actions.add('button',undefined,'Cancel');cancel.onClick=function(){d.close();};d.defaultElement=ok;d.cancelElement=cancel;d.show();
    }
    refreshModes();ui.onResizing=ui.onResize=function(){this.layout.resize();};
    if(ui instanceof Window)ui.show();else ui.layout.layout(true);
    try{M.timeout=1;connect();}catch(error){status(error.message||String(error),true);}finally{M.timeout=8;}
})(this);
