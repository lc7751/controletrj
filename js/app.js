/* =====================================================================
 * app.js  —  NÚCLEO DA APLICAÇÃO (bootstrap + rotas + cache de dados)
 * ---------------------------------------------------------------------
 * - Verifica login; mostra a tela de login ou o painel.
 * - Monta a barra lateral e troca de página pelo hash da URL (#/...).
 * - Carrega tarefas + incidentes + cidades + config UMA vez e reaproveita.
 * ===================================================================== */
(function (TRJ) {
  // defensivo: usar objetos vazios se módulos ainda não estiverem carregados
  var U = TRJ.ui || {};
  var D = TRJ.domain || {};
  var Comp = TRJ.compute || {};
  var C = TRJ.constants || {};
  var App = { data: null, _timer: null };

  // ícones SVG simples (stroke currentColor)
  var ICONS = {
    dashboard: '<path d="M3 13h8V3H3zM13 21h8V3h-8zM3 21h8v-6H3z"/>',
    sla: '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>',
    regional: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    sites: '<path d="M12 2v6M5 8a7 7 0 0 1 14 0M8 11a4 4 0 0 1 8 0M12 14v8"/>',
    cadastro: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h5"/>',
    config: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.3-1-2 3.5L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    importar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'
  };
  function icon(name, size) {
    return '<svg width="' + (size || 18) + '" height="' + (size || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
  }
  App.icon = icon;

  var LINKS = [
    { hash: '#/dashboard', label: 'Dashboard', ico: 'dashboard' },
    { hash: '#/sla', label: 'SLA / Aderência', ico: 'sla' },
    { hash: '#/regional', label: 'Visão Regional', ico: 'regional' },
    { hash: '#/sites-fora', label: 'Sites Fora (Incidentes)', ico: 'sites' },
    { hash: '#/cadastro', label: 'Cadastro de Cidades', ico: 'cadastro' },
    { hash: '#/importar', label: 'Importar dados', ico: 'importar' },
    { hash: '#/configuracoes', label: 'Configurações', ico: 'config' }
  ];

  // ---------------- LOGIN ----------------
  function showLogin(msg) {
    var shell = document.getElementById('app-shell');
    if (shell) shell.style.display = 'none';
    var ls = document.getElementById('login-screen');
    if (ls) ls.style.display = 'flex';
    var err = document.getElementById('login-error');
    if (err) err.textContent = msg || '';
  }
  function wireLogin() {
    var form = document.getElementById('login-form');
    if (!form) return;
    form.addEventListener('submit', async function (ev) {
      ev.preventDefault();
      var email = (document.getElementById('login-email') || {}).value || '';
      var pwd = (document.getElementById('login-pwd') || {}).value || '';
      var btn = document.getElementById('login-btn');
      var err = document.getElementById('login-error');
      if (err) err.textContent = '';
      if (btn) { btn.disabled = true; btn.textContent = 'Entrando...'; }
      try {
        await TRJ.auth.login(email.trim(), pwd);
        await startApp();
      } catch (e) {
        if (err) err.textContent = e.message || 'Falha no login.';
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
      }
    });
  }

  // ---------------- SHELL ----------------
  function buildSidebar() {
    var user = (TRJ.auth && TRJ.auth.getUser && TRJ.auth.getUser()) || {};
    // assegurar que U.h exista (se não existir, usar fallback simples)
    var h = (U && typeof U.h === 'function') ? U.h : function (tag, props, children) {
      var el = document.createElement(tag);
      props = props || {};
      if (props.class) el.className = props.class;
      if (props.text) el.textContent = props.text;
      if (props.html) el.innerHTML = props.html;
      if (props.onclick && typeof props.onclick === 'function') el.addEventListener('click', props.onclick);
      (children || []).forEach(function (c) { if (typeof c === 'string') el.appendChild(document.createTextNode(c)); else if (c) el.appendChild(c); });
      return el;
    };

    var brand = h('div', { class: 'flex items-center gap-3 px-4 py-4' }, [
      h('img', { src: 'assets/logo-trj.png', alt: 'TRJ', style: { width: '38px', height: '38px', objectFit: 'contain' } }),
      h('div', null, [
        h('div', { class: 'font-extrabold text-sm', style: { color: (TRJ.config && TRJ.config.APP_NAME) ? 'var(--trj-primary)' : 'var(--trj-primary)', letterSpacing: '.5px' }, text: (TRJ.config && TRJ.config.APP_NAME) || 'CONTROLE TRJ' }),
        h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: (TRJ.config && TRJ.config.APP_SUB) || 'Operacional' })
      ])
    ]);
    var hasTasks = App.data && App.data.rawTasks && App.data.rawTasks.length > 0;
    var visibleLinks = hasTasks ? LINKS : LINKS.filter(function (l) { return l.hash === '#/importar' || l.hash === '#/configuracoes'; });
    var nav = h('nav', { class: 'flex flex-col gap-1 px-3 mt-2', style: { flex: '1' } }, visibleLinks.map(function (l) {
      // construir link com data-hash (dataset pode não existir no fallback)
      var a = h('a', { class: 'trj-link', href: l.hash }, [ h('span', { class: 'ico', html: icon(l.ico) }), h('span', { text: l.label }) ]);
      try { a.setAttribute('data-hash', l.hash); } catch (_) {}
      return a;
    }));
    if (!hasTasks) {
      nav.appendChild(h('div', { class: 'text-xs px-2 pt-2', style: { color: 'var(--trj-muted)', lineHeight: '1.4' }, text: 'Faça o upload dos arquivos para liberar as abas de visualização.' }));
    }
    var footer = h('div', { class: 'px-3 py-3', style: { borderTop: '1px solid var(--trj-border)' } }, [
      h('div', { class: 'text-xs px-2 mb-2 truncate', style: { color: 'var(--trj-muted)' }, text: user.email || '' }),
      h('button', { class: 'trj-link w-full', onclick: doLogout }, [h('span', { class: 'ico', html: icon('logout') }), h('span', { text: 'Sair' })])
    ]);
    var aside = h('aside', { id: 'sidebar', class: 'trj-card flex flex-col', style: { width: '256px', minWidth: '256px', borderRadius: '0', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', height: '100vh', position: 'sticky', top: '0' } }, [brand, nav, footer]);
    return aside;
  }

  function doLogout() {
    try {
      if (TRJ.files) {
        if (typeof TRJ.files.stopAutoMonitor === 'function') TRJ.files.stopAutoMonitor();
        else if (typeof TRJ.files._stopAutoMonitor === 'function') TRJ.files._stopAutoMonitor();
        else if (TRJ.files._monitorTimer) { clearInterval(TRJ.files._monitorTimer); TRJ.files._monitorTimer = null; }
      }
    } catch(_) {}
    if (App._timer) { clearInterval(App._timer); App._timer = null; }
    try { TRJ.auth && TRJ.auth.logout && TRJ.auth.logout(); } catch(_) {}
    location.hash = '#/dashboard';
    showLogin();
  }

  function setActiveLink() {
    var cur = location.hash || '#/dashboard';
    document.querySelectorAll('#sidebar .trj-link[data-hash]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-hash') === cur);
    });
  }

  function buildShell() {
    var shell = document.getElementById('app-shell');
    if (!shell) return;
    shell.innerHTML = '';
    shell.style.display = 'flex';
    var sidebar = buildSidebar();
    // topbar mobile
    var topbar = (U && typeof U.h === 'function') ? U.h('div', { class: 'flex items-center justify-between px-4 py-3 lg:hidden trj-card', style: { borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none' } }, [
      U.h('div', { class: 'flex items-center gap-2' }, [
        U.h('img', { src: 'assets/logo-trj.png', alt: 'TRJ', style: { width: '28px', height: '28px' } }),
        U.h('span', { class: 'font-bold', style: { color: 'var(--trj-primary)' }, text: 'CONTROLE TRJ' })
      ]),
      U.h('button', { class: 'trj-btn trj-btn-ghost', text: '☰', onclick: toggleSidebar })
    ]) : (function () {
      var el = document.createElement('div'); el.className = 'topbar'; return el;
    })();

    var page = document.getElementById('page');
    // se não existe, criar container
    if (!page) page = (function () { var p = document.createElement('div'); p.id = 'page'; p.className = 'p-4 lg:p-6'; return p; })();
    var main = document.createElement('div'); main.style.flex = '1'; main.style.minWidth = '0';
    main.appendChild(topbar); main.appendChild(page);

    shell.appendChild(sidebar);
    shell.appendChild(main);
    setActiveLink();
  }

  function toggleSidebar() {
    var sb = document.getElementById('sidebar');
    if (!sb) return;
    sb.style.display = (sb.style.display === 'none' || getComputedStyle(sb).display === 'none') ? 'flex' : 'none';
  }

  // ---------------- DADOS ----------------
  function prazoOverride(config) {
    var o = {};
    if (C && Array.isArray(C.PRIORIDADES)) {
      C.PRIORIDADES.forEach(function (p) { if (config && config['sla_' + p] != null && config['sla_' + p] !== '') o[p] = config['sla_' + p]; });
    }
    return o;
  }

  // ---------------- DADOS (versão defensiva) ----------------
  App.loadAll = async function () {
    try {
      if (U && typeof U.loading === 'function') U.loading(true);
    } catch(_) {}

    try {
      var rawTasks = [];
      var rawInc = [];
      try { rawTasks = (TRJ.files && typeof TRJ.files.getTasks === 'function') ? TRJ.files.getTasks() : (TRJ.files && TRJ.files.rawTasks) || []; }
      catch(e) { console.warn('getTasks falhou', e); rawTasks = []; }
      try { rawInc = (TRJ.files && typeof TRJ.files.getIncidents === 'function') ? TRJ.files.getIncidents() : (TRJ.files && TRJ.files.rawInc) || []; }
      catch(e) { console.warn('getIncidents falhou', e); rawInc = []; }

      var config = {};
      if (TRJ.api && typeof TRJ.api.getConfig === 'function') {
        try { var cfgRes = await TRJ.api.getConfig(); config = cfgRes && (cfgRes.config || cfgRes) || {}; }
        catch (e) { console.warn('Falha ao carregar config externa:', e); config = {}; }
      }

      var prazoMap = {};
      try {
        if (D && typeof D.montarPrazoMap === 'function') prazoMap = D.montarPrazoMap(prazoOverride(config));
        else prazoMap = {};
      } catch (e) { console.warn('Erro montarPrazoMap:', e); prazoMap = {}; }

      var validMap = {};
      try {
        var ids = (Comp && typeof Comp.collectIds === 'function') ? Comp.collectIds(rawTasks || [], rawInc || []) : [];
        if (ids && ids.length && TRJ.api && typeof TRJ.api.lookupCities === 'function') {
          try {
            var lk = await TRJ.api.lookupCities(ids);
            validMap = lk && lk.map ? lk.map : {};
          } catch (e) { console.warn('lookupCities falhou:', e); validMap = {}; }
        }
      } catch (e) { console.warn('Erro collectIds/lookupCities:', e); validMap = {}; }

      var now = new Date();
      var tasksEnriched = rawTasks;
      try {
        if (Comp && typeof Comp.enrichTasks === 'function') tasksEnriched = Comp.enrichTasks(rawTasks || [], validMap, prazoMap, now);
      } catch (e) { console.warn('enrichTasks falhou:', e); tasksEnriched = rawTasks; }

      var incidentsEnriched = rawInc;
      try {
        if (Comp && typeof Comp.enrichIncidents === 'function') incidentsEnriched = Comp.enrichIncidents(rawInc || [], validMap);
      } catch (e) { console.warn('enrichIncidents falhou:', e); incidentsEnriched = rawInc; }

      App.data = {
        config: config,
        prazoMap: prazoMap,
        validMap: validMap,
        rawTasks: rawTasks || [],
        rawInc: rawInc || [],
        tasksEnriched: tasksEnriched || [],
        incidentsEnriched: incidentsEnriched || [],
        loadedAt: new Date()
      };
      return App.data;
    } finally {
      try { if (U && typeof U.loading === 'function') U.loading(false); } catch(_) {}
    }
  };

  App.refresh = async function () {
    try {
      await App.loadAll();
      buildShell();
      render();
      // iniciar monitor só se não estiver rodando
      try {
        if (TRJ.files && typeof TRJ.files.startAutoMonitor === 'function' && !TRJ.files._monitorTimer) {
          TRJ.files.startAutoMonitor(function () { App.refresh(); }, 45000);
        }
      } catch (e) { console.warn('Erro ao iniciar monitor no refresh:', e); }
      try { U.toast('Dados atualizados.', 'ok'); } catch(_) {}
    } catch (e) {
      console.error('Erro em App.refresh:', e);
      try { buildShell(); render(); } catch(_) {}
      try { U.toast('Os arquivos foram lidos, mas houve falha ao atualizar alguns dados externos.', 'err'); } catch(_) {}
    }
  };

  // recarrega só incidentes (após upload/alteração de status) — agora da memória/navegador
  App.reloadIncidents = async function () {
    var rawInc = (TRJ.files && typeof TRJ.files.getIncidents === 'function') ? TRJ.files.getIncidents() : [];
    App.data = App.data || {};
    App.data.rawInc = rawInc;
    // garantir Comp disponível antes de enriquecer
    Comp = TRJ.compute || Comp || null;
    if (Comp && typeof Comp.enrichIncidents === 'function') {
      try { App.data.incidentsEnriched = Comp.enrichIncidents(rawInc, App.data.validMap); }
      catch (e) { console.warn('Erro ao enriquecer incidents no reload:', e); App.data.incidentsEnriched = rawInc; }
    } else {
      App.data.incidentsEnriched = rawInc;
    }
  };

  // ---------------- DRILL ----------------
  App.openDrillTasks = function (spec, filtros, title) {
    if (!App.data) return;
    Comp = TRJ.compute || Comp || null;
    var drillFn = (Comp && typeof Comp.drillTasks === 'function') ? Comp.drillTasks : null;
    var rows = drillFn ? drillFn(App.data.tasksEnriched, spec, filtros || {}) : [];
    try { U.openModal(title || 'Detalhamento', U.taskTable(rows)); } catch (e) { console.warn('openDrillTasks fallback', e); }
  };
  App.openDrillIncidents = function (spec, title) {
    if (!App.data) return;
    Comp = TRJ.compute || Comp || null;
    var drillInc = (Comp && typeof Comp.drillIncidents === 'function') ? Comp.drillIncidents : null;
    var rows = drillInc ? drillInc(App.data.incidentsEnriched, spec) : [];
    try { U.openModal(title || 'Detalhamento', U.incidentTable(rows)); } catch (e) { console.warn('openDrillIncidents fallback', e); }
  };

// ---------------- ROTAS ----------------
  var ROUTES = {
    '#/dashboard': 'dashboard',
    '#/sla': 'sla',
    '#/regional': 'regional',
    '#/sites-fora': 'sitesFora',
    '#/cadastro': 'cadastro',
    '#/importar': 'importar',
    '#/configuracoes': 'configuracoes'
  };

  // helper: tenta encontrar o módulo da página em TRJ.pages com várias variações de nome
  function findPageModuleByName(name) {
    if (!name) return null;
    if (!window.TRJ || !TRJ.pages) return null;

    // 1) tentativas diretas/variações previsíveis
    var candidates = [
      name,
      name.replace(/-/g, '_'),
      name.replace(/-([a-z])/g, function (_, ch) { return ch.toUpperCase(); }), // camelCase
      name.replace(/[^a-zA-Z0-9_]/g, '') // simples
    ];

    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (TRJ.pages[c]) return TRJ.pages[c];
    }

    // 2) case-insensitive match across todas as chaves
    var lower = name.toLowerCase();
    var keys = Object.keys(TRJ.pages || {});
    for (var k = 0; k < keys.length; k++) {
      if (keys[k].toLowerCase() === lower) return TRJ.pages[keys[k]];
    }

    // 3) partial match: chave que contém o slug (ex: 'sites' matches 'sitesFora')
    for (var k2 = 0; k2 < keys.length; k2++) {
      if (keys[k2].toLowerCase().indexOf(lower) >= 0) return TRJ.pages[keys[k2]];
    }

    // 4) fallback: se algum módulo tiver propriedade 'render' ou 'page' cuja chave sugira a página
    for (var k3 = 0; k3 < keys.length; k3++) {
      var mod = TRJ.pages[keys[k3]];
      if (mod && typeof mod === 'object') {
        var kn = keys[k3].toLowerCase();
        if (kn.indexOf(lower) >= 0 && (typeof mod.render === 'function' || typeof mod.page === 'function' || typeof mod.default === 'function')) {
          return mod;
        }
      }
    }

    return null;
  }

  // render agora suporta:
  // - páginas antigas exportando função: fn(pageElement, {data, app})
  // - módulos modernos exportando render: module.render(root[, opts])
  // - módulos com default/function/page/show/init
  function render() {
    try {
      if (!TRJ.auth || !TRJ.auth.isLogged || !TRJ.auth.isLogged()) { showLogin(); return; }
    } catch (e) {
      showLogin(); return;
    }

    var page = document.getElementById('page');
    if (!page) return;

    try { U.destroyCharts && U.destroyCharts(); } catch(_) {}
    try { U.closeModal && U.closeModal(); } catch(_) {}

    var hash = location.hash || '#/dashboard';
    // se rota não registrada, fallback para dashboard
    if (!ROUTES[hash]) { location.hash = '#/dashboard'; return; }

    var hasTasks = App.data && App.data.rawTasks && App.data.rawTasks.length > 0;
    // bloquear acesso às abas até upload (comportamento existente)
    if (!hasTasks && hash !== '#/importar' && hash !== '#/configuracoes') { location.hash = '#/importar'; return; }

    setActiveLink();

    // Resolver nome do módulo a partir da rota
    var moduleName = ROUTES[hash];
    var module = findPageModuleByName(moduleName);

    // fallback: se não encontrou, tentar usar o slug direto (ex: 'sites-fora')
    if (!module) {
      var slug = (hash || '').replace(/^#\/?/, '');
      module = findPageModuleByName(slug);
    }

    // limpar container
    page.innerHTML = '';

    // 1) se é uma função direta (old-style)
    if (typeof module === 'function') {
      try {
        module(page, { data: App.data, app: App });
        return;
      } catch (e) {
        page.appendChild((U && U.h) ? U.h('div', { class: 'trj-card p-6', style: { color: 'var(--trj-red)' }, text: 'Erro ao renderizar a página: ' + (e.message || e) }) : (function(){ var d=document.createElement('div'); d.className='trj-card p-6'; d.style.color='var(--trj-red)'; d.textContent='Erro ao renderizar a página: '+(e.message||e); return d; })());
        return;
      }
    }

    // 2) se é um objeto/módulo, testamos várias propriedades/assinaturas
    if (module && typeof module === 'object') {
      try {
        // preferencial: module.render(root, opts)
        if (typeof module.render === 'function') {
          try { module.render(page, { data: App.data, app: App }); return; } catch (e) { console.warn('module.render erro', e); }
        }

        // module.default é função? (bundlers/ESM)
        if (typeof module.default === 'function') {
          try { module.default(page, { data: App.data, app: App }); return; } catch (e) { console.warn('module.default erro', e); }
        }

        // module.page / module.show
        if (typeof module.page === 'function') {
          try { module.page(page, { data: App.data, app: App }); return; } catch (e) { console.warn('module.page erro', e); }
        }
        if (typeof module.show === 'function') {
          try { module.show(page, { data: App.data, app: App }); return; } catch (e) { console.warn('module.show erro', e); }
        }

        // init + render fallback: chamar init({data,app}) se existir, depois tentar render again
        if (typeof module.init === 'function') {
          try { module.init({ data: App.data, app: App }); } catch (ee) { console.warn('page.init falhou', ee); }
          if (typeof module.render === 'function') {
            try { module.render(page, { data: App.data, app: App }); return; } catch (e) { console.warn('module.render após init erro', e); }
          }
        }

      } catch (e) {
        console.warn('Erro ao invocar módulo de página', e);
      }
    }

    // Se chegamos aqui, nenhuma implementação válida foi encontrada
    page.appendChild((U && U.h) ? U.h('div', { class: 'trj-card p-6', text: 'Página não encontrada.' }) : (function(){ var d=document.createElement('div'); d.className='trj-card p-6'; d.textContent='Página não encontrada.'; return d; })());
  }
  App.render = render;
  App.navigate = function (hash) { if (location.hash === hash) render(); else location.hash = hash; };
  
  // ---------------- START ----------------
  async function startApp() {
    var ls = document.getElementById('login-screen');
    if (ls) ls.style.display = 'none';
    buildShell();
    try {
      await App.loadAll();
      buildShell();
      render();
      // start monitor only if available and not already started
      try {
        if (TRJ.files && typeof TRJ.files.startAutoMonitor === 'function' && !TRJ.files._monitorTimer) {
          try { TRJ.files.startAutoMonitor(function () { App.refresh(); }, 45000); }
          catch (e) { try { TRJ.files.startAutoMonitor(); } catch(_) { console.warn('startAutoMonitor erro'); } }
        }
      } catch (e) { console.warn('Erro ao iniciar monitor no startApp:', e); }
    } catch (e) {
      // token expirado -> volta pro login
      if (/token/i.test((e && e.message) || '')) { doLogout(); showLogin(e.message); return; }
      try { U.toast && U.toast(e.message || 'Erro ao carregar dados.', 'err'); } catch(_) {}
    }
    if (TRJ.config && TRJ.config.AUTO_REFRESH_SEG > 0) {
      if (App._timer) clearInterval(App._timer);
      App._timer = setInterval(function () { App.refresh(); }, TRJ.config.AUTO_REFRESH_SEG * 1000);
    }
  }

  // substitua a função boot existente por esta versão defensiva:
  function waitFor(conditionFn, interval, timeout) {
    interval = interval || 100;
    timeout = timeout || 5000;
    var start = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        try {
          if (conditionFn()) return resolve(true);
        } catch (e) { /* ignore */ }
        if (Date.now() - start > timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  async function boot() {
    wireLogin();
    window.addEventListener('hashchange', render);

    // Se não tiver auth disponível, mostra login e retorna
    if (!TRJ.auth || !TRJ.auth.isLogged) { showLogin(); return; }

    // se usuário já estiver logado, aguarda módulos (compute/pages) e inicia
    if (TRJ.auth.isLogged()) {
      var ready = await waitFor(function () {
        return window.TRJ && TRJ.compute && typeof TRJ.compute.collectIds === 'function'
          && TRJ.pages && Object.keys(TRJ.pages).length > 0
          && TRJ.ui && typeof TRJ.ui.h === 'function';
      }, 100, 5000);

      if (!ready) {
        console.warn('Boot: módulos compute/pages não carregaram dentro do timeout. Tentando iniciar mesmo assim.');
      }

      try {
        await startApp();
      } catch (e) {
        console.error('Boot: startApp falhou', e);
        try { showLogin(e && e.message); } catch (_) {}
      }
    } else {
      // usuário não logado
      showLogin();
    }
  }

  // expõe listeners úteis para re-render quando tasks/incidents forem carregadas externamente
  document.removeEventListener('trj:tasksLoaded', render);
  document.addEventListener('trj:tasksLoaded', async function (e) {
    try {
      // Se houver payload com tasks, podemos otimizar, mas chamamos loadAll para manter consistência
      await App.loadAll();
    } catch (err) { console.warn('tasksLoaded handler erro', err); }
    try { render(); } catch(_) {}
  });

  // incidents
  try { document.removeEventListener('trj:incidentsLoaded', render); } catch(_) {}
  document.addEventListener('trj:incidentsLoaded', async function (e) {
    try {
      // recarrega apenas incidents para ser mais leve
      await App.reloadIncidents();
    } catch (err) { console.warn('incidentsLoaded handler erro', err); }
    try { render(); } catch(_) {}
  });

  // iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  TRJ.app = App;
})(window.TRJ = window.TRJ || {});
