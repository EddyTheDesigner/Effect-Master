const api=window.effectMaster,$=id=>document.getElementById(id);
let prefs={},busy=false,polling=false,draft;
const drawings={
 up:'<path d="M12 17V3m-5 5 5-5 5 5M4 17v4h16v-4"/>',down:'<path d="M12 3v14m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 raster:'<rect x="3" y="3" width="18" height="18"/><path d="m3 17 6-7 4 4 4-5 4 5"/><circle cx="8" cy="7" r="1"/>',
 normal:'<rect x="3" y="3" width="13" height="13"/><path d="M8 18v3h13V8h-3"/>',split:'<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/>',combine:'<rect x="3" y="3" width="18" height="18"/><path d="M7 12h10m-5-5v10"/>',
 center:'<rect x="5" y="5" width="14" height="14"/><path d="M1 12h22M12 1v22"/>',update:'<path d="M4 9a8 8 0 1 1 1 10M3 3v7h7"/>',
 link:'<path d="m10 8 3-3a4 4 0 0 1 6 6l-3 3M14 16l-3 3a4 4 0 0 1-6-6l3-3m1 5 6-6"/>',unlink:'<path d="m13 5 1-1a4 4 0 0 1 6 6l-1 1M11 19l-1 1a4 4 0 0 1-6-6l1-1M3 3l18 18"/>',
 new:'<path d="M12 3v18M3 12h18"/>',all:'<rect x="6" y="6" width="15" height="15"/><path d="M3 18V3h15"/>',swatches:'<path d="M3 5h5v14H3zM10 5h5v14h-5zM17 5h4v14h-4z"/>',guides:'<path d="M7 2v20M17 2v20M2 7h20M2 17h20"/>',
 precomp:'<rect x="3" y="4" width="18" height="16"/><rect x="8" y="8" width="8" height="8"/>',decomp:'<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><rect x="9" y="9" width="6" height="6"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',trash:'<path d="M3 6h18M9 3h6M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',pin:'<path d="m8 3 8 0-1 7 3 4H6l3-4ZM12 14v8"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
};
function icon(name,copy=false){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+drawings[name]+(copy?'<path d="M19 1v6m-3-3h6"/>':'')+'</svg>';}
function status(message,error=false){$('status').textContent=message;$('status').classList.toggle('error',error);}
function button(parent,name,title,action,copy=false){const b=document.createElement('button');b.title=title;b.setAttribute('aria-label',title);b.innerHTML=icon(name,copy);b.disabled=busy;b.onclick=action;parent.append(b);return b;}
async function save(patch){try{prefs=await api.save({...prefs,...patch});render();}catch(e){status(e.message,true);}}
async function run(action,shift=false){if(busy)return;busy=true;render();status('Transferring…');try{status(await api.run(action,shift));}catch(e){status(e.message,true);}finally{busy=false;render();await poll();}}
function render(){
  document.documentElement.style.setProperty('--accent',{Coral:'#f97354',Lime:'#a8d46b',Blue:'#66b3f5',Violet:'#b191ed'}[prefs.accent]||'#f97354');document.documentElement.style.setProperty('--radius',(prefs.roundness??8)+'px');
  $('pin').innerHTML=icon('pin');$('pin').classList.toggle('active',!!prefs.pinned);$('settingsButton').innerHTML=icon('menu');
  for(const id of ['pin','settingsButton','vectorTab','effectTab','vectorConnection','effectConnection'])$(id).disabled=busy;
  $('vectorTab').classList.toggle('active',prefs.view!=='effect');$('effectTab').classList.toggle('active',prefs.view==='effect');
  for(const id of ['transfers','modes','links','context'])$(id).replaceChildren();
  button($('transfers'),'up','Send to EffectCraft; Shift creates a matching composition',e=>run('toEffectCraft',e.shiftKey));
  button($('transfers'),'down','Update linked originals in VectorCraft',()=>run('toVectorCraft'));
  button($('transfers'),'raster','Rasterize VectorCraft selection as transparent PNG',()=>run('raster'));
  for(const mode of ['normal','split','combine'])button($('modes'),mode,mode[0].toUpperCase()+mode.slice(1)+' transfer mode',()=>save({mode})).classList.toggle('active',prefs.mode===mode);
  button($('modes'),'center','Center artboard in composition',()=>save({center:!prefs.center})).classList.toggle('active',!!prefs.center);
  button($('modes'),'update','Update selected EffectCraft properties; animated properties get a key at the playhead',()=>run('update'));
  button($('links'),'link','Link one selected VectorCraft object to one selected matching EffectCraft layer',()=>run('link'));
  button($('links'),'unlink','Unlink selection in the active app tab',()=>run(prefs.view==='effect'?'unlink':'unlinkVector'));
  button($('links'),'up','Send new copies to EffectCraft',()=>run('copyToEffect'),true);
  button($('links'),'down','Send new copies to VectorCraft at the current pose',()=>run('copyToVector'),true);
  $('contextTitle').textContent=prefs.view==='effect'?'GROUPS':'ARTBOARD';
  const rows=prefs.view==='effect'?[['precomp','Precompose selection and descendants'],['decomp','Decompose a compatible precomp'],['eye','Hide or show controllers in timeline'],['trash','Release group controllers']]:[['new','New composition matching the artboard'],['all','Send all visible artwork'],['swatches','Import RGB document swatches'],['guides','Import ruler guides']];
  for(const [name,title]of rows)button($('context'),name,title,()=>run(name));
}
async function poll(){if(polling||busy)return;polling=true;try{const state=await api.state();if(!Object.keys(prefs).length){prefs=state.settings;render();}if(state.connections)for(const [name,label,field]of [['vector','VectorCraft','document'],['effect','EffectCraft','composition']]){const b=$(name+'Connection');b.textContent='● '+label+' · '+state.connections[field];b.classList.toggle('online',state.connections[name]);b.title=b.textContent;}}catch(e){status(e.message,true);}finally{polling=false;}}
for(const name of ['vector','effect'])$(name+'Connection').onclick=async()=>{try{status(await api.launch(name));await poll();}catch(e){status(e.message,true);}};
$('pin').onclick=()=>save({pinned:!prefs.pinned});$('vectorTab').onclick=()=>save({view:'vector'});$('effectTab').onclick=()=>save({view:'effect'});
function paths(){ $('paths').textContent='VC: '+(draft.vectorPath||'vectorcraft on PATH')+'\nEC: '+(draft.effectPath||'effectcraft on PATH')+'\nImages: '+(draft.assetFolder||'Default project folder'); }
$('settingsButton').onclick=()=>{draft={...prefs};for(const key of ['accent','roundness','artboard','fps','duration','vectorPort','effectPort'])$('settingsForm').elements[key].value=key==='artboard'?prefs[key]+1:prefs[key];paths();$('settingsDialog').showModal();};
$('cancelSettings').onclick=()=>$('settingsDialog').close();
$('settingsForm').onsubmit=async e=>{e.preventDefault();for(const key of ['accent','roundness','artboard','fps','duration','vectorPort','effectPort']){const value=$('settingsForm').elements[key].value;draft[key]=key==='accent'?value:Number(value)-(key==='artboard'?1:0);}await save(draft);$('settingsDialog').close();};
for(const b of document.querySelectorAll('[data-choose]'))b.onclick=async()=>{try{prefs=await api.choose(b.dataset.choose);draft[b.dataset.choose]=prefs[b.dataset.choose];paths();}catch(e){status(e.message,true);}};
$('clearAssets').onclick=()=>{draft.assetFolder='';paths();};
$('install').onclick=async()=>{try{status(await api.install());$('settingsDialog').close();}catch(e){status(e.message,true);}};
poll();setInterval(poll,2500);
