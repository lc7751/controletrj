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
      const iconHtml = TRJ.app.icon ? TRJ.app.icon(link.ico) : '';
      const a = U.h('a', { 
        href: link.hash, 
        class: 'nav-item ' + (window.location.hash === link.hash ? 'active' : ''),
        html: `<i>${iconHtml}</i><span>${link.label}</span>`
      });
      nav.appendChild(a);
    });
  }

  async function startApp() {
    // 1. Forçar exibição inicial correta para evitar tela preta
    const loginEl = document.getElementById('login-screen');
    const appEl = document.getElementById('app-shell');

    if (!TRJ.auth.isLogged()) {
      if (loginEl) loginEl.style.display = 'flex';
      if (appEl) appEl.style.display = 'none';
      return;
    }

    if (loginEl) loginEl.style.display = 'none';
    if (appEl) appEl.style.display = 'block';

    // 2. Carregar dados iniciais
    try {
        App.data = await TRJ.api.getConfig(); // ou carregar local
    } catch(e) { console.warn('Falha config api'); }

    // 3. Tentar monitoramento sem quebrar o app
    try {
      if (TRJ.files && TRJ.files.startAutoMonitor) TRJ.files.startAutoMonitor();
    } catch(e) { console.info('Monitor não iniciado: ' + e.message); }

    window.addEventListener('hashchange', render);
    render();
  }

  function render() {
    const container = document.getElementById('main-content');
    if (!container) return;
    buildSidebar();

    const route = window.location.hash.replace('#/', '') || 'dashboard';
    const hasTasks = !!localStorage.getItem('trj_tasks');

    // Redirecionamento se tentar acessar aba protegida sem dados
    if (!hasTasks && ['dashboard', 'sla', 'regional', 'sites-fora'].includes(route)) {
        window.location.hash = '#/importar';
        return;
    }

    container.innerHTML = '';
    const page = TRJ.pages[route];
    if (page && page.rebuild) {
      page.rebuild(container, App.data);
    } else {
      container.innerHTML = `<div class="p-8 text-muted">Aba ${route} em construção.</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', startApp);
  document.addEventListener('trj:tasksLoaded', render);

  TRJ.app = App;
})(window.TRJ = window.TRJ || {});