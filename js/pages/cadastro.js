// js/pages/cadastro.js
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.cadastro = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('page') || document.body;
        mount.innerHTML = '';
        var header = document.createElement('h3'); header.textContent = 'Cadastro de Sites'; header.className='mb-3';
        var card = document.createElement('div'); card.className='trj-card p-4';

        // form fields: BAIRRO, END_ID, SITE, RESPONSÁVEL (dropdown predefined)
        var form = document.createElement('div');
        form.innerHTML = ''
          + '<label>BAIRRO:</label><input id="cad-bairro" class="trj-input" style="margin-bottom:8px;"/><br/>'
          + '<label>END_ID:</label><input id="cad-endid" class="trj-input" style="margin-bottom:8px;"/><br/>'
          + '<label>SITE:</label><input id="cad-site" class="trj-input" style="margin-bottom:8px;"/><br/>'
          + '<label>RESPONSÁVEL:</label><select id="cad-resp" class="trj-input" style="margin-bottom:8px;"><option value="">-- selecione --</option><option value="1">Equipe A</option><option value="2">Equipe B</option><option value="3">IME</option></select><br/>';
        var saveBtn = document.createElement('button'); saveBtn.className='trj-btn trj-btn-primary clickable'; saveBtn.textContent='Salvar'; saveBtn.onclick = function(){
          var obj = {
            bairro: document.getElementById('cad-bairro').value,
            end_id: document.getElementById('cad-endid').value,
            site: document.getElementById('cad-site').value,
            responsavel: document.getElementById('cad-resp').value,
            createdAt: (new Date()).toISOString()
          };
          // fallback persisting to localStorage or call TRJ.api if exists
          if (TRJ.api && typeof TRJ.api.saveSite === 'function') {
            TRJ.api.saveSite(obj).then(function(){ TRJ.ui && TRJ.ui.toast && TRJ.ui.toast('Salvo com sucesso','success'); }).catch(function(){ localSave(obj); });
          } else {
            localSave(obj);
          }
        };
        function localSave(o){
          var arr = JSON.parse(localStorage.getItem('trj_sites_cadastro')||'[]');
          arr.unshift(o);
          localStorage.setItem('trj_sites_cadastro', JSON.stringify(arr));
          if (TRJ.ui && TRJ.ui.toast) TRJ.ui.toast('Salvo localmente','info');
        }

        card.appendChild(form);
        card.appendChild(saveBtn);

        // list existing
        var list = document.createElement('div'); list.style.marginTop='12px';
        var existing = JSON.parse(localStorage.getItem('trj_sites_cadastro')||'[]');
        list.innerHTML = '<strong>Cadastros recentes (' + existing.length + ')</strong>';
        existing.slice(0,20).forEach(function(s){
          var r = document.createElement('div'); r.className='trj-row'; r.textContent = (s.end_id || s.site || '') + ' — ' + (s.responsavel||'');
          list.appendChild(r);
        });
        card.appendChild(list);

        mount.appendChild(header); mount.appendChild(card);
      } catch(e){ console.error('cadastro render error', e); }
    }
  };
})();
