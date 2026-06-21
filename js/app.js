/* app.js — VERSÃO FINAL AJUSTADA */
(function (TRJ) {
  var U = TRJ.ui, D = TRJ.domain, Comp = TRJ.compute, C = TRJ.constants;
  var App = { data: null };

  // Ícones e Links (Dashboard e SLA agora exigem tarefas)
  var LINKS = [
    { hash: '#/dashboard', label: 'Dashboard', ico: 'dashboard', requiresTasks: true },
    { hash: '#/sla', label: 'SLA Ativo', ico: 'sla', requiresTasks: true },
    { hash: '#/regional', label: 'Regional', ico: 'regional', requiresTasks: true },
    { hash: '#/sites-fora', label: 'Sites Fora', ico: 'sites', requiresTasks: true },
    { hash: '#/cadastro', label: 'Cadastro Sites', ico: 'cadastro' },
    { hash: '#/importar', label: 'Importar Dados', ico: 'importar' },
    { hash: '#/configuracoes', label: 'Configurações', ico: 'config' }
  ];

  function buildSidebar() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const hasTasks = !!localStorage.getItem('trj_tasks');
    nav.innerHTML = '';
    
    LINKS.forEach(link => {
      if (link.requiresTasks && !hasTasks) return; // Esconde se não houver dados
      const iconHtml = TRJ.app && TRJ.app.icon ? TRJ.app.icon(link.ico) : '';
      const a = U.h('a', { 
        href: link.hash, 
        class: 'nav-item ' + (window.location.hash === link.hash ? 'active' : ''),
        html: `<i>${iconHtml}</i><span>${link.label}</span>`
      });
      nav.appendChild(a);
    });
  }

 // ---------------- START (substituir por este trecho) ----------------
  async function startApp() {
    // mostra loading (UI) mas não oculta a tela de login até o carregamento terminar com sucesso
    U.loading(true);
    // garantir estado consistente da UI enquanto tentamos carregar
    try {
      // buildShell aqui prepara a estrutura do painel, mas não oculta o login até o sucesso
      if (typeof buildShell === 'function') buildShell();

      // carrega todos os dados (config do Apps Script + tarefas/incidentes locais)
      await App.loadAll();

      // reconstruir shell com dados e renderizar
      if (typeof buildShell === 'function') buildShell();
      render();

      // iniciar monitor automático (se disponível) de forma defensiva
      try {
        if (TRJ.files && typeof TRJ.files.startAutoMonitor === 'function') {
          // a sua versão do startAutoMonitor não aceita callbacks; apenas chame-a
          TRJ.files.startAutoMonitor();
        }
      } catch (e) {
        console.warn('Falha ao iniciar auto-monitor (silenciado):', e && e.message);
      }

      // configurar auto-refresh (se habilitado na config)
      try {
        if (TRJ.config && Number(TRJ.config.AUTO_REFRESH_SEG) > 0) {
          if (App._timer) clearInterval(App._timer);
          App._timer = setInterval(function () { App.refresh(); }, Number(TRJ.config.AUTO_REFRESH_SEG) * 1000);
        }
      } catch (e) {
        console.warn('Erro ao configurar auto-refresh:', e && e.message);
      }

      // esconder tela de login somente após sucesso total
      var ls = document.getElementById('login-screen');
      if (ls) ls.style.display = 'none';
      var shell = document.getElementById('app-shell');
      if (shell) shell.style.display = 'flex';

    } catch (e) {
      // erro no carregamento inicial -> mostrar login (evita tela preta)
      console.error('Erro no startApp:', e);
      try { U.toast(e.message || 'Erro ao carregar dados.', 'err'); } catch(_) {}

      // restaurar a tela de login e esconder o shell
      var ls = document.getElementById('login-screen');
      if (ls) ls.style.display = 'flex';
      var shell = document.getElementById('app-shell');
      if (shell) shell.style.display = 'none';

      // se o erro aparentar ser token inválido, forçar logout
      try {
        if (/token/i.test(e && e.message || '')) {
          if (typeof doLogout === 'function') doLogout();
          showLogin(e.message);
          return;
        }
      } catch(err){/*ignore*/}

      showLogin(e && e.message ? e.message : '');
      return;
    } finally {
      U.loading(false);
    }
  }

  function boot() {
    if (typeof wireLogin === 'function') wireLogin();
    window.addEventListener('hashchange', render);

    // Se usuário já estiver logado, tentamos iniciar; caso falhe, mostramos login.
    if (TRJ.auth && typeof TRJ.auth.isLogged === 'function' && TRJ.auth.isLogged()) {
      // chamar startApp() mas não bloquear o thread do boot
      startApp().catch(function(e){
        console.error('Boot: startApp falhou', e);
        try { showLogin(e && e.message); } catch(_) {}
      });
    } else {
      showLogin();
    }
  }

  // registra atualização quando tasks são carregadas
  document.addEventListener('trj:tasksLoaded', render);

  // inicialização quando DOM estiver pronto (mantemos o boot seguro)
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // render robusto: aceita página como função OU objeto com método rebuild
  function render() {
    const container = document.getElementById('main-content') || document.getElementById('page') || document.getElementById('app-root');
    if (!container) return;
    buildSidebar();

    const rawHash = window.location.hash || '#/dashboard';
    const route = (rawHash.replace('#/', '') || 'dashboard');
    const hasTasks = !!localStorage.getItem('trj_tasks');

    // Redirecionamento se tentar acessar aba protegida sem dados
    if (!hasTasks && ['dashboard', 'sla', 'regional', 'sites-fora'].includes(route)) {
      if (window.location.hash !== '#/importar') window.location.hash = '#/importar';
      return;
    }

    container.innerHTML = '';
    const page = TRJ.pages && TRJ.pages[route];

    if (!page) {
      container.innerHTML = `<div class="p-8 text-muted">Aba ${route} em construção.</div>`;
      return;
    }

    // page pode ser função (page(container, opts)) ou objeto { rebuild(container, data) }
    try {
      if (typeof page === 'function') {
        page(container, { data: App.data, app: App });
      } else if (page && typeof page.rebuild === 'function') {
        page.rebuild(container, App.data);
      } else {
        container.innerHTML = `<div class="p-8 text-muted">Aba ${route} em construção.</div>`;
      }
    } catch (e) {
      container.innerHTML = `<div class="p-6 trj-card" style="color:var(--trj-red)">Erro ao renderizar a página: ${e && e.message || e}</div>`;
      console.error('Erro ao renderizar página', route, e);
    }
  }

  TRJ.app = App;
})(window.TRJ = window.TRJ || {});