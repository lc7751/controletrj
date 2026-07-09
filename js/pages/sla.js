/* Página: SLA / Aderência — gráficos pizza por prioridade e geral */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  var COR_DENTRO = '#2ecc71';  // verde
  var COR_FORA   = '#e74c3c';  // vermelho
  var COR_ORANGE = '#f0b429';  // amarelo (aderência parcial)

  TRJ.pages.sla = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) {
      container.appendChild(U.h('div', { class: 'trj-card p-6 text-center', text: 'Sem dados para exibir.' }));
      return;
    }
    var d = Comp.slaPage(data.tasksEnriched, data.prazoMap) || {};
    var porPrioridade = d.porPrioridade || [];
    var porRegiao     = d.porRegiao     || [];
    var geral         = d.geral         || { pct: 0, dentro: 0, fora: 0 };

    // ── Header ──────────────────────────────────────────────────────────
    container.appendChild(U.pageHeader('SLA / Aderência',
      'Aderência geral: ' + geral.pct + '%  (' + geral.dentro + ' dentro / ' + geral.fora + ' fora)'));

    // ── Legenda compartilhada ────────────────────────────────────────────
    var legenda = U.h('div', {
      style: { display:'flex', gap:'20px', justifyContent:'center', marginBottom:'20px', flexWrap:'wrap' }
    }, [
      U.h('div', { style:{ display:'flex', alignItems:'center', gap:'7px', fontSize:'12px' } }, [
        U.h('span', { style:{ width:'14px', height:'14px', borderRadius:'50%', background:COR_DENTRO, display:'inline-block' } }),
        U.h('span', { text:'Dentro do SLA' })
      ]),
      U.h('div', { style:{ display:'flex', alignItems:'center', gap:'7px', fontSize:'12px' } }, [
        U.h('span', { style:{ width:'14px', height:'14px', borderRadius:'50%', background:COR_FORA, display:'inline-block' } }),
        U.h('span', { text:'Fora do SLA' })
      ]),
    ]);
    container.appendChild(legenda);

    // ── SEÇÃO 1: Aderência Geral (destaque central) ──────────────────────
    var corGeralPct = geral.pct >= 90 ? COR_DENTRO : geral.pct >= 70 ? COR_ORANGE : COR_FORA;
    var geralWrap = U.h('div', { class:'trj-card p-5 mb-5', style:{ display:'flex', alignItems:'center', gap:'32px', flexWrap:'wrap' } });

    // Donut grande do geral
    var geralCanvas = U.h('canvas', { style:{ width:'220px', height:'220px', flexShrink:'0' } });
    var geralInfo   = U.h('div', { style:{ flex:'1', minWidth:'200px' } }, [
      U.h('div', { style:{ fontSize:'13px', fontWeight:'700', color:'var(--trj-muted)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:'8px' }, text:'ADERÊNCIA GERAL' }),
      U.h('div', { style:{ fontSize:'52px', fontWeight:'800', color:corGeralPct, lineHeight:'1' }, text: geral.pct + '%' }),
      U.h('div', { style:{ fontSize:'12px', color:'var(--trj-muted)', marginTop:'6px' }, text: geral.dentro + ' dentro / ' + geral.fora + ' fora' }),
      U.h('div', { style:{ marginTop:'16px', display:'flex', gap:'12px', flexWrap:'wrap' } }, [
        U.h('div', { style:{ background:'rgba(46,204,113,.12)', border:'1px solid rgba(46,204,113,.3)', borderRadius:'8px', padding:'8px 14px', textAlign:'center' } }, [
          U.h('div', { style:{ fontSize:'22px', fontWeight:'800', color:COR_DENTRO }, text: String(geral.dentro) }),
          U.h('div', { style:{ fontSize:'10px', color:'var(--trj-muted)', marginTop:'2px' }, text:'DENTRO DO SLA' })
        ]),
        U.h('div', { style:{ background:'rgba(231,76,60,.12)', border:'1px solid rgba(231,76,60,.3)', borderRadius:'8px', padding:'8px 14px', textAlign:'center' } }, [
          U.h('div', { style:{ fontSize:'22px', fontWeight:'800', color:COR_FORA }, text: String(geral.fora) }),
          U.h('div', { style:{ fontSize:'10px', color:'var(--trj-muted)', marginTop:'2px' }, text:'FORA DO SLA' })
        ])
      ])
    ]);

    var geralChartWrap = U.h('div', { style:{ width:'220px', height:'220px', position:'relative', flexShrink:'0' } });
    geralChartWrap.appendChild(geralCanvas);

    // Percentual central
    var pctCentral = U.h('div', {
      style:{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
              textAlign:'center', pointerEvents:'none' }
    }, [
      U.h('div', { style:{ fontSize:'26px', fontWeight:'800', color:corGeralPct }, text: geral.pct + '%' }),
      U.h('div', { style:{ fontSize:'10px', color:'var(--trj-muted)' }, text:'aderência' })
    ]);
    geralChartWrap.appendChild(pctCentral);

    geralWrap.appendChild(geralChartWrap);
    geralWrap.appendChild(geralInfo);
    container.appendChild(geralWrap);

    U.donutChart(geralCanvas, [
      { label: 'Dentro do SLA', value: geral.dentro, cor: COR_DENTRO },
      { label: 'Fora do SLA',   value: geral.fora,   cor: COR_FORA   }
    ]);

    // ── SEÇÃO 2: Por Prioridade (grid 2 linhas × 3 colunas) ─────────────
    var sectionPrio = U.h('div', { class:'trj-card p-5 mb-5' });
    sectionPrio.appendChild(U.h('h3', { style:{ fontWeight:'700', fontSize:'14px', marginBottom:'16px' }, text:'ADERÊNCIA POR PRIORIDADE' }));

    var prioGrid = U.h('div', {
      style: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'16px' }
    });

    porPrioridade.forEach(function (p) {
      var corPct = p.pct >= 90 ? COR_DENTRO : p.pct >= 70 ? COR_ORANGE : COR_FORA;
      var total  = p.dentro + p.fora;

      // Card de cada prioridade
      var card = U.h('div', {
        style: { background:'var(--trj-card2)', borderRadius:'12px', padding:'16px', display:'flex',
                 flexDirection:'column', alignItems:'center', gap:'8px', cursor:'pointer',
                 border:'1px solid var(--trj-border)', transition:'box-shadow .15s' },
        onclick: function () {}
      });
      card.addEventListener('mouseenter', function(){ card.style.boxShadow='0 4px 18px rgba(0,0,0,.3)'; });
      card.addEventListener('mouseleave', function(){ card.style.boxShadow=''; });

      // Título da prioridade
      card.appendChild(U.h('div', { style:{ fontWeight:'700', fontSize:'13px', color:'var(--trj-muted)', textTransform:'uppercase', letterSpacing:'.05em' }, text: p.prioridade }));

      // Wrapper do canvas + percentual central
      var wrap = U.h('div', { style:{ position:'relative', width:'140px', height:'140px' } });
      var cnv  = U.h('canvas', { style:{ width:'140px', height:'140px' } });
      wrap.appendChild(cnv);

      var centro = U.h('div', {
        style:{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-55%)',
                textAlign:'center', pointerEvents:'none' }
      }, [
        U.h('div', { style:{ fontSize:'20px', fontWeight:'800', color:corPct, lineHeight:'1' }, text: p.pct + '%' }),
        U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)' }, text:'aderência' })
      ]);
      wrap.appendChild(centro);
      card.appendChild(wrap);

      // Info embaixo
      card.appendChild(U.h('div', { style:{ fontSize:'11px', textAlign:'center', color:'var(--trj-muted)' } }, [
        U.h('span', { text:'Prazo: ' }),
        U.h('b', { style:{ color:'var(--trj-fg)' }, text: p.prazoHoras + 'h' }),
        U.h('span', { text:'  ·  ' }),
        U.h('b', { style:{ color:corPct }, text: p.dentro + '/' + total })
      ]));

      // Barras de progresso (mini)
      var barW = total > 0 ? Math.round((p.dentro / total) * 100) : 0;
      card.appendChild(U.h('div', { style:{ width:'100%', background:'rgba(231,76,60,.25)', borderRadius:'4px', height:'5px', overflow:'hidden' } }, [
        U.h('div', { style:{ width: barW + '%', background:COR_DENTRO, height:'100%', borderRadius:'4px', transition:'width .4s' } })
      ]));

      prioGrid.appendChild(card);

      // Renderizar donut sem legenda (info já está no card)
      U.donutChart(cnv, [
        { label: 'Dentro', value: p.dentro, cor: COR_DENTRO },
        { label: 'Fora',   value: p.fora,   cor: COR_FORA   }
      ], {
        onSlice: function (i) {
          var lado = i === 0 ? 'dentro' : 'fora';
          app.openDrillTasks({ tipo: 'prioridadeSla', arg: p.prioridade + '|' + lado }, {},
            (lado === 'fora' ? 'FORA SLA: ' : 'DENTRO SLA: ') + p.prioridade);
        }
      });
    });

    sectionPrio.appendChild(prioGrid);
    container.appendChild(sectionPrio);

    // ── SEÇÃO 3: Por Região (tabela) ─────────────────────────────────────
    var thead = U.h('thead', null, U.h('tr', null,
      ['Região','Total','Dentro','Fora','Aderência','Progresso'].map(function (t) { return U.h('th', { text:t }); })));

    var tbody = U.h('tbody', null, porRegiao.map(function (r) {
      var corR  = r.pct >= 90 ? COR_DENTRO : r.pct >= 70 ? COR_ORANGE : COR_FORA;
      var total = r.dentro + r.fora;
      var barW  = total > 0 ? Math.round((r.dentro / total) * 100) : 0;
      return U.h('tr', { style:{ cursor:'pointer' },
        onclick: function () { app.openDrillTasks({ tipo: 'regiaoSla', arg: r.regiao + '|fora' }, {}, 'FORA SLA: ' + r.label); }
      }, [
        U.h('td', { text: (C.REGIAO_LABELS[r.regiao] || r.label || r.regiao) }),
        U.h('td', { text: U.fmtNum(total) }),
        U.h('td', { style:{ color:COR_DENTRO, fontWeight:'700' }, text: U.fmtNum(r.dentro) }),
        U.h('td', { style:{ color:COR_FORA,   fontWeight:'700' }, text: U.fmtNum(r.fora)   }),
        U.h('td', { html: '<b style="color:'+corR+';font-size:15px">' + r.pct + '%</b>' }),
        U.h('td', null, U.h('div', { style:{ width:'120px', background:'rgba(231,76,60,.2)', borderRadius:'4px', height:'6px', overflow:'hidden' } }, [
          U.h('div', { style:{ width: barW+'%', background:COR_DENTRO, height:'100%', borderRadius:'4px', transition:'width .4s' } })
        ]))
      ]);
    }));

    container.appendChild(U.h('div', { class:'trj-card p-5' }, [
      U.h('h3', { style:{ fontWeight:'700', fontSize:'14px', marginBottom:'14px' }, text:'ADERÊNCIA POR REGIÃO  (clique para detalhar fora do SLA)' }),
      U.h('div', { style:{ overflowX:'auto' } }, U.h('table', { class:'trj-table' }, [thead, tbody]))
    ]));
  };
})(window.TRJ = window.TRJ || {});
