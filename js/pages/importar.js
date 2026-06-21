/* Página: Importar dados — com conexão de pasta e importação de incidentes via texto */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, FS = TRJ.files, Comp = TRJ.compute;

  async function connectAndStart() {
    try {
      await FS.connectFolder();
      // iniciar monitor automático (ele chama o callback com parsed items)
      FS.startAutoMonitor(function (items) {
        // items é o array retornado por scanFolderOnce
        // converta / processe conforme sua lógica para gerar tasks
        // aqui chamamos setTasksFromParsed que apenas armazena raw items
        FS.setTasksFromParsed(items);
        // também podemos chamar TRJ.app.refresh() se for necessário
        if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh();
      }, 45000);
      renderPage(sectionEl);
    } catch (e) {
      U.toast(e.message || 'Erro ao conectar pasta', 'err');
    }
  }

  function formatFolderName(handle) {
    try { return handle && (handle.name || 'Pasta'); } catch (_) { return 'Pasta'; }
  }

  // detectar NE IDs em um texto: padrão simples (letras/números/underline)
  function detectNeIdsFromText(text) {
    if (!text) return [];
    // extrai tokens com letras/números/underscore, mínimo 4 caracteres
    var arr = text.split(/[^A-Za-z0-9_\\-]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    // aplicar heurística: strings com underscore e dígitos ou 4+ letras
    var pat = /^[A-Z0-9_\\-]{3,}$/i;
    var set = {};
    arr.forEach(function (t) {
      t = t.toUpperCase();
      if (pat.test(t)) set[t] = true;
    });
    return Object.keys(set);
  }

  var sectionEl = null;
  TRJ.pages.importar = function (container, ctx) {
    sectionEl = container;
    container.innerHTML = '';
    container.appendChild(U.pageHeader('Importar dados', 'Conecte a pasta de arquivos e cole os Sites Fora abaixo'));

    // status / conectar
    var statusP = U.h('div', { class: 'trj-card p-4 mb-4' }, [
      U.h('div', { class: 'flex items-center justify-between' }, [
        U.h('div', { html: '<b>Pasta de verificação</b><div class="text-xs" style="color:var(--trj-muted)">Conecte a pasta que contém os arquivos de atividades.</div>' }),
        U.h('div', { class: 'flex items-center gap-2' }, [
          U.h('button', { class: 'trj-btn trj-btn-primary', text: 'Conectar pasta', onclick: async function () {
            await connectAndStart();
            renderPage(container);
          }}),
          U.h('button', { class: 'trj-btn', text: 'Verificar agora', onclick: async function () {
            try {
              const items = await FS.scanFolderOnce();
              FS.setTasksFromParsed(items);
              U.toast('Pasta verificada. Itens encontrados: ' + (items && items.length || 0), 'ok');
              if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh();
            } catch (e) { U.toast(e.message || 'Erro ao escanear pasta', 'err'); }
          }})
        ])
      ])
    ]);

    container.appendChild(statusP);

    // detalhe do estado da pasta
    var folderBox = U.h('div', { class: 'trj-card p-4 mb-4' });
    container.appendChild(folderBox);

    // incidents (Sites Fora) textarea + detector
    var incidentsBox = U.h('div', { class: 'trj-card p-4' }, [
      U.h('h3', { class: 'font-semibold mb-2', text: 'Sites Fora — NE IDs' }),
      U.h('p', { class: 'text-sm mb-2', style: { color: 'var(--trj-muted)' }, text: 'Cole o texto com os sites fora. O sistema detecta automaticamente os NE IDs.' }),
      U.h('textarea', { id: 'trj-inc-text', class: 'trj-input', style: { width: '100%', height: '160px', fontFamily: 'monospace' }, placeholder: 'Cole aqui o texto do painel G.E.N.E.S.I.S ou lista...' }),
      U.h('div', { class: 'flex items-center gap-2 mt-3' }, [
        U.h('button', { class: 'trj-btn trj-btn-primary', text: 'Detectar NE IDs', onclick: function () {
          var txt = document.getElementById('trj-inc-text').value || '';
          var ids = detectNeIdsFromText(txt);
          renderDetectedIds(ids, incidentsBox);
        }}),
        U.h('button', { class: 'trj-btn', text: 'Limpar', onclick: function () {
          document.getElementById('trj-inc-text').value = '';
          renderDetectedIds([], incidentsBox);
        }})
      ]),
      U.h('div', { id: 'trj-detected-ids', class: 'mt-4' })
    ]);
    container.appendChild(incidentsBox);

    // inicial render
    renderPage(container);
  };

  // render do estado da pasta e dos ids detectados
  async function renderPage(container) {
    // folder state
    const folderBox = container.querySelector('.trj-card') || container.firstChild;
    // atualizar folder display
    const fb = container.querySelector('div.trj-card') || container.children[1];
    // build info
    var infoHtml = U.h('div', { class: 'text-sm', html: 'Estado: <b style=\"color:var(--trj-muted)\">' + (FS._folderHandle ? 'Conectada: ' + formatFolderName(FS._folderHandle) : 'Nenhuma pasta conectada') + '</b>' });
    // update first folder card content (replace)
    const folderCard = container.querySelectorAll('.trj-card')[0];
    if (folderCard) {
      folderCard.innerHTML = '';
      folderCard.appendChild(U.h('div', { class: 'flex items-center justify-between' }, [
        U.h('div', { html: '<b>Pasta de verificação</b><div class=\"text-xs\" style=\"color:var(--trj-muted)\">Conecte a pasta que contém os arquivos de atividades.</div>' }),
        U.h('div', { class: 'flex items-center gap-2' }, [
          U.h('button', { class: 'trj-btn trj-btn-primary', text: FS._folderHandle ? 'Re-conectar pasta' : 'Conectar pasta', onclick: async function () {
            try { await FS.connectFolder(); U.toast('Pasta conectada: ' + formatFolderName(FS._folderHandle), 'ok'); renderPage(container); } catch (e) { U.toast(e.message || 'Erro', 'err'); }
          }}),
          U.h('button', { class: 'trj-btn', text: 'Verificar agora', onclick: async function () {
            try {
              const items = await FS.scanFolderOnce();
              FS.setTasksFromParsed(items);
              U.toast('Pasta verificada. Itens: ' + (items && items.length || 0), 'ok');
              if (TRJ.app && typeof TRJ.app.refresh === 'function') TRJ.app.refresh();
            } catch (e) { U.toast(e.message || 'Erro ao escanear pasta', 'err'); }
          }})
        ])
      ]));
      // show folder name and disconnect
      var details = U.h('div', { class: 'mt-3 flex items-center justify-between' }, [
        U.h('div', { class: 'text-xs', style: { color: 'var(--trj-muted)' }, text: FS._folderHandle ? 'Conectada: ' + formatFolderName(FS._folderHandle) : 'Nenhuma pasta conectada' }),
        U.h('div', { class: 'flex items-center gap-2' }, [
          U.h('button', { class: 'trj-btn trj-btn-ghost', text: 'Desconectar', onclick: async function () { await FS.disconnectFolder(); U.toast('Pasta desconectada', 'ok'); renderPage(container); }})
        ])
      ]);
      folderCard.appendChild(details);
    }

    // render detected ids area initial state
    renderDetectedIds([], container);
  }

  // render detected ids (recebe array de strings)
  function renderDetectedIds(arr, host) {
    var hostEl = host.querySelector('#trj-detected-ids') || host.querySelectorAll('.trj-card')[1].querySelector('#trj-detected-ids');
    hostEl.innerHTML = '';
    if (!arr || !arr.length) {
      hostEl.appendChild(U.h('div', { class: 'text-sm', style: { color: 'var(--trj-muted)' }, text: 'NE IDs detectados: (nenhum)' }));
      return;
    }
    var wrap = U.h('div', { class: 'flex flex-wrap gap-2' }, arr.map(function (id) {
      return U.h('span', { class: 'tag', style: { background: 'transparent', border: '1px solid rgba(255,99,132,.25)', color: 'var(--trj-fg)', padding: '6px 10px', borderRadius: '12px' }, text: id });
    }));
    // botão importar para memória
    var importBtn = U.h('div', { class: 'mt-3' }, [
      U.h('button', { class: 'trj-btn trj-btn-primary', text: 'Importar incidentes detectados', onclick: function () {
        // transforma ids em objetos de incidente simples
        const incs = arr.map(function (id) { return { site: id, enderecoId: null, statusTrat: 'FORA', fila: null, inicio: null, observacao: 'Importado via texto' }; });
        FS.setIncidents(incs);
        U.toast('Incidentes importados: ' + incs.length, 'ok');
        if (TRJ.app && typeof TRJ.app.reloadIncidents === 'function') TRJ.app.reloadIncidents();
      }})
    ]);
    hostEl.appendChild(wrap);
    hostEl.appendChild(importBtn);
  }

  // ao carregar a página, tentamos recuperar handle salvo
  (async function tryLoadSaved() {
    try {
      if (FS && typeof FS.loadSavedFolder === 'function') {
        await FS.loadSavedFolder();
      }
    } catch (e) { /* ignora */ }
  })();

})(window.TRJ = window.TRJ || {});
