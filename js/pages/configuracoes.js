// js/pages/configuracoes.js
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.configuracoes = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.body;
        mount.innerHTML = '';
        var header = document.createElement('h3'); header.textContent = 'Configurações'; header.className='mb-3';
        var card = document.createElement('div'); card.className='trj-card p-4';

        var content = document.createElement('div');
        content.innerHTML = '<p>Opções de configuração do sistema. Ajuste conforme necessário.</p>';

        card.appendChild(content);
        mount.appendChild(header);
        mount.appendChild(card);
      } catch(e){ console.error('configuracoes render error', e); }
    }
  };
})();
