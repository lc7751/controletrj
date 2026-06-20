// js/pages/importar.js
(function (TRJ) {
  // helpers
  function showMsg(elId, msg) {
    const el = document.getElementById(elId);
    if (el) el.innerText = msg;
  }

  function detectSeparator(line) {
    if (!line) return ';';
    if (line.indexOf(';') >= 0) return ';';
    if (line.indexOf('|') >= 0) return '|';
    if (line.indexOf('\t') >= 0) return '\t';
    if (line.indexOf(',') >= 0) return ',';
    return ';';
  }

  function parseIncidentesText(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) return [];

    const sep = detectSeparator(lines[0]);
    const firstCols = lines[0].split(sep).map((c) => c.trim().toUpperCase());
    const hasHeader = ['END_ID','END ID','SITE','BAIRRO','RESPONSÁVEL','RESPONSAVEL','DATA']
      .some((h) => firstCols.includes(h));

    const results = [];
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim());
      const obj = {};

      if (hasHeader) {
        firstCols.forEach((h, idx) => { obj[h] = cols[idx] || ''; });
      } else {
        obj.END_ID = cols[0] || '';
        obj.SITE = cols[1] || '';
        obj.BAIRRO = cols[2] || '';
        obj.RESPONSAVEL = cols[3] || '';
        obj.DATA = cols[4] || '';
        obj.OBS = cols.slice(5).join(' ') || '';
      }

      results.push(obj);
    }

    return results;
  }

  // Render da página (chamado pelo app)
  function render(container) {
    const hasTasks = !!localStorage.getItem('trj_tasks');
    container.innerHTML = `
      <div class="max-w-4xl mx-auto p-6" id="importar-page-inner">
        <div class="mb-6">
          <h1 class="text-2xl font-bold">Importar Dados</h1>
          <p class="text-sm text-muted">Carregue o arquivo base para liberar as demais abas.</p>
        </div>

        ${!hasTasks ? `
          <div class="bg-primary/8 border border-primary/20 p-4 rounded mb-6">
            <strong>Atenção:</strong> É necessário carregar o arquivo de tarefas para acessar os dashboards.
          </div>
        ` : ''}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="trj-card p-4">
            <h3 class="font-bold mb-2">1. Arquivo de Tarefas (Excel / CSV)</h3>
            <input type="file" id="file-input" class="block w-full mb-3" accept=".xls,.xlsx,.csv" />
            <button id="btn-process-upload" class="trj-btn w-full py-2">Processar Arquivo</button>
            <button id="btn-connect-folder" class="mt-3 text-xs w-full">Conectar pasta (monitoramento)</button>
          </div>

          <div class="trj-card p-4">
            <h3 class="font-bold mb-2">2. Incidentes (colar texto)</h3>
            <textarea id="incidentes-text" class="w-full h-36 mb-3" placeholder="Cole aqui as colunas do painel G.E.N.E.S.I.S (separadores: tab, ; ou |)"></textarea>
            <button id="btn-parse-incidentes" class="trj-btn w-full py-2">Importar Incidentes</button>
            <div id="incidentes-parse-result" class="text-xs mt-2 text-muted"></div>
          </div>
        </div>
      </div>
    `;

    setupEvents();
  }

  // Eventos (seletor baseado no conteúdo injetado)
  function setupEvents() {
    const btnParse = document.getElementById('btn-parse-incidentes');
    const txt = document.getElementById('incidentes-text');
    const fileInput = document.getElementById('file-input');
    const btnProcess = document.getElementById('btn-process-upload');
    const btnConnect = document.getElementById('btn-connect-folder');

    if (btnParse) {
      btnParse.addEventListener('click', () => {
        const text = txt ? txt.value : '';
        const parsed = parseIncidentesText(text);

        if (parsed.length === 0) {
          showMsg('incidentes-parse-result', 'Nenhum incidente detectado. Verifique o formato.');
          return;
        }

        showMsg('incidentes-parse-result', `Detectados ${parsed.length} incidentes. Importando...`);

        if (window.TRJ && TRJ.api && TRJ.api.importIncidentes) {
          TRJ.api.importIncidentes(parsed)
            .then(() => showMsg('incidentes-parse-result', 'Incidentes importados com sucesso.'))
            .catch((e) => showMsg('incidentes-parse-result', 'Erro ao importar: ' + (e.message || e)));
        } else {
          const stored = JSON.parse(localStorage.getItem('trj_incidentes') || '[]').concat(parsed);
          localStorage.setItem('trj_incidentes', JSON.stringify(stored));
          showMsg('incidentes-parse-result', 'Incidentes gravados localmente (fallback).');
          document.dispatchEvent(new CustomEvent('trj:incidentesImported', { detail: { count: parsed.length } }));
        }
      });
    }

    if (btnProcess) {
      btnProcess.addEventListener('click', () => {
        const files = fileInput ? fileInput.files : null;
        if (!files || files.length === 0) {
          alert('Selecione um arquivo para upload.');
          return;
        }

        const f = files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
          try {
            const data = e.target.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const first = workbook.SheetNames[0];
            const sheet = workbook.Sheets[first];
            const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (window.TRJ && TRJ.files && TRJ.files.setTasks) {
              TRJ.files.setTasks(json);
            } else {
              localStorage.setItem('trj_tasks', JSON.stringify(json));
            }

            document.dispatchEvent(new CustomEvent('trj:tasksLoaded'));
            alert('Arquivo processado com sucesso.');
          } catch (err) {
            alert('Erro ao processar o arquivo: ' + (err.message || err));
            console.error(err);
          }
        };
        reader.readAsBinaryString(f);
      });
    }

    if (btnConnect) {
      btnConnect.addEventListener('click', async () => {
        if (window.TRJ && TRJ.files && TRJ.files.connectFolder) {
          try {
            await TRJ.files.connectFolder();
            alert('Pasta conectada. Monitoração automática iniciada.');
          } catch (err) {
            alert('Não foi possível conectar a pasta: ' + err.message);
          }
        } else {
          alert('Função de conexão de pasta não implementada.');
        }
      });
    }
  }

  // expõe o módulo para o app
  TRJ.importar = TRJ.importar || {};
  TRJ.importar.render = render;

  // inicialização quando a página tem um container estático #importar-page
  document.addEventListener('DOMContentLoaded', function () {
    const directContainer = document.getElementById('importar-page');
    if (directContainer) {
      render(directContainer);
    }
  });
})(window.TRJ = window.TRJ || {});