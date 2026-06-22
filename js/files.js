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
  const KEY_TASKS = 'trj_tasks';
  const KEY_INC = 'trj_incidentes';
  const KEY_SIG = 'trj_lastSignature';
  const KEY_CONNECTED_NAME = 'trj_connectedFolderName';

  // Estado interno
  F._folderHandle = null;        // DirectoryHandle (persistido no IndexedDB)
  F._monitorTimer = null;
  F._monitorIntervalMs = DEFAULT_INTERVAL_MS;
  F._lastSignature = localStorage.getItem(KEY_SIG) || null;
  F._tasks = F._tasks || [];
  F._incidents = F._incidents || [];
  F._busy = false;

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
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const s = tx.objectStore(IDB_STORE);
        const r = s.put(val, key);
        r.onsuccess = function () { resolve(); };
        r.onerror = function (e) { reject(e.target.error); };
      });
    });
  }
  function idbGet(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const s = tx.objectStore(IDB_STORE);
        const r = s.get(key);
        r.onsuccess = function () { resolve(r.result); };
        r.onerror = function (e) { reject(e.target.error); };
      });
    });
  }
  function idbDelete(key) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const s = tx.objectStore(IDB_STORE);
        const r = s.delete(key);
        r.onsuccess = function () { resolve(); };
        r.onerror = function (e) { reject(e.target.error); };
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
    // Se a handle não oferecer queryPermission (navegadores antigos), tente requestPermission
    if (typeof handle.queryPermission === 'function') {
      let perm = await handle.queryPermission({ mode: 'read' });
      if (perm === 'granted') return true;
      perm = await handle.requestPermission({ mode: 'read' });
      return perm === 'granted';
    } else if (typeof handle.requestPermission === 'function') {
      const perm = await handle.requestPermission({ mode: 'read' });
      return perm === 'granted';
    }
    return false;
  }

  // ---------------- Connect / Load saved handle
  F.connectFolder = async function () {
    if (!window.showDirectoryPicker) throw new Error('API de acesso a arquivos não suportada neste navegador.');
    const handle = await window.showDirectoryPicker();
    const ok = await ensurePermission(handle);
    if (!ok) throw new Error('Permissão de leitura não concedida para a pasta selecionada.');
    F._folderHandle = handle;
    try { await idbPut('dir_handle', handle); } catch (e) { console.warn('não foi possível salvar handle no IDB', e); }
    try { localStorage.setItem(KEY_CONNECTED_NAME, handle.name || 'Pasta'); } catch (_) {}
    return handle;
  };

  F.loadSavedFolder = async function () {
    try {
      const handle = await idbGet('dir_handle');
      if (!handle) return null;
      const ok = await ensurePermission(handle);
      if (!ok) return null;
      F._folderHandle = handle;
      return handle;
    } catch (e) {
      console.warn('loadSavedFolder falhou:', e);
      return null;
    }
  };

  F.disconnectFolder = async function () {
    F._folderHandle = null;
    try { await idbDelete('dir_handle'); } catch (_) {}
    try { localStorage.removeItem(KEY_CONNECTED_NAME); } catch (_) {}
    F._lastSignature = null;
    localStorage.removeItem(KEY_SIG);
    F.stopAutoMonitor();
  };

  // ---------------- Build signature & scan folder
  async function buildSignatureFromHandle(handle) {
    if (!handle) return null;
    const parts = [];
    async function walk(dir, prefix) {
      for await (const entry of dir.values()) {
        if (entry.kind === 'file') {
          try {
            const f = await entry.getFile();
            parts.push((prefix + '/' + entry.name) + '|' + (f.size || 0) + '|' + (f.lastModified || 0));
          } catch (e) {
            // ignorar arquivos inacessíveis
          }
        } else if (entry.kind === 'directory') {
          await walk(entry, prefix + '/' + entry.name);
        }
      }
    }
    await walk(handle, '');
    return parts.sort().join('||');
  }

  async function ensureFolderPermission(handle) {
    if (!handle) return false;
    try {
      // tenta query primeiro (não disponível em todos os navegadores)
      if (typeof handle.queryPermission === 'function') {
        var p = await handle.queryPermission({ mode: 'read' });
        if (p === 'granted') return true;
      }
      // tenta requestPermission
      if (typeof handle.requestPermission === 'function') {
        var pr = await handle.requestPermission({ mode: 'read' });
        return pr === 'granted';
      }
      // se nenhuma API, presumir disponível (fallback)
      return true;
    } catch (e) {
      console.warn('Erro ao verificar permissão do handle:', e);
      return false;
    }
  }

  async function scanFolderOnce(options) {
    options = options || {};
    // aceitar tanto folderHandle quanto _folderHandle
    var handle = (this && (this.folderHandle || this._folderHandle)) || (TRJ && TRJ.files && (TRJ.files.folderHandle || TRJ.files._folderHandle));
    if (!handle) {
      // em vez de lançar, retornar array vazio (UI pode notificar usuário)
      console.warn('scanFolderOnce: nenhuma pasta conectada.');
      return [];
    }

    // garantir permissão de leitura
    var ok = await ensureFolderPermission(handle);
    if (!ok) {
      // tentar solicitar uma nova conexão (somente se gesto do usuário; aqui apenas erro)
      throw new Error('Permissão de leitura negada para a pasta conectada.');
    }

    var results = [];
    try {
      // iterar entradas (DirectoryHandle.entries())
      for await (const entry of handle.values ? handle.values() : handle.entries()) {
        // entry pode ser FileSystemHandle ou [name, handle] dependendo do browser
        var name, entryHandle;
        if (Array.isArray(entry)) { name = entry[0]; entryHandle = entry[1]; }
        else { entryHandle = entry; name = entry.name; }
        try {
          if (entryHandle.kind === 'file') {
            // coleta metadados básicos; getFile() pode ser pesado — você pode apenas armazenar o handle
            results.push({ name: name, handle: entryHandle });
          } else if (entryHandle.kind === 'directory') {
            // opcional: ignorar ou descer recursivamente, conforme necessidade
            // results.push({ name: name, kind: 'dir', handle: entryHandle });
          }
        } catch (e) {
          console.warn('erro lendo entry', name, e);
        }
      }
    } catch (e) {
      console.error('scanFolderOnce: falha ao iterar pasta:', e);
      throw e;
    }

    // opcional: aplicar sua lógica de filtragem por extensão (xlsx, csv, etc.) aqui
    var filtered = results.filter(function (it) {
      var n = (it && it.name) ? it.name.toLowerCase() : '';
      return n.endsWith('.xlsx') || n.endsWith('.xls') || n.endsWith('.csv') || n.endsWith('.ods') || n.endsWith('.txt') || n.endsWith('.html') || n.endsWith('.htm');
    });

    // retornar os matches
    return filtered;
  }

  // ---------------- Monitor (start / stop / trigger)
  F.startAutoMonitor = function (onChangeCb, intervalMs) {
    F.stopAutoMonitor();
    F._monitorIntervalMs = intervalMs || F._monitorIntervalMs || DEFAULT_INTERVAL_MS;

    // checagem inicial (tenta restaurar handle salvo se não houver)
    (async function initAndStart() {
      try {
        if (!F._folderHandle) {
          // tenta carregar saved handle (não bloqueante)
          try { await F.loadSavedFolder(); } catch (_) { /* ignora */ }
        }
        // primeira verificação para capturar assinatura inicial
        if (!F._folderHandle) {
          console.info('AutoMonitor: nenhuma pasta conectada. Use connectFolder() para conectar.');
          return;
        }
        const sig = await buildSignatureFromHandle(F._folderHandle);
        if (sig) {
          F._lastSignature = sig;
          try { localStorage.setItem(KEY_SIG, sig); } catch (_) {}
        }
      } catch (e) {
        console.warn('Falha na checagem inicial do AutoMonitor:', e);
      }

      // loop periódico
      F._monitorTimer = setInterval(async () => {
        if (F._busy) return;
        F._busy = true;
        try {
          if (!F._folderHandle) {
            // tenta recarregar handle salvo (caso tenham permissão)
            try { await F.loadSavedFolder(); } catch (_) {}
            if (!F._folderHandle) { F._busy = false; return; }
          }
          const sig = await buildSignatureFromHandle(F._folderHandle);
          if (!sig) { F._busy = false; return; }
          if (sig !== F._lastSignature) {
            F._lastSignature = sig;
            try { localStorage.setItem(KEY_SIG, sig); } catch (_) {}
            const items = await scanFolderOnce();
            // dispara eventos globais (compatibilidade com pages)
            document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: items } }));
            document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: items }));
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

      console.info('AutoMonitor iniciado (intervalo ' + F._monitorIntervalMs + ' ms).');
    })();
  };

  F.stopAutoMonitor = function () {
    if (F._monitorTimer) {
      clearInterval(F._monitorTimer);
      F._monitorTimer = null;
    }
  };

  F.triggerScan = async function () {
    try {
      if (!F._folderHandle) {
        // tenta carregar handle salvo
        try { await F.loadSavedFolder(); } catch (_) {}
        if (!F._folderHandle) {
          console.info('triggerScan: nenhuma pasta conectada.');
          return { changed: false, items: [] };
        }
      }
      const sig = await buildSignatureFromHandle(F._folderHandle);
      if (!sig) return { changed: false, items: [] };
      const items = await scanFolderOnce();
      if (sig !== F._lastSignature) {
        F._lastSignature = sig;
        try { localStorage.setItem(KEY_SIG, sig); } catch (_) {}
        // dispatch events (compat)
        document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: items } }));
        document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: items }));
        try { if (typeof F.onFolderChange === 'function') F.onFolderChange(items); } catch (e) { console.warn('F.onFolderChange erro', e); }
        return { changed: true, items: items };
      }
      // still dispatch folderChanged so UI can inspect even if signature same
      document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: items } }));
      document.dispatchEvent(new CustomEvent('trj:folderChanged.importar', { detail: { items: items } }));
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
    // dispatch with array detail for compatibility (alguns listeners esperam array diretamente)
    try { document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: F._tasks.slice() })); } catch (e) { console.warn('emit tasksLoaded failed', e); }
  };
  F.getTasks = function () { return F._tasks.slice(); };

  F.setIncidents = function (data) {
    F._incidents = Array.isArray(data) ? data.slice() : [];
    persist(KEY_INC, F._incidents);
    try { document.dispatchEvent(new CustomEvent('trj:incidentsLoaded', { detail: F._incidents.slice() })); } catch (e) { console.warn('emit incidentsLoaded failed', e); }
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

  // carregar tasks/incidents persistidos
  loadPersisted();

})();
