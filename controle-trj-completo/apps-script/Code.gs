/**
 * ============================================================
 *  CONTROLE OPERACIONAL TRJ — Backend (Google Apps Script)
 * ============================================================
 *  Este script transforma a sua planilha Google na BASE DE DADOS
 *  (backend) do painel. Ele expoe uma API JSON usada pelo site
 *  estatico hospedado no GitHub Pages.
 *
 *  COMO USAR (resumo — veja LEIA-ME.md para o passo a passo):
 *   1. Abra a sua planilha do Google.
 *   2. Menu  Extensoes > Apps Script.
 *   3. Apague o conteudo do arquivo Code.gs e cole TODO este arquivo.
 *   4. Cole tambem o conteudo de appsscript.json no "Editor de manifesto".
 *   5. Rode a funcao  configurarTudo  uma vez (autorize o acesso).
 *   6. Implante:  Implantar > Nova implantacao > App da Web
 *        - Executar como: Eu
 *        - Quem pode acessar: Qualquer pessoa
 *      Copie a URL /exec gerada e cole em  site/config.js .
 *
 *  A aba de cidades (VALID_CAD) é a sua base real. As abas TASKS,
 *  INCIDENTES, USUARIOS e CONFIG sao criadas automaticamente.
 * ============================================================
 */

// ----- Configuracao geral -----
var VALID_CAD_SHEET = 'VALID_CAD';   // aba de cidades (sua base real)
var TASKS_SHEET     = 'TASKS';       // atividades (vem do Python)
var INCID_SHEET     = 'INCIDENTES';  // sites fora (vem dos uploads HTML)
var USERS_SHEET     = 'USUARIOS';    // login do painel
var CONFIG_SHEET    = 'CONFIG';      // parametros (prazos SLA etc.)

// Colunas (ordem) gravadas nas abas geridas pelo painel.
var TASK_COLS = [
  'filaAtual','osNumero','sequenciaId','tipoAtividade','status','eta','fim',
  'habilidadeTrabalho','microarea','dataBase','vencimentoSla','enderecoId',
  'siteId','tipoFalha','dataCriacao','quemEncerrou','prioridade'
];
var INCID_COLS = [
  'site','horario','horarioDt','downtime','gsbi','qtdFurtos','qtdCelulas',
  'tecnologia','enderecoId','anf','cidadeUf','cidade','infra','statusEvento',
  'previsao','causa','causaGrupo','detalhe','obs','tsk','statusTrat'
];
var USER_COLS  = ['email','senha','nome','papel'];
var CONFIG_COLS = ['chave','valor'];

// ============================================================
//  ROTEADOR HTTP
// ============================================================
function doGet(e)  { return handle(e, false); }
function doPost(e) { return handle(e, true); }

