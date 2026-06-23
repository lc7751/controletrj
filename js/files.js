/* =====================================================================
 * files.js  —  LEITURA DE ARQUIVOS "Atividades-TRJ_FMMT" (Excel)
 * ---------------------------------------------------------------------
 * As TAREFAS (tickets) e os INCIDENTES NÃO ficam mais na planilha Google.
 * Eles são lidos diretamente aqui no navegador, a partir dos arquivos que
 * caem na sua pasta de Downloads:
 *
 *   • Atividades-TRJ_FMMT_<DATA>        -> tarefas agendadas
 *   • Atividades-TRJ_FMMT_Não-agendada  -> tarefas não agendadas
 *
 * Há dois caminhos:
 *   1) "Conectar pasta" (Chrome/Edge): usa a File System Access API.
 *      Você autoriza a pasta UMA vez e depois é só clicar em
 *      "Verificar agora" para reler os arquivos mais recentes.
 *   2) "Upload manual": funciona em qualquer navegador — você escolhe
 *      os arquivos .xlsx na mão.
 *
 * Os dados ficam guardados no próprio navegador (localStorage), então
 * sobrevivem a um F5. Use a página "Importar dados" para gerenciar.
 * ===================================================================== */
(function (TRJ) {
  var F = {};
  var monitor = { timer: null, onUpdate: null, interval: 45000, lastSignature: null, busy: false };

  // ------------------------------------------------------------------
  // 1) MAPA DE COLUNAS  (número da coluna no .xlsx, começando em 1)
  //    Os nomes à esquerda são lidos pelo restante do site — não mude.
  //    Tipos: 's' = texto, 'n' = número, 'd' = data, 'ds' = data ou texto
  // ------------------------------------------------------------------
  var COLUNAS = [
    ['filaAtual',           1, 's'],
    ['osNumero',            2, 's'],
    ['sequenciaId',         3, 'n'],
    ['tipoAtividade',       4, 's'],
    ['status',              5, 's'],
    ['eta',                13, 'd'],
    ['fim',                14, 'd'],
    ['habilidadeTrabalho', 16, 's'],
    ['microarea',          17, 's'],
    ['dataBase',           20, 'd'],
    ['vencimentoSla',      21, 'ds'],
    ['enderecoId',         67, 's'],
    ['siteId',             84, 's'],
    ['tipoFalha',         132, 's'],
    ['dataCriacao',       176, 'd'],
    ['quemEncerrou',      180, 's'],
    ['prioridade',        191, 's']
  ];
  F.COLUNAS = COLUNAS;

  var JUNK = { '#': 1, '/': 1, '//': 1, '-': 1, 'none': 1, 'null': 1, 'nan': 1 };

  function sv(v) {
    if (v == null) return null;
    var s = String(v).trim();
    if (!s) return null;
    var c = s.replace(/\s/g, '').toLowerCase();
    if (JUNK[c]) return null;
    return s;
  }
  function numv(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(',', '.'));
    if (!isFinite(n)) return null;
    return Math.trunc(n);
  }
  function dtv(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
    if (typeof v === 'number') {
      // serial do Excel -> data (epoch 1899-12-30)
      var ms = Math.round((v - 25569) * 86400 * 1000);
      var d = new Date(ms);
      return isNaN(d.getTime()) ? null : d.toISOString();
    }
    var s = String(v).trim();
    if (!s || JUNK[s.toLowerCase()]) return null;
    return s; // texto cru — domain.parsePlatformDate entende datas BR
  }
  function cell(type, v) {
    if (type === 'n') return numv(v);
    if (type === 'd') return dtv(v);
    if (type === 'ds') return (v instanceof Date || typeof v === 'number') ? dtv(v) : sv(v);
    return sv(v);
  }

  // ------------------------------------------------------------------
  // 2) PARSE de um arquivo .xlsx em memória -> lista de tarefas
  // ------------------------------------------------------------------
  function parseArrayBuffer(buf) {
    if (typeof XLSX === 'undefined') throw new Error('Biblioteca de leitura de Excel não carregou. Recarregue a página.');
    var wb = XLSX.read(buf, { type: 'array', cellDates: true });
    var ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    var rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var out = [];
    for (var r = 1; r < rows.length; r++) { // linha 0 = cabeçalho
      var row = rows[r];
      if (!row) continue;
      var vazia = true;
      for (var i = 0; i < row.length; i++) { if (row[i] != null && String(row[i]).trim() !== '') { vazia = false; break; } }
      if (vazia) continue;
      var rec = {};
      for (var k = 0; k < COLUNAS.length; k++) {
        var def = COLUNAS[k], idx = def[1] - 1;
        rec[def[0]] = cell(def[2], idx < row.length ? row[idx] : null);
      }
      if (rec.osNumero) out.push(rec); // só vale se tiver número da OS
    }
    return out;
  }
  F.parseArrayBuffer = parseArrayBuffer;

  // ------------------------------------------------------------------
  // 3) Identificação dos arquivos pelo nome
  // ------------------------------------------------------------------
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  function isExcelName(name) { return /\.xlsx?$/i.test(name || ''); }
  function isAtividadesFile(name) {
    var n = norm(name);
    return isExcelName(name) && n.indexOf('atividades-trj_fmmt') >= 0;
  }
  function isNaoAgendada(name) {
    var n = norm(name);
    return n.indexOf('nao-agendada') >= 0 || n.indexOf('nao_agendada') >= 0 || n.indexOf('naoagendada') >= 0 || n.indexOf('nao agendada') >= 0;
  }
  // chave de "mais recente": tenta achar a data no nome; senão usa lastModified
  function dateKey(name, lastModified) {
    var n = norm(name);
    var m = n.match(/(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    m = n.match(/(\d{2})[-_.](\d{2})[-_.](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    return lastModified || 0;
  }
  F.isAtividadesFile = isAtividadesFile;

  // ------------------------------------------------------------------
  // 4) Persistência (localStorage) + memória
  // ------------------------------------------------------------------
  var LS_TASKS = 'trj_rawTasks', LS_INC = 'trj_rawInc', LS_META = 'trj_filesMeta';
  var mem = { tasks: [], inc: [], meta: {} };
  (function loadLS() {
    try { mem.tasks = JSON.parse(localStorage.getItem(LS_TASKS) || '[]') || []; } catch (e) { mem.tasks = []; }
    try { mem.inc = JSON.parse(localStorage.getItem(LS_INC) || '[]') || []; } catch (e) { mem.inc = []; }
    try { mem.meta = JSON.parse(localStorage.getItem(LS_META) || '{}') || {}; } catch (e) { mem.meta = {}; }
  })();
  monitor.lastSignature = mem.meta && mem.meta.tasks && mem.meta.tasks.signature ? mem.meta.tasks.signature : null;

  function saveLS(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* cota cheia: mantém só em memória */ } }

  function setTasks(arr, meta) {
    mem.tasks = arr || [];
    if (meta) {
      var payload = Object.assign({}, meta);
      if (payload.signature == null && payload.signatura != null) payload.signature = payload.signatura;
      mem.meta = Object.assign({}, mem.meta, { tasks: payload });
      monitor.lastSignature = payload.signature || null;
    }
    saveLS(LS_TASKS, mem.tasks); saveLS(LS_META, mem.meta);
  }
  function setIncidents(arr, meta) {
    mem.inc = arr || [];
    if (meta) mem.meta = Object.assign({}, mem.meta, { inc: meta });
    saveLS(LS_INC, mem.inc); saveLS(LS_META, mem.meta);
  }
  F.getTasks = function () { return mem.tasks.slice(); };
  F.getIncidents = function () { return mem.inc.slice(); };
  F.setTasks = setTasks;
  F.setIncidents = setIncidents;
  F.getMeta = function () { return mem.meta || {}; };
  F.clearTasks = function () { monitor.lastSignature = null; setTasks([], { origem: null, em: null, arquivos: [], signature: null }); };
  F.clearIncidents = function () { setIncidents([], { origem: null, em: null }); };

  // ------------------------------------------------------------------
  // 5) IndexedDB — guarda o "handle" da pasta de Downloads
  // ------------------------------------------------------------------
  var IDB_NAME = 'trj-files', IDB_STORE = 'handles', IDB_KEY = 'downloadsDir';
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB indisponível.')); return; }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readonly');
        var rq = tx.objectStore(IDB_STORE).get(key);
        rq.onsuccess = function () { resolve(rq.result || null); };
        rq.onerror = function () { reject(rq.error); };
      });
    }).catch(function () { return null; });
  }
  function idbSet(key, val) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(val, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbDel(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function buildSignature(matches) {
    return (matches || []).map(function (m) { return m.name + '|' + m.key; }).sort().join('::');
  }

  async function collectMatches(handle) {
    var matches = [];
    for await (var entry of handle.values()) {
      if (entry.kind !== 'file') continue;
      if (!isAtividadesFile(entry.name)) continue;
      var file = await entry.getFile();
      matches.push({ name: entry.name, file: file, naoAgendada: isNaoAgendada(entry.name), key: dateKey(entry.name, file.lastModified) });
    }
    return matches;
  }

  // ------------------------------------------------------------------
  // 6) File System Access API (Chrome/Edge + HTTPS)
  // ------------------------------------------------------------------
  F.supportsDirectoryPicker = function () { return typeof window.showDirectoryPicker === 'function'; };

  F.hasFolder = function () { return idbGet(IDB_KEY).then(function (h) { return !!h; }); };
  F.folderName = function () { return idbGet(IDB_KEY).then(function (h) { return h ? h.name : null; }); };

  F.pickFolder = async function () {
    if (!F.supportsDirectoryPicker()) throw new Error('Seu navegador não permite conectar pastas. Use Chrome/Edge, ou utilize o upload manual.');
    var handle = await window.showDirectoryPicker({ id: 'trj-downloads', mode: 'read', startIn: 'downloads' });
    await idbSet(IDB_KEY, handle);
    return handle.name;
  };

  F.forgetFolder = function () { return idbDel(IDB_KEY); };

  async function ensurePermission(handle) {
    var opts = { mode: 'read' };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if ((await handle.requestPermission(opts)) === 'granted') return true;
    return false;
  }

  async function loadFromMatches(matches, origem, signature) {
    var ag = matches.filter(function (m) { return !m.naoAgendada; }).sort(function (a, b) { return b.key - a.key; });
    var na = matches.filter(function (m) { return m.naoAgendada; }).sort(function (a, b) { return b.key - a.key; });
    var chosen = [];
    if (ag[0]) chosen.push(ag[0]);
    if (na[0]) chosen.push(na[0]);
    if (!chosen.length) chosen = matches; // fallback: tudo
    var tasks = [], arquivos = [];
    for (var i = 0; i < chosen.length; i++) {
      var buf = await chosen[i].file.arrayBuffer();
      var parsed = parseArrayBuffer(buf);
      tasks = tasks.concat(parsed);
      arquivos.push({ nome: chosen[i].name, qtd: parsed.length });
    }
    setTasks(tasks, { origem: origem, arquivos: arquivos, em: new Date().toISOString(), signature: signature || buildSignature(matches) });
    return { total: tasks.length, arquivos: arquivos };
  }

  // Relê a pasta conectada e carrega os arquivos mais recentes
  F.scanFolder = async function () {
    var handle = await idbGet(IDB_KEY);
    if (!handle) throw new Error('Nenhuma pasta conectada. Clique em "Conectar pasta de Downloads".');
    if (!(await ensurePermission(handle))) throw new Error('Permissão para ler a pasta foi negada.');
    var matches = await collectMatches(handle);
    if (!matches.length) throw new Error('Nenhum arquivo "Atividades-TRJ_FMMT" foi encontrado na pasta conectada.');
    var sig = buildSignature(matches);
    if (sig && sig === monitor.lastSignature) {
      return { total: mem.tasks.length, arquivos: (mem.meta && mem.meta.tasks && mem.meta.tasks.arquivos) || [], unchanged: true };
    }
    return await loadFromMatches(matches, 'pasta', sig);
  };

  // ------------------------------------------------------------------
  // 7) Upload manual (qualquer navegador)
  // ------------------------------------------------------------------
  F.readManualFiles = async function (fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var xls = files.filter(function (f) { return isExcelName(f.name); });
    if (!xls.length) throw new Error('Selecione um ou mais arquivos .xlsx (Atividades-TRJ_FMMT).');
    var matches = xls.map(function (f) {
      return { name: f.name, file: f, naoAgendada: isNaoAgendada(f.name), key: dateKey(f.name, f.lastModified) };
    });
    // Se nenhum nome casar com o padrão, assume que o usuário escolheu certo e usa todos.
    var validos = matches.filter(function (m) { return isAtividadesFile(m.name); });
    return await loadFromMatches(validos.length ? validos : matches, 'upload');
  };

  // Preview rápido (sem salvar) — para o usuário conferir o mapeamento
  F.startAutoMonitor = function (onUpdate, intervalMs) {
    F.stopAutoMonitor();
    monitor.onUpdate = typeof onUpdate === 'function' ? onUpdate : null;
    monitor.interval = intervalMs || monitor.interval || 45000;
    if (!F.supportsDirectoryPicker()) return false;
    monitor.timer = setInterval(async function () {
      if (monitor.busy) return;
      monitor.busy = true;
      try {
        var res = await F.scanFolder();
        if (res && !res.unchanged && monitor.onUpdate) {
          await monitor.onUpdate(res);
        }
      } catch (e) {
        // monitoramento silencioso: erros aparecem quando o usuário tenta acessar manualmente
      } finally {
        monitor.busy = false;
      }
    }, monitor.interval);
    return true;
  };

  F.stopAutoMonitor = function () {
    if (monitor.timer) clearInterval(monitor.timer);
    monitor.timer = null;
    monitor.busy = false;
  };

  F.previewFile = async function (file) {
    var buf = await file.arrayBuffer();
    var parsed = parseArrayBuffer(buf);
    return { total: parsed.length, amostra: parsed.slice(0, 5) };
  };

  TRJ.files = F;
})(window.TRJ = window.TRJ || {});
