/* importar.js — VERSÃO FINAL */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, FS = TRJ.files;

  function render(container) {
    const hasTasks = !!localStorage.getItem('trj_tasks');

    container.innerHTML = `
      <div class="max-w-4xl mx-auto p-6">
        <h1 class="text-2xl font-bold">Importar Dados</h1>
        <p class="text-muted mb-6">Central de carregamento de arquivos e incidentes.</p>

        ${!hasTasks ? `
          <div class="bg-primary/10 border border-primary/30 p-5 rounded-lg mb-8 animate-pulse">
            <h3 class="text-primary font-bold flex items-center gap-2">
               ⚠️ BLOQUEIO DE VISUALIZAÇÃO
            </h3>
            <p class="text-sm text-primary mt-1">
              Os Dashboards e SLAs estão ocultos. Por favor, carregue o arquivo de tarefas (.xlsx) abaixo para desbloquear.
            </p>
          </div>
        ` : ''}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
          <!-- Bloco 1: Arquivos Excel -->
          <div class="trj-card p-6 border-2 border-dashed border-muted/20">
             <h3 class="font-bold mb-4">1. Arquivos de Atividades (.xlsx)</h3>
             <input type="file" id="f-upload" class="block w-full text-sm mb-4" accept=".xlsx">
             <button id="btn-up" class="trj-btn bg-primary w-full py-2">Processar Upload</button>
             <button id="btn-conn" class="mt-4 text-xs underline w-full">Conectar pasta automática</button>
          </div>

          <!-- Bloco 2: Incidentes (Texto) -->
          <div class="trj-card p-6">
             <h3 class="font-bold mb-4">2. Incidentes (Colar Texto)</h3>
             <textarea id="inc-text" class="w-full h-32 bg-bg border border-muted/20 rounded p-3 text-xs mb-3" 
               placeholder="Arraste as colunas do G.E.N.E.S.I.S aqui (Site, Cidade, ANF...)"></textarea>
             <button id="btn-inc-parse" class="trj-btn border border-primary text-primary w-full py-2">Importar Texto</button>
             <div id="inc-msg" class="text-xs mt-2 text-muted"></div>
          </div>
        </div>
      </div>
    `;

    // Eventos
    document.getElementById('btn-up')?.addEventListener('click', () => {
      const fin = document.getElementById('f-upload');
      if (!fin.files[0]) return alert('Selecione um arquivo.');
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target.result, {type:'binary'});
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        localStorage.setItem('trj_tasks', JSON.stringify(data));
        document.dispatchEvent(new CustomEvent('trj:tasksLoaded'));
        alert('Tarefas carregadas! Dashboards liberados.');
      };
      reader.readAsBinaryString(fin.files[0]);
    });

    document.getElementById('btn-inc-parse')?.addEventListener('click', () => {
      const text = document.getElementById('inc-text').value;
      if (!text.trim()) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const parsed = lines.map(l => {
        const c = l.split(/\t|;|\|/);
        return { site: c[0], cidade: c[1], anf: c[2], causa: c[3], status: c[4] };
      });
      localStorage.setItem('trj_incidentes', JSON.stringify(parsed));
      document.getElementById('inc-msg').innerText = `${parsed.length} registros salvos.`;
    });
  }

  TRJ.pages.importar = { rebuild: render };
})(window.TRJ = window.TRJ || {});