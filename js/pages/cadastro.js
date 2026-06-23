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
