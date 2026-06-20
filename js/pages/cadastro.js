// cadastro.js - formulário de cadastro de sites
(function(){
  const responsables = [
    { label: 'Zona Oeste - Alan', value: 'ALAN' },
    { label: 'Zona Sul / Niteroi - Matheus', value: 'MATHEUS' },
    { label: 'Zona Norte - Jack', value: 'JACKELINE' },
    { label: 'ANG/CBF/NFB/PET/VRD - Jesse', value: 'JESSE' },
    { label: 'Baixada - Vinicius', value: 'VINICIUS' },
    { label: 'Campos - Merielem', value: 'MERIELEM' },
    { label: 'ES - Merielem', value: 'MERIELEM' }
  ];

  function buildCadastroForm(containerId){
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = `
      <div class="trj-card p-4">
        <h3>Cadastro de Sites</h3>
        <div class="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label>BAIRRO:</label>
            <input id="cad-bairro" class="trj-input" />
          </div>
          <div>
            <label>END_ID:</label>
            <input id="cad-endid" class="trj-input" />
          </div>
          <div class="col-span-2">
            <label>SITE:</label>
            <input id="cad-site" class="trj-input" />
          </div>
          <div>
            <label>RESPONSÁVEL:</label>
            <select id="cad-resp" class="trj-select"></select>
          </div>
        </div>
        <div class="mt-3">
          <button id="cad-salvar" class="trj-btn trj-btn-primary clickable">Salvar</button>
          <button id="cad-limpar" class="trj-btn trj-btn-ghost clickable">Limpar</button>
        </div>
        <div id="cad-result" style="margin-top:8px;color:var(--trj-muted);"></div>
      </div>
    `;
    const sel = document.getElementById('cad-resp');
    responsables.forEach(r=>{
      const opt = document.createElement('option'); opt.value = r.value; opt.text = r.label; sel.appendChild(opt);
    });

    document.getElementById('cad-salvar').addEventListener('click', ()=>{
      const row = {
        bairro: document.getElementById('cad-bairro').value.trim(),
        end_id: document.getElementById('cad-endid').value.trim(),
        site: document.getElementById('cad-site').value.trim(),
        responsavel: document.getElementById('cad-resp').value
      };
      if(window.TRJ && TRJ.api && TRJ.api.saveSite){
        TRJ.api.saveSite(row).then(()=> document.getElementById('cad-result').innerText = 'Site salvo com sucesso.');
      } else {
        const stored = JSON.parse(localStorage.getItem('trj_sites')||'[]'); stored.push(row); localStorage.setItem('trj_sites', JSON.stringify(stored));
        document.getElementById('cad-result').innerText = 'Site salvo (local).';
      }
    });

    document.getElementById('cad-limpar').addEventListener('click', ()=>{
      document.getElementById('cad-bairro').value = ''; document.getElementById('cad-endid').value = ''; document.getElementById('cad-site').value = ''; document.getElementById('cad-resp').selectedIndex = 0; document.getElementById('cad-result').innerText = '';
    });
  }

  document.addEventListener('DOMContentLoaded', ()=> buildCadastroForm('cadastro-container'));
  window.TRJ = window.TRJ || {}; window.TRJ.cadastro = { buildCadastroForm };
})();
