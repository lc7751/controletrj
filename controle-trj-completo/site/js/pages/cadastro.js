/* Página: Cadastro de Cidades (base VALID_CAD) */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui;
  var st = { page: 1, pageSize: 50, q: '', area: '' };
  var meta = null;

  TRJ.pages.cadastro = function (container, ctx) {
    var app = ctx.app;
    container.appendChild(U.pageHeader('Cadastro de Cidades', 'Base de endereços / cidades (VALID_CAD)'));
    var info = U.h('div', { class: 'text-sm mb-3', style: { color: 'var(--trj-muted)' }, text: 'Carregando...' });
    var tableHost = U.h('div', { class: 'trj-card p-4' });
    var pager = U.h('div', { class: 'flex items-center justify-between mt-3' });

    var inpQ = U.h('input', { class: 'trj-input', style: { width: '240px' }, placeholder: 'Buscar bairro / endereço / cidade...', value: st.q });
    inpQ.addEventListener('keydown', function (e) { if (e.key === 'Enter') { st.q = this.value; st.page = 1; load(); } });
    var selArea = U.h('select', { class: 'trj-select', style: { width: 'auto' } });
    selArea.addEventListener('change', function () { st.area = this.value; st.page = 1; load(); });
    var btn = U.h('button', { class: 'trj-btn trj-btn-ghost', text: 'Buscar', onclick: function () { st.q = inpQ.value; st.page = 1; load(); } });
    container.appendChild(U.h('div', { class: 'flex gap-2 flex-wrap mb-3' }, [inpQ, selArea, btn]));
    container.appendChild(info);
    container.appendChild(tableHost);
    container.appendChild(pager);

    async function loadMeta() {
      try { var m = await TRJ.api.getCitiesMeta(); meta = m; selArea.innerHTML = '';
        selArea.appendChild(U.h('option', { value: '', text: 'Todas as áreas' }));
        (m.areas || []).forEach(function (a) { selArea.appendChild(U.h('option', { value: a, text: a, selected: st.area === a ? 'selected' : null })); });
      } catch (e) {}
    }
    async function load() {
      U.loading(true);
      try {
        var res = await TRJ.api.getCities({ page: st.page, pageSize: st.pageSize, q: st.q, area: st.area });
        renderTable(res); 
      } catch (e) { info.textContent = e.message || 'Erro ao carregar.'; }
      finally { U.loading(false); }
    }
    function renderTable(res) {
      info.textContent = U.fmtNum(res.total) + ' registro(s) · página ' + res.page + '/' + res.totalPages;
      var cols = ['bairro', 'enderecoId', 'site', 'cm', 'novaArea', 'coordenador', 'cidade'];
      var labels = ['Bairro', 'Endereço ID', 'Site', 'CM', 'Nova Área', 'Coordenador', 'Cidade'];
      var thead = U.h('thead', null, U.h('tr', null, labels.map(function (t) { return U.h('th', { text: t }); })));
      var tbody = U.h('tbody', null, (res.rows || []).map(function (r) {
        return U.h('tr', null, cols.map(function (c) { return U.h('td', { text: r[c] || '—' }); }));
      }));
      tableHost.innerHTML = '';
      tableHost.appendChild(U.h('div', { style: { maxHeight: '60vh', overflow: 'auto' } }, U.h('table', { class: 'trj-table' }, [thead, tbody])));
      pager.innerHTML = '';
      pager.appendChild(U.h('button', { class: 'trj-btn trj-btn-ghost', text: '← Anterior', onclick: function () { if (st.page > 1) { st.page--; load(); } } }));
      pager.appendChild(U.h('span', { class: 'text-sm', style: { color: 'var(--trj-muted)' }, text: 'Página ' + res.page + ' de ' + res.totalPages }));
      pager.appendChild(U.h('button', { class: 'trj-btn trj-btn-ghost', text: 'Próxima →', onclick: function () { if (st.page < res.totalPages) { st.page++; load(); } } }));
    }

    loadMeta();
    load();
  };
})(window.TRJ = window.TRJ || {});
