// js/pages/cadastro.js (Formulário Atualizado)
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.cadastro = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.body;
        mount.innerHTML = '';
        var h = document.createElement('h3'); h.textContent = 'Cadastro de Sites'; h.className='mb-3';
        var card = document.createElement('div'); card.className='trj-card p-6';

        var html = `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label class="text-xs text-muted block mb-1">BAIRRO:</label>
              <input id="f-bairro" class="trj-input w-full" placeholder="Ex: Centro" />
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">END_ID:</label>
              <input id="f-endid" class="trj-input w-full" placeholder="Ex: RJB123" />
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">SITE:</label>
              <input id="f-site" class="trj-input w-full" placeholder="Nome do Site" />
            </div>
            <div>
              <label class="text-xs text-muted block mb-1">RESPONSÁVEL:</label>
              <select id="f-resp" class="trj-input w-full">
                <option value="Equipe A">Equipe A</option>
                <option value="Equipe B">Equipe B</option>
                <option value="IME">IME</option>
              </select>
            </div>
          </div>
          <button id="btn-save-site" class="trj-btn trj-btn-primary clickable px-8">Salvar Cadastro</button>
        `;
        
        card.innerHTML = html;
        mount.appendChild(h); mount.appendChild(card);

        // Lógica de Salvar (mesma do anterior)
        document.getElementById('btn-save-site').onclick = function() {
           // ... lógica de alert/toast e persistencia ...
           if(window.TRJ.ui) TRJ.ui.toast("Site cadastrado com sucesso!", "success");
        };

      } catch(e){ console.error(e); }
    }
  };
})();
