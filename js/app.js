// app.js - lógica reduzida para controle de exibição de abas até upload
(function(){
  function buildSidebar(){
    // marca elementos com data-requires="tasks" para esconder quando não houver tasks
    const hasTasks = !!(localStorage.getItem('trj_tasks'));
    document.querySelectorAll('.nav-item[data-requires="tasks"]').forEach(el => { el.style.display = hasTasks ? '' : 'none'; });
    document.querySelectorAll('.nav-item[data-always]').forEach(el => { el.style.display = ''; });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    buildSidebar();
    document.addEventListener('trj:tasksLoaded', ()=> buildSidebar());
  });

  window.TRJ = window.TRJ || {};
  window.TRJ.app = window.TRJ.app || {};
  window.TRJ.app.buildSidebar = buildSidebar;
})();
