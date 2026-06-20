// files.js - monitor automático de diretório e funções de tasks
(function(){
  const MONITOR_INTERVAL_MS = 30000; // 30s
  let monitor = {
    handle: null,
    timer: null,
    lastSignature: localStorage.getItem('trj_lastSignature') || null,
    busy: false
  };

  // Tenta restaurar handle persistido (se você tiver lógica de IndexedDB para persistir handles,
  // coloque-a aqui). Por ora, deixamos monitor.handle nulo até o usuário conectar.
  // monitor.handle = tryRestoreHandle() || null;

  async function connectFolder(){
    if(!window.showDirectoryPicker) throw new Error('File System Access API não suportado.');
    const handle = await window.showDirectoryPicker();
    monitor.handle = handle;
    try {
      // salva apenas o nome para UX; o handle não é serializável em localStorage
      localStorage.setItem('trj_connectedFolderName', handle.name || 'folder');
    } catch(e){ /* ignore localStorage failures */ }
    // iniciar monitoramento (de forma tolerante)
    startAutoMonitor();
    return handle;
  }

  // Gera assinatura determinística (ordenando por nome)
  function buildSignature(list){
    if(!Array.isArray(list) || list.length === 0) return '';
    const sorted = list.slice().sort((a,b) => (a.name || '').localeCompare(b.name || ''));
    return sorted.map(f=> `${f.name}::${f.size || 0}::${f.lastModified || ''}`).join('|');
  }

  // Faz uma varredura segura na pasta conectada.
  // Retorna { entries: [...], signature: '...' }
  // Se não houver pasta conectada, NÃO lança — retorna entries:[] e signature:null
  async function scanFolderOnce(){
    if(!monitor.handle) {
      // não lançar aqui para evitar que o caller quebre o bootstrap
      return { entries: [], signature: null };
    }

    const entries = [];
    try {
      for await (const [name, entry] of monitor.handle.entries()){
        if(entry && entry.kind === 'file'){
          try{
            const fh = await entry.getFile();
            entries.push({ name: fh.name, size: fh.size, lastModified: fh.lastModified || 0 });
          }catch(e){
            // pode ocorrer por falta de permissão em um arquivo; ignorar só esse arquivo
            console.debug('Não pôde ler arquivo do diretório (ignorando):', name, e && e.message);
          }
        }
      }
    } catch(e) {
      // erro ao iterar a pasta (ex.: revogação de permissão) -> desassociar handle e retornar vazio
      console.warn('Erro ao acessar a pasta conectada. Monitor será desconectado.', e && e.message);
      monitor.handle = null;
      localStorage.removeItem('trj_connectedFolderName');
      return { entries: [], signature: null };
    }

    const sig = buildSignature(entries);
    return { entries, signature: sig };
  }

  // Inicia monitor automático. Se não houver pasta conectada, retorna silenciosamente.
  async function startAutoMonitor(){
    // limpa timer anterior se houver
    if(monitor.timer) {
      clearInterval(monitor.timer);
      monitor.timer = null;
    }

    // Checagem inicial sem lançar
    try {
      const res = await scanFolderOnce();
      if(res && res.signature) {
        monitor.lastSignature = res.signature;
        try { localStorage.setItem('trj_lastSignature', res.signature); } catch(e){}
      } else {
        // nenhuma pasta conectada ou sem assinatura — não iniciar o timer automaticamente
        console.info('AutoMonitor: nenhuma pasta conectada. Use connectFolder() para conectar.');
        return;
      }
    } catch(err){
      console.warn('Falha na checagem inicial do AutoMonitor:', err && err.message);
      return;
    }

    // montar timer que varre periodicamente — erros são capturados e não propagados
    monitor.timer = setInterval(async () => {
      if(monitor.busy) return;
      monitor.busy = true;
      try {
        const { signature, entries } = await scanFolderOnce();
        // se não houver assinatura significa que a pasta foi desconectada
        if(!signature) {
          console.info('AutoMonitor: pasta desconectada ou inacessível. Parando monitor.');
          stopAutoMonitor();
          monitor.busy = false;
          return;
        }

        if(signature !== monitor.lastSignature){
          console.info('Novos/alterados arquivos detectados no diretório.');
          monitor.lastSignature = signature;
          try { localStorage.setItem('trj_lastSignature', signature); } catch(e){}
          if(window.TRJ && TRJ.files && typeof TRJ.files.onFolderChange === 'function'){
            try {
              TRJ.files.onFolderChange(entries);
            } catch(e){ console.error('Erro em onFolderChange:', e); }
          } else {
            document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
          }
        }
      } catch(e){
        console.warn('Erro durante monitoramento (silenciado):', e && e.message);
      } finally {
        monitor.busy = false;
      }
    }, MONITOR_INTERVAL_MS);

    console.info('AutoMonitor iniciado (intervalo ' + MONITOR_INTERVAL_MS + ' ms).');
  }

  function stopAutoMonitor(){
    if(monitor.timer){
      clearInterval(monitor.timer);
      monitor.timer = null;
    }
  }

  // Função pública para forçar uma varredura pontual sem iniciar o timer
  async function triggerScan(){
    try {
      const { entries, signature } = await scanFolderOnce();
      if(!signature) {
        console.info('triggerScan: nenhuma pasta conectada.');
        return { changed: false, entries: [] };
      }
      if(signature !== monitor.lastSignature){
        monitor.lastSignature = signature;
        try { localStorage.setItem('trj_lastSignature', signature); } catch(e){}
        if(window.TRJ && TRJ.files && typeof TRJ.files.onFolderChange === 'function'){
          TRJ.files.onFolderChange(entries);
        } else {
          document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
        }
        return { changed: true, entries };
      }
      return { changed: false, entries };
    } catch(e){
      console.warn('triggerScan falhou:', e && e.message);
      return { changed: false, entries: [] };
    }
  }

  // placeholder para setTasks (aplicação implementa lógica real)
  function setTasks(data){
    try {
      localStorage.setItem('trj_tasks', JSON.stringify(data));
    } catch(e){}
    document.dispatchEvent(new CustomEvent('trj:tasksLoaded'));
  }

  // export público
  window.TRJ = window.TRJ || {};
  window.TRJ.files = window.TRJ.files || {};
  window.TRJ.files.connectFolder = connectFolder;
  window.TRJ.files.startAutoMonitor = startAutoMonitor;
  window.TRJ.files.stopAutoMonitor = stopAutoMonitor;
  window.TRJ.files.scanFolder = scanFolderOnce;
  window.TRJ.files.triggerScan = triggerScan;
  window.TRJ.files.setTasks = setTasks;
  // hook público que a aplicação pode sobrescrever para processar entradas
  window.TRJ.files.onFolderChange = window.TRJ.files.onFolderChange || function(entries){
    document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
  };

})();