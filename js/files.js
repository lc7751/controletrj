// files.js - monitor automático de diretório e funções de tasks & incidents
(function () {
  // Namespace
  window.TRJ = window.TRJ || {};
  window.TRJ.files = window.TRJ.files || {};
  const F = window.TRJ.files;

  // Config
  const DEFAULT_INTERVAL_MS = 30000; // 30s
  const IDB_DB = 'trj_handles_db';
  const IDB_STORE = 'handles_v1';
  const IDB_KEY = 'dir_handle';
  const KEY_TASKS = 'trj_tasks';
  const KEY_INC = 'trj_incidentes';
  const KEY_SIG = 'trj_lastSignature';
  const KEY_CONNECTED_NAME = 'trj_connectedFolderName';

  // Estado interno
  F._folderHandle = null;        // DirectoryHandle (persistido no IndexedDB)
  F._monitorTimer = null;        // timer id OR special 'starting' flag
  F._monitorIntervalMs = DEFAULT_INTERVAL_MS;
  F._lastSignature = localStorage.getItem(KEY_SIG) || null;
  F._tasks = F._tasks || [];
  F._incidents = F._incidents || [];
  F._busy = false;
  F.isMonitoring = !!F._monitorTimer;

  // ---------------- IndexedDB helpers (para salvar handle)
  function openDB() {
    return new Promise(function (resolve, reject) {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = function (e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = function (e) { resolve(e.target.result); };
      req.onerror = function (e) { reject(e.target.error); };
    });
  }
  function idbPut(key, val) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const s = tx.objectStore(IDB_STORE);
          const r = s.put(val, key);
          r.onsuccess = function () { resolve(); };
          r.onerror = function (e) { reject(e.target.error); };
        } catch (e) { reject(e); }
      });
    });
  }
  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const s = tx.objectStore(IDB_STORE);
          const r = s.get(key);
          r.onsuccess = function () { resolve(r.result); };
          r.onerror = function (e) { reject(e.target.error); };
        } catch (e) { reject(e); }
      });
    });
  }
  function idbDelete(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          const s = tx.objectStore(IDB_STORE);
          const r = s.delete(key);
          r.onsuccess = function () { resolve(); };
          r.onerror = function (e) { reject(e.target.error); };
        } catch (e) { reject(e); }
      });
    });
  }

  // ---------------- Persistence local (tasks/incidents)
  function persist(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj || [])); } catch (e) { /* silencioso */ }
  }
  function loadPersisted() {
    try {
      const ts = localStorage.getItem(KEY_TASKS);
      F._tasks = ts ? JSON.parse(ts) : [];
    } catch (_) { F._tasks = []; }
    try {
      const is = localStorage.getItem(KEY_INC);
      F._incidents = is ? JSON.parse(is) : [];
    } catch (_) { F._incidents = []; }
  }

  // ---------------- Permissões
  async function ensurePermission(handle) {
    if (!handle) return false;
    try {
      if (typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'read' });
        if (perm === 'granted') return true;
        perm = await handle.requestPermission({ mode: 'read' });
        return perm === 'granted';
      } else if (typeof handle.requestPermission === 'function') {
        const perm = await handle.requestPermission({ mode: 'read' });
        return perm === 'granted';
      }
      return true;
    } catch (e) {
      console.warn('ensurePermission error', e);
      return false;
    }
  }

  // ---------------- Connect / Load saved handle
  F.connectFolder = async function () {
    if (!window.showDirectoryPicker) throw new Error('API de acesso a arquivos não suportada neste navegador.');
    const handle = await window.showDirectoryPicker();
    const ok = await ensurePermission(handle);
    if (!ok) throw new Error('Permissão de leitura não concedida para a pasta selecionada.');
    F._folderHandle = handle;
    try { await idbPut(IDB_KEY, handle); } catch (e) { console.warn('não foi possível salvar handle no IDB', e); }
    try { localStorage.setItem(KEY_CONNECTED_NAME, handle.name || 'Pasta'); } catch (_) {}
    return handle;
  };

  F.loadSavedFolder = async function () {
    try {
      const handle = await idbGet(IDB_KEY);
      if (!handle) return null;
      const ok = await ensurePermission(handle);
      if (!ok) return null;
      F._folderHandle = handle;
      try { localStorage.setItem(KEY_CONNECTED_NAME, handle.name || 'Pasta'); } catch (_) {}
      return handle;
    } catch (e) {
      console.warn('loadSavedFolder falhou:', e);
      return null;
    }
  };

  F.disconnectFolder = async function () {
    F._folderHandle = null;
    try { await idbDelete(IDB_KEY); } catch (_) {}
    try { localStorage.removeItem(KEY_CONNECTED_NAME); } catch (_) {}
    F._lastSignature = null;
    try { localStorage.removeItem(KEY_SIG); } catch (_) {}
    F.stopAutoMonitor();
  };

  // ---------------- Build signature & scan folder (recursivo)
  async function buildSignatureFromHandle(handle) {
    if (!handle) return null;
    const parts = [];
    async function walk(dir, prefix) {
      for await (const entry of dir.values()) {
        try {
          if (entry.kind === 'file') {
            const f = await entry.getFile();
            parts.push((prefix + '/' + entry.name) + '|' + (f.size || 0) + '|' + (f.lastModified || 0));
          } else if (entry.kind === 'directory') {
            await walk(entry, prefix + '/' + entry.name);
          }
        } catch (e) {
          // ignorar arquivos inacessíveis
        }
      }
    }
    await walk(handle, '');
    return parts.sort().join('||');
  }

  // retorna lista de arquivos (recursivo), cada item: { path, name, handle, size?, lastModified? }
  async function listFilesRecursive(handle) {
    if (!handle) return [];
    const out = [];
    async function walk(dir, prefix) {
      for await (const entry of dir.values()) {
        try {
          if (entry.kind === 'file') {
            try {
              const f = await entry.getFile();
              out.push({
                path: (prefix ? (prefix + '/' + entry.name) : entry.name),
                name: entry.name,
                handle: entry,
                size: f.size || 0,
                lastModified: f.lastModified || 0
              });
            } catch (e) {
              // push minimal info if getFile fails
              out.push({ path: (prefix ? (prefix + '/' + entry.name) : entry.name), name: entry.name, handle: entry });
            }
          } else if (entry.kind === 'directory') {
            await walk(entry, prefix ? (prefix + '/' + entry.name) : entry.name);
          }
        } catch (e) {
          console.warn('listFilesRecursive entry read error', e);
        }
      }
    }
    await walk(handle, '');
    return out;
  }

  async function ensureFolderPermission(handle) {
    if (!handle) return false;
    try {
      if (typeof handle.queryPermission === 'function') {
        var p = await handle.queryPermission({ mode: 'read' });
        if (p === 'granted') return true;
      }
      if (typeof handle.requestPermission === 'function') {
        var pr = await handle.requestPermission({ mode: 'read' });
        return pr === 'granted';
      }
      // fallback permissivo
      return true;
    } catch (e) {
      console.warn('Erro ao verificar permissão do handle:', e);
      return false;
    }
  }

  // scanFolderOnce: lista recursiva e filtra por extensões relevantes
  async function scanFolderOnce(options) {
    options = options || {};
    // aceitar tanto folderHandle quanto _folderHandle
    var handle = (this && (this.folderHandle || this._folderHandle)) || (TRJ && TRJ.files && (TRJ.files.folderHandle || TRJ.files._folderHandle));
    if (!handle) {
      console.warn('scanFolderOnce: nenhuma pasta conectada.');
      return [];
    }

    // garantir permissão de leitura
    var ok = await ensureFolderPermission(handle);
    if (!ok) {
      throw new Error('Permissão de leitura negada para a pasta conectada.');
    }

    var results = [];
    try {
      results = await listFilesRecursive(handle);
    } catch (e) {
      console.error('scanFolderOnce: falha ao iterar pasta:', e);
      throw e;
    }

    var filtered = results.filter(function (it) {
      var n = (it && it.name) ? it.name.toLowerCase() : '';
      return n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv') || n.endsWith('.ods') || n.endsWith('.txt') || n.endsWith('.html') || n.endsWith('.htm');
    });

    return filtered;
  }

  // ---------------- Monitor (start / stop / trigger)
  F.startAutoMonitor = function (onChangeCb, intervalMs) {
    // stop existing
    try { F.stopAutoMonitor(); } catch (_) {}

    F._monitorIntervalMs = intervalMs || F._monitorIntervalMs || DEFAULT_INTERVAL_MS;
    // mark as starting to prevent duplicates
    F._monitorTimer = 'starting';
    F.isMonitoring = true;

    // async init and periodic loop
    (async function initAndStart() {
      try {
        if (!F._folderHandle) {
          try { await F.loadSavedFolder(); } catch (_) { /* ignora */ }
        }
        if (!F._folderHandle) {
          console.info('AutoMonitor: nenhuma pasta conectada. Use connectFolder() para conectar.');
          // keep _monitorTimer truthy to indicate monitoring was requested, but no interval set yet
          return;
        }

        // primeira verificação para capturar assinatura inicial
        try {
          const sig = await buildSignatureFromHandle(F._folderHandle);
          if (sig) {
            F._lastSignature = sig;
            try { localStorage.setItem(KEY_SIG, sig); } catch (_) {}
          }
        } catch (e) {
          console.warn('Falha ao gerar assinatura inicial do AutoMonitor:', e);
        }

        // criar intervalo efetivo
        const intervalId = setInterval(async () => {
          if (F._busy) return;
          F._busy = true;
          try {
            if (!F._folderHandle) {
              try { await F.loadSavedFolder(); } catch (_) {}
              if (!F._folderHandle) { F._busy = false; return; }
            }
            const sig = await buildSignatureFromHandle(F._folderHandle);
            if (!sig) { F._busy = false; return; }
            if (sig !== F._lastSignature) {
              F._lastSignature = sig;
              try { localStorage.setItem(KEY_SIG, sig); } catch (_) {}
              const items = await scanFolderOnce();
              const payload = { items: items };
              document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: payload }));
              document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: payload }));
              try { if (typeof F.onFolderChange === 'function') F.onFolderChange(items); } catch (e) { console.warn('F.onFolderChange erro', e); }
              if (typeof onChangeCb === 'function') {
                try { onChangeCb(items); } catch (e) { console.warn('onChangeCb erro', e); }
              }
            }
          } catch (e) {
            console.warn('Erro durante monitoramento (silenciado):', e && e.message);
          } finally {
            F._busy = false;
          }
        }, F._monitorIntervalMs);

        // store actual timer id
        F._monitorTimer = intervalId;
        F.isMonitoring = true;
        console.info('AutoMonitor iniciado (intervalo ' + F._monitorIntervalMs + ' ms). timerId=', intervalId);
      } catch (e) {
        console.warn('Erro iniciando AutoMonitor:', e);
        F._monitorTimer = null;
        F.isMonitoring = false;
      }
    })();

    // retornar o valor atual (pode ser 'starting' ou timerId mais tarde)
    return F._monitorTimer;
  };

  F.stopAutoMonitor = function () {
    try {
      if (F._monitorTimer && typeof F._monitorTimer === 'number') {
        clearInterval(F._monitorTimer);
      }
    } catch (_) {}
    F._monitorTimer = null;
    F.isMonitoring = false;
    console.info('AutoMonitor parado.');
  };

  F.triggerScan = async function () {
    try {
      if (!F._folderHandle) {
        try { await F.loadSavedFolder(); } catch (_) {}
        if (!F._folderHandle) {
          console.info('triggerScan: nenhuma pasta conectada.');
          return { changed: false, items: [] };
        }
      }
      const sig = await buildSignatureFromHandle(F._folderHandle);
      if (!sig) return { changed: false, items: [] };
      const items = await scanFolderOnce();
      const payload = { items: items };
      if (sig !== F._lastSignature) {
        F._lastSignature = sig;
        try { localStorage.setItem(KEY_SIG, sig); } catch (_) {}
        document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: payload }));
        document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: payload }));
        try { if (typeof F.onFolderChange === 'function') F.onFolderChange(items); } catch (e) { console.warn('F.onFolderChange erro', e); }
        return { changed: true, items: items };
      }
      // Mesmo sem mudança, dispatch para que a UI possa listar/inspecionar
      document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: payload }));
      document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: payload }));
      try { if (typeof F.onFolderChange === 'function') F.onFolderChange(items); } catch (e) { console.warn('F.onFolderChange erro', e); }
      return { changed: false, items: items };
    } catch (e) {
      console.warn('triggerScan falhou:', e && e.message);
      return { changed: false, items: [] };
    }
  };

  // ---------------- Tasks / Incidents API (memória + persist)
  F.setTasks = function (data) {
    F._tasks = Array.isArray(data) ? data.slice() : [];
    persist(KEY_TASKS, F._tasks);
    try { document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: { tasks: F._tasks.slice() } })); } catch (e) { console.warn('emit tasksLoaded failed', e); }
  };
  F.getTasks = function () { return F._tasks.slice(); };

  F.setIncidents = function (data) {
    F._incidents = Array.isArray(data) ? data.slice() : [];
    persist(KEY_INC, F._incidents);
    try { document.dispatchEvent(new CustomEvent('trj:incidentsLoaded', { detail: { incidents: F._incidents.slice() } })); } catch (e) { console.warn('emit incidentsLoaded failed', e); }
  };
  F.getIncidents = function () { return F._incidents.slice(); };

  // pequeno hook público que a app pode sobrescrever (opcional)
  F.onFolderChange = F.onFolderChange || function (items) {
    // default: nada (eventos já são disparados)
  };

  // ---------------- Exports
  F.scanFolderOnce = scanFolderOnce;
  F.buildSignatureFromHandle = buildSignatureFromHandle;
  F.loadSavedFolder = F.loadSavedFolder;
  F.idb = { get: idbGet, put: idbPut, del: idbDelete };
  F.connectFolder = F.connectFolder;
  F.disconnectFolder = F.disconnectFolder;
  F.triggerScan = F.triggerScan;
  F.startAutoMonitor = F.startAutoMonitor;
  F.stopAutoMonitor = F.stopAutoMonitor;
  F.getTasks = F.getTasks;
  F.getIncidents = F.getIncidents;

  // carregar tasks/incidents persistidos
  loadPersisted();

})();
