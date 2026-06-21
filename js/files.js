// files.js - monitor automático de diretório e funções de tasks & incidents
(function(){
  const MONITOR_INTERVAL_MS = 30000; // 30s
  let monitor = {
    handle: null,
    timer: null,
    lastSignature: localStorage.getItem('trj_lastSignature') || null,
    busy: false
  };

  // memória local
  let _tasks = [];
  let _incidents = [];

  // keys de storage
  const KEY_TASKS = 'trj_tasks';
  const KEY_INC = 'trj_incidentes';
  const KEY_CONNECTED_NAME = 'trj_connectedFolderName';
  const KEY_SIG = 'trj_lastSignature';

  // tenta carregar dados persistidos do localStorage
  function loadPersisted() {
    try {
      const ts = localStorage.getItem(KEY_TASKS);
      _tasks = ts ? JSON.parse(ts) : [];
    } catch(e){ _tasks = []; }
    try {
      const is = localStorage.getItem(KEY_INC);
      _incidents = is ? JSON.parse(is) : [];
    } catch(e){ _incidents = []; }
  }

  // salvar em localStorage (silencioso em erro)
  function persist(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj || [])); } catch(e){}
  }

  // API pública para obter tarefas / incidentes
  function getTasks(){ return Array.isArray(_tasks) ? _tasks.slice() : []; }
  function getIncidents(){ return Array.isArray(_incidents) ? _incidents.slice() : []; }

  // setters públicos — disparam eventos para aplicação reagir
  function setTasks(data){
    _tasks = Array.isArray(data) ? data.slice() : [];
    persist(KEY_TASKS, _tasks);
    document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: { tasks: getTasks() } }));
  }
  function setIncidents(data){
    _incidents = Array.isArray(data) ? data.slice() : [];
    persist(KEY_INC, _incidents);
    document.dispatchEvent(new CustomEvent('trj:incidentsLoaded', { detail: { incidents: getIncidents() } }));
  }

  // Tenta restaurar handle persistido (se você tiver lógica de IndexedDB para persistir handles,
  // coloque-a aqui). Por ora, deixamos monitor.handle nulo até o usuário conectar.
  // monitor.handle = tryRestoreHandle() || null;

  async function connectFolder(){
    if(!window.showDirectoryPicker) throw new Error('File System Access API não suportado.');
    const handle = await window.showDirectoryPicker();
    monitor.handle = handle;
    try {
      localStorage.setItem(KEY_CONNECTED_NAME, handle.name || 'folder');
    } catch(e){}
    // iniciar monitoramento (tolerante)
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
  // Se não houver pasta conectada, retorna entries:[] e signature:null
  async function scanFolderOnce(){
    if(!monitor.handle) {
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
            console.debug('Não pôde ler arquivo do diretório (ignorando):', name, e && e.message);
          }
        }
      }
    } catch(e) {
      console.warn('Erro ao acessar a pasta conectada. Monitor será desconectado.', e && e.message);
      monitor.handle = null;
      try { localStorage.removeItem(KEY_CONNECTED_NAME); } catch(_) {}
      return { entries: [], signature: null };
    }

    const sig = buildSignature(entries);
    return { entries, signature: sig };
  }

  // Inicia monitor automático. Se não houver pasta conectada, retorna silenciosamente.
  async function startAutoMonitor(){
    if(monitor.timer) {
      clearInterval(monitor.timer);
      monitor.timer = null;
    }

    // Checagem inicial sem lançar
    try {
      const res = await scanFolderOnce();
      if(res && res.signature) {
        monitor.lastSignature = res.signature;
        try { localStorage.setItem(KEY_SIG, res.signature); } catch(e){}
      } else {
        console.info('AutoMonitor: nenhuma pasta conectada. Use connectFolder() para conectar.');
        return;
      }
    } catch(err){
      console.warn('Falha na checagem inicial do AutoMonitor:', err && err.message);
      return;
    }

    monitor.timer = setInterval(async () => {
      if(monitor.busy) return;
      monitor.busy = true;
      try {
        const { signature, entries } = await scanFolderOnce();
        if(!signature) {
          console.info('AutoMonitor: pasta desconectada ou inacessível. Parando monitor.');
          stopAutoMonitor();
          monitor.busy = false;
          return;
        }

        if(signature !== monitor.lastSignature){
          console.info('Novos/alterados arquivos detectados no diretório.');
          monitor.lastSignature = signature;
          try { localStorage.setItem(KEY_SIG, signature); } catch(e){}
          // evento global para a aplicação processar os arquivos como quiser
          document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
          // se a app implementou um hook específico, chamar também
          if(window.TRJ && TRJ.files && typeof TRJ.files.onFolderChange === 'function'){
            try { TRJ.files.onFolderChange(entries); } catch(e){ console.error('Erro em onFolderChange:', e); }
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
        try { localStorage.setItem(KEY_SIG, signature); } catch(e){}
        document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
        if(window.TRJ && TRJ.files && typeof TRJ.files.onFolderChange === 'function'){
          TRJ.files.onFolderChange(entries);
        }
        return { changed: true, entries };
      }
      return { changed: false, entries };
    } catch(e){
      console.warn('triggerScan falhou:', e && e.message);
      return { changed: false, entries: [] };
    }
  }

  // expose
  window.TRJ = window.TRJ || {};
  window.TRJ.files = window.TRJ.files || {};

  // carregar persistidos agora
  loadPersisted();

  // Export API
  window.TRJ.files.connectFolder = connectFolder;
  window.TRJ.files.startAutoMonitor = startAutoMonitor;
  window.TRJ.files.stopAutoMonitor = stopAutoMonitor;
  window.TRJ.files.scanFolder = scanFolderOnce;
  window.TRJ.files.triggerScan = triggerScan;

  // tasks/incidents API
  window.TRJ.files.getTasks = getTasks;
  window.TRJ.files.getIncidents = getIncidents;
  window.TRJ.files.setTasks = setTasks;
  window.TRJ.files.setIncidents = setIncidents;

  // hook público que a aplicação pode sobrescrever para processar entradas
  // (por padrão apenas dispara evento trj:folderChanged)
  window.TRJ.files.onFolderChange = window.TRJ.files.onFolderChange || function(entries){
    document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { entries } }));
  };

})();