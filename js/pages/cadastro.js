// cadastro.js - formulário de cadastro de sites (modificado)
(function (TRJ) {
  TRJ = TRJ || {};
  var U = TRJ.ui || {};

  var responsables = [
    { label: 'Zona Oeste - Alan', value: 'ALAN' },
    { label: 'Zona Sul / Niteroi - Matheus', value: 'MATHEUS' },
    { label: 'Zona Norte - Jack', value: 'JACKELINE' },
    { label: 'ANG/CBF/NFB/PET/VRD - Jesse', value: 'JESSE' },
    { label: 'Baixada - Vinicius', value: 'VINICIUS' },
    { label: 'Campos - Merielem', value: 'MERIELEM' },
    { label: 'ES - Merielem', value: 'MERIELEM_ES' }
  ];

  // helper: cria elemento via TRJ.ui.h quando disponível, senão cria DOM manualmente
  function h(tag, props, children) {
    if (U && typeof U.h === 'function') return U.h(tag, props, children);
    var el = document.createElement(tag);
    props = props || {};
    if (props.class) el.className = props.class;
    if (props.id) el.id = props.id;
    if (props.type) el.type = props.type;
    if (props.placeholder) el.placeholder = props.placeholder;
    if (props.text) el.textContent = props.text;
    if (props.html) el.innerHTML = props.html;
    if (props.value != null) el.value = props.value;
    if (props.onclick && typeof props.onclick === 'function') el.addEventListener('click', props.onclick);
    if (props.attrs) {
      Object.keys(props.attrs).forEach(function(k){ el.setAttribute(k, props.attrs[k]); });
    }
    (children || []).forEach(function (c) {
      if (typeof c === 'string') el.appendChild(document.createTextNode(c));
      else if (c) el.appendChild(c);
    });
    return el;
  }

  // constrói o formulário dentro do elemento root (DOM element)
  function buildForm(root) {
    if (!root) return;
    // limpar conteúdo anterior
    root.innerHTML = '';

    var title = h('h3', { text: 'Cadastro de Sites' });
    var card = h('div', { class: 'trj-card p-4' }, [
      title
    ]);

    // campos
    var grid = h('div', { class: 'grid grid-cols-2 gap-3 mt-3' });
    // BAIRRO
    var divBairro = h('div', {}, [
      h('label', { text: 'BAIRRO:' }),
      h('input', { id: 'cad-bairro', class: 'trj-input', placeholder: 'Ex: Centro' })
    ]);
    // END_ID
    var divEnd = h('div', {}, [
      h('label', { text: 'END_ID:' }),
      h('input', { id: 'cad-endid', class: 'trj-input', placeholder: 'Ex: 12345' })
    ]);
    // SITE (col-span-2)
    var divSite = h('div', { class: 'col-span-2' }, [
      h('label', { text: 'SITE:' }),
      h('input', { id: 'cad-site', class: 'trj-input', placeholder: 'Nome do site (obrigatório)' })
    ]);
    // RESPONSÁVEL
    var selDiv = h('div', {}, [
      h('label', { text: 'RESPONSÁVEL:' }),
      h('select', { id: 'cad-resp', class: 'trj-select' })
    ]);

    grid.appendChild(divBairro);
    grid.appendChild(divEnd);
    grid.appendChild(divSite);
    grid.appendChild(selDiv);

    // preencher options
    var sel = selDiv.querySelector('#cad-resp') || selDiv.querySelector('select');
    responsables.forEach(function (r) {
      var opt = document.createElement('option');
      opt.value = r.value;
      opt.text = r.label;
      sel.appendChild(opt);
    });

    // botões
    var btnSalvar = h('button', { id: 'cad-salvar', class: 'trj-btn trj-btn-primary clickable', text: 'Salvar' });
    var btnLimpar = h('button', { id: 'cad-limpar', class: 'trj-btn trj-btn-ghost clickable', text: 'Limpar' });
    var btnWrap = h('div', { class: 'mt-3' }, [btnSalvar, btnLimpar]);

    var result = h('div', { id: 'cad-result', class: '', text: '' });
    result.style.marginTop = '8px';
    result.style.color = 'var(--trj-muted)';

    card.appendChild(grid);
    card.appendChild(btnWrap);
    card.appendChild(result);
    root.appendChild(card);

    // helpers locais para selecionar dentro do root
    function q(id) { return root.querySelector('#' + id); }
    function getValues() {
      return {
        bairro: (q('cad-bairro') && q('cad-bairro').value || '').trim(),
        end_id: (q('cad-endid') && q('cad-endid').value || '').trim(),
        site: (q('cad-site') && q('cad-site').value || '').trim(),
        responsavel: (q('cad-resp') && q('cad-resp').value) || ''
      };
    }

    function setResult(txt, type) {
      result.textContent = txt || '';
      if (U && typeof U.toast === 'function' && type) U.toast(txt, type);
    }

    // salvar
    btnSalvar.addEventListener('click', function () {
      var data = getValues();
      // validação simples
      if (!data.site) {
        setResult('Preencha o campo SITE.', 'err');
        try { q('cad-site').focus(); } catch (_) {}
        return;
      }
      if (!data.responsavel) {
        setResult('Selecione o RESPONSÁVEL.', 'err');
        try { q('cad-resp').focus(); } catch (_) {}
        return;
      }

      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';

      // função salvar via API se disponível
      var savePromise;
      if (window.TRJ && TRJ.api && typeof TRJ.api.saveSite === 'function') {
        try {
          savePromise = TRJ.api.saveSite(data);
        } catch (e) {
          savePromise = Promise.reject(e);
        }
      } else {
        // fallback: salvar localStorage
        try {
          var stored = JSON.parse(localStorage.getItem('trj_sites') || '[]');
          stored.push(data);
          localStorage.setItem('trj_sites', JSON.stringify(stored));
          savePromise = Promise.resolve({ local: true });
        } catch (e) {
          savePromise = Promise.reject(e);
        }
      }

      savePromise.then(function (res) {
        setResult('Site salvo com sucesso.', 'ok');
        // disparar evento para listeners externos
        try {
          document.dispatchEvent(new CustomEvent('trj:siteSaved', { detail: data }));
        } catch (e) { /* ignore */ }
      }).catch(function (err) {
        console.error('Erro ao salvar site:', err);
        setResult('Erro ao salvar: ' + ((err && err.message) || err), 'err');
      }).finally(function () {
        btnSalvar.disabled = false;
        btnSalvar.textContent = 'Salvar';
      });
    });

    // limpar
    btnLimpar.addEventListener('click', function () {
      q('cad-bairro').value = '';
      q('cad-endid').value = '';
      q('cad-site').value = '';
      q('cad-resp').selectedIndex = 0;
      setResult('');
    });
  }

  // API pública pro app antigo: recebe id do container
  function buildCadastroForm(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    buildForm(container);
  }

  // módulo compatível com TRJ.pages
  TRJ.pages = TRJ.pages || {};
  TRJ.pages.cadastro = {
    render: function (root, opts) {
      // root pode ser a div #page; criar um container interno para o formulário
      var container = document.createElement('div');
      container.id = 'cadastro-container';
      root.appendChild(container);
      buildForm(container);
    }
  };

  // manter compatibilidade antiga
  TRJ.cadastro = TRJ.cadastro || {};
  TRJ.cadastro.buildCadastroForm = buildCadastroForm;

  // expor para debug
  window.TRJ = TRJ;
})(window.TRJ = window.TRJ || {});
