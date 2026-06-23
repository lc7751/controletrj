// js/pages/importar.js
(function(){
  if (!window.TRJ) window.TRJ = {};
  TRJ.pages = TRJ.pages || {};

  TRJ.pages.importar = {
    render: function(root) {
      try {
        var mount = root || document.getElementById('importar-root') || document.getElementById('page') || document.body;
        mount.innerHTML = '';
        var header = document.createElement('h3'); header.textContent = 'Importar Dados'; header.className='mb-3';
        var card = document.createElement('div'); card.className='trj-card p-4';

        // file input
        var fileRow = document.createElement('div');
        fileRow.innerHTML = '<label>Upload de arquivos (XLSX / CSV):</label><input id="imp-file" type="file" class="trj-input" multiple style="display:block;margin:6px 0 10px;"/>';
        var btnImport = document.createElement('button'); btnImport.className='trj-btn clickable'; btnImport.textContent='Importar arquivos';
        btnImport.onclick = async function(){
          var input = document.getElementById('imp-file');
          if (!input.files || !input.files.length) { TRJ.ui && TRJ.ui.toast && TRJ.ui.toast('Selecione um arquivo'); return; }
          var files = Array.from(input.files);
          // use TRJ.sitesFora.importFromFile if available or TRJ.files.process
          try {
            if (TRJ.sitesFora && typeof TRJ.sitesFora.importFromFile === 'function') {
              await TRJ.sitesFora.importFromFile(files);
            } else {
              TRJ.ui && TRJ.ui.toast && TRJ.ui.toast('Módulo de import não disponível', 'warning');
            }
          } catch(e){ console.error('import files error', e); }
        };

        // incidents textarea (text input) per your request
        var taWrap = document.createElement('div'); taWrap.style.marginTop='12px';
        taWrap.innerHTML = '<label>Colar incidentes (texto CSV/TSV/HTML):</label><textarea id="imp-inc-text" class="trj-input" style="min-height:120px;width:100%;margin:6px 0;"></textarea>';
        var btnTextImport = document.createElement('button'); btnTextImport.className='trj-btn clickable'; btnTextImport.textContent='Importar incidentes do texto';
        btnTextImport.onclick = async function(){
          var txt = document.getElementById('imp-inc-text').value;
          if (!txt || !txt.trim()) { TRJ.ui && TRJ.ui.toast && TRJ.ui.toast('Cole o texto dos incidentes'); return; }
          try {
            if (TRJ.sitesFora && typeof TRJ.sitesFora.importFromText === 'function') {
              await TRJ.sitesFora.importFromText(txt);
            } else {
              localStorage.setItem('trj_incidentes', JSON.stringify([]));
              TRJ.ui && TRJ.ui.toast && TRJ.ui.toast('Módulo de import não encontrado', 'warning');
            }
          } catch(e){ console.error('import text error', e); }
        };

        card.appendChild(fileRow);
        card.appendChild(btnImport);
        card.appendChild(taWrap);
        card.appendChild(btnTextImport);

        mount.appendChild(header); mount.appendChild(card);

        if (!TRJ.pages.importar._bound) {
          document.addEventListener('trj:folderChanged.importar', function(){ setTimeout(function(){ TRJ.pages.importar.render(mount); }, 200); });
          TRJ.pages.importar._bound = true;
        }
      } catch(e){ console.error('importar render error', e); }
    }
  };
})();
