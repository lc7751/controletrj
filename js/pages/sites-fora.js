/* =====================================================================
 * Página: Sites Fora — Incidentes
 * ---------------------------------------------------------------------
 * Mostra a lista de incidentes importados do painel G.E.N.E.S.I.S
 * (via "Importar dados"), com busca livre, resumo por ANF, cruzamento
 * com TSK aberta na fila e sinalização de incidentes correlacionados.
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui;

  // estado persiste entre re-renders (closure do módulo)
  var state = { busca: '' };

  TRJ.pages.sitesFora = function (container, ctx) {
    var incidents = (ctx.data && ctx.data.incidentsEnriched) || [];
    var ativos = incidents.filter(function (i) { return (i.statusTrat || 'ATIVO').toUpperCase() !== 'RESOLVIDO'; });

    container.appendChild(U.pageHeader('Sites Fora — Incidentes',
      'Lista de incidentes importados do painel G.E.N.E.S.I.S. Para atualizar, use a aba "Importar dados".'));

    // ---------------- Resumo (total ativos + distribuição por ANF) ----------------
    if (ativos.length) {
      var porAnf = {};
      ativos.forEach(function (i) { var a = (i.anf || '').toString().trim() || 'N/D'; porAnf[a] = (porAnf[a] || 0) + 1; });
      var anfItens = Object.keys(porAnf)
        .sort(function (a, b) { return porAnf[b] - porAnf[a]; })
        .map(function (a) {
          return { nome: a === 'N/D' ? 'N/D' : 'ANF ' + a, valor: porAnf[a], pct: (Math.round(porAnf[a] / ativos.length * 1000) / 10) + '%' };
        });
      container.appendChild(U.h('div', { class: 'mb-5' }, U.resumoBar('Total Sites Fora', ativos.length, anfItens)));
    }

    // ---------------- Lista de incidentes (com busca) ----------------
    container.appendChild(buildListaIncidentes(incidents, (ctx.data && ctx.data.tasksEnriched) || []));
  };

  // ---------------- Lista de Incidentes (busca livre) ----------------
  function buildListaIncidentes(incidents, tasksEnriched) {
    var wrap = U.h('div', { class: 'trj-card p-5' });
    wrap.appendChild(U.h('h3', { class: 'text-base font-bold mb-1', text: '📋 Lista de Incidentes' }));
    wrap.appendChild(U.h('p', { class: 'text-xs mb-3', style: { color: 'var(--trj-muted)' }, text: 'Busque por site, end id, cidade, ANF, causa ou alarme. ⚡ = correlacionado a outro(s) incidente(s) (mesma ANF/horário próximo).' }));

    var listEl = U.h('div', { class: 'mt-3' });
    var search = U.searchInput('🔎 Buscar incidente...', function (q) { state.busca = q; renderLista(); }, { value: state.busca });
    wrap.appendChild(search);
    wrap.appendChild(listEl);

    function renderLista() {
      var q = (state.busca || '').toLowerCase().trim();
      var rows = !q ? incidents : incidents.filter(function (r) {
        var hay = [r.site, r.enderecoId, r.cidade, r.anf, r.causa, r.causaGrupo, r.obs, r.infra, r.gsbi].filter(Boolean).join(' ').toLowerCase();
        return hay.indexOf(q) >= 0;
      });
      listEl.innerHTML = '';
      if (!incidents.length) {
        listEl.appendChild(U.h('div', { class: 'text-sm py-10 text-center', style: { color: 'var(--trj-muted)' }, html: 'Nenhum incidente importado ainda.<br>Vá em <b>Importar dados</b> e use a busca automática (ou cole o painel G.E.N.E.S.I.S).' }));
        return;
      }
      if (!rows.length) {
        listEl.appendChild(U.h('div', { class: 'text-sm py-10 text-center', style: { color: 'var(--trj-muted)' }, text: 'Nenhum incidente encontrado para essa busca.' }));
        return;
      }
      listEl.appendChild(U.incidentTable(rows, tasksEnriched));
    }
    renderLista();
    return wrap;
  }
})(window.TRJ = window.TRJ || {});
