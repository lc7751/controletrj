/* =====================================================================
 * Página: Prioritários
 * ---------------------------------------------------------------------
 * Painel de acompanhamento de casos especiais:
 *   • B2B / PREMIUM    — coluna DJ = "ISOC SERVICOS FIXO PREMIUM CLASS"
 *                        OU coluna BG contém "PREMIUM", "B2B - TIM",
 *                        "tracking_corporativo"
 *   • Backbone / Longa Distância — coluna BG contém "BACKBONE",
 *                                  "LONGA DISTANCIA" ou "LONGA DISTÂNCIA"
 *   • Concentradores   — cadastro de sites sensíveis que devem ser
 *                        monitorados; quando qualquer END_ID ou SITE
 *                        cadastrado aparece numa tarefa aberta ou num
 *                        incidente ativo (Sites Fora), aparece aqui
 *                        automaticamente com destaque.
 * ===================================================================== */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, D = TRJ.domain;

  var LS_CONC = 'trj_concentradores';

  // ------------------------------------------------------------------
  // Utilitários
  // ------------------------------------------------------------------
  function up(s) { return (s || '').toString().trim().toUpperCase(); }

  function carregarConcentradores() {
    try { return JSON.parse(localStorage.getItem(LS_CONC) || '[]') || []; }
    catch (e) { return []; }
  }
  function salvarConcentradores(lista) {
    try { localStorage.setItem(LS_CONC, JSON.stringify(lista)); } catch (e) {}
  }

  // Verifica se a tarefa está em backlog (aberta)
  function ehBacklog(t) {
    var s = up(t.status);
    return s === 'NÃO INICIADO' || s === 'NAO INICIADO' || s === 'INICIADO' || s === 'PENDENTE';
  }

  // Verifica se é tarefa corretiva
  function ehCorretiva(t) {
    return (t.tipoAtividade || '').indexOf('Corretiva') >= 0 ||
           (t.tipoAtividade || '').indexOf('CORRETIVA') >= 0 ||
           (t.tipoAtividade || '') === 'Planta Interna - Manutenção Corretiva';
  }

  // Detecta B2B / Premium (baseado no VBA GerarListaVencimentos)
  function ehB2BouPremium(t) {
    var dj = up(t.isocDJ || '');
    var bg = up(t.motivoCancelamento || '');
    return dj.indexOf('PREMIUM') >= 0 ||
           dj.indexOf('ISOC') >= 0 ||
           bg.indexOf('B2B - TIM') >= 0 ||
           bg.indexOf('TRACKING_CORPORATIVO') >= 0 ||
           bg.indexOf('B2B') >= 0 ||
           bg.indexOf('PREMIUM') >= 0;
  }

  // Detecta Backbone / Longa Distância
  function ehBackboneLD(t) {
    var bg = up(t.motivoCancelamento || '');
    return bg.indexOf('BACKBONE') >= 0 ||
           bg.indexOf('LONGA DISTANCIA') >= 0 ||
           bg.indexOf('LONGA DISTÂNCIA') >= 0;
  }

  // Trecho relevante do BG para exibir (primeira linha não-bot)
  function extrairTrechoRelevante(bg) {
    if (!bg) return null;
    var linhas = bg.split(/\n|(?=\d{2}\/\d{2}\/\d{4}\s)/);
    for (var i = 0; i < linhas.length; i++) {
      var l = linhas[i].trim();
      if (l.length < 15 || /WFM\s*Agent/i.test(l) || /MONITOR\s*CCI/i.test(l)) continue;
      return l.slice(0, 100) + (l.length > 100 ? '…' : '');
    }
    return null;
  }

  // Cor/label por status
  function statusStyle(s) {
    var u = up(s);
    if (u === 'INICIADO') return { cor: '#1fae5e', bg: 'rgba(46,204,113,.18)', label: 'INICIADO' };
    if (u === 'NÃO INICIADO' || u === 'NAO INICIADO') return { cor: '#f0b429', bg: 'rgba(240,180,41,.22)', label: 'NÃO INICIADO' };
    if (u === 'PENDENTE') return { cor: '#9b59b6', bg: 'rgba(155,89,182,.18)', label: 'PENDENTE' };
    return { cor: '#9aa5b1', bg: 'rgba(154,165,177,.15)', label: s || '—' };
  }

  // ------------------------------------------------------------------
  // Card de tarefa prioritária
  // ------------------------------------------------------------------
  function cardTarefa(t, opts) {
    opts = opts || {};
    var ss = statusStyle(t.status);
    var tsk = t.osNumero || '—';
    var bg = t.motivoCancelamento || '';
    var trecho = opts.trecho || extrairTrechoRelevante(bg) || null;
    var isocLabel = t.isocDJ ? up(t.isocDJ).slice(0, 40) : null;

    var badges = [];
    if (opts.badgeB2B) badges.push(U.h('span', {
      class: 'trj-badge', style: { background: 'rgba(52,152,219,.22)', color: '#3498db', fontWeight: '800', fontSize: '10px' }, text: '⭐ B2B/PREMIUM'
    }));
    if (opts.badgeBackbone) badges.push(U.h('span', {
      class: 'trj-badge', style: { background: 'rgba(231,76,60,.22)', color: '#e74c3c', fontWeight: '800', fontSize: '10px' }, text: '⚡ BACKBONE LD'
    }));
    if (opts.badgeConc) badges.push(U.h('span', {
      class: 'trj-badge', style: { background: 'rgba(155,89,182,.22)', color: '#9b59b6', fontWeight: '800', fontSize: '10px' }, text: '📍 CONCENTRADOR'
    }));

    var topo = U.h('div', { class: 'flex items-center justify-between flex-wrap gap-2', style: { marginBottom: '8px' } }, [
      U.h('div', { class: 'flex items-center gap-2 flex-wrap' }, [
        U.h('span', { style: { fontFamily: 'ui-monospace,monospace', fontWeight: '800', fontSize: '14px', color: 'var(--trj-primary)' }, text: tsk }),
        U.h('span', { class: 'trj-badge', style: { background: ss.bg, color: ss.cor, fontWeight: '700' }, text: ss.label }),
        t.prioridade ? U.h('span', { class: 'trj-badge', style: { background: 'rgba(255,140,0,.15)', color: 'var(--trj-primary)', fontWeight: '700' }, text: t.prioridade }) : null
      ].concat(badges)),
      U.h('div', { class: 'flex gap-2 flex-wrap' }, [
        t.enderecoId ? U.h('span', { style: { fontSize: '12px', color: 'var(--trj-muted)' }, text: t.enderecoId }) : null
      ])
    ]);

    var info = [];
    if (t.filaAtual) info.push(U.h('div', { style: { fontSize: '11px', color: 'var(--trj-muted)' }, text: '👤 ' + t.filaAtual.slice(0, 60) }));
    if (isocLabel) info.push(U.h('div', { style: { fontSize: '11px', color: '#3498db', fontWeight: '600' }, text: '🏢 ' + isocLabel }));
    if (opts.notaConc) info.push(U.h('div', { style: { fontSize: '11px', color: '#9b59b6', fontStyle: 'italic' }, text: '📝 ' + opts.notaConc }));
    if (trecho) info.push(U.h('div', { style: { fontSize: '11px', color: 'var(--trj-muted)', marginTop: '3px' }, text: '💬 ' + trecho }));

    return U.h('div', {
      class: 'trj-card p-3',
      style: { borderLeft: '4px solid ' + (opts.borderCor || 'var(--trj-primary)'), cursor: 'pointer', transition: 'box-shadow .15s' },
      onclick: function () {
        var modal = U.h('div', { style: { whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace,monospace', fontSize: '12px', maxHeight: '60vh', overflowY: 'auto', padding: '12px', lineHeight: '1.6', background: 'var(--trj-card2)', borderRadius: '8px' } },
          [U.h('b', { text: tsk + ' — BG completo\n\n' }),
           U.h('span', { text: bg || '(sem diário)' })]);
        U.openModal(tsk, modal);
      }
    }, [topo].concat(info));
  }

  // Card de incidente (sites fora)
  function cardIncidente(inc, opts) {
    opts = opts || {};
    return U.h('div', {
      class: 'trj-card p-3',
      style: { borderLeft: '4px solid #e74c3c' }
    }, [
      U.h('div', { class: 'flex items-center gap-2 flex-wrap', style: { marginBottom: '4px' } }, [
        U.h('span', { class: 'trj-badge', style: { background: 'rgba(231,76,60,.22)', color: '#e74c3c', fontWeight: '800', fontSize: '10px' }, text: '🚨 SITE FORA' }),
        U.h('span', { style: { fontWeight: '700', fontFamily: 'ui-monospace,monospace' }, text: inc.site || inc.enderecoId || '—' }),
        U.h('span', { style: { fontSize: '12px', color: 'var(--trj-muted)' }, text: inc.enderecoId || '' })
      ]),
      U.h('div', { style: { fontSize: '11px', color: 'var(--trj-muted)' } },
        '⏱ ' + (inc.downtime || inc.duracao || '—') + '  |  ' + (inc.causa || '/') + '  |  ' + (inc.cidadeUf || '—')),
      opts.notaConc ? U.h('div', { style: { fontSize: '11px', color: '#9b59b6', fontStyle: 'italic', marginTop: '3px' }, text: '📝 ' + opts.notaConc }) : null
    ]);
  }

  // ------------------------------------------------------------------
  // Seção genérica (título + conteúdo colapsável)
  // ------------------------------------------------------------------
  function secao(icon, titulo, cor, count, conteudo) {
    var estado = { aberto: true };
    var inner = U.h('div', { style: { marginTop: '12px' } });
    conteudo.forEach(function (el) { if (el) inner.appendChild(el); });

    var badgeCount = U.h('span', {
      class: 'trj-badge',
      style: { background: count > 0 ? 'rgba(231,76,60,.22)' : 'rgba(154,165,177,.15)', color: count > 0 ? '#e74c3c' : 'var(--trj-muted)', fontWeight: '800', fontSize: '11px', minWidth: '24px', textAlign: 'center', animation: count > 0 ? 'pulse 2s infinite' : 'none' },
      text: String(count)
    });

    var chevron = U.h('span', { style: { fontSize: '18px', transition: 'transform .2s', color: 'var(--trj-muted)' }, text: '▾' });

    var hdr = U.h('div', {
      class: 'flex items-center justify-between clickable',
      style: { cursor: 'pointer', padding: '10px 0', borderBottom: '2px solid ' + cor, marginBottom: '4px' },
      onclick: function () {
        estado.aberto = !estado.aberto;
        inner.style.display = estado.aberto ? '' : 'none';
        chevron.style.transform = estado.aberto ? '' : 'rotate(-90deg)';
      }
    }, [
      U.h('div', { class: 'flex items-center gap-2' }, [
        U.h('span', { style: { fontSize: '18px' }, text: icon }),
        U.h('span', { style: { fontWeight: '800', fontSize: '15px', color: cor }, text: titulo }),
        badgeCount
      ]),
      chevron
    ]);

    return U.h('div', { class: 'trj-card p-4 mb-4' }, [hdr, inner]);
  }

  // ------------------------------------------------------------------
  // SEÇÃO CONCENTRADORES — cadastro
  // ------------------------------------------------------------------
  function buildConcentradoresSection(tasks, incidents, onRefresh) {
    var lista = carregarConcentradores();

    // Encontrar matches entre concentradores e tasks/incidents
    var matches = [];
    lista.forEach(function (conc) {
      var keyConc = up(conc.endId || conc.site || '');
      if (!keyConc) return;

      // Buscar nas tarefas abertas
      tasks.forEach(function (t) {
        if (!ehBacklog(t)) return;
        var keyEnd = up(t.enderecoId || '');
        var keySite = up(t.siteId || '');
        if (keyEnd === keyConc || keySite === keyConc ||
            (keyConc.length > 3 && (keyEnd.indexOf(keyConc) >= 0 || keySite.indexOf(keyConc) >= 0))) {
          matches.push({ tipo: 'task', conc: conc, data: t });
        }
      });

      // Buscar nos incidentes ativos (Sites Fora)
      incidents.forEach(function (inc) {
        if (up(inc.statusTrat) === 'RESOLVIDO') return;
        var keyEnd = up(inc.enderecoId || inc.endId || '');
        var keySite = up(inc.site || '');
        if (keyEnd === keyConc || keySite === keyConc ||
            (keyConc.length > 3 && (keyEnd.indexOf(keyConc) >= 0 || keySite.indexOf(keyConc) >= 0))) {
          matches.push({ tipo: 'incident', conc: conc, data: inc });
        }
      });
    });

    var conteudo = [];

    // Formulário de cadastro
    var inpSite = U.h('input', { class: 'trj-input', placeholder: 'Nome do site (ex.: RJBT40)', style: { flex: '1' } });
    var inpEnd  = U.h('input', { class: 'trj-input', placeholder: 'END_ID (ex.: RJRJO_0143)', style: { flex: '1' } });
    var inpNota = U.h('input', { class: 'trj-input', placeholder: 'Anotação (ex.: Hub principal ANGR05)', style: { flex: '2' } });
    var btnAdd  = U.h('button', {
      class: 'trj-btn trj-btn-primary clickable',
      text: '+ Cadastrar',
      onclick: function () {
        var s = (inpSite.value || '').trim();
        var e = (inpEnd.value || '').trim();
        var n = (inpNota.value || '').trim();
        if (!s && !e) { U.toast('Informe ao menos o Site ou END_ID.', 'err'); return; }
        var novo = { id: Date.now(), site: s, endId: e, nota: n };
        lista.push(novo);
        salvarConcentradores(lista);
        inpSite.value = ''; inpEnd.value = ''; inpNota.value = '';
        U.toast('Concentrador cadastrado.', 'ok');
        onRefresh();
      }
    });

    conteudo.push(U.h('div', { class: 'flex flex-wrap gap-2 mb-4 items-center', style: { padding: '8px', background: 'var(--trj-card2)', borderRadius: '8px' } }, [
      inpSite, inpEnd, inpNota, btnAdd
    ]));

    // Lista de concentradores cadastrados
    if (lista.length > 0) {
      conteudo.push(U.h('div', { style: { marginBottom: '12px' } }, lista.map(function (conc) {
        return U.h('div', {
          class: 'flex items-center gap-2 flex-wrap',
          style: { fontSize: '12px', padding: '4px 0', borderBottom: '1px solid var(--trj-border)' }
        }, [
          conc.site ? U.h('span', { style: { fontWeight: '700' }, text: conc.site }) : null,
          conc.endId ? U.h('span', { style: { color: 'var(--trj-muted)', fontFamily: 'ui-monospace,monospace' }, text: conc.endId }) : null,
          conc.nota ? U.h('span', { style: { color: 'var(--trj-muted)', fontStyle: 'italic' }, text: '— ' + conc.nota }) : null,
          U.h('button', {
            class: 'trj-btn trj-btn-ghost clickable',
            style: { fontSize: '10px', padding: '1px 6px', color: '#e74c3c', marginLeft: 'auto' },
            text: '✕',
            onclick: function () {
              lista = lista.filter(function (x) { return x.id !== conc.id; });
              salvarConcentradores(lista);
              onRefresh();
            }
          })
        ]);
      })));
    } else {
      conteudo.push(U.h('p', { style: { color: 'var(--trj-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }, text: 'Nenhum concentrador cadastrado ainda.' }));
    }

    // Matches encontrados
    if (matches.length > 0) {
      conteudo.push(U.h('div', {
        class: 'trj-badge',
        style: { display: 'inline-block', margin: '8px 0 4px', background: 'rgba(155,89,182,.18)', color: '#9b59b6', fontWeight: '800' },
        text: '🔔 ' + matches.length + ' concentrador(es) com alerta'
      }));
      matches.forEach(function (m) {
        if (m.tipo === 'task') {
          conteudo.push(cardTarefa(m.data, { badgeConc: true, notaConc: m.conc.nota, borderCor: '#9b59b6' }));
        } else {
          conteudo.push(cardIncidente(m.data, { notaConc: m.conc.nota }));
        }
      });
    } else if (lista.length > 0) {
      conteudo.push(U.h('p', { style: { color: 'var(--trj-green)', fontSize: '13px', textAlign: 'center', padding: '8px 0' }, text: '✅ Nenhum concentrador cadastrado está com tarefa aberta ou incidente ativo.' }));
    }

    return { secao: secao('📍', 'Concentradores', '#9b59b6', matches.length, conteudo), count: matches.length };
  }

  // ------------------------------------------------------------------
  // PÁGINA PRINCIPAL
  // ------------------------------------------------------------------
  TRJ.pages.prioritarios = function (container, ctx) {
    var app = ctx.app;
    var data = ctx.data || {};
    var tasks     = (data.tasksEnriched || []).filter(function (t) { return ehBacklog(t) && ehCorretiva(t); });
    var incidents = data.incidentsEnriched || [];

    container.appendChild(U.pageHeader('🎯 Prioritários',
      'Casos B2B/Premium, Backbone Longa Distância e Concentradores monitorados — atualizados a cada render.'));

    // =====================================================================
    // 1. B2B / PREMIUM
    // =====================================================================
    var b2bTasks = tasks.filter(ehB2BouPremium);

    var b2bCards = b2bTasks.length === 0
      ? [U.h('p', { style: { color: 'var(--trj-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }, text: 'Nenhum caso B2B / Premium em aberto no momento.' })]
      : b2bTasks.map(function (t) {
          var dj = up(t.isocDJ || '');
          var bg = up(t.motivoCancelamento || '');
          var label = dj.indexOf('PREMIUM') >= 0 || dj.indexOf('ISOC') >= 0 ? dj.slice(0, 40) : null;
          return cardTarefa(t, { badgeB2B: true, borderCor: '#3498db', trecho: label });
        });

    container.appendChild(secao('⭐', 'B2B / Premium', '#3498db', b2bTasks.length, b2bCards));

    // =====================================================================
    // 2. BACKBONE / LONGA DISTÂNCIA
    // =====================================================================
    var backboneTasks = tasks.filter(ehBackboneLD);

    var backboneCards = backboneTasks.length === 0
      ? [U.h('p', { style: { color: 'var(--trj-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }, text: 'Nenhuma tarefa com Backbone / Longa Distância no diário.' })]
      : backboneTasks.map(function (t) {
          var bg = t.motivoCancelamento || '';
          var lines = bg.split(/\n/);
          var linhaBackbone = null;
          for (var i = 0; i < lines.length; i++) {
            if (/backbone|longa distancia|longa distância/i.test(lines[i])) {
              linhaBackbone = lines[i].trim().slice(0, 100);
              break;
            }
          }
          return cardTarefa(t, { badgeBackbone: true, borderCor: '#e74c3c', trecho: linhaBackbone });
        });

    container.appendChild(secao('⚡', 'Backbone / Longa Distância', '#e74c3c', backboneTasks.length, backboneCards));

    // =====================================================================
    // 3. CONCENTRADORES
    // =====================================================================
    function renderConcentradores() {
      var old = container.querySelector('#conc-section');
      if (old) old.remove();
      var result = buildConcentradoresSection(data.tasksEnriched || [], incidents, renderConcentradores);
      var wrapper = U.h('div', { id: 'conc-section' });
      wrapper.appendChild(result.secao);
      container.appendChild(wrapper);
    }
    renderConcentradores();

    // =====================================================================
    // Botão de atualização manual
    // =====================================================================
    container.appendChild(U.h('div', { class: 'flex justify-end mt-4' }, [
      U.h('button', {
        class: 'trj-btn trj-btn-ghost clickable',
        text: '🔄 Atualizar painel',
        onclick: function () { app.refresh(true).then(function () { app.render(); }); }
      })
    ]));
  };

})(window.TRJ = window.TRJ || {});
