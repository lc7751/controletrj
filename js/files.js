// files.js - monitor automático de diretório e funções de tasks
(function(){
  const MONITOR_INTERVAL_MS = 30000; // 30s
  let monitor = {
    handle: null,
    timer: null,
    lastSignature: localStorage.getItem('trj_lastSignature') || null,
    busy: false
  };

  async function connectFolder(){
    if(!window.showDirectoryPicker) throw new Error('File System Access API não suportado.');
    const handle = await window.showDirectoryPicker();
    monitor.handle = handle;
    localStorage.setItem('trj_connectedFolderName', handle.name || 'folder');
    startAutoMonitor();
    return handle;
  }

  function buildSignature(list){
    return list.map(f=> `${f.name}::${f.size || 0}::${f.lastModified || ''}`).join('|');
  }

  async function scanFolderOnce(){
    if(!monitor.handle) throw new Error('Nenhuma pasta conectada');
    const entries = [];
    for await (const [name, entry] of monitor.handle.entries()){
      if(entry.kind === 'file'){
        try{
          const fh = await entry.getFile();
          entries.push({ name: fh.name, size: fh.size, lastModified: fh.lastModified || 0 });
        }catch(e){/* ignorar */}
      }
    }
    const sig = buildSignature(entries);
    return { entries, signature: sig };
  }

  async function startAutoMonitor(){
    if(monitor.timer) clearInterval(monitor.timer);
    try {
      const { signature } = await scanFolderOnce();
      monitor.lastSignature = signature;
      localStorage.setItem('trj_lastSignature', signature);
    } catch(err){ console.warn('Monitor start failed:', err); }
    monitor.timer = setInterval(async () => {
      if(monitor.busy) return;
      monitor.busy = true;
      try {
        const { signature, entries } = await scanFolderOnce();
        if(signature !== monitor.lastSignature){
          console.info('Novos arquivos detectados no diretório.');
          monitor.lastSignature = signature;
          localStorage.setItem('trj_lastSignature', signature);
          if(window.TRJ && TRJ.files && TRJ.files.onFolderChange){
            TRJ.files.onFolderChange(entries);
          } else {
            document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
          }
        }
      } catch(e){ console.warn('Erro durante monitoramento:', e); }
      finally { monitor.busy = false; }
    }, MONITOR_INTERVAL_MS);
  }

  function stopAutoMonitor(){ if(monitor.timer){ clearInterval(monitor.timer); monitor.timer = null; } }

  // placeholder for setTasks (application should implement logic)
  function setTasks(data){
    localStorage.setItem('trj_tasks', JSON.stringify(data));
    document.dispatchEvent(new CustomEvent('trj:tasksLoaded'));
  }

  // export
  window.TRJ = window.TRJ || {};
  window.TRJ.files = window.TRJ.files || {};
  window.TRJ.files.connectFolder = connectFolder;
  window.TRJ.files.startAutoMonitor = startAutoMonitor;
  window.TRJ.files.stopAutoMonitor = stopAutoMonitor;
  window.TRJ.files.scanFolder = scanFolderOnce;
  window.TRJ.files.setTasks = setTasks;
  window.TRJ.files.onFolderChange = window.TRJ.files.onFolderChange || function(entries){ document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } })); };

})();
