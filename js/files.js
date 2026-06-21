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

 // scanFolderOnce: percorre a pasta conectada, pega os N arquivos mais recentes e retorna rows processadas + signature
// Uso:
//   const { results, signature } = await scanFolderOnce({ folderHandle: TRJ.files.folderHandle, keepMostRecent: 1 });
// Retorno: results = [{ _source, rows: [...], _lastModified, _blob? }], signature = "nome1|lm1;nome2|lm2;..."
async function scanFolderOnce(opts = {}) {
  const folderHandle = opts.folderHandle || (window.TRJ && TRJ.files && TRJ.files.folderHandle) || null;
  const KEEP_MOST_RECENT = Number(opts.keepMostRecent || 1);
  if (!folderHandle) throw new Error('Nenhuma pasta conectada. Conecte a pasta antes de verificar.');

  // extensões aceitáveis
  const allowedExts = ['xlsx','xls','csv','txt','json'];

  // caminha recursivamente e coleta entradas de arquivos com ext permitida
  async function walkDirectory(dirHandle, relativePath = '') {
    const list = [];
    for await (const [name, entry] of dirHandle.entries()) {
      try {
        if (entry.kind === 'file') {
          const ext = (name.split('.').pop() || '').toLowerCase();
          if (allowedExts.includes(ext)) {
            // obter lastModified para ordenar; getFile() pode lançar por permissão -> capturamos
            try {
              const file = await entry.getFile();
              list.push({ entry, name, path: relativePath ? (relativePath + '/' + name) : name, lastModified: file.lastModified || 0 });
            } catch (eFile) {
              // se não conseguir abrir o arquivo, ainda registramos sem lastModified (0)
              console.warn('Não foi possível ler metadata do arquivo', name, eFile);
              list.push({ entry, name, path: relativePath ? (relativePath + '/' + name) : name, lastModified: 0 });
            }
          }
        } else if (entry.kind === 'directory') {
          const nested = await walkDirectory(entry, relativePath ? (relativePath + '/' + name) : name);
          list.push(...nested);
        }
      } catch (e) {
        console.warn('Erro ao iterar entrada', name, e);
      }
    }
    return list;
  }

  // ler o diretório e coletar arquivos
  let tempFiles = [];
  try {
    tempFiles = await walkDirectory(folderHandle, '');
  } catch (e) {
    // erro de permissão ou outro
    console.error('Erro ao acessar a pasta:', e);
    throw new Error('Permissão negada ou erro ao acessar a pasta. Conecte a pasta novamente.');
  }

  if (!tempFiles.length) {
    return { results: [], signature: null };
  }

  // ordenar por lastModified desc e pegar os N mais recentes
  tempFiles.sort((a,b) => (b.lastModified || 0) - (a.lastModified || 0));
  const chosen = tempFiles.slice(0, KEEP_MOST_RECENT);

  const results = [];

  for (const fmeta of chosen) {
    const entry = fmeta.entry;
    const name = fmeta.path || fmeta.name;
    const lower = (name || '').toLowerCase();
    const ext = lower.split('.').pop();

    try {
      const file = await entry.getFile();
      const ab = await file.arrayBuffer();
      const lastModified = file.lastModified || fmeta.lastModified || 0;

      if (ext === 'csv' || ext === 'txt') {
        // texto plano - tenta converter via XLSX se preferir, senão parse simples
        const txt = new TextDecoder().decode(ab);
        // tentativa de usar XLSX para CSV robusto se estiver disponível
        if (window.XLSX && typeof XLSX.read === 'function') {
          try {
            const wb = XLSX.read(txt, { type: 'string' });
            const sname = wb.SheetNames[0];
            const json = XLSX.utils.sheet_to_json(wb.Sheets[sname], { defval: null });
            results.push({ _source: name, rows: json, _lastModified: lastModified });
          } catch (e) {
            // fallback simples: linhas
            const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            results.push({ _source: name, rows: lines, _lastModified: lastModified });
          }
        } else {
          const txt = new TextDecoder().decode(ab);
          const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          results.push({ _source: name, rows: lines, _lastModified: lastModified });
        }
      } else if (ext === 'json') {
        const txt = new TextDecoder().decode(ab);
        try {
          const obj = JSON.parse(txt);
          results.push({ _source: name, rows: Array.isArray(obj) ? obj : [obj], _lastModified: lastModified });
        } catch (eJson) {
          results.push({ _source: name, rows: [txt], _lastModified: lastModified });
        }
      } else if (ext === 'xlsx' || ext === 'xls') {
        if (window.XLSX && typeof XLSX.read === 'function') {
          try {
            const wb = XLSX.read(ab, { type: 'array' });
            const sname = wb.SheetNames[0];
            const json = XLSX.utils.sheet_to_json(wb.Sheets[sname], { defval: null });
            results.push({ _source: name, rows: json, _lastModified: lastModified });
          } catch (eX) {
            console.warn('Erro parse XLSX', name, eX);
            results.push({ _source: name, rows: [], _lastModified: lastModified, _blob: ab });
          }
        } else {
          // sem XLSX disponível: retornar blob para possível processamento posterior
          results.push({ _source: name, rows: [], _lastModified: lastModified, _blob: ab });
        }
      } else {
        // extensão desconhecida: anexa blob para debug
        results.push({ _source: name, rows: [], _lastModified: lastModified, _blob: ab });
      }
    } catch (eRead) {
      console.warn('Erro lendo arquivo escolhido', name, eRead);
      // empurra objeto com erro para diagnóstico
      results.push({ _source: name, rows: [], _lastModified: fmeta.lastModified || 0, _error: String(eRead) });
    }
  }

  // construir signature simples: concat name|lastModified; usado para detectar mudanças
  const sigParts = chosen.map(c => `${c.path || c.name}|${c.lastModified || 0}`);
  const signature = sigParts.join(';');

  return { results, signature };
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
            // dispara evento global e callback opcional
            document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: items } }));
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
        document.dispatchEvent(new CustomEvent('trj:folderChanged', { detail: { items: items } }));
        return { changed: true, items: items };
      }
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
    document.dispatchEvent(new CustomEvent('trj:tasksLoaded', { detail: { tasks: F._tasks.slice() } }));
  };
  F.getTasks = function () { return F._tasks.slice(); };

  F.setIncidents = function (data) {
    F._incidents = Array.isArray(data) ? data.slice() : [];
    persist(KEY_INC, F._incidents);
    document.dispatchEvent(new CustomEvent('trj:incidentsLoaded', { detail: { incidents: F._incidents.slice() } }));
  };
  F.getIncidents = function () { return F._incidents.slice(); };

  // pequeno hook público que a app pode sobrescrever (opcional)
  F.onFolderChange = F.onFolderChange || function (items) {
    // default: dispara evento trj:folderChanged (já feito acima), aqui para compatibilidade
    // app pode sobrescrever para processar imediatamente
  };

  // ---------------- Exports
  F.scanFolderOnce = scanFolderOnce;
  F.buildSignatureFromHandle = buildSignatureFromHandle;
  F.loadSavedFolder = F.loadSavedFolder;
  F.idb = { get: idbGet, put: idbPut, del: idbDelete };

  // carregar tasks/incidents persistidos
  loadPersisted();

})();
