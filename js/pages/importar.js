/* =====================================================================
 * Página: Importar dados
 * ---------------------------------------------------------------------
 * Carrega as TAREFAS a partir dos arquivos "Atividades-TRJ_FMMT" da pasta
 * de Downloads. Dois caminhos: leitura automática (Chrome/Edge) ou upload
 * manual (qualquer navegador).
 *
 * Os INCIDENTES (Sites Fora) podem ser importados de duas formas:
 *   • colando o texto/HTML do painel G.E.N.E.S.I.S em um campo de texto;
 *   • anexando o arquivo do painel G.E.N.E.S.I.S.
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, FS = TRJ.files, G = TRJ.genesis, Comp = TRJ.compute;

  function listaArquivos(meta) {
    var arr = (meta && meta.arquivos) || [];
    if (!arr.length) return null;
    return U.h('ul', { class: 'text-xs mt-2', style: { color: 'var(--trj-muted)', listStyle: 'disc', paddingLeft: '18px' } },
      arr.map(function (a) { return U.h('li', { text: a.nome + ' — ' + U.fmtNum(a.qtd) + ' tarefa(s)' }); }));
  }

  // Processa um texto/HTML do G.E.N.E.S.I.S e atualiza os incidentes.
  async function processarGenesis(html, data, app, origemLabel) {
    if (!html || !html.trim()) { U.toast('Cole o conteúdo do painel G.E.N.E.S.I.S primeiro.', 'err'); return false; }
    try {
      U.loading(true);
      if (!G.ehGenesisHtml(html)) { U.toast('O conteúdo não parece ser do painel G.E.N.E.S.I.S.', 'err'); return false; }
      var genesisRows = G.parseGenesisHtml(html);
      if (!genesisRows.length) { U.toast('Nenhum incidente encontrado no conteúdo informado.', 'err'); return false; }
      var ids = genesisRows.map(function (r) { return (r.enderecoId || r.site || '').toString().toUpperCase(); }).filter(Boolean);
      var validMap = (data && data.validMap) || {};
      if (ids.length) {
        try { var lk = await TRJ.api.lookupCities(ids); validMap = Object.assign({}, validMap, (lk && lk.map) || {}); }
        catch (e) { /* sem backend de cidades: segue sem enriquecimento */ }
      }
      var incidentes = Comp.genesisToIncidents(genesisRows, validMap);
      FS.setIncidents(incidentes, { origem: origemLabel || 'genesis', em: new Date().toISOString() });
      await app.reloadIncidents();
      U.toast(incidentes.length + ' incidente(s) importado(s).', 'ok');
      app.render();
      return true;
    } catch (e) {
      U.toast(e.message || 'Erro ao importar incidentes.', 'err');
      return false;
    } finally {
      U.loading(false);
    }
  }

  function importarIncidentesArquivo(input, data, app) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      processarGenesis(reader.result, data, app, 'genesis-arquivo').then(function () { input.value = ''; });
    };
    reader.readAsText(file, 'UTF-8');
  }

  TRJ.pages.importar = function (container, ctx) {
    var app = ctx.app;
    var data = ctx.data || {};
    var meta = FS.getMeta();
    var tMeta = meta.tasks || {};
    var nTasks = FS.getTasks().length;
    var nInc = FS.getIncidents().length;

    container.appendChild(U.pageHeader('Importar dados',
      'Envie os arquivos obrigatórios antes de liberar as abas de visualização.'));

    if (!nTasks) {
      container.appendChild(U.h('div', { class: 'trj-card p-4 mb-5', style: { border: '1px solid rgba(255,140,0,.35)', background: 'rgba(255,140,0,.08)' } }, [
        U.h('div', { class: 'font-bold mb-1', text: 'Upload obrigatório para liberar as visualizações' }),
        U.h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: 'Faça o upload ou conecte a pasta dos arquivos de atividades. Depois disso, o Dashboard, SLA, Visão Regional e demais abas ficam disponíveis.' })
      ]));
    }

    // ---- status atual ----
    var statusCards = U.h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-3 mb-5' }, [
      U.kpiCard({ label: 'Tarefas carregadas', value: U.fmtNum(nTasks), cor: C.CORES_TRJ.orange }),
      U.kpiCard({ label: 'Incidentes (Sites Fora)', value: U.fmtNum(nInc), cor: C.CORES_TRJ.blue }),
      U.kpiCard({ label: 'Origem das tarefas', value: tMeta.origem === 'pasta' ? 'Pasta' : (tMeta.origem === 'upload' ? 'Upload' : '—'), cor: C.CORES_TRJ.green }),
      U.kpiCard({ label: 'Atualizado em', value: tMeta.em ? new Date(tMeta.em).toLocaleDateString('pt-BR') : '—', sub: tMeta.em ? new Date(tMeta.em).toLocaleTimeString('pt-BR') : null, cor: (C.CORES_TRJ.purple || '#8b5cf6') })
    ]);
    container.appendChild(statusCards);
    var lf = listaArquivos(tMeta);
    if (lf) container.appendChild(U.h('div', { class: 'trj-card p-4 mb-5' }, [U.h('div', { class: 'text-sm font-bold mb-1', text: 'Arquivos da última carga' }), lf]));

    var grid = U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5' });
    container.appendChild(grid);

    // ================= BLOCO 1: leitura automática =================
    var auto = U.h('div', { class: 'trj-card p-5 flex flex-col gap-3' });
    auto.appendChild(U.h('h3', { class: 'text-base font-bold', html: app.icon('refresh') + ' Leitura automática da pasta' }));
    auto.appendChild(U.h('p', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: 'Conecte sua pasta de Downloads uma vez. Depois é só clicar em “Verificar agora” que o sistema lê os arquivos mais recentes automaticamente.' }));

    if (!FS.supportsDirectoryPicker()) {
      auto.appendChild(U.h('div', { class: 'trj-card p-3', style: { background: 'rgba(231,76,60,.1)', border: '1px solid rgba(231,76,60,.3)' } },
        U.h('div', { class: 'text-xs', style: { color: '#e8a' }, html: '⚠ Seu navegador não suporta leitura automática de pastas.<br>Use o <b>Google Chrome</b> ou <b>Microsoft Edge</b> (no computador), ou utilize o <b>upload manual</b> ao lado.' })));
    } else {
      var statusPasta = U.h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: 'Verificando pasta conectada...' });
      auto.appendChild(statusPasta);
      FS.folderName().then(function (nome) {
        statusPasta.textContent = nome ? ('✅ Pasta conectada: ' + nome) : 'Nenhuma pasta conectada ainda.';
        statusPasta.style.color = nome ? 'var(--trj-green, #2ecc71)' : 'var(--trj-muted)';
      });

      var btnConectar = U.h('button', { class: 'trj-btn trj-btn-primary clickable', text: '📁 Conectar pasta de Downloads', onclick: async function () {
        try { U.loading(true); var nome = await FS.pickFolder(); U.toast('Pasta conectada: ' + nome, 'ok'); var r = await FS.scanFolder(); await app.refresh(true); U.toast(r.total + ' tarefa(s) carregada(s).', 'ok'); app.navigate('#/importar'); app.render(); }
        catch (e) { if (e && e.name === 'AbortError') { /* cancelado */ } else U.toast(e.message || 'Erro ao conectar pasta.', 'err'); }
        finally { U.loading(false); }
      } });
      var btnVerificar = U.h('button', { class: 'trj-btn trj-btn-ghost clickable', html: app.icon('refresh') + ' Verificar agora', onclick: async function () {
        try { U.loading(true); var r = await FS.scanFolder(); await app.refresh(true); U.toast(r.total + ' tarefa(s) carregada(s).', 'ok'); app.render(); }
        catch (e) { U.toast(e.message || 'Erro ao ler a pasta.', 'err'); }
        finally { U.loading(false); }
      } });
      auto.appendChild(U.h('div', { class: 'flex gap-2 flex-wrap mt-1' }, [btnConectar, btnVerificar]));
    }
    grid.appendChild(auto);

    // ================= BLOCO 2: upload manual =================
    var manual = U.h('div', { class: 'trj-card p-5 flex flex-col gap-3' });
    manual.appendChild(U.h('h3', { class: 'text-base font-bold', html: '⬆ Upload manual' }));
    manual.appendChild(U.h('p', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: 'Funciona em qualquer navegador. Selecione um ou os dois arquivos (agendada e não-agendada).' }));
    var inp = U.h('input', { type: 'file', accept: '.xlsx,.xls', multiple: 'multiple', class: 'trj-input', style: { padding: '8px' } });
    var btnUp = U.h('button', { class: 'trj-btn trj-btn-primary mt-1 clickable', text: 'Carregar arquivos selecionados', onclick: async function () {
      if (!inp.files || !inp.files.length) { U.toast('Escolha ao menos um arquivo .xlsx.', 'err'); return; }
      try { U.loading(true); var r = await FS.readManualFiles(inp.files); await app.refresh(true); U.toast(r.total + ' tarefa(s) carregada(s).', 'ok'); inp.value = ''; app.render(); }
      catch (e) { U.toast(e.message || 'Erro ao ler os arquivos.', 'err'); }
      finally { U.loading(false); }
    } });
    manual.appendChild(inp);
    manual.appendChild(btnUp);
    grid.appendChild(manual);

    // ================= bloco de incidentes (Sites Fora) =================
    var incCard = U.h('div', { class: 'trj-card p-5 mb-5' });
    incCard.appendChild(U.h('h3', { class: 'text-base font-bold mb-1', text: 'Incidentes (Sites Fora) — painel G.E.N.E.S.I.S' }));
    incCard.appendChild(U.h('p', { class: 'text-xs mb-3', style: { color: 'var(--trj-muted)' }, text: 'Cole o conteúdo (texto/HTML) do painel G.E.N.E.S.I.S no campo abaixo OU anexe o arquivo exportado. Tudo fica salvo no seu navegador.' }));

    // --- (a) colar texto ---
    var txt = U.h('textarea', { class: 'trj-input w-full', rows: '6', placeholder: 'Cole aqui o conteúdo do painel G.E.N.E.S.I.S (Ctrl+V)...', style: { fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' } });
    var btnTxt = U.h('button', { class: 'trj-btn trj-btn-primary clickable', text: '⬆ Importar texto colado', onclick: async function () {
      var ok = await processarGenesis(txt.value, data, app, 'genesis-texto');
      if (ok) txt.value = '';
    } });
    var btnTxtLimpar = U.h('button', { class: 'trj-btn trj-btn-ghost clickable', text: 'Limpar campo', onclick: function () { txt.value = ''; } });
    incCard.appendChild(txt);
    incCard.appendChild(U.h('div', { class: 'flex gap-2 flex-wrap mt-2' }, [btnTxt, btnTxtLimpar]));

    // --- (b) anexar arquivo ---
    incCard.appendChild(U.h('div', { class: 'text-xs mt-4 mb-1', style: { color: 'var(--trj-muted)' }, text: 'Ou anexe o arquivo do painel:' }));
    var incInput = U.h('input', { type: 'file', accept: '.html,.htm,.xls,.xlsx', style: { display: 'none' }, onchange: function () { importarIncidentesArquivo(this, data, app); } });
    var incBtn = U.h('button', { class: 'trj-btn trj-btn-ghost clickable', text: '📎 Anexar arquivo G.E.N.E.S.I.S', onclick: function () { incInput.click(); } });
    incCard.appendChild(U.h('div', { class: 'flex gap-2 flex-wrap' }, [incInput, incBtn]));
    container.appendChild(incCard);

    // ================= bloco de ajuda + limpar =================
    container.appendChild(U.h('div', { class: 'trj-card p-5' }, [
      U.h('h3', { class: 'text-sm font-bold mb-2', text: 'Como funciona' }),
      U.h('div', { class: 'text-xs leading-relaxed', style: { color: 'var(--trj-muted)' }, html:
        'O sistema procura na sua pasta os arquivos cujo nome começa com <b>Atividades-TRJ_FMMT</b>:<br>' +
        '• <b>Atividades-TRJ_FMMT_&lt;DATA&gt;</b> — tarefas agendadas (usa a mais recente)<br>' +
        '• <b>Atividades-TRJ_FMMT_Não-agendada</b> — tarefas não agendadas<br><br>' +
        'Os <b>incidentes (Sites Fora)</b> podem ser importados colando o texto do painel <b>G.E.N.E.S.I.S</b> ou anexando o arquivo. Tudo fica salvo no seu navegador.' }),
      U.h('div', { class: 'flex gap-2 flex-wrap mt-4' }, [
        U.h('button', { class: 'trj-btn trj-btn-ghost clickable', text: 'Limpar tarefas', onclick: function () {
          if (!confirm('Remover todas as tarefas carregadas?')) return;
          FS.clearTasks(); app.refresh(true).then(function () { app.render(); }); U.toast('Tarefas removidas.', 'ok');
        } }),
        U.h('button', { class: 'trj-btn trj-btn-ghost clickable', text: 'Limpar incidentes', onclick: function () {
          if (!confirm('Remover todos os incidentes carregados?')) return;
          FS.clearIncidents(); app.refresh(true).then(function () { app.render(); }); U.toast('Incidentes removidos.', 'ok');
        } })
      ])
    ]));
  };
})(window.TRJ = window.TRJ || {});