function handle(e, isPost) {
  var params = {};
  try {
    if (isPost && e && e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      params = e.parameter;
    }
  } catch (err) {
    return json({ ok: false, error: 'Corpo invalido: ' + err });
  }

  var action = (params.action || '').toString();
  try {
    switch (action) {
      case 'ping':          return json({ ok: true, version: 'trj-1.0', time: new Date().toISOString() });
      case 'login':         return json(actionLogin(params));
      case 'getCities':     return guard(params, function(){ return actionGetCities(params); });
      case 'getCitiesMeta': return guard(params, function(){ return actionGetCitiesMeta(); });
      case 'lookupCities':  return guard(params, function(){ return actionLookupCities(params); });
      case 'getTasks':      return guard(params, function(){ return actionGetTasks(); });
      case 'saveTasks':     return guard(params, function(){ return actionSaveTasks(params); });
      case 'getIncidents':  return guard(params, function(){ return actionGetIncidents(); });
      case 'saveIncidents': return guard(params, function(){ return actionSaveIncidents(params); });
      case 'setIncidentStatus': return guard(params, function(){ return actionSetIncidentStatus(params); });
      case 'getConfig':     return guard(params, function(){ return actionGetConfig(); });
      case 'setConfig':     return guard(params, function(){ return actionSetConfig(params); });
      default:              return json({ ok: false, error: 'Acao desconhecida: ' + action });
    }
  } catch (err) {
    return json({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function guard(params, fn) {
  var tok = (params.token || '').toString();
  if (tok !== getApiToken()) return json({ ok: false, error: 'Token invalido ou expirado. Faca login novamente.' });
  return json(fn());
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  ACOES
// ============================================================
function actionLogin(params) {
  var email = (params.email || '').toString().trim().toLowerCase();
  var senha = (params.password || params.senha || '').toString();
  if (!email || !senha) return { ok: false, error: 'Informe e-mail e senha.' };

  var sh = sheet(USERS_SHEET);
  var data = sh.getDataRange().getValues();
  var hdr = headerIndex(data[0], USER_COLS);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var e2 = (row[hdr.email] || '').toString().trim().toLowerCase();
    var s2 = (row[hdr.senha] || '').toString();
    if (e2 && e2 === email && s2 === senha) {
      return {
        ok: true,
        token: getApiToken(),
        user: { email: e2, nome: (row[hdr.nome] || '').toString(), papel: (row[hdr.papel] || 'operador').toString() }
      };
    }
  }
  return { ok: false, error: 'E-mail ou senha invalidos.' };
}

function actionGetTasks() {
  return { ok: true, rows: readObjects(TASKS_SHEET, TASK_COLS) };
}

function actionSaveTasks(params) {
  var rows = params.rows || [];
  writeObjects(TASKS_SHEET, TASK_COLS, rows);
  return { ok: true, count: rows.length };
}

function actionGetIncidents() {
  return { ok: true, rows: readObjects(INCID_SHEET, INCID_COLS) };
}

function actionSaveIncidents(params) {
  var rows = params.rows || [];
  // Preserva o status de tratamento ja definido pelo operador (site|enderecoId).
  var existing = readObjects(INCID_SHEET, INCID_COLS);
  var prev = {};
  for (var i = 0; i < existing.length; i++) {
    var k = key2(existing[i].site, existing[i].enderecoId);
    var st = (existing[i].statusTrat || '').toString().toUpperCase();
    if (st && st !== 'ATIVO') prev[k] = st;
  }
  for (var j = 0; j < rows.length; j++) {
    var k2 = key2(rows[j].site, rows[j].enderecoId);
    if (prev[k2]) rows[j].statusTrat = prev[k2];
  }
  writeObjects(INCID_SHEET, INCID_COLS, rows);
  return { ok: true, count: rows.length };
}

// Altera o status de tratamento de um ou mais incidentes (ação manual do operador).
// params.items = [{ site, enderecoId, status }]
function actionSetIncidentStatus(params) {
  var items = params.items || [];
  if (!items.length) return { ok: true, count: 0 };
  var map = {};
  for (var i = 0; i < items.length; i++) {
    map[key2(items[i].site, items[i].enderecoId)] = (items[i].status || 'ATIVO').toString().toUpperCase();
  }
  var sh = sheet(INCID_SHEET);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, count: 0 };
  var hdr = headerIndex(data[0], INCID_COLS);
  var col = hdr.statusTrat;
  var changed = 0;
  for (var r = 1; r < data.length; r++) {
    var k = key2(data[r][hdr.site], data[r][hdr.enderecoId]);
    if (map[k]) { sh.getRange(r + 1, col + 1).setValue(map[k]); changed++; }
  }
  return { ok: true, count: changed };
}

function actionGetConfig() {
  var sh = sheet(CONFIG_SHEET);
  var data = sh.getDataRange().getValues();
  var hdr = headerIndex(data[0], CONFIG_COLS);
  var cfg = {};
  for (var i = 1; i < data.length; i++) {
    var ch = (data[i][hdr.chave] || '').toString();
    if (ch) cfg[ch] = (data[i][hdr.valor] || '').toString();
  }
  return { ok: true, config: cfg };
}

function actionSetConfig(params) {
  var cfg = params.config || {};
  var sh = sheet(CONFIG_SHEET);
  var data = sh.getDataRange().getValues();
  var hdr = headerIndex(data[0], CONFIG_COLS);
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var ch = (data[i][hdr.chave] || '').toString();
    if (ch) map[ch] = i; // linha (0-based em data)
  }
  for (var k in cfg) {
    if (!cfg.hasOwnProperty(k)) continue;
    if (map[k] != null) {
      sh.getRange(map[k] + 1, hdr.valor + 1).setValue(cfg[k]);
    } else {
      sh.appendRow(buildRow(CONFIG_COLS, { chave: k, valor: cfg[k] }));
    }
  }
  return { ok: true };
}

// ---- Cidades (VALID_CAD) ----
function validCadColumns(header) {
  var idx = { enderecoId: -1, site: -1, cidade: -1, novaArea: -1, coordenador: -1, bairro: -1, cm: -1 };
  for (var c = 0; c < header.length; c++) {
    var h = norm(header[c]);
    if (idx.enderecoId < 0 && (h.indexOf('ENDERECO') >= 0 || h === 'END_ID' || h === 'ENDID')) idx.enderecoId = c;
    if (idx.site < 0 && h === 'SITE') idx.site = c;
    if (idx.cidade < 0 && h.indexOf('CIDADE') >= 0) idx.cidade = c;
    if (idx.novaArea < 0 && h.indexOf('NOVA') >= 0) idx.novaArea = c;
    if (idx.coordenador < 0 && h.indexOf('COORDEN') >= 0) idx.coordenador = c;
    if (idx.bairro < 0 && h.indexOf('BAIRRO') >= 0) idx.bairro = c;
    if (idx.cm < 0 && h === 'CM') idx.cm = c;
  }
  return idx;
}

function cleanVal(v) {
  var s = (v == null ? '' : v).toString().trim();
  if (!s || s.toUpperCase() === 'NAO' || s === '#' || s === '/') return '';
  return s;
}

function validCadRow(row, idx) {
  return {
    enderecoId: idx.enderecoId >= 0 ? cleanVal(row[idx.enderecoId]) : '',
    site:       idx.site       >= 0 ? cleanVal(row[idx.site]) : '',
    cidade:     idx.cidade     >= 0 ? cleanVal(row[idx.cidade]) : '',
    novaArea:   idx.novaArea   >= 0 ? cleanVal(row[idx.novaArea]) : '',
    coordenador:idx.coordenador>= 0 ? cleanVal(row[idx.coordenador]) : '',
    bairro:     idx.bairro     >= 0 ? cleanVal(row[idx.bairro]) : '',
    cm:         idx.cm         >= 0 ? cleanVal(row[idx.cm]) : ''
  };
}

function actionLookupCities(params) {
  var ids = params.ids || [];
  var want = {};
  for (var i = 0; i < ids.length; i++) {
    var s = (ids[i] || '').toString().trim().toUpperCase();
    if (s) want[s] = true;
  }
  var sh = sheet(VALID_CAD_SHEET);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, map: {} };
  var idx = validCadColumns(data[0]);
  var map = {};
  for (var r = 1; r < data.length; r++) {
    var rec = validCadRow(data[r], idx);
    var keyE = rec.enderecoId.toUpperCase();
    var keyS = rec.site.toUpperCase();
    if (keyE && want[keyE] && !map[keyE]) map[keyE] = rec;
    if (keyS && want[keyS] && !map[keyS]) map[keyS] = rec;
  }
  return { ok: true, map: map };
}

function actionGetCities(params) {
  var page = Math.max(1, parseInt(params.page || '1', 10));
  var pageSize = Math.min(200, Math.max(10, parseInt(params.pageSize || '25', 10)));
  var q = (params.q || '').toString().trim().toUpperCase();
  var area = (params.area || '').toString().trim();

  var sh = sheet(VALID_CAD_SHEET);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, rows: [], total: 0, page: 1, totalPages: 1 };
  var idx = validCadColumns(data[0]);

  var all = [];
  for (var r = 1; r < data.length; r++) {
    var rec = validCadRow(data[r], idx);
    if (!rec.enderecoId && !rec.site && !rec.cidade) continue;
    if (area && area !== 'TODAS' && rec.novaArea !== area) continue;
    if (q) {
      var hay = (rec.site + ' ' + rec.enderecoId + ' ' + rec.cidade + ' ' + rec.bairro).toUpperCase();
      if (hay.indexOf(q) < 0) continue;
    }
    all.push(rec);
  }
  var total = all.length;
  var totalPages = Math.max(1, Math.ceil(total / pageSize));
  var start = (page - 1) * pageSize;
  return { ok: true, rows: all.slice(start, start + pageSize), total: total, page: page, totalPages: totalPages };
}

