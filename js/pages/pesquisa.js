/* ============================================================
 * Página: Pesquisa Operacional
 * ============================================================
 * Baseado no módulo VBA Pesquisa_Operacional.
 *
 * 3 modos:
 *  1. PESQUISA POR PALAVRA — busca no diário BG (col BG = motivoCancelamento)
 *  2. TSKs SEM ATUALIZAÇÃO — TSKs Corretivas abertas sem update recente
 *  3. POSSÍVEIS NORMALIZADOS — TSKs cujo alarme/incidente parece normalizado
 *     (cruza tipoFalha com palavras-chave + verifica se END_ID está fora)
 * ============================================================ */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants;

  /* ── Normaliza texto para comparação (réplica de NormalizeText do VBA) ── */
  function norm(s) {
    if (!s) return '';
    return s.toString().trim().toUpperCase()
      .replace(/[ÁÀÂÃÄ]/g,'A').replace(/[ÉÈÊË]/g,'E')
      .replace(/[ÍÌÎÏ]/g,'I').replace(/[ÓÒÔÕÖ]/g,'O')
      .replace(/[ÚÙÛÜ]/g,'U').replace(/Ç/g,'C')
      .replace(/[\t\/\\\-_.,;:()'"""]/g,' ')
      .replace(/\s{2,}/g,' ').trim();
  }

  /* ── Palavras-chave de alarme que indicam possível normalização ── */
  var PALAVRAS_NORM = [
    'EXTERNAL', 'ENERGIA', 'GSM BTS DOWN', 'MASSIVA ACESSO', 'PARTIAL DOWN',
    'CELL', 'ENODEB DOWN', 'COMMUNICATION FAILURE', 'INACESSIVEL',
    'EQUIPAMENTO INACESSIVEL', 'SITE FORA', 'NR GNODEB DOWN', 'FALHA DE ENERGIA',
    'RETIFICADOR', 'ENODB', 'ISOLATED NE', 'S1 APP LINK DOWN', 'BATERIA',
    'NODEB DOWN', 'DISJUNTOR', 'INDISPONIBILIDADE', 'BREAK SIGNAL', 'PERDA DE SINAL'
  ];

  function contemPalavras(texto, palavras) {
    var n = norm(texto);
    return palavras.some(function (p) { return n.indexOf(norm(p)) >= 0; });
  }

  /* ── Filtro base: Corretiva + Não Iniciado / Iniciado ─────────────── */
  function ehValidoParaPesquisa(t) {
    if (!t) return false;
    var tipo = (t.tipoAtividade || '').toLowerCase();
    if (tipo.indexOf('corretiva') < 0) return false;
    var s = norm(t.status || '');
    return s === 'NAO INICIADO' || s === 'INICIADO';
  }

  /* ── Formatar linha de resultado (formato igual ao VBA) ─────────────
   * resumido:  TSK / SITE (END_ID)
   * completo:  *PRIORIDADE* - TSK / SITE (END_ID) - FILA -> INFO (nota)  */
  function formatarLinha(t, extra, resumo) {
    var tsk  = t.osNumero || '—';
    var site = t.siteId || t.enderecoId || '—';
    var eid  = t.enderecoId || '';
    var prio = t.prioridade || '';
    var fila = (t.filaAtual || '').replace(/^TLP-T\d+(-\d+)?-?\s*/i,'').slice(0,35);

    if (resumo) {
      return (prio ? '*'+prio+'* ' : '') + tsk + ' / ' + site + (eid?' ('+eid+')':'');
    }
    var base = (prio ? '*'+prio+'* ' : '') + tsk + ' / ' + site + (eid?' ('+eid+')':'');
    if (fila) base += ' → ' + fila;
    if (extra) base += ' · ' + extra;
    return base;
  }

  /* ── Agrupar por região e montar texto de cópia ────────────────── */
  function montarTexto(titulo, grupos) {
    if (!Object.keys(grupos).length) return '';
    var linhas = ['*' + titulo.toUpperCase() + '*', ''];
    C.REGIOES.concat(['SEM REGIÃO']).forEach(function (r) {
      var label = (C.REGIAO_LABELS[r] || r).toUpperCase();
      var arr = grupos[r] || grupos[label];
      if (!arr || !arr.length) return;
      linhas.push('*' + label + '*');
      arr.forEach(function (l) { linhas.push(l); });
      linhas.push('');
    });
    return linhas.join('\n').trim();
  }

  function agrupar(linhas_regioes) {
    var g = {};
    linhas_regioes.forEach(function (item) {
      var r = item.r || 'SEM REGIÃO';
      if (!g[r]) g[r] = [];
      g[r].push(item.linha);
    });
    return g;
  }

  /* ── Botão de cópia ─────────────────────────────────────────────── */
  function btnCopiar(getTexto) {
    return U.h('button', {
      class: 'trj-btn trj-btn-ghost clickable',
      style: { fontSize:'12px', padding:'4px 12px', display:'inline-flex', alignItems:'center', gap:'5px', border:'1px solid rgba(255,255,255,.15)' },
      onclick: function () {
        var txt = getTexto();
        if (!txt) { U.toast('Nenhum resultado para copiar.', 'err'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(function(){ U.toast('✓ Copiado!','ok'); });
        } else {
          var ta = document.createElement('textarea'); ta.value = txt;
          ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); U.toast('✓ Copiado!','ok'); } catch(e){}
          document.body.removeChild(ta);
        }
      }
    }, [U.h('span',{text:'📋'}), U.h('span',{text:'Copiar'})]);
  }

  /* ── Badge de status ─────────────────────────────────────────────── */
  function statusBadge(s) {
    var u = norm(s);
    var cor = u==='INICIADO' ? '#2ecc71' : '#f0b429';
    var bg  = u==='INICIADO' ? 'rgba(46,204,113,.18)' : 'rgba(240,180,41,.22)';
    return U.h('span',{class:'trj-badge',style:{background:bg,color:cor,fontWeight:'700',fontSize:'10px'},text:s||'—'});
  }

  /* ── Resultado vazio ────────────────────────────────────────────── */
  function vazio(msg) {
    return U.h('p',{style:{color:'var(--trj-muted)',fontSize:'13px',fontStyle:'italic',textAlign:'center',padding:'24px 0'},text: msg || 'Nenhum resultado.'});
  }

  /* ── Tabela de resultados genérica ─────────────────────────────── */
  function tabelaResultados(rows, colunas) {
    if (!rows.length) return vazio();
    var thead = U.h('thead', null, U.h('tr', null, colunas.map(function(c){ return U.h('th',{text:c}); })));
    var tbody = U.h('tbody', null, rows.map(function(r){
      return U.h('tr', null, r.map(function(cel){
        if (cel && typeof cel === 'object' && cel.nodeType) return U.h('td',null,cel);
        return U.h('td',{text: cel==null?'—':String(cel), style:{maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}});
      }));
    }));
    return U.h('div',{style:{overflowX:'auto'}}, U.h('table',{class:'trj-table'},[thead,tbody]));
  }

  /* ══════════════════════════════════════════════════════════════════
   * PÁGINA PRINCIPAL
   * ══════════════════════════════════════════════════════════════════ */
  TRJ.pages.pesquisa = function(container, ctx) {
    var data  = ctx.data || {};
    var tasks = (data.tasksEnriched || []);
    var incs  = (data.incidentsEnriched || []);

    // Pré-processar: ENDIDs com incidente ativo (não resolvido)
    var eidsAtivos = {};
    incs.forEach(function(i) {
      if ((i.statusTrat||'ATIVO').toUpperCase() !== 'RESOLVIDO') {
        eidsAtivos[(i.enderecoId||i.endId||'').trim()] = i;
      }
    });

    container.appendChild(U.pageHeader('Pesquisa Operacional',
      'Pesquisa por palavra no diário · TSKs sem atualização · Possíveis normalizados'));

    // Tabs do modo
    var modoAtivo = { v: 'palavra' };
    var tabContent = U.h('div', { style:{ marginTop:'16px' } });

    var TABS = [
      { id:'palavra',  label:'Pesquisa por Palavra',     icon:'🔍' },
      { id:'pendente', label:'TSKs Sem Atualização',      icon:'⚠️' },
      { id:'norm',     label:'Possíveis Normalizados',    icon:'✅' },
    ];

    var tabBtns = {};
    var tabRow = U.h('div', { style:{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'0' } });
    TABS.forEach(function(tab) {
      var btn = U.h('button', {
        class: 'trj-btn clickable',
        style: { padding:'8px 18px', fontSize:'13px', fontWeight:'600',
                 borderRadius:'10px 10px 0 0', border:'1px solid var(--trj-border)',
                 borderBottom:'none', background: tab.id===modoAtivo.v ? 'var(--trj-card)' : 'var(--trj-card2)',
                 color: tab.id===modoAtivo.v ? 'var(--trj-primary)' : 'var(--trj-muted)',
                 transition:'all .15s' },
        onclick: function() {
          modoAtivo.v = tab.id;
          Object.keys(tabBtns).forEach(function(id){
            var isAtivo = id === tab.id;
            tabBtns[id].style.background = isAtivo ? 'var(--trj-card)' : 'var(--trj-card2)';
            tabBtns[id].style.color      = isAtivo ? 'var(--trj-primary)' : 'var(--trj-muted)';
          });
          renderModo();
        }
      }, [U.h('span',{text: tab.icon + ' ' + tab.label})]);
      tabBtns[tab.id] = btn;
      tabRow.appendChild(btn);
    });

    container.appendChild(tabRow);
    var card = U.h('div', { class:'trj-card p-5', style:{ borderRadius:'0 10px 10px 10px' } });
    card.appendChild(tabContent);
    container.appendChild(card);

    /* ════════════════════════════════════════════════════════════
     * MODO 1: PESQUISA POR PALAVRA (réplica de PesquisaPorPalavra)
     * ════════════════════════════════════════════════════════════ */
    function renderPalavra() {
      tabContent.innerHTML = '';

      var searchInput = U.h('input', {
        class:'trj-input',
        placeholder:'Digite a palavra ou frase para buscar no diário de trabalho (BG)...',
        style:{ fontSize:'13px', width:'100%', marginBottom:'12px' }
      });

      var toggleResumo = { v: true };
      var btnResumo = U.h('button', {
        class:'trj-btn trj-btn-ghost clickable',
        style:{ fontSize:'12px', padding:'3px 10px' },
        onclick: function() {
          toggleResumo.v = !toggleResumo.v;
          btnResumo.textContent = toggleResumo.v ? 'Modo: Resumido' : 'Modo: Completo';
          buscar();
        }
      }, 'Modo: Resumido');

      var resultArea = U.h('div');
      var textoAtual = '';

      var ctrlRow = U.h('div', { style:{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'16px', flexWrap:'wrap' } }, [
        btnResumo,
        btnCopiar(function(){ return textoAtual; })
      ]);
      tabContent.appendChild(searchInput);
      tabContent.appendChild(ctrlRow);
      tabContent.appendChild(resultArea);
      searchInput.focus();

      var timer = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(timer);
        timer = setTimeout(buscar, 300);
      });
      searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') buscar();
      });

      function buscar() {
        var termo = searchInput.value.trim();
        resultArea.innerHTML = '';
        if (!termo) return;

        var validas = tasks.filter(ehValidoParaPesquisa);
        var resultados = [];

        validas.forEach(function(t) {
          var bg = t.motivoCancelamento || '';
          if (!bg) return;
          if (norm(bg).indexOf(norm(termo)) < 0) return;
          resultados.push({ r: t.regiao || 'SEM REGIÃO', t: t });
        });

        if (!resultados.length) {
          resultArea.appendChild(vazio('Nenhum resultado para "' + termo + '"'));
          textoAtual = '';
          return;
        }

        // Agrupado por região
        var grupos = agrupar(resultados.map(function(item) {
          return { r: item.r, linha: formatarLinha(item.t, null, toggleResumo.v) };
        }));

        textoAtual = montarTexto('PESQUISA: ' + termo, grupos);

        // Tabela de resultado
        var rows = resultados.map(function(item) {
          var t = item.t;
          var r = (C.REGIAO_LABELS[item.r] || item.r || 'SEM REGIÃO').toUpperCase();
          var updateInfo = '—';
          if (U.classificarUltimoBloco && t.motivoCancelamento) {
            var res = U.classificarUltimoBloco(t.motivoCancelamento);
            updateInfo = res.estado === 'ok' ? '✅ Hoje' : res.estado === 'antigo' ? '🟡 Anterior' : '🔴 Sem update';
          }
          return [r, statusBadge(t.status), t.osNumero, t.siteId || '—', t.enderecoId || '—', t.tipoFalha || '—', updateInfo];
        });

        var headerInfo = U.h('div', { style:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}, [
          U.h('span', { style:{ fontWeight:'600', fontSize:'13px' }, text: resultados.length + ' resultado(s) para "' + termo + '"' }),
        ]);
        resultArea.appendChild(headerInfo);
        resultArea.appendChild(tabelaResultados(rows, ['Região','Status','TSK','Site','END_ID','Falha','Último Update']));
      }
    }

    /* ════════════════════════════════════════════════════════════
     * MODO 2: TSKs SEM ATUALIZAÇÃO (baseado em PesquisaTSKPendentes)
     * ════════════════════════════════════════════════════════════ */
    function renderPendente() {
      tabContent.innerHTML = '';

      var maisRecente = { v: true }; // true = só sem update / false = todas sem update há +24h
      var filtroSelect = U.h('select', {
        class:'trj-btn trj-btn-ghost',
        style:{ fontSize:'12px', padding:'4px 10px' }
      }, [
        U.h('option', { value:'sem', text:'Sem qualquer atualização' }),
        U.h('option', { value:'antigo', text:'Atualização anterior (não hoje)' }),
        U.h('option', { value:'todos', text:'Todas as abertas' }),
      ]);

      var resultArea = U.h('div', { style:{ marginTop:'16px' } });
      var textoAtual = '';

      var ctrlRow = U.h('div', { style:{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px', flexWrap:'wrap' } }, [
        U.h('span', { style:{ fontSize:'13px', color:'var(--trj-muted)' }, text:'Filtro:' }),
        filtroSelect,
        btnCopiar(function(){ return textoAtual; })
      ]);

      tabContent.appendChild(ctrlRow);
      tabContent.appendChild(resultArea);

      filtroSelect.addEventListener('change', renderLista);
      renderLista();

      function renderLista() {
        resultArea.innerHTML = '';
        var filtro = filtroSelect.value;
        var validas = tasks.filter(ehValidoParaPesquisa);
        var resultados = [];

        validas.forEach(function(t) {
          var bg = t.motivoCancelamento || '';
          var updateEstado = 'sem';
          if (U.classificarUltimoBloco && bg) {
            updateEstado = U.classificarUltimoBloco(bg).estado;
          }
          var incluir = (filtro === 'todos') ||
                        (filtro === 'sem' && (updateEstado === 'sem')) ||
                        (filtro === 'antigo' && (updateEstado === 'sem' || updateEstado === 'antigo'));
          if (!incluir) return;
          resultados.push({ r: t.regiao || 'SEM REGIÃO', t: t, estado: updateEstado });
        });

        if (!resultados.length) {
          resultArea.appendChild(vazio('Nenhuma TSK encontrada para este filtro.'));
          textoAtual = '';
          return;
        }

        // Ordenar por região e prioridade
        resultados.sort(function(a, b) {
          var ri = C.REGIOES || [];
          var ar = ri.indexOf(a.r), br2 = ri.indexOf(b.r);
          if (ar!==br2) return ar-br2;
          var pa = parseInt((a.t.prioridade||'P9').replace(/\D/g,''),10)||9;
          var pb = parseInt((b.t.prioridade||'P9').replace(/\D/g,''),10)||9;
          return pa-pb;
        });

        var grupos = agrupar(resultados.map(function(item) {
          return { r: item.r, linha: formatarLinha(item.t, null, true) };
        }));
        textoAtual = montarTexto('TSKs ' + (filtro==='sem'?'SEM ATUALIZAÇÃO':filtro==='antigo'?'SEM UPDATE HOJE':'ABERTAS'), grupos);

        var rows = resultados.map(function(item) {
          var t   = item.t;
          var reg = (C.REGIAO_LABELS[item.r]||item.r||'SEM REGIÃO').toUpperCase();
          var ic  = item.estado==='sem' ? '🔴 Sem update' : item.estado==='antigo' ? '🟡 Anterior' : '🟢 Hoje';
          var updateCell = U.ultimoUpdateCell ? U.ultimoUpdateCell(
            { enderecoId: t.enderecoId }, [t], null
          ) : U.h('span',{text:ic});
          return [reg, statusBadge(t.status), t.osNumero, t.prioridade||'—',
                  t.siteId||'—', t.enderecoId||'—', t.tipoFalha||'—',
                  ic];
        });

        var count = U.h('div',{style:{fontWeight:'600',fontSize:'13px',marginBottom:'10px'},text: resultados.length+' TSK(s) encontrada(s)'});
        resultArea.appendChild(count);
        resultArea.appendChild(tabelaResultados(rows, ['Região','Status','TSK','P','Site','END_ID','Falha','Update']));
      }
    }

    /* ════════════════════════════════════════════════════════════
     * MODO 3: POSSÍVEIS NORMALIZADOS (réplica de PesquisaNormalizados)
     *
     * Lógica:
     *  • TSK Corretiva + Não Iniciado / Iniciado
     *  • tipoFalha contém palavras-chave de alarme (array PALAVRAS_NORM)
     *  • O END_ID NÃO aparece nos incidentes ativos (statusTrat ≠ RESOLVIDO)
     *  → Significa que o alarme/incidente foi normalizado mas a TSK ainda está aberta
     * ════════════════════════════════════════════════════════════ */
    function renderNormalizados() {
      tabContent.innerHTML = '';

      var toggleResumo = { v: true };
      var btnResumo2 = U.h('button', {
        class:'trj-btn trj-btn-ghost clickable',
        style:{ fontSize:'12px', padding:'3px 10px' },
        onclick: function() {
          toggleResumo.v = !toggleResumo.v;
          btnResumo2.textContent = toggleResumo.v ? 'Modo: Resumido' : 'Modo: Completo';
          renderNorm();
        }
      }, 'Modo: Resumido');

      var resultArea = U.h('div', { style:{ marginTop:'16px' } });
      var textoAtual = '';

      var ctrlRow = U.h('div', { style:{ display:'flex', gap:'8px', alignItems:'center', marginBottom:'12px', flexWrap:'wrap' } }, [
        btnResumo2,
        btnCopiar(function(){ return textoAtual; }),
        U.h('span', { style:{ fontSize:'11px', color:'var(--trj-muted)', marginLeft:'8px' },
          text:'TSKs abertas cujo END_ID não está mais em sites fora ativos' })
      ]);

      tabContent.appendChild(ctrlRow);
      tabContent.appendChild(resultArea);
      renderNorm();

      function renderNorm() {
        resultArea.innerHTML = '';
        var validas = tasks.filter(ehValidoParaPesquisa);
        var normalizados = [];

        validas.forEach(function(t) {
          var eid = (t.enderecoId || '').trim();
          // Critério 1: END_ID não está nos incidentes ativos (normalizado)
          var estaFora = !!eidsAtivos[eid];
          if (estaFora) return; // ainda em site fora → não é normalizado

          // Critério 2: tipoFalha ou motivoCancelamento contém palavra-chave de alarme
          var falha = t.tipoFalha || '';
          var bg    = t.motivoCancelamento || '';
          if (!contemPalavras(falha, PALAVRAS_NORM) && !contemPalavras(bg, PALAVRAS_NORM)) return;

          normalizados.push({ r: t.regiao || 'SEM REGIÃO', t: t });
        });

        if (!normalizados.length) {
          resultArea.appendChild(vazio('Nenhuma TSK identificada como possível normalizado.'));
          textoAtual = '';
          return;
        }

        // Ordenar por região e prioridade
        normalizados.sort(function(a, b) {
          var ri = C.REGIOES || [];
          var ar = ri.indexOf(a.r), br2 = ri.indexOf(b.r);
          if (ar!==br2) return ar-br2;
          var pa = parseInt((a.t.prioridade||'P9').replace(/\D/g,''),10)||9;
          var pb = parseInt((b.t.prioridade||'P9').replace(/\D/g,''),10)||9;
          return pa-pb;
        });

        var grupos = agrupar(normalizados.map(function(item) {
          return {
            r: item.r,
            linha: formatarLinha(item.t, item.t.tipoFalha, toggleResumo.v)
          };
        }));
        textoAtual = montarTexto('POSSÍVEIS NORMALIZADOS', grupos);

        var rows = normalizados.map(function(item) {
          var t   = item.t;
          var reg = (C.REGIAO_LABELS[item.r]||item.r||'SEM REGIÃO').toUpperCase();
          var updateInfo = '—';
          if (U.classificarUltimoBloco && t.motivoCancelamento) {
            var res = U.classificarUltimoBloco(t.motivoCancelamento);
            updateInfo = res.estado==='ok'?'🟢 Hoje':res.estado==='antigo'?'🟡 Anterior':'🔴 Sem update';
          }
          return [reg, statusBadge(t.status), t.osNumero, t.prioridade||'—',
                  t.siteId||'—', t.enderecoId||'—', t.tipoFalha||'—', updateInfo];
        });

        var aviso = U.h('div', { style:{ display:'flex', gap:'10px', alignItems:'flex-start', padding:'10px 14px',
          background:'rgba(46,204,113,.08)', border:'1px solid rgba(46,204,113,.25)', borderRadius:'8px', marginBottom:'12px' }}, [
          U.h('span',{style:{fontSize:'18px'},text:'✅'}),
          U.h('div',null,[
            U.h('b',{text: normalizados.length + ' TSK(s) possivelmente normalizada(s)'}),
            U.h('p',{style:{fontSize:'12px',color:'var(--trj-muted)',margin:'3px 0 0'},
              text:'Critério: TSK Corretiva aberta com alarme de falha de energia/equipamento, sem incidente ativo no END_ID.'})
          ])
        ]);
        resultArea.appendChild(aviso);
        resultArea.appendChild(tabelaResultados(rows, ['Região','Status','TSK','P','Site','END_ID','Tipo Falha','Último Update']));
      }
    }

    /* ── Renderizar o modo ativo ─────────────────────────────────── */
    function renderModo() {
      tabContent.innerHTML = '';
      if (modoAtivo.v === 'palavra')  renderPalavra();
      else if (modoAtivo.v === 'pendente') renderPendente();
      else renderNormalizados();
    }

    renderModo();
  };

})(window.TRJ = window.TRJ || {});
