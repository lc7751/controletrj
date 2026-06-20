/* app.js — NÚCLEO CORRIGIDO */
(function (TRJ) {
  var App = { data: null };

  function checkNav() {
    const hasTasks = !!localStorage.getItem('trj_tasks');
    // Esconde itens que exigem tarefas
    document.querySelectorAll('.nav-item[data-requires="tasks"]').forEach(el => {
      el.style.display = hasTasks ? 'flex' : 'none';
    });
    // Se o usuário tentar acessar algo bloqueado via URL, manda para importar
    const route = window.location.hash || '#/dashboard';
    if (!hasTasks && !['#/importar', '#/configuracoes'].includes(route)) {
        window.location.hash = '#/importar';
    }
  }

  async function startApp() {
    if (!TRJ.auth.isLogged()) {
      document.getElementById('login-screen').style.display = 'flex';
      document.getElementById('app-shell').style.display = 'none';
      return;
    }

    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-shell').style.display = 'block';

    checkNav();
    
    // Inicia monitoramento automático se houver pasta conectada
    if (TRJ.files && TRJ.files.startAutoMonitor) TRJ.files.startAutoMonitor();

    window.addEventListener('hashchange', () => {
      checkNav();
      renderRoute();
    });
    renderRoute();
  }

  function renderRoute() {
    const route = window.location.hash.replace('#/', '') || 'dashboard';
    const container = document.getElementById('main-content');
    if (!container) return;
    container.innerHTML = '<div class="p-8 text-muted">Carregando módulo...</div>';
    
    // Chama a função de render do módulo específico (ex: TRJ.dashboard.render)
    if (TRJ[route] && TRJ[route].render) {
      TRJ[route].render(container);
    } else {
      container.innerHTML = `<div class="p-8">Módulo "${route}" em desenvolvimento.</div>`;
    }
  }

  // Eventos Globais
  document.addEventListener('DOMContentLoaded', startApp);
  document.addEventListener('trj:tasksLoaded', () => {
    checkNav();
    window.location.hash = '#/dashboard';
  });

  TRJ.app = App;
})(window.TRJ = window.TRJ || {});