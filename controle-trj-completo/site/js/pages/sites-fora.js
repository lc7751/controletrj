/* Página: Sites Fora (Incidentes) */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute, G = TRJ.genesis;
  var filtros = { status: 'TODAS', anf: 'TODAS', q: '' };

  TRJ.pages.sitesFora = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados.' })); return; }
    var d = Comp.incidentsPage(data.incidentsEnriched, filtros);

    // ---- header + upload ----
    var fileInput = U.h('input', { type: 'file', accept: '.html,.htm,.xls,.xlsx', style: { display: 'none' }, onchange: function () { onUpload(this, data, app); } });
    var btnUp = U.h('button', { class: 'trj-btn trj-btn-primary', text: '⬆ Importar painel G.E.N.E.S.I.S', onclick: function () { fileInput.click(); } });
    var btnRef = U.h('button', { class: 'trj-btn trj-btn-ghost', html: app.icon('refresh') + ' Atualizar', onclick: function () { app.refresh(); } });
    container.appendChild(U.pageHeader('Sites Fora — Incidentes', d.total + ' incidente(s) · ' + d.resumo.massivasCount + ' massiva(s)', U.h('div', { class: 'flex gap-2 flex-wrap' }, [fileInput, btnUp, btnRef])));

    // ---- resumo cards ----
    var cards = [
      { l: 'Ativos', v: d.resumo.ativos, cor: C.CORES_TRJ.red },
      { l: 'Em Tratamento', v: d.resumo.emTratamento, cor: C.CORES_TRJ.orange },
      { l: 'Resolvidos', v: d.resumo.resolvidos, cor: C.CORES_TRJ.green },
      { l: 'Furtos', v: d.resumo.furtos, cor: C.CORES_TRJ.orange2 },
      { l: 'Células Afetadas', v: d.resumo.celulas, cor: C.CORES_TRJ.blue }
    ];
    container.appendChild(U.h('div', { class: 'grid grid-cols-2 md:grid-cols-5 gap-3 mb-5' }, cards.map(function (k) { return U.kpiCard({ label: k.l, value: U.fmtNum(k.v), cor: k.cor }); })));

    // ---- massivas ----
    if (d.massivas.length) {
      container.appendChild(U.h('div', { class: 'trj-card p-4 mb-5' }, [
        U.h('h3', { class: 'text-sm font-bold mb-3', style: { color: C.CORES_TRJ.red }, text: '⚠ Massivas (≥ ' + d.limiarMassiva + ' sites no mesmo ANF)' }),
        U.h('div', { class: 'flex flex-col gap-2' }, d.massivas.map(function (m) {
          return U.h('div', { class: 'flex items-center justify-between', style: { borderBottom: '1px solid rgba(255,255,255,.05)', paddingBottom: '6px' } }, [
            U.h('span', { class: 'font-semibold', text: m.label }),
            U.h('span', { html: '<b style="color:' + C.CORES_TRJ.red + '">' + m.total + ' sites</b> <span style="color:var(--trj-muted);font-size:12px">— ' + m.cidades.slice(0, 4).map(function (c) { return U.esc(c.cidade) + ' (' + c.qtd + ')'; }).join(', ') + '</span>' })
          ]);
        }))
      ]));
    }

    // ---- filtros ----
    var selStatus = U.h('select', { class: 'trj-select', style: { width: 'auto' }, onchange: function () { filtros.status = this.value; app.render(); } },
      ['TODAS'].concat(C.STATUS_INCIDENTE).map(function (s) { return U.h('option', { value: s, text: s === 'TODAS' ? 'Todos status' : s, selected: filtros.status === s ? 'selected' : null }); }));
    var selAnf = U.h('select', { class: 'trj-select', style: { width: 'auto' }, onchange: function () { filtros.anf = this.value; app.render(); } },
      ['TODAS'].concat(C.ANF_LIST).map(function (a) { return U.h('option', { value: a, text: a === 'TODAS' ? 'Todos ANF' : 'ANF ' + a, selected: filtros.anf === a ? 'selected' : null }); }));
    var inpQ = U.h('input', { class: 'trj-input', style: { width: '220px' }, placeholder: 'Buscar site / cidade / causa...', value: filtros.q });
    inpQ.addEventListener('keydown', function (e) { if (e.key === 'Enter') { filtros.q = this.value; app.render(); } });
    container.appendChild(U.h('div', { class: 'flex gap-2 flex-wrap mb-3' }, [selStatus, selAnf, inpQ, U.h('button', { class: 'trj-btn trj-btn-ghost', text: 'Filtrar', onclick: function () { filtros.q = inpQ.value; app.render(); } })]));

    // ---- tabela ----
    var thead = U.h('thead', null, U.h('tr', null, ['Site', 'Cidade', 'ANF', 'Causa', 'GSBI', 'Início', 'Status', 'Ação'].map(function (t) { return U.h('th', { text: t }); })));
    var tbody = U.h('tbody', null, d.rows.slice(0, 600).map(function (r) {
      var sel = U.h('select', { class: 'trj-select', style: { width: 'auto', padding: '4px 8px', fontSize: '12px' }, onchange: function () { mudarStatus(r, this.value, app); } },
        C.STATUS_INCIDENTE.map(function (s) { return U.h('option', { value: s, text: s, selected: (r.statusTrat || 'ATIVO').toUpperCase() === s ? 'selected' : null }); }));
      return U.h('tr', null, [
        U.h('td', { html: U.esc(r.site || r.enderecoId || '—') + (r.emMassiva ? ' <span class="trj-badge" style="color:#e74c3c;background:rgba(231,76,60,.15)">M</span>' : '') }),
        U.h('td', { text: r.cidade || '—' }),
        U.h('td', { text: r.anf || '—' }),
        U.h('td', { text: r.causa || r.causaGrupo || '—' }),
        U.h('td', { text: r.gsbi || '—' }),
        U.h('td', { text: r.horarioDt ? TRJ.domain.formatarDataBR(r.horarioDt) : '—' }),
        U.h('td', null, U.tratBadge(r.statusTrat)),
        U.h('td', null, sel)
      ]);
    }));
    container.appendChild(U.h('div', { class: 'trj-card p-4' }, [
      U.h('div', { class: 'text-xs mb-2', style: { color: 'var(--trj-muted)' }, text: U.fmtNum(d.total) + ' registro(s)' + (d.total > 600 ? ' (exibindo 600)' : '') }),
      U.h('div', { style: { maxHeight: '60vh', overflow: 'auto' } }, U.h('table', { class: 'trj-table' }, [thead, tbody]))
    ]));
  };

  async function mudarStatus(row, status, app) {
    try {
      U.loading(true);
      await TRJ.api.setIncidentStatus([{ site: row.site, enderecoId: row.enderecoId, status: status }]);
      await app.reloadIncidents();
      U.toast('Status atualizado.', 'ok');
      app.render();
    } catch (e) { U.toast(e.message || 'Erro ao atualizar status.', 'err'); }
    finally { U.loading(false); }
  }

  function onUpload(input, data, app) {
    var file = input.files && input.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = async function () {
      try {
        U.loading(true);
        var html = reader.result;
        if (!G.ehGenesisHtml(html)) { U.toast('Arquivo não parece ser o painel G.E.N.E.S.I.S.', 'err'); return; }
        var genesisRows = G.parseGenesisHtml(html);
        if (!genesisRows.length) { U.toast('Nenhum incidente encontrado no arquivo.', 'err'); return; }
        // coleta ids -> lookup -> enriquece cidade
        var ids = genesisRows.map(function (r) { return (r.enderecoId || r.site || '').toString().toUpperCase(); }).filter(Boolean);
        var validMap = data.validMap || {};
        if (ids.length) { var lk = await TRJ.api.lookupCities(ids); validMap = Object.assign({}, validMap, lk.map || {}); }
        var incidentes = Comp.genesisToIncidents(genesisRows, validMap);
        await TRJ.api.saveIncidents(incidentes);
        await app.reloadIncidents();
        U.toast(incidentes.length + ' incidente(s) importado(s).', 'ok');
        app.render();
      } catch (e) { U.toast(e.message || 'Erro ao importar.', 'err'); }
      finally { U.loading(false); input.value = ''; }
    };
    reader.readAsText(file, 'UTF-8');
  }
})(window.TRJ = window.TRJ || {});
