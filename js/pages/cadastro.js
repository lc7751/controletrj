/* =====================================================================
 * Página: Cadastro de Cidades / Sites
 * ---------------------------------------------------------------------
 * Formulário para cadastrar manualmente um site informando BAIRRO,
 * END_ID, SITE e o RESPONSÁVEL pela região. Os registros são salvos via
 * TRJ.api.saveSite (backend quando há URL; senão, localStorage offline).
 * Abaixo do formulário, lista os sites já cadastrados neste navegador.
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui;

  var RESPONSAVEIS = [
    { label: 'Zona Oeste — Alan', value: 'ALAN' },
    { label: 'Zona Sul / Niterói — Matheus', value: 'MATHEUS' },
    { label: 'Zona Norte — Jack', value: 'JACKELINE' },
    { label: 'ANG/CBF/NFB/PET/VRD — Jesse', value: 'JESSE' },
    { label: 'Baixada — Vinicius', value: 'VINICIUS' },
    { label: 'Campos — Merielem', value: 'MERIELEM' },
    { label: 'ES — Merielem', value: 'MERIELEM' }
  ];

  var LS_SITES = 'trj_sites';

  function lerSites() {
    try { return JSON.parse(localStorage.getItem(LS_SITES) || '[]') || []; }
    catch (e) { return []; }
  }

  // ---- Varredura de sites sem cadastro (regiao = OTHERS) ----
  // Reúne tarefas e incidentes ativos que caíram em "OTHERS" por falta de
  // cadastro no VALID_CAD, deduplicando por END_ID, pra cadastrar em lote.
  // Importante: considera só TSKs (tickets corretiva) — atividades manuais
  // (Preventiva/Conjunta/WO) não entram, pois não fazem parte do cadastro.
  function coletarSemCadastro(data) {
    var vistos = {}, lista = [];
    function add(endId, site, cidade, origem) {
      var key = (endId || '').toString().trim().toUpperCase();
      if (!key || vistos[key]) return;
      vistos[key] = true;
      lista.push({ end_id: key, site: (site || '').toString().trim(), cidade: (cidade || '').toString().trim(), origem: origem });
    }
    ((data && data.tasksEnriched) || []).forEach(function (t) {
      if ((t.regiao || 'OTHERS') !== 'OTHERS') return;
      if (!TRJ.domain.isTicketCorretiva(t.tipoAtividade)) return; // só TSK — sem atividades manuais
      add(t.enderecoId, t.siteId, t.cidade, 'Tarefa');
    });
    ((data && data.incidentsEnriched) || []).forEach(function (i) {
      if ((i.regiao || 'OTHERS') !== 'OTHERS') return;
      if ((i.statusTrat || '').toUpperCase() === 'RESOLVIDO') return;
      add(i.enderecoId, i.site, i.cidade || i.cidadeUf, 'Incidente');
    });
    return lista.sort(function (a, b) { return a.end_id.localeCompare(b.end_id); });
  }

  // ---- Card: varredura + cadastro em lote ----
  function buildScanCard(ctx) {
    var data = ctx.data, app = ctx.app;
    var card = U.h('div', { class: 'trj-card p-5 mb-5' });
    card.appendChild(U.h('h3', { class: 'text-base font-bold mb-1', text: '🔍 Sites sem cadastro (classificados como "Outros")' }));
    card.appendChild(U.h('p', { class: 'text-xs mb-3', style: { color: 'var(--trj-muted)' }, text: 'Busca tarefas e incidentes ativos sem região cadastrada no VALID_CAD. Marque os que pertencem a uma região, escolha o responsável e cadastre todos de uma vez — sem copiar END_ID um por um.' }));

    var resultWrap = U.h('div', { class: 'mt-3' });
    var selResp = U.h('select', { class: 'trj-select', style: { width: 'auto', minWidth: '240px' } },
      RESPONSAVEIS.map(function (r) { return U.h('option', { value: r.value, text: r.label }); }));
    var btnBuscar = U.h('button', {
      class: 'trj-btn trj-btn-primary clickable', html: '🔍 Buscar sites sem cadastro',
      onclick: function () { renderResultado(); }
    });
    var statusTxt = U.h('span', { class: 'text-xs', style: { color: 'var(--trj-muted)' } });
    card.appendChild(U.h('div', { class: 'flex items-center gap-2 flex-wrap' }, [btnBuscar, statusTxt]));
    card.appendChild(resultWrap);

    var checkboxes = []; // { item, cb }

    function renderResultado() {
      var lista = coletarSemCadastro(data);
      resultWrap.innerHTML = '';
      checkboxes = [];
      if (!lista.length) {
        statusTxt.textContent = '';
        resultWrap.appendChild(U.h('div', { class: 'text-sm py-6 text-center', style: { color: 'var(--trj-green)' }, text: '✓ Nenhum site sem cadastro encontrado — tudo classificado!' }));
        return;
      }
      statusTxt.textContent = lista.length + ' site(s) sem cadastro encontrado(s)';

      var toolbar = U.h('div', { class: 'flex items-center gap-2 flex-wrap mt-3 mb-2' }, [
        U.h('button', { class: 'trj-btn trj-btn-ghost clickable', style: { fontSize: '12px' }, text: 'Marcar todos', onclick: function () { checkboxes.forEach(function (c) { c.cb.checked = true; }); atualizarContagem(); } }),
        U.h('button', { class: 'trj-btn trj-btn-ghost clickable', style: { fontSize: '12px' }, text: 'Desmarcar todos', onclick: function () { checkboxes.forEach(function (c) { c.cb.checked = false; }); atualizarContagem(); } }),
        U.h('span', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: 'Responsável/região destino:' }),
        selResp
      ]);
      resultWrap.appendChild(toolbar);

      var thStyle = { textAlign: 'left', padding: '7px 9px', fontSize: '11px', color: 'var(--trj-muted)', borderBottom: '1px solid var(--trj-border)', textTransform: 'uppercase' };
      var tdStyle = { padding: '7px 9px', fontSize: '13px', borderBottom: '1px solid rgba(255,255,255,.05)' };
      var head = U.h('tr', null, ['', 'END_ID', 'Site', 'Cidade', 'Origem'].map(function (t) { return U.h('th', { style: thStyle, text: t }); }));
      var body = lista.map(function (item) {
        var cb = U.h('input', { type: 'checkbox' });
        checkboxes.push({ item: item, cb: cb });
        cb.addEventListener('change', atualizarContagem);
        return U.h('tr', null, [
          U.h('td', { style: tdStyle }, cb),
          U.h('td', { style: Object.assign({ fontFamily: 'ui-monospace, monospace' }, tdStyle), text: item.end_id }),
          U.h('td', { style: tdStyle, text: item.site || '—' }),
          U.h('td', { style: tdStyle, text: item.cidade || '—' }),
          U.h('td', { style: tdStyle, text: item.origem })
        ]);
      });
      resultWrap.appendChild(U.h('div', { style: { maxHeight: '360px', overflow: 'auto' } }, [
        U.h('table', { style: { width: '100%', borderCollapse: 'collapse' } }, [U.h('thead', null, [head]), U.h('tbody', null, body)])
      ]));

      var btnCadastrar = U.h('button', { class: 'trj-btn trj-btn-primary clickable', text: 'Cadastrar selecionados (0)', style: { marginTop: '12px' }, disabled: true,
        onclick: async function () {
          var selecionados = checkboxes.filter(function (c) { return c.cb.checked; }).map(function (c) { return c.item; });
          if (!selecionados.length) return;
          btnCadastrar.disabled = true;
          var ok = 0, falhas = 0;
          for (var i = 0; i < selecionados.length; i++) {
            var it = selecionados[i];
            try {
              await TRJ.api.saveSite({ bairro: it.cidade || '', end_id: it.end_id, site: it.site || '', responsavel: selResp.value });
              ok++;
            } catch (e) { falhas++; }
          }
          U.toast(ok + ' site(s) cadastrado(s)' + (falhas ? ' · ' + falhas + ' falha(s)' : '') + '.', falhas ? 'err' : 'ok');
          if (app && app.refresh) await app.refresh(true); // já re-renderiza a página
        } });
      resultWrap.appendChild(btnCadastrar);

      function atualizarContagem() {
        var n = checkboxes.filter(function (c) { return c.cb.checked; }).length;
        btnCadastrar.textContent = 'Cadastrar selecionados (' + n + ')';
        btnCadastrar.disabled = n === 0;
      }
    }

    return card;
  }

  function labelResp(value) {
    for (var i = 0; i < RESPONSAVEIS.length; i++) {
      if (RESPONSAVEIS[i].value === value) return RESPONSAVEIS[i].label;
    }
    return value || '—';
  }

  // bloco label + campo
  function campo(labelTxt, inputEl, full) {
    return U.h('div', { class: full ? 'col-span-2' : '' }, [
      U.h('label', { class: 'text-xs font-bold block mb-1', style: { color: 'var(--trj-muted)' }, text: labelTxt }),
      inputEl
    ]);
  }

  TRJ.pages.cadastro = function (container, ctx) {
    container.appendChild(U.pageHeader('Cadastro de Cidades',
      'Cadastre manualmente os sites com bairro, END_ID e o responsável pela região.'));

    container.appendChild(buildScanCard(ctx));

    // ---- inputs ----
    var inBairro = U.h('input', { id: 'cad-bairro', class: 'trj-input w-full', placeholder: 'Ex.: Centro' });
    var inEndId  = U.h('input', { id: 'cad-endid', class: 'trj-input w-full', placeholder: 'Ex.: RJCEN_001' });
    var inSite   = U.h('input', { id: 'cad-site', class: 'trj-input w-full', placeholder: 'Nome / identificação do site' });
    var selResp  = U.h('select', { id: 'cad-resp', class: 'trj-select w-full' },
      RESPONSAVEIS.map(function (r) { return U.h('option', { value: r.value, text: r.label }); }));

    var msg = U.h('div', { class: 'text-sm mt-1', style: { color: 'var(--trj-muted)', minHeight: '20px' } });

    function renderLista() {
      var sites = lerSites();
      listaWrap.innerHTML = '';
      listaWrap.appendChild(U.h('div', { class: 'flex items-center justify-between mb-3' }, [
        U.h('h3', { class: 'text-base font-bold', text: 'Sites cadastrados' }),
        U.h('span', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: sites.length + ' registro(s)' })
      ]));
      if (!sites.length) {
        listaWrap.appendChild(U.h('div', { class: 'text-sm py-6 text-center', style: { color: 'var(--trj-muted)' }, text: 'Nenhum site cadastrado ainda.' }));
        return;
      }
      var thStyle = { textAlign: 'left', padding: '8px 10px', fontSize: '12px', color: 'var(--trj-muted)', borderBottom: '1px solid var(--trj-border)' };
      var head = U.h('tr', null, ['BAIRRO', 'END_ID', 'SITE', 'RESPONSÁVEL', ''].map(function (t) { return U.h('th', { style: thStyle, text: t }); }));
      var body = sites.map(function (s, idx) {
        var tdStyle = { padding: '8px 10px', fontSize: '13px', borderBottom: '1px solid var(--trj-border)' };
        var btnDel = U.h('button', { class: 'trj-btn trj-btn-ghost clickable', style: { padding: '2px 10px', fontSize: '12px' }, text: 'Remover', onclick: function () {
          var arr = lerSites(); arr.splice(idx, 1);
          try { localStorage.setItem(LS_SITES, JSON.stringify(arr)); } catch (e) {}
          renderLista();
          U.toast('Site removido.', 'ok');
        } });
        return U.h('tr', null, [
          U.h('td', { style: tdStyle, text: s.bairro || '—' }),
          U.h('td', { style: tdStyle, text: s.end_id || '—' }),
          U.h('td', { style: tdStyle, text: s.site || '—' }),
          U.h('td', { style: tdStyle, text: labelResp(s.responsavel) }),
          U.h('td', { style: Object.assign({ textAlign: 'right' }, tdStyle) }, [btnDel])
        ]);
      });
      var table = U.h('div', { style: { overflowX: 'auto' } }, [
        U.h('table', { style: { width: '100%', borderCollapse: 'collapse' } }, [
          U.h('thead', null, [head]),
          U.h('tbody', null, body)
        ])
      ]);
      listaWrap.appendChild(table);
    }

    function limpar() {
      inBairro.value = ''; inEndId.value = ''; inSite.value = '';
      selResp.selectedIndex = 0; msg.textContent = '';
    }

    var btnSalvar = U.h('button', { class: 'trj-btn trj-btn-primary clickable', text: 'Salvar', onclick: function () {
      var row = {
        bairro: (inBairro.value || '').trim(),
        end_id: (inEndId.value || '').trim(),
        site: (inSite.value || '').trim(),
        responsavel: selResp.value
      };
      if (!row.end_id && !row.site && !row.bairro) {
        msg.textContent = 'Preencha ao menos o BAIRRO, o END_ID ou o SITE.';
        msg.style.color = 'var(--trj-red, #e74c3c)';
        return;
      }
      btnSalvar.disabled = true;
      Promise.resolve(TRJ.api.saveSite(row)).then(function (res) {
        // em modo backend o saveSite não grava localmente; garantimos a lista local também
        if (res && res.offline !== true && !TRJ.api.isOffline()) {
          try { var arr = lerSites(); arr.push(row); localStorage.setItem(LS_SITES, JSON.stringify(arr)); } catch (e) {}
        }
        msg.textContent = 'Site salvo com sucesso.';
        msg.style.color = 'var(--trj-green, #2ecc71)';
        U.toast('Site cadastrado.', 'ok');
        limpar();
        renderLista();
      }).catch(function (e) {
        msg.textContent = e && e.message ? e.message : 'Erro ao salvar o site.';
        msg.style.color = 'var(--trj-red, #e74c3c)';
        U.toast('Erro ao salvar o site.', 'err');
      }).then(function () { btnSalvar.disabled = false; });
    } });

    var btnLimpar = U.h('button', { class: 'trj-btn trj-btn-ghost clickable', text: 'Limpar', onclick: limpar });

    var form = U.h('div', { class: 'trj-card p-5 mb-5' }, [
      U.h('h3', { class: 'text-base font-bold mb-3', text: 'Cadastro de Sites' }),
      U.h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, [
        campo('BAIRRO', inBairro),
        campo('END_ID', inEndId),
        campo('SITE', inSite, true),
        campo('RESPONSÁVEL', selResp)
      ]),
      U.h('div', { class: 'flex gap-2 flex-wrap mt-4' }, [btnSalvar, btnLimpar]),
      msg
    ]);
    container.appendChild(form);

    var listaWrap = U.h('div', { class: 'trj-card p-5' });
    container.appendChild(listaWrap);
    renderLista();
  };
})(window.TRJ = window.TRJ || {});
