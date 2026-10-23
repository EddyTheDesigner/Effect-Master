const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('effectMaster',{
  state:()=>ipcRenderer.invoke('state'),
  save:value=>ipcRenderer.invoke('save',value),
  run:(action,newComp)=>ipcRenderer.invoke('run',action,newComp),
  launch:app=>ipcRenderer.invoke('launch',app),
  choose:kind=>ipcRenderer.invoke('choose',kind),
  install:()=>ipcRenderer.invoke('install'),
  close:()=>ipcRenderer.invoke('close')
});
