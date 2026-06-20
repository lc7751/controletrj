/* =====================================================================
 * Página: Importar dados
 * ---------------------------------------------------------------------
 * Carrega as TAREFAS a partir dos arquivos "Atividades-TRJ_FMMT" da sua
 * pasta de Downloads. Dois caminhos: leitura automática (Chrome/Edge) ou
 * upload manual (qualquer navegador).
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, FS = TRJ.files;

  function fmtData(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleString('pt-BR');
    } catch (e) { return '—'; }
  }

  function listaArquivos(meta) {
    var arr = (meta && meta.arquivos) || [];
    if (!arr.length) return null;
    return U.h('ul', { class: 'text-xs mt-2', style: { color: 'var(--trj-muted)', listStyle: 'disc', paddingLeft: '18px' } },
      arr.map(function (a) { return U.h('li', { text: a.nome + ' — ' + U.fmtNum(a.qtd) + ' tarefa(s)' }); }));
  }

  TRJ.pages.importar = function (container, ctx) {
    var app = ctx.app;
    var meta = FS.getMeta();
    var tMeta = meta.tasks || {}, iMeta = meta.inc || {};
    var nTasks = FS.getTasks().length;
    var nInc = FS.getIncidents().length;

    container.appendChild(U.pageHeader('Importar dados',
      'Carregue as tarefas dos arquivos “Atividades-TRJ_FMMT” — da pasta de Downloads ou por upload manual.'));

    // ---- status atual ----
    var statusCards = U.h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-3 mb-5' }, [
      U.kpiCard({ label: 'Tarefas carregadas', value: U.fmtNum(nTasks), cor: C.CORES_TRJ.orange }),
      U.kpiCard({ label: 'Incidentes (Sites Fora)', value: U.fmtNum(nInc), cor: C.CORES_TRJ.blue }),
      U.kpiCard({ label: 'Origem das tarefas', value: tMeta.origem === 'pasta' ? 'Pasta' : (tMeta.origem === 'upload' ? 'Upload' : '—'), cor: C.CORES_TRJ.green }),
      U.kpiCard({ label: 'Atualizado em', value: tMeta.em ? new Date(tMeta.em).toLocaleDateString('pt-BR') : '—', sub: tMeta.em ? new Date(tMeta.em).toLocaleTimeString('pt-BR') : null, cor: C.CORES_TRJ.purple || '#8b5cf6' })
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

      var btnConectar = U.h('button', { class: 'trj-btn trj-btn-primary', text: '📁 Conectar pasta de Downloads', onclick: async function () {
        try { U.loading(true); var nome = await FS.pickFolder(); U.toast('Pasta conectada: ' + nome, 'ok'); var r = await FS.scanFolder(); await app.refresh(); U.toast(r.total + ' tarefa(s) carregada(s).', 'ok'); app.navigate('#/importar'); app.render(); }
        catch (e) { if (e && e.name === 'AbortError') { /* cancelado */ } else U.toast(e.message || 'Erro ao conectar pasta.', 'err'); }
        finally { U.loading(false); }
      } });
      var btnVerificar = U.h('button', { class: 'trj-btn trj-btn-ghost', html: app.icon('refresh') + ' Verificar agora', onclick: async function () {
        try { U.loading(true); var r = await FS.scanFolder(); await app.refresh(); U.toast(r.total + ' tarefa(s) carregada(s).', 'ok'); app.render(); }
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
    var btnUp = U.h('button', { class: 'trj-btn trj-btn-primary mt-1', text: 'Carregar arquivos selecionados', onclick: async function () {
      if (!inp.files || !inp.files.length) { U.toast('Escolha ao menos um arquivo .xlsx.', 'err'); return; }
      try { U.loading(true); var r = await FS.readManualFiles(inp.files); await app.refresh(); U.toast(r.total + ' tarefa(s) carregada(s).', 'ok'); inp.value = ''; app.render(); }
      catch (e) { U.toast(e.message || 'Erro ao ler os arquivos.', 'err'); }
      finally { U.loading(false); }
    } });
    manual.appendChild(inp);
    manual.appendChild(btnUp);
    grid.appendChild(manual);

    // ================= bloco de ajuda + limpar =================
    container.appendChild(U.h('div', { class: 'trj-card p-5' }, [
      U.h('h3', { class: 'text-sm font-bold mb-2', text: 'Como funciona' }),
      U.h('div', { class: 'text-xs leading-relaxed', style: { color: 'var(--trj-muted)' }, html:
        'O sistema procura na sua pasta os arquivos cujo nome começa com <b>Atividades-TRJ_FMMT</b>:<br>' +
        '• <b>Atividades-TRJ_FMMT_&lt;DATA&gt;</b> — tarefas agendadas (usa a mais recente)<br>' +
        '• <b>Atividades-TRJ_FMMT_Não-agendada</b> — tarefas não agendadas<br><br>' +
        'Os <b>incidentes (Sites Fora)</b> são importados na própria página “Sites Fora”, colando/anexando o painel <b>G.E.N.E.S.I.S</b>. Tudo fica salvo no seu navegador.' }),
      U.h('div', { class: 'flex gap-2 flex-wrap mt-4' }, [
        U.h('button', { class: 'trj-btn trj-btn-ghost', text: 'Limpar tarefas', onclick: function () {
          if (!confirm('Remover todas as tarefas carregadas?')) return;
          FS.clearTasks(); app.refresh().then(function () { app.render(); }); U.toast('Tarefas removidas.', 'ok');
        } }),
        U.h('button', { class: 'trj-btn trj-btn-ghost', text: 'Limpar incidentes', onclick: function () {
          if (!confirm('Remover todos os incidentes carregados?')) return;
          FS.clearIncidents(); app.refresh().then(function () { app.render(); }); U.toast('Incidentes removidos.', 'ok');
        } })
      ])
    ]));
  };
})(window.TRJ = window.TRJ || {});