function actionGetCitiesMeta() {
  var sh = sheet(VALID_CAD_SHEET);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, areas: [], total: 0 };
  var idx = validCadColumns(data[0]);
  var set = {};
  var total = 0;
  for (var r = 1; r < data.length; r++) {
    var a = idx.novaArea >= 0 ? cleanVal(data[r][idx.novaArea]) : '';
    if (a) set[a] = true;
    total++;
  }
  var areas = Object.keys(set).sort();
  return { ok: true, areas: areas, total: total };
}

// ============================================================
//  HELPERS DE PLANILHA
// ============================================================
function ss() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Planilha nao encontrada. Defina SPREADSHEET_ID nas Propriedades do Script.');
}

function sheet(name) {
  var s = ss().getSheetByName(name);
  if (!s) {
    s = ss().insertSheet(name);
    var cols = name === TASKS_SHEET ? TASK_COLS
             : name === INCID_SHEET ? INCID_COLS
             : name === USERS_SHEET ? USER_COLS
             : name === CONFIG_SHEET ? CONFIG_COLS
             : null;
    if (cols) s.getRange(1, 1, 1, cols.length).setValues([cols]);
  }
  return s;
}

function headerIndex(headerRow, cols) {
  var idx = {};
  var hmap = {};
  for (var c = 0; c < headerRow.length; c++) hmap[norm(headerRow[c])] = c;
  for (var i = 0; i < cols.length; i++) {
    var key = cols[i];
    var found = hmap[norm(key)];
    idx[key] = (found == null ? i : found);
  }
  return idx;
}

