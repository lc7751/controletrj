/* =====================================================================
 * Página: Prioritários
 * ---------------------------------------------------------------------
 * Interface de categorias (botões) com drilldown por clique.
 * Cada categoria exibe: TSK · NE/Site · END_ID · Falha · Fila atual
 * + último e penúltimo update do BG (estilo Sites Fora).
 *
 * Categorias:
 *   • ⭐ B2B / Premium  — coluna DJ contém "ISOC"/"PREMIUM"
 *                         OU coluna BG contém "B2B","PREMIUM"
 *   • ⚡ Backbone LD    — coluna BG contém "BACKBONE" ou "LONGA DISTANCIA"
 *   • 📍 Concentradores — cadastro de sites monitorados;
 *                         cruza com tarefas abertas e incidentes ativos
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants;

  var LS_CONC = 'trj_concentradores';

  // ---- helpers -------------------------------------------------------
  function up(s) { return (s || '').toString().trim().toUpperCase(); }

  function ehBacklog(t) {
    var s = up(t.status);
    return s === 'NÃO INICIADO' || s === 'NAO INICIADO' || s === 'INICIADO' || s === 'PENDENTE';
  }
  function ehCorretiva(t) {
    return (t.tipoAtividade || '').indexOf('Corretiva') >= 0 ||
           (t.tipoAtividade || '').indexOf('CORRETIVA') >= 0;
  }
  function ehB2B(t) {
    // Regra criadora (coluna DJ): só considera se contiver "PREMIUM"
    var dj = up(t.isocDJ || '');
    // Coluna BG: conforme VBA — B2B-TIM, tracking_corporativo ou PREMIUM
    var bg = up(t.motivoCancelamento || '');
    return dj.indexOf('PREMIUM') >= 0 ||
           bg.indexOf('B2B - TIM') >= 0 ||
           bg.indexOf('TRACKING_CORPORATIVO') >= 0 ||
           bg.indexOf('PREMIUM') >= 0;
  }
  function ehBackboneLD(t) {
    var bg = up(t.motivoCancelamento || '');
    return bg.indexOf('LONGA DISTANCIA') >= 0;
  }

  function carregarConc() {
    try { return JSON.parse(localStorage.getItem(LS_CONC) || '[]') || []; }
    catch (e) { return []; }
  }
  function salvarConc(l) {
    try { localStorage.setItem(LS_CONC, JSON.stringify(l)); } catch (e) {}
  }

  // ---- ícone folha (igual ao Sites Fora) ----------------------------
  var FOLHA = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>';

  // ---- célula de último update do BG --------------------------------
  function bgCell(t) {
    var bg = t.motivoCancelamento || '';
    if (!bg || !U.extrairDoisBlocosBG) {
      return U.h('span', { style: { color: 'var(--trj-muted)', fontSize: '11px' }, text: '—' });
    }
    var semUpdate = U.isTextoSemAtualizacao && U.isTextoSemAtualizacao(bg);
    var dois = U.extrairDoisBlocosBG(bg);
    if (semUpdate || !dois.length) {
      return U.h('span', {
        class: 'trj-badge',
        style: { background: 'rgba(231,76,60,.14)', color: '#e74c3c', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', cursor: 'default' },
        title: 'Nenhuma atualização do técnico'
      }, [U.h('span', { class: 'trj-pulse-dot' }), U.h('span', { text: 'Sem update' })]);
    }
    var ultimo = dois[0] || '';
    var semPrefix = ultimo.replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*-?\s*/, '').trim();
    var resumo = semPrefix.slice(0, 35) + (semPrefix.length > 35 ? '…' : '');
    return U.h('button', {
      class: 'trj-btn trj-btn-ghost',
      style: { fontSize: '11px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--trj-green)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      title: ultimo,
      onclick: function (ev) {
        ev.stopPropagation();
        var conteudo = U.h('div', {
          style: { whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,monospace', fontSize: '12px', maxHeight: '60vh', overflowY: 'auto', padding: '12px', lineHeight: '1.6', background: 'var(--trj-card2)', borderRadius: '8px' }
        }, [U.h('b', { text: '── Último ──\n\n' }), U.h('span', { text: dois[0] || '' }),
            dois[1] ? U.h('span', { text: '\n\n── Penúltimo ──\n\n' + dois[1] }) : null]);
        U.openModal('BG — ' + (t.osNumero || ''), conteudo);
      }
    }, [U.h('span', { html: FOLHA }), U.h('span', { text: resumo })]);
  }

  // ---- status badge -------------------------------------------------
  function statusBadge(s) {
    var u = up(s);
    var cor = '#9aa5b1', bg = 'rgba(154,165,177,.15)', lbl = s || '—';
    if (u === 'INICIADO')                        { cor = '#1fae5e'; bg = 'rgba(46,204,113,.2)'; }
    else if (u === 'NÃO INICIADO' || u === 'NAO INICIADO') { cor = '#f0b429'; bg = 'rgba(240,180,41,.25)'; lbl = 'NÃO INIC.'; }
    else if (u === 'PENDENTE')                   { cor = '#9b59b6'; bg = 'rgba(155,89,182,.2)'; }
    return U.h('span', { class: 'trj-badge', style: { background: bg, color: cor, fontWeight: '700', fontSize: '10px' }, text: lbl });
  }

  // ---- tabela de tarefas prioritárias --------------------------------
  function tabelaTarefas(rows, opts) {
    opts = opts || {};
    if (!rows.length) {
      return U.h('p', {
        style: { color: 'var(--trj-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' },
        text: opts.vazio || 'Nenhum resultado nesta categoria.'
      });
    }
    var thead = U.h('thead', null, U.h('tr', null,
      ['Status', 'TSK', 'NE / Site', 'END_ID', 'Falha', 'Fila Atual', 'BG — Último Update']
        .map(function (t) { return U.h('th', { text: t }); })));

    var tbody = U.h('tbody', null, rows.map(function (t) {
      var fila = (t.filaAtual || '—').slice(0, 45);
      var ne   = t.siteId || t.enderecoId || '—';
      var falha = t.tipoFalha || '—';
      return U.h('tr', null, [
        U.h('td', null, statusBadge(t.status)),
        U.h('td', null, U.h('span', {
          style: { fontFamily: 'ui-monospace,monospace', fontWeight: '700', fontSize: '12px', color: 'var(--trj-primary)' },
          text: t.osNumero || '—'
        })),
        U.h('td', { text: ne, style: { maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
        U.h('td', { text: t.enderecoId || '—', style: { fontFamily: 'ui-monospace,monospace', fontSize: '11px' } }),
        U.h('td', { text: falha, style: { maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
        U.h('td', { text: fila, style: { fontSize: '11px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
        U.h('td', null, bgCell(t))
      ]);
    }));
    var tbl = U.h('table', { class: 'trj-table' }, [thead, tbody]);
    var wrap = U.h('div', { style: { overflowX: 'auto' } }, tbl);
    return wrap;
  }

  // ---- drilldown de concentradores (tarefas + incidentes) -----------
  function tabelaConcentradores(matches, onAtualizar) {
    if (!matches.length) {
      return U.h('p', {
        style: { color: 'var(--trj-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '24px 0' },
        text: 'Nenhum concentrador cadastrado está com tarefa aberta ou incidente ativo no momento.'
      });
    }
    // Separar tarefas e incidentes
    var tarefas  = matches.filter(function (m) { return m.tipo === 'task'; });
    var incids   = matches.filter(function (m) { return m.tipo === 'incident'; });
    var sections = [];

    if (tarefas.length) {
      var thead = U.h('thead', null, U.h('tr', null,
        ['Status', 'TSK', 'NE / Site', 'END_ID', 'Falha', 'Fila Atual', 'BG — Último Update', 'Anotação']
          .map(function (t) { return U.h('th', { text: t }); })));
      var tbody = U.h('tbody', null, tarefas.map(function (m) {
        var t = m.data;
        return U.h('tr', { style: { borderLeft: '3px solid #9b59b6' } }, [
          U.h('td', null, statusBadge(t.status)),
          U.h('td', null, U.h('span', {
            style: { fontFamily: 'ui-monospace,monospace', fontWeight: '700', fontSize: '12px', color: 'var(--trj-primary)' },
            text: t.osNumero || '—'
          })),
          U.h('td', { text: t.siteId || t.enderecoId || '—' }),
          U.h('td', { text: t.enderecoId || '—', style: { fontFamily: 'ui-monospace,monospace', fontSize: '11px' } }),
          U.h('td', { text: t.tipoFalha || '—' }),
          U.h('td', { text: (t.filaAtual || '—').slice(0, 40), style: { fontSize: '11px' } }),
          U.h('td', null, bgCell(t)),
          U.h('td', { style: { color: '#9b59b6', fontStyle: 'italic', fontSize: '11px' }, text: m.conc.nota || '—' })
        ]);
      }));
      sections.push(U.h('div', { style: { marginBottom: '16px' } }, [
        U.h('p', { style: { fontSize: '12px', fontWeight: '700', color: '#9b59b6', marginBottom: '6px' }, text: '📋 Tarefas abertas (' + tarefas.length + ')' }),
        U.h('div', { style: { overflowX: 'auto' } }, U.h('table', { class: 'trj-table' }, [thead, tbody]))
      ]));
    }

    if (incids.length) {
      var thead2 = U.h('thead', null, U.h('tr', null,
        ['Horário', 'Site', 'END_ID', 'Causa', 'Cidade', 'Duração', 'Anotação']
          .map(function (t) { return U.h('th', { text: t }); })));
      var tbody2 = U.h('tbody', null, incids.map(function (m) {
        var i = m.data;
        return U.h('tr', { style: { borderLeft: '3px solid #e74c3c' } }, [
          U.h('td', { text: i.horario || '—' }),
          U.h('td', { text: i.site || '—', style: { fontWeight: '700' } }),
          U.h('td', { text: i.enderecoId || '—', style: { fontFamily: 'ui-monospace,monospace', fontSize: '11px' } }),
          U.h('td', { text: i.causa || '/', style: { maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }),
          U.h('td', { text: i.cidadeUf || '—' }),
          U.h('td', { text: i.downtime || i.duracao || '—' }),
          U.h('td', { style: { color: '#9b59b6', fontStyle: 'italic', fontSize: '11px' }, text: m.conc.nota || '—' })
        ]);
      }));
      sections.push(U.h('div', null, [
        U.h('p', { style: { fontSize: '12px', fontWeight: '700', color: '#e74c3c', marginBottom: '6px' }, text: '🚨 Sites Fora (Incidentes) (' + incids.length + ')' }),
        U.h('div', { style: { overflowX: 'auto' } }, U.h('table', { class: 'trj-table' }, [thead2, tbody2]))
      ]));
    }
    return U.h('div', null, sections);
  }

  // ---- formulário de cadastro de concentradores ---------------------
  function formConcentradores(onSalvar) {
    var inpSite = U.h('input', { class: 'trj-input', placeholder: 'Site (ex.: RJBT40)', style: { flex: '1', minWidth: '120px' } });
    var inpEnd  = U.h('input', { class: 'trj-input', placeholder: 'END_ID (ex.: RJRJO_0143)', style: { flex: '1', minWidth: '140px' } });
    var inpNota = U.h('input', { class: 'trj-input', placeholder: 'Anotação (ex.: Hub principal ANGR05)', style: { flex: '2', minWidth: '200px' } });
    var btnAdd  = U.h('button', {
      class: 'trj-btn trj-btn-primary clickable',
      html: '+ Cadastrar',
      onclick: function () {
        var s = (inpSite.value || '').trim(), e = (inpEnd.value || '').trim(), n = (inpNota.value || '').trim();
        if (!s && !e) { U.toast('Informe ao menos o Site ou END_ID.', 'err'); return; }
        var lista = carregarConc();
        lista.push({ id: Date.now(), site: s, endId: e, nota: n });
        salvarConc(lista);
        inpSite.value = ''; inpEnd.value = ''; inpNota.value = '';
        U.toast('Concentrador cadastrado.', 'ok');
        onSalvar();
      }
    });
    return U.h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', padding: '12px', background: 'var(--trj-card2)', borderRadius: '8px', marginBottom: '12px' } },
      [inpSite, inpEnd, inpNota, btnAdd]);
  }

  function listaConcentradores(lista, onRemover) {
    if (!lista.length) return U.h('p', { style: { color: 'var(--trj-muted)', fontSize: '12px', fontStyle: 'italic' }, text: 'Nenhum concentrador cadastrado. Use o formulário acima.' });
    return U.h('div', { style: { marginBottom: '12px' } }, lista.map(function (c) {
      return U.h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', borderBottom: '1px solid var(--trj-border)', fontSize: '12px', flexWrap: 'wrap' } }, [
        U.h('span', { style: { fontFamily: 'ui-monospace,monospace', fontWeight: '700', minWidth: '80px' }, text: c.site || '—' }),
        U.h('span', { style: { color: 'var(--trj-muted)', minWidth: '120px' }, text: c.endId || '—' }),
        U.h('span', { style: { color: 'var(--trj-muted)', fontStyle: 'italic', flex: '1' }, text: c.nota || '' }),
        U.h('button', {
          class: 'trj-btn trj-btn-ghost clickable',
          style: { fontSize: '10px', padding: '1px 6px', color: '#e74c3c', marginLeft: 'auto', flexShrink: '0' },
          text: '✕ Remover',
          onclick: function () {
            var l = carregarConc().filter(function (x) { return x.id !== c.id; });
            salvarConc(l);
            onRemover();
          }
        })
      ]);
    }));
  }

  // ---- botão de categoria (label/chip com ícone + count) -----------
  function btnCategoria(opts) {
    // opts: { icon, label, count, cor, ativo, onclick }
    var ativo = !!opts.ativo;
    return U.h('button', {
      class: 'trj-btn clickable',
      style: {
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '14px 22px', borderRadius: '12px', fontSize: '14px', fontWeight: '700',
        background: ativo ? opts.cor : 'var(--trj-card2)',
        color: ativo ? '#fff' : opts.cor,
        border: '2px solid ' + opts.cor,
        boxShadow: ativo ? ('0 4px 18px ' + opts.cor + '55') : 'none',
        transition: 'all .2s ease', transform: ativo ? 'translateY(-2px)' : '',
        minWidth: '220px', position: 'relative'
      },
      onclick: opts.onclick
    }, [
      U.h('span', { style: { fontSize: '22px' }, text: opts.icon }),
      U.h('div', { style: { textAlign: 'left' } }, [
        U.h('div', { text: opts.label }),
        U.h('div', { style: { fontSize: '11px', fontWeight: '400', opacity: '0.85' }, text: opts.count + ' tarefa(s) em aberto' })
      ]),
      opts.count > 0 ? U.h('span', {
        style: { position: 'absolute', top: '6px', right: '8px', background: ativo ? 'rgba(255,255,255,.3)' : opts.cor, color: ativo ? '#fff' : '#fff', borderRadius: '999px', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800' },
        text: String(opts.count)
      }) : null
    ]);
  }

  // ---- PÁGINA PRINCIPAL --------------------------------------------
  TRJ.pages.prioritarios = function (container, ctx) {
    var app = ctx.app;
    var data = ctx.data || {};
    var allTasks  = (data.tasksEnriched || []).filter(function (t) { return ehBacklog(t) && ehCorretiva(t); });
    var incidents = data.incidentsEnriched || [];

    var b2bTasks      = allTasks.filter(ehB2B);
    var backboneTasks = allTasks.filter(ehBackboneLD);

    // Calcular matches de concentradores
    function calcMatches() {
      var lista = carregarConc();
      var matches = [];
      lista.forEach(function (conc) {
        var key = up(conc.endId || conc.site || '');
        if (!key) return;
        allTasks.forEach(function (t) {
          var ke = up(t.enderecoId || ''), ks = up(t.siteId || '');
          if (ke === key || ks === key || (key.length > 3 && (ke.indexOf(key) >= 0 || ks.indexOf(key) >= 0)))
            matches.push({ tipo: 'task', conc: conc, data: t });
        });
        incidents.forEach(function (inc) {
          if (up(inc.statusTrat) === 'RESOLVIDO') return;
          var ke = up(inc.enderecoId || inc.endId || ''), ks = up(inc.site || '');
          if (ke === key || ks === key || (key.length > 3 && (ke.indexOf(key) >= 0 || ks.indexOf(key) >= 0)))
            matches.push({ tipo: 'incident', conc: conc, data: inc });
        });
      });
      return matches;
    }

    var concMatches = calcMatches();
    var catAtiva = { v: null }; // categoria ativa: 'b2b' | 'backbone' | 'conc'

    container.appendChild(U.pageHeader('🎯 Prioritários', 'Casos especiais em monitoramento — clique em uma categoria para ver os detalhes.'));

    // --- linha de botões de categoria --------------------------------
    var btnRow = U.h('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '20px' } });
    var drillArea = U.h('div', { style: { minHeight: '120px' } });

    function setCategoria(cat) {
      catAtiva.v = cat;
      // Redesenhar botões
      btnRow.innerHTML = '';
      renderBotoes();
      // Renderizar drilldown
      drillArea.innerHTML = '';
      drillArea.appendChild(renderDrill(cat));
    }

    function renderBotoes() {
      btnRow.appendChild(btnCategoria({
        icon: '⭐', label: 'B2B / Premium', count: b2bTasks.length, cor: '#3498db',
        ativo: catAtiva.v === 'b2b',
        onclick: function () { setCategoria(catAtiva.v === 'b2b' ? null : 'b2b'); }
      }));
      btnRow.appendChild(btnCategoria({
        icon: '⚡', label: 'Backbone / Longa Distância', count: backboneTasks.length, cor: '#e74c3c',
        ativo: catAtiva.v === 'backbone',
        onclick: function () { setCategoria(catAtiva.v === 'backbone' ? null : 'backbone'); }
      }));
      btnRow.appendChild(btnCategoria({
        icon: '📍', label: 'Concentradores', count: concMatches.length, cor: '#9b59b6',
        ativo: catAtiva.v === 'conc',
        onclick: function () { setCategoria(catAtiva.v === 'conc' ? null : 'conc'); }
      }));
    }
    renderBotoes();
    container.appendChild(btnRow);
    container.appendChild(drillArea);

    function renderDrill(cat) {
      if (!cat) return U.h('div');

      var card = U.h('div', { class: 'trj-card p-5', style: { animation: 'fadeIn .18s ease' } });

      if (cat === 'b2b') {
        card.appendChild(U.h('div', { class: 'flex items-center gap-2 mb-4' }, [
          U.h('span', { style: { fontSize: '18px' }, text: '⭐' }),
          U.h('span', { style: { fontWeight: '800', fontSize: '16px', color: '#3498db' }, text: 'B2B / Premium — ' + b2bTasks.length + ' caso(s)' })
        ]));
        card.appendChild(tabelaTarefas(b2bTasks, { vazio: 'Nenhum caso B2B / Premium em aberto no momento.' }));

      } else if (cat === 'backbone') {
        card.appendChild(U.h('div', { class: 'flex items-center gap-2 mb-4' }, [
          U.h('span', { style: { fontSize: '18px' }, text: '⚡' }),
          U.h('span', { style: { fontWeight: '800', fontSize: '16px', color: '#e74c3c' }, text: 'Backbone / Longa Distância — ' + backboneTasks.length + ' caso(s)' })
        ]));
        card.appendChild(tabelaTarefas(backboneTasks, { vazio: 'Nenhuma tarefa com Backbone / Longa Distância no diário.' }));

      } else if (cat === 'conc') {
        card.appendChild(U.h('div', { class: 'flex items-center gap-2 mb-3' }, [
          U.h('span', { style: { fontSize: '18px' }, text: '📍' }),
          U.h('span', { style: { fontWeight: '800', fontSize: '16px', color: '#9b59b6' }, text: 'Concentradores — ' + concMatches.length + ' alerta(s)' })
        ]));
        // Cadastro
        card.appendChild(formConcentradores(function () {
          concMatches = calcMatches();
          setCategoria('conc');
        }));
        card.appendChild(listaConcentradores(carregarConc(), function () {
          concMatches = calcMatches();
          setCategoria('conc');
        }));
        // Drilldown
        if (concMatches.length > 0) {
          card.appendChild(U.h('hr', { style: { margin: '12px 0', borderColor: 'var(--trj-border)' } }));
          card.appendChild(U.h('p', { style: { fontWeight: '700', fontSize: '13px', marginBottom: '8px', color: '#9b59b6' }, text: '🔔 Alertas ativos:' }));
          card.appendChild(tabelaConcentradores(concMatches, function () {
            concMatches = calcMatches();
            setCategoria('conc');
          }));
        }
      }
      return card;
    }

    // Botão de atualização
    container.appendChild(U.h('div', { style: { marginTop: '16px', display: 'flex', justifyContent: 'flex-end' } }, [
      U.h('button', {
        class: 'trj-btn trj-btn-ghost clickable', text: '🔄 Atualizar painel',
        onclick: function () { app.refresh(true).then(function () { app.render(); }); }
      })
    ]));
  };

})(window.TRJ = window.TRJ || {});
