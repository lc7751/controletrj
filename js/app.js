/* =====================================================================
 * app.js  —  NÚCLEO DA APLICAÇÃO (bootstrap + rotas + cache de dados)
 * ---------------------------------------------------------------------
 * - Verifica login; mostra a tela de login ou o painel.
 * - Monta a barra lateral e troca de página pelo hash da URL (#/...).
 * - Carrega tarefas + incidentes + cidades + config UMA vez e reaproveita.
 * ===================================================================== */
(function (TRJ) {
  var U = TRJ.ui, D = TRJ.domain, Comp = TRJ.compute, C = TRJ.constants;
  var App = { data: null };

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
    var brand = U.h('div', { class: 'flex items-center gap-3 px-4 py-4' }, [
      U.h('img', { src: 'assets/logo-trj.png', alt: 'TRJ', style: { width: '38px', height: '38px', objectFit: 'contain' } }),
      U.h('div', null, [
        U.h('div', { class: 'font-extrabold text-sm', style: { color: (TRJ.config && TRJ.config.APP_NAME) ? 'var(--trj-primary)' : 'var(--trj-primary)', letterSpacing: '.5px' }, text: (TRJ.config && TRJ.config.APP_NAME) || 'CONTROLE TRJ' }),
        U.h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: (TRJ.config && TRJ.config.APP_SUB) || 'Operacional' })
      ])
    ]);
    var hasTasks = App.data && App.data.rawTasks && App.data.rawTasks.length > 0;
    var visibleLinks = hasTasks ? LINKS : LINKS.filter(function (l) { return l.hash === '#/importar' || l.hash === '#/configuracoes'; });
    var nav = U.h('nav', { class: 'flex flex-col gap-1 px-3 mt-2', style: { flex: '1' } }, visibleLinks.map(function (l) {
      return U.h('a', { class: 'trj-link', href: l.hash, dataset: { hash: l.hash } }, [
        U.h('span', { class: 'ico', html: icon(l.ico) }), U.h('span', { text: l.label })
      ]);
    }));
    if (!hasTasks) {
      nav.appendChild(U.h('div', { class: 'text-xs px-2 pt-2', style: { color: 'var(--trj-muted)', lineHeight: '1.4' }, text: 'Faça o upload dos arquivos para liberar as abas de visualização.' }));
    }
    var footer = U.h('div', { class: 'px-3 py-3', style: { borderTop: '1px solid var(--trj-border)' } }, [
      U.h('div', { class: 'text-xs px-2 mb-2 truncate', style: { color: 'var(--trj-muted)' }, text: user.email || '' }),
      U.h('button', { class: 'trj-link w-full', onclick: doLogout }, [U.h('span', { class: 'ico', html: icon('logout') }), U.h('span', { text: 'Sair' })])
    ]);
    return U.h('aside', { id: 'sidebar', class: 'trj-card flex flex-col', style: { width: '256px', minWidth: '256px', borderRadius: '0', borderTop: 'none', borderBottom: 'none', borderLeft: 'none', height: '100vh', position: 'sticky', top: '0' } }, [brand, nav, footer]);
  }

  function doLogout() {
    try { if (TRJ.files && TRJ.files.stopAutoMonitor) TRJ.files.stopAutoMonitor(); } catch(_) {}
    if (App._timer) { clearInterval(App._timer); App._timer = null; }
    try { TRJ.auth.logout(); } catch(_) {}
    location.hash = '#/dashboard';
    showLogin();
  }

  function setActiveLink() {
    var cur = location.hash || '#/dashboard';
    document.querySelectorAll('#sidebar .trj-link[data-hash]').forEach(function (a) {
      a.classList.toggle('active', a.dataset.hash === cur);
    });
  }

  function buildShell() {
    var shell = document.getElementById('app-shell');
    if (!shell) return;
    shell.innerHTML = '';
    shell.style.display = 'flex';
    var sidebar = buildSidebar();
    // topbar mobile
    var topbar = U.h('div', { class: 'flex items-center justify-between px-4 py-3 lg:hidden trj-card', style: { borderRadius: '0', borderLeft: 'none', borderRight: 'none', borderTop: 'none' } }, [
      U.h('div', { class: 'flex items-center gap-2' }, [
        U.h('img', { src: 'assets/logo-trj.png', alt: 'TRJ', style: { width: '28px', height: '28px' } }),
        U.h('span', { class: 'font-bold', style: { color: 'var(--trj-primary)' }, text: 'CONTROLE TRJ' })
      ]),
      U.h('button', { class: 'trj-btn trj-btn-ghost', text: '☰', onclick: toggleSidebar })
    ]);
    var page = U.h('div', { id: 'page', class: 'p-4 lg:p-6', style: { flex: '1' } });
    var main = U.h('div', { style: { flex: '1', minWidth: '0' } }, [topbar, page]);
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
  U.loading(true);
  try {
    var rawTasks = (TRJ.files && TRJ.files.getTasks()) || [];
    var rawInc = (TRJ.files && TRJ.files.getIncidents()) || [];

    var config = {};
    try {
      var cfgRes = await TRJ.api.getConfig();
      config = cfgRes.config || {};
    } catch (e) {
      console.warn('Falha ao carregar config externa:', e);
    }

    var prazoMap = D.montarPrazoMap(prazoOverride(config));

    var validMap = {};
    var ids = Comp.collectIds(rawTasks, rawInc);
    if (ids.length) {
      try {
        var lk = await TRJ.api.lookupCities(ids);
        validMap = lk.map || {};
      } catch (e) {
        console.warn('Falha ao consultar cidades:', e);
      }
    }

    var now = new Date();
    App.data = {
      config: config,
      prazoMap: prazoMap,
      validMap: validMap,
      rawTasks: rawTasks,
      rawInc: rawInc,
      tasksEnriched: Comp.enrichTasks(rawTasks, validMap, prazoMap, now),
      incidentsEnriched: Comp.enrichIncidents(rawInc, validMap),
      loadedAt: new Date()
    };
  } finally {
    U.loading(false);
  }
};

  App.refresh = async function () {
  try {
    await App.loadAll();
    buildShell();
    render();
    if (TRJ.files && TRJ.files.startAutoMonitor) {
      TRJ.files.startAutoMonitor(function () {
        App.refresh();
      }, 45000);
    }
    U.toast('Dados atualizados.', 'ok');
  } catch (e) {
    console.error('Erro em App.refresh:', e);
    buildShell();
    render();
    U.toast('Os arquivos foram lidos, mas houve falha ao atualizar alguns dados externos.', 'err');
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
    U.openModal(title || 'Detalhamento', U.taskTable(rows));
  };
  App.openDrillIncidents = function (spec, title) {
    if (!App.data) return;
    Comp = TRJ.compute || Comp || null;
    var drillInc = (Comp && typeof Comp.drillIncidents === 'function') ? Comp.drillIncidents : null;
    var rows = drillInc ? drillInc(App.data.incidentsEnriched, spec) : [];
    U.openModal(title || 'Detalhamento', U.incidentTable(rows));
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

  function render() {
    try {
      if (!TRJ.auth || !TRJ.auth.isLogged || !TRJ.auth.isLogged()) { showLogin(); return; }
    } catch (e) {
      showLogin(); return;
    }
    var page = document.getElementById('page');
    if (!page) return;
    try { U.destroyCharts(); } catch(_) {}
    try { U.closeModal(); } catch(_) {}
    var hash = location.hash || '#/dashboard';
    if (!ROUTES[hash]) { location.hash = '#/dashboard'; return; }
    var hasTasks = App.data && App.data.rawTasks && App.data.rawTasks.length > 0;
    if (!hasTasks && hash !== '#/importar' && hash !== '#/configuracoes') { location.hash = '#/importar'; return; }
    setActiveLink();
    var fn = TRJ.pages && TRJ.pages[ROUTES[hash]];
    page.innerHTML = '';
    if (typeof fn === 'function') {
      try { fn(page, { data: App.data, app: App }); }
      catch (e) { page.appendChild(U.h('div', { class: 'trj-card p-6', style: { color: 'var(--trj-red)' }, text: 'Erro ao renderizar a página: ' + (e.message || e) })); }
    } else {
      page.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Página não encontrada.' }));
    }
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
      if (TRJ.files && typeof TRJ.files.startAutoMonitor === 'function') {
        try { TRJ.files.startAutoMonitor(function () { App.refresh(); }, 45000); }
        catch (e) { try { TRJ.files.startAutoMonitor(); } catch(_) { console.warn('startAutoMonitor erro'); } }
      }
    } catch (e) {
      // token expirado -> volta pro login
      if (/token/i.test((e && e.message) || '')) { doLogout(); showLogin(e.message); return; }
      try { U.toast(e.message || 'Erro ao carregar dados.', 'err'); } catch(_) {}
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
          && TRJ.pages && Object.keys(TRJ.pages).length > 0;
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

  // expõe listener útil para re-render quando tasks forem carregadas externamente
  document.addEventListener('trj:tasksLoaded', render);

  // iniciar quando DOM estiver pronto
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  TRJ.app = App;
})(window.TRJ = window.TRJ || {});
