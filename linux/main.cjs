const {app,BrowserWindow,ipcMain,dialog}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const bridge=require('./bridge.cjs');
app.setName('Effect Master');
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(start).catch(e=>{dialog.showErrorBox('Effect Master',e.message);app.quit();});
let window,busy=false,config,preferences,core;
app.on('second-instance',()=>{window?.show();window?.focus();});
app.on('window-all-closed',()=>app.quit());
async function persist(value){const normalized=bridge.settings(value);await fs.mkdir(path.dirname(config),{recursive:true});await fs.writeFile(config+'.tmp',JSON.stringify(normalized,null,2));await fs.rename(config+'.tmp',config);preferences=normalized;window.setAlwaysOnTop(preferences.pinned);return preferences;}
function handle(name,fn){ipcMain.handle(name,async(event,...args)=>{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('Invalid request.');return fn(...args);});}
async function start(){
  config=path.join(app.getPath('userData'),'settings.json');
  try{preferences=bridge.settings(JSON.parse(await fs.readFile(config,'utf8')));}catch{preferences=bridge.settings();}
  core=await fs.readFile(path.join(__dirname,'Effect Master Core.js'),'utf8');
  window=new BrowserWindow({width:330,height:540,minWidth:300,minHeight:500,backgroundColor:'#1b1d21',title:'Effect Master',autoHideMenuBar:true,alwaysOnTop:preferences.pinned,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.on('close',event=>{if(busy){event.preventDefault();dialog.showMessageBox(window,{message:'A transfer is running. Wait for its result before closing.'});}});
  handle('state',async()=>({settings:preferences,busy,connections:busy?null:await bridge.inspect(preferences)}));
  handle('save',value=>{if(busy)throw new Error('Wait for the transfer to finish.');return persist(value);});
  handle('run',async(action,newComp)=>{if(busy)throw new Error('A transfer is already running.');busy=true;try{return await bridge.execute(core,action,preferences,newComp,path.join(app.getPath('documents'),'Effect Master Assets'));}finally{busy=false;}});
  handle('close',()=>window.close());
  handle('choose',async kind=>{
    if(!['vectorPath','effectPath','assetFolder'].includes(kind))throw new Error('Unknown file selection.');
    const result=await dialog.showOpenDialog(window,{title:kind==='assetFolder'?'Choose image folder':'Choose the installed application or AppImage',properties:[kind==='assetFolder'?'openDirectory':'openFile']});
    if(result.canceled)return preferences;return persist({...preferences,[kind]:result.filePaths[0]});
  });
  handle('launch',async name=>{
    if(busy)throw new Error('Wait for the transfer to finish.');
    if(!['vector','effect'].includes(name))throw new Error('Unknown app.');
    const state=await bridge.inspect(preferences);if(state[name])return 'Already connected.';
    const executable=preferences[name+'Path']||(name==='vector'?'vectorcraft':'effectcraft');
    await new Promise((resolve,reject)=>{const child=spawn(executable,[],{detached:true,stdio:'ignore',env:{...process.env,[name==='vector'?'VECTORCRAFT_CONTROL_PORT':'EFFECTCRAFT_CONTROL_PORT']:String(preferences[name==='vector'?'vectorPort':'effectPort'])}});child.once('error',()=>reject(new Error('Could not open the app. Choose its executable or AppImage in Settings.')));child.once('spawn',()=>{child.unref();resolve();});});
    return 'Opening app. If it is already running offline, save and close it, then click its name again.';
  });
  handle('install',async()=>{
    if(process.platform!=='linux')throw new Error('This installer is for Linux.');
    const folder=path.dirname(process.execPath);
    if(/[\r\n\0]/.test(folder))throw new Error('Move this folder to a path without line breaks.');
    const quote=s=>'"'+s.replace(/[\\"`$]/g,'\\$&').replace(/%/g,'%%')+'"';
    const applications=path.join(process.env.XDG_DATA_HOME||path.join(os.homedir(),'.local/share'),'applications');
    await fs.mkdir(applications,{recursive:true});
    await fs.writeFile(path.join(applications,'effect-master.desktop'),'[Desktop Entry]\nType=Application\nName=Effect Master\nComment=Linked artwork transfers between VectorCraft and EffectCraft\nExec='+quote(process.execPath)+'\nIcon='+path.join(__dirname,'icon.svg')+'\nTerminal=false\nCategories=Graphics;\n');
    return 'Added Effect Master to your applications menu. Keep the extracted folder in this location.';
  });
  await window.loadFile(path.join(__dirname,'index.html'));
}