function readObjects(name, cols) {
  var sh = sheet(name);
  var data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  var idx = headerIndex(data[0], cols);
  var out = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var blank = true;
    var o = {};
    for (var i = 0; i < cols.length; i++) {
      var v = row[idx[cols[i]]];
      if (v instanceof Date) v = v.toISOString();
      o[cols[i]] = (v == null ? '' : v);
      if (o[cols[i]] !== '') blank = false;
    }
    if (!blank) out.push(o);
  }
  return out;
}

function buildRow(cols, obj) {
  var row = [];
  for (var i = 0; i < cols.length; i++) {
    var v = obj[cols[i]];
    row.push(v == null ? '' : v);
  }
  return row;
}

function writeObjects(name, cols, rows) {
  var sh = sheet(name);
  // Limpa tudo abaixo do cabecalho
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
  // Garante cabecalho
  sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  if (!rows || !rows.length) return;
  var matrix = [];
  for (var i = 0; i < rows.length; i++) matrix.push(buildRow(cols, rows[i]));
  sh.getRange(2, 1, matrix.length, cols.length).setValues(matrix);
}

function key2(a, b) {
  return (a == null ? '' : a).toString().toUpperCase() + '|' + (b == null ? '' : b).toString().toUpperCase();
}

function norm(s) {
  return (s == null ? '' : s).toString()
    .normalize ? (s == null ? '' : s).toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
    : (s == null ? '' : s).toString().toUpperCase().trim();
}

// ============================================================
//  TOKEN / SETUP
// ============================================================
function getApiToken() {
  var props = PropertiesService.getScriptProperties();
  var t = props.getProperty('API_TOKEN');
  if (!t) {
    t = Utilities.getUuid().replace(/-/g, '');
    props.setProperty('API_TOKEN', t);
  }
  return t;
}

/**
 * Rode esta funcao UMA VEZ no editor (botao Executar) para:
 *  - criar as abas TASKS, INCIDENTES, USUARIOS, CONFIG;
 *  - criar um usuario admin padrao;
 *  - gravar os prazos de SLA padrao;
 *  - gerar o token de API.
 */
function configurarTudo() {
  sheet(TASKS_SHEET); sheet(INCID_SHEET); sheet(USERS_SHEET); sheet(CONFIG_SHEET);

  // Usuario admin padrao (se a aba estiver vazia)
  var u = sheet(USERS_SHEET);
  if (u.getLastRow() < 2) {
    u.appendRow(buildRow(USER_COLS, { email: 'admin@trj.com', senha: 'trj2026', nome: 'Administrador', papel: 'admin' }));
  }

  // Prazos SLA padrao (horas) — se ainda nao existirem
  var defaults = { sla_P1: '4', sla_P2: '8', sla_P3: '12', sla_P4: '24', sla_P5: '48' };
  actionSetConfig({ config: defaults });

  var token = getApiToken();
  Logger.log('=============================================');
  Logger.log('Setup concluido!');
  Logger.log('Token de API (guardado em Propriedades do Script): ' + token);
  Logger.log('Usuario padrao: admin@trj.com / trj2026');
  Logger.log('Agora implante como App da Web (Implantar > Nova implantacao).');
  Logger.log('=============================================');
  return token;
}
