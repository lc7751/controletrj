/* =====================================================================
 * Página: Sites Fora — Incidentes
 * ---------------------------------------------------------------------
 * Mostra a lista de incidentes importados do painel G.E.N.E.S.I.S
 * (via "Importar dados"), com busca livre, resumo por ANF, cruzamento
 * com TSK aberta na fila e sinalização de incidentes correlacionados.
 *
 * O modo "Agrupado" (uma linha por END_ID) é só uma forma de EXIBIR a
 * lista — as contagens (resumo, dashboard etc.) sempre usam o total real,
 * como se não estivesse agrupado.
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, Comp = TRJ.compute;

  var LS_AGRUPADO = 'trj_sf_agrupado';
  function getAgrupado() { try { return localStorage.getItem(LS_AGRUPADO) === '1'; } catch (e) { return false; } }
  function setAgrupado(v) { try { localStorage.setItem(LS_AGRUPADO, v ? '1' : '0'); } catch (e) {} }

  // estado persiste entre re-renders (closure do módulo)
  var state = { busca: '', agrupado: getAgrupado(), causaFiltro: '', filtroSemAtualizacao: false };

  TRJ.pages.sitesFora = function (container, ctx) {
    var incidents = (ctx.data && ctx.data.incidentsEnriched) || [];
    var ativos = incidents.filter(function (i) { return (i.statusTrat || 'ATIVO').toUpperCase() !== 'RESOLVIDO'; });

    // cabeçalho bem sutil/compacto — o que importa aqui é a lista
    container.appendChild(U.pageHeader('Sites Fora', null, null, { compact: true }));

    // ---------------- Resumo (total ativos + distribuição por ANF) — SEMPRE com o total real ----------------
    if (ativos.length) {
      var porAnf = {};
      ativos.forEach(function (i) { var a = (i.anf || '').toString().trim() || 'N/D'; porAnf[a] = (porAnf[a] || 0) + 1; });
      var anfItens = Object.keys(porAnf)
        .sort(function (a, b) { return porAnf[b] - porAnf[a]; })
        .map(function (a) {
          return { nome: a === 'N/D' ? 'N/D' : 'ANF ' + a, valor: porAnf[a], pct: (Math.round(porAnf[a] / ativos.length * 1000) / 10) + '%' };
        });
      container.appendChild(U.h('div', { class: 'mb-4' }, U.resumoBar('Total Sites Fora', ativos.length, anfItens)));
    }

    // ---------------- Lista de incidentes (com busca + agrupamento de exibição) ----------------
    container.appendChild(buildListaIncidentes(incidents, (ctx.data && ctx.data.tasksEnriched) || []));
  };

  // ---------------- Lista de Incidentes (busca livre + agrupamento de exibição) ----------------
  function buildListaIncidentes(incidents, tasksEnriched) {
    var wrap = U.h('div', { class: 'trj-card p-5' });

    var currentRows = [];
    var btnCopy = U.h('button', {
      class: 'trj-btn trj-btn-ghost', title: 'Copiar lista filtrada em texto (formato WhatsApp)',
      style: { padding: '3px 9px', fontSize: '12px' }, text: '📋',
      onclick: function() { U.copyText(U.incidentTableCopyText(currentRows, 'Sites Fora', tasksEnriched), 'Lista copiada!'); }
    });
    var headRow = U.h('div', { class: 'flex items-center justify-between flex-wrap gap-3 mb-1' }, [
      U.h('h3', { class: 'text-base font-bold', text: '📋 Lista de Incidentes' }),
      U.h('div', { class: 'flex items-center gap-3' }, [
        btnCopy,
        U.switch(state.agrupado, 'Agrupar por END_ID (junta sites com a mesma queda)', function (checked) {
          state.agrupado = checked; setAgrupado(checked); renderLista();
        })
      ])
    ]);
    wrap.appendChild(headRow);
    wrap.appendChild(U.h('p', { class: 'text-xs mb-3', style: { color: 'var(--trj-muted)' }, text: 'Busque por site, end id, cidade, ANF, causa ou alarme. ⚡ = correlacionado a outro(s) incidente(s) (mesma ANF/horário próximo).' }));

    // ---- filtros: causa + atualização ----
    var causaCount = {};
    incidents.forEach(function(i) {
      var c = (i.causa || '').trim();
      causaCount[c || '__SEM__'] = (causaCount[c || '__SEM__'] || 0) + 1;
    });
    var causaKeys = Object.keys(causaCount)
      .filter(function(k) { return k !== '__SEM__'; })
      .sort(function(a, b) { return causaCount[b] - causaCount[a]; });

    var filtrosEl = U.h('div', { class: 'flex flex-wrap gap-2 mb-3 mt-2' });

    function chipStyle(active, danger) {
      return {
        fontSize: '11px', padding: '3px 10px', borderRadius: '20px', cursor: 'pointer',
        background: active ? (danger ? 'rgba(231,76,60,.25)' : 'rgba(255,140,0,.25)') : 'rgba(255,255,255,.06)',
        color: active ? (danger ? '#e74c3c' : 'var(--trj-primary)') : 'var(--trj-muted)',
        border: '1px solid ' + (active ? (danger ? '#e74c3c' : 'var(--trj-primary)') : 'rgba(255,255,255,.12)'),
        fontWeight: active ? '700' : '400'
      };
    }

    function renderFiltros() {
      filtrosEl.innerHTML = '';

      var allActive = !state.causaFiltro;
      var allChip = U.h('button', { class: 'trj-btn trj-btn-ghost', style: chipStyle(allActive, false), text: 'Todos' });
      allChip.addEventListener('click', function() { state.causaFiltro = ''; renderFiltros(); renderLista(); });
      filtrosEl.appendChild(allChip);

      causaKeys.forEach(function(k) {
        var active = state.causaFiltro === k;
        var chip = U.h('button', { class: 'trj-btn trj-btn-ghost', style: chipStyle(active, false), text: k + ' (' + causaCount[k] + ')' });
        chip.addEventListener('click', function() { state.causaFiltro = active ? '' : k; renderFiltros(); renderLista(); });
        filtrosEl.appendChild(chip);
      });

      if (causaCount['__SEM__']) {
        var semActive = state.causaFiltro === '__SEM__';
        var semChip = U.h('button', { class: 'trj-btn trj-btn-ghost', style: chipStyle(semActive, true), text: 'SEM CAUSA (' + causaCount['__SEM__'] + ')' });
        semChip.addEventListener('click', function() { state.causaFiltro = semActive ? '' : '__SEM__'; renderFiltros(); renderLista(); });
        filtrosEl.appendChild(semChip);
      }

      var semAt = state.filtroSemAtualizacao;
      var semAtBtn = U.h('button', { class: 'trj-btn trj-btn-ghost', style: chipStyle(semAt, true), text: '⚠️ > 1h sem atualização' });
      semAtBtn.addEventListener('click', function() { state.filtroSemAtualizacao = !semAt; renderFiltros(); renderLista(); });
      filtrosEl.appendChild(semAtBtn);
    }
    renderFiltros();
    wrap.appendChild(filtrosEl);

    var listEl = U.h('div', { class: 'mt-3' });
    var search = U.searchInput('🔎 Buscar incidente...', function (q) { state.busca = q; renderLista(); }, { value: state.busca });
    wrap.appendChild(search);
    wrap.appendChild(listEl);

    function renderLista() {
      var base = state.agrupado ? Comp.agruparIncidentesPorEndId(incidents) : incidents;

      if (state.causaFiltro) {
        var cf = state.causaFiltro;
        base = base.filter(function(r) {
          var c = (r.causa || '').trim();
          return cf === '__SEM__' ? !c : c === cf;
        });
      }

      if (state.filtroSemAtualizacao) {
        var agora = Date.now();
        base = base.filter(function(r) {
          if ((r.statusTrat || '').toUpperCase() === 'RESOLVIDO') return false;
          if (!r.ultimaAtGenesis) return true;
          return (agora - new Date(r.ultimaAtGenesis).getTime()) > 3600000;
        });
      }

      var q = (state.busca || '').toLowerCase().trim();
      var rows = !q ? base : base.filter(function (r) {
        try {
          var tskMatch = U.tskAberta ? U.tskAberta(r, tasksEnriched) : null;
          var tskTxt = tskMatch ? ((tskMatch.osNumero || '') + ' ' + (tskMatch.status || '')) : 'SEM TSK';
          var hay = [r.site, r.enderecoId, r.cidade, r.anf, r.causa, r.causaGrupo, r.obs, r.infra, r.gsbi, r.detalhe, tskTxt]
            .filter(Boolean).join(' ').toLowerCase();
          return hay.indexOf(q) >= 0;
        } catch (e) {
          var hay2 = [r.site, r.enderecoId, r.cidade, r.anf, r.causa, r.causaGrupo].filter(Boolean).join(' ').toLowerCase();
          return hay2.indexOf(q) >= 0;
        }
      });
      currentRows = rows;
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
