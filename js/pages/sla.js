/* Página: SLA / Aderência */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  /* Metas por prioridade (conforme especificado) */
  var META_PRIO = { P1: 80, P2: 75, P3: 70, P4: 70, P5: 70 };
  var COR_DENTRO = C.CORES_TRJ.green;   /* #2ecc71 */
  var COR_FORA   = C.CORES_TRJ.red;     /* #e74c3c */
  var COR_WARN   = C.CORES_TRJ.orange;  /* #ff8c00 */

  function corPrioridade(prio, pct) {
    var meta = META_PRIO[prio] || 70;
    return pct >= meta ? COR_DENTRO : COR_FORA;
  }
  function corGeral(pct) {
    return pct >= 80 ? COR_DENTRO : pct >= 65 ? COR_WARN : COR_FORA;
  }

  /* Donut direto no Chart.js — sem legenda, sem anotações externas */
  function mkDonut(canvas, dentro, fora, onClick) {
    var border = '#13131a';
    if (!window.Chart) return;
    new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Dentro do SLA', 'Fora do SLA'],
        datasets: [{ data: [dentro, fora],
          backgroundColor: [COR_DENTRO, COR_FORA],
          hoverBackgroundColor: ['#27ae60','#c0392b'],
          borderColor: border, borderWidth: 3
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: function(c) {
            var tot = dentro + fora;
            return ' ' + c.label + ': ' + c.raw + (tot>0 ? ' ('+Math.round(c.raw/tot*100)+'%)' : '');
          }}
        }},
        onClick: onClick ? function(ev, els) { if (els && els.length) onClick(els[0].index); } : undefined,
        animation: { duration: 500 }
      }
    });
  }

  /* ═══════════════════════════════════════════════════════════════ */
  TRJ.pages.sla = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) {
      container.appendChild(U.h('div', { class:'trj-card p-6 text-center', text:'Sem dados.' }));
      return;
    }

    var tasks  = data.tasksEnriched || [];
    var estado = { regiao:'TODAS', prioridade:'TODAS' };

    container.appendChild(U.pageHeader('SLA / Aderência',
      'Aderência por prioridade e região. Clique para detalhar.'));

    /* ── Filtros ───────────────────────────────────────────────── */
    function mkSelect(options) {
      var sel = U.h('select', { class:'trj-select',
        style:{ padding:'6px 12px', fontSize:'12px', cursor:'pointer',
                minWidth:'160px', borderRadius:'8px' }
      }, options.map(function(o){ return U.h('option', { value:o.v, text:o.t }); }));
      return sel;
    }

    var selReg  = mkSelect(
      [{ v:'TODAS', t:'Todas as regiões' }]
      .concat(C.REGIOES.filter(function(r){ return r !== 'OTHERS'; })
              .map(function(r){ return { v:r, t:C.REGIAO_LABELS[r]||r }; })));
    var selPrio = mkSelect(
      [{ v:'TODAS', t:'Todas as prioridades' }]
      .concat(['P1','P2','P3','P4','P5'].map(function(p){ return { v:p, t:p }; })));

    /* Legenda de cores */
    function legItem(cor, label) {
      return U.h('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--trj-muted)' } }, [
        U.h('span', { style:{ width:'10px', height:'10px', borderRadius:'50%', background:cor, display:'inline-block' } }),
        U.h('span', { text: label })
      ]);
    }

    var topBar = U.h('div', {
      style:{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', marginBottom:'18px' }
    }, [
      selReg, selPrio,
      U.h('div', { style:{ marginLeft:'auto', display:'flex', gap:'14px' } }, [
        legItem(COR_DENTRO, 'Dentro do SLA'),
        legItem(COR_FORA,   'Fora do SLA')
      ])
    ]);
    container.appendChild(topBar);

    var area = U.h('div');
    container.appendChild(area);

    /* ── Renderização principal ────────────────────────────────── */
    function render() {
      area.innerHTML = '';

      /* Filtrar tasks */
      var tf = tasks.filter(function(t) {
        if (estado.regiao    !== 'TODAS' && (t.regiao    || 'OTHERS') !== estado.regiao)    return false;
        if (estado.prioridade !== 'TODAS' && (t.prioridade || '')     !== estado.prioridade) return false;
        return true;
      });

      var d   = Comp.slaPage(tf, data.prazoMap) || {};
      var por = d.porPrioridade || [];
      var reg = d.porRegiao     || [];
      var ger = d.geral         || { pct:0, dentro:0, fora:0 };

      /* ══════════════════════════════════════════════════════════
       * SEÇÃO 1: Aderência por Prioridade — cards grandes em linha
       * ══════════════════════════════════════════════════════════ */
      var sec1 = U.h('div', { class:'trj-card p-5 mb-5' });
      sec1.appendChild(U.h('div', {
        style:{ fontWeight:'800', fontSize:'12px', letterSpacing:'.08em',
                color:'var(--trj-muted)', textTransform:'uppercase', marginBottom:'16px' }
      }, 'ADERÊNCIA POR PRIORIDADE'));

      var grid = U.h('div', {
        style:{ display:'grid',
                gridTemplateColumns:'repeat(' + Math.max(por.length, 1) + ', 1fr)',
                gap:'14px' }
      });

      por.forEach(function(p) {
        var total  = p.dentro + p.fora;
        var cor    = corPrioridade(p.prioridade, p.pct);
        var meta   = META_PRIO[p.prioridade] || 70;

        var card = U.h('div', {
          style:{ background:'var(--trj-card2)', borderRadius:'14px',
                  padding:'20px 16px 16px', display:'flex', flexDirection:'column',
                  alignItems:'center', border:'1px solid var(--trj-border)',
                  transition:'all .2s ease', cursor:'pointer', gap:'4px' }
        });
        card.addEventListener('mouseenter', function(){
          card.style.borderColor = cor;
          card.style.boxShadow   = '0 6px 28px rgba(0,0,0,.45)';
          card.style.transform   = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', function(){
          card.style.borderColor = 'var(--trj-border)';
          card.style.boxShadow   = '';
          card.style.transform   = '';
        });

        /* Label prioridade */
        card.appendChild(U.h('div', {
          style:{ fontWeight:'800', fontSize:'15px', letterSpacing:'.04em',
                  color:'var(--trj-muted)', alignSelf:'flex-start', marginBottom:'6px' }
        }, p.prioridade));

        /* Área do donut — quadrada, preenchendo largura */
        var donutArea = U.h('div', { style:{ position:'relative', width:'100%', aspectRatio:'1/1' } });
        var cnv = U.h('canvas', { style:{ position:'absolute', inset:'0', width:'100%', height:'100%' } });
        donutArea.appendChild(cnv);

        /* Percentual centralizado (posicionado via CSS transform) */
        var centro = U.h('div', {
          style:{ position:'absolute', top:'50%', left:'50%',
                  transform:'translate(-50%,-56%)', textAlign:'center',
                  pointerEvents:'none' }
        }, [
          U.h('div', {
            style:{ fontSize:'clamp(22px,3.8vw,32px)', fontWeight:'800',
                    color:cor, lineHeight:'1', letterSpacing:'-.02em' },
            text: p.pct + '%'
          }),
          U.h('div', { style:{ fontSize:'10px', color:'var(--trj-muted)', marginTop:'3px' }, text:'aderência' })
        ]);
        donutArea.appendChild(centro);

        /* Números dentro/fora nos cantos inferiores */
        function numCorner(val, label, cor2, side) {
          return U.h('div', {
            style:{ position:'absolute', bottom:'10%', [side]:'6%',
                    textAlign: side === 'left' ? 'left' : 'right', pointerEvents:'none' }
          }, [
            U.h('div', { style:{ fontSize:'clamp(16px,2.6vw,22px)', fontWeight:'800', color:cor2, lineHeight:'1' }, text:String(val) }),
            U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)', textTransform:'uppercase', marginTop:'2px' }, text:label })
          ]);
        }
        donutArea.appendChild(numCorner(p.dentro, 'dentro', COR_DENTRO, 'left'));
        donutArea.appendChild(numCorner(p.fora,   'fora',   COR_FORA,   'right'));

        card.appendChild(donutArea);

        /* Linha: prazo / total / meta */
        card.appendChild(U.h('div', {
          style:{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', width:'100%',
                  marginTop:'12px', gap:'4px' }
        }, [
          U.h('div', { style:{ fontSize:'11px', color:'var(--trj-muted)' } }, [
            U.h('div', { text:'Prazo' }), U.h('b', { style:{ fontSize:'13px', color:'var(--trj-fg)' }, text: p.prazoHoras + 'h' })
          ]),
          U.h('div', { style:{ fontSize:'11px', color:'var(--trj-muted)', textAlign:'center' } }, [
            U.h('div', { text:'Total' }), U.h('b', { style:{ fontSize:'13px', color:'var(--trj-fg)' }, text:String(total) })
          ]),
          U.h('div', { style:{ fontSize:'11px', color:'var(--trj-muted)', textAlign:'right' } }, [
            U.h('div', { text:'Meta' }), U.h('b', { style:{ fontSize:'13px', color: p.pct>=meta?COR_DENTRO:COR_FORA }, text: meta + '%' })
          ])
        ]));

        grid.appendChild(card);

        /* Donut */
        mkDonut(cnv, p.dentro, p.fora, function(i) {
          var lado = i===0 ? 'dentro' : 'fora';
          app.openDrillTasks({ tipo:'prioridadeSla', arg:p.prioridade+'|'+lado }, {},
            (lado==='fora'?'FORA SLA: ':'DENTRO SLA: ') + p.prioridade);
        });
      });

      sec1.appendChild(grid);
      area.appendChild(sec1);

      /* ══════════════════════════════════════════════════════════
       * SEÇÃO 2: Aderência por Região
       *   LEFT  → UM donut grande (Aderência Geral)
       *   RIGHT → linhas de região com TOTAL / DENTRO / FORA / ADERÊNCIA
       * ══════════════════════════════════════════════════════════ */
      var sec2 = U.h('div', { class:'trj-card p-5' });
      sec2.appendChild(U.h('div', {
        style:{ fontWeight:'800', fontSize:'12px', letterSpacing:'.08em',
                color:'var(--trj-muted)', textTransform:'uppercase', marginBottom:'16px' }
      }, 'ADERÊNCIA POR REGIÃO'));

      var regLayout = U.h('div', {
        style:{ display:'flex', gap:'28px', alignItems:'flex-start', flexWrap:'wrap' }
      });

      /* ── Donut Geral (esquerda) ── */
      var gerCor   = corGeral(ger.pct);
      var gerTotal = ger.dentro + ger.fora;
      var geralSide = U.h('div', {
        style:{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
                minWidth:'160px', flexShrink:'0' }
      });

      var gerWrap = U.h('div', { style:{ position:'relative', width:'160px', height:'160px' } });
      var gerCnv  = U.h('canvas', { style:{ width:'160px', height:'160px' } });
      gerWrap.appendChild(gerCnv);
      gerWrap.appendChild(U.h('div', {
        style:{ position:'absolute', top:'50%', left:'50%',
                transform:'translate(-50%,-50%)', textAlign:'center', pointerEvents:'none' }
      }, [
        U.h('div', { style:{ fontSize:'24px', fontWeight:'800', color:gerCor, lineHeight:'1' }, text: ger.pct + '%' }),
        U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)', marginTop:'3px' }, text:'aderência' })
      ]));
      geralSide.appendChild(gerWrap);
      geralSide.appendChild(U.h('div', {
        style:{ textAlign:'center', fontSize:'11px', color:'var(--trj-muted)', lineHeight:'1.6' }
      }, [
        U.h('div', { style:{ fontWeight:'700', color:'var(--trj-fg)', fontSize:'12px' }, text:'ADERÊNCIA GERAL' }),
        U.h('div', null, [
          U.h('span', { style:{ color:COR_DENTRO, fontWeight:'700' }, text: String(ger.dentro) }),
          U.h('span', { text:' dentro / ' }),
          U.h('span', { style:{ color:COR_FORA, fontWeight:'700' }, text: String(ger.fora) }),
          U.h('span', { text:' fora' })
        ]),
        U.h('div', { text:'Total: ' + gerTotal })
      ]));
      regLayout.appendChild(geralSide);
      mkDonut(gerCnv, ger.dentro, ger.fora, null);

      /* ── Linhas de região (direita) ── */
      var regTable = U.h('div', { style:{ flex:'1', minWidth:'300px' } });

      /* Cabeçalho */
      regTable.appendChild(U.h('div', {
        style:{ display:'grid', gridTemplateColumns:'1fr 70px 70px 70px 80px',
                padding:'0 8px 8px', gap:'8px', borderBottom:'1px solid var(--trj-border)',
                fontSize:'10px', fontWeight:'700', color:'var(--trj-muted)', textTransform:'uppercase', letterSpacing:'.05em' }
      }, [
        U.h('div', { text:'REGIÃO' }),
        U.h('div', { style:{ textAlign:'center' }, text:'TOTAL' }),
        U.h('div', { style:{ textAlign:'center' }, text:'DENTRO' }),
        U.h('div', { style:{ textAlign:'center' }, text:'FORA' }),
        U.h('div', { style:{ textAlign:'right'  }, text:'ADERÊNCIA' })
      ]));

      reg.forEach(function(r) {
        var rTotal = r.dentro + r.fora;
        var rCor   = corGeral(r.pct);
        var label  = (C.REGIAO_LABELS[r.regiao] || r.label || r.regiao || '').toUpperCase();

        var row = U.h('div', {
          style:{ display:'grid', gridTemplateColumns:'1fr 70px 70px 70px 80px',
                  padding:'10px 8px', gap:'8px', borderBottom:'1px solid rgba(255,255,255,.05)',
                  cursor:'pointer', transition:'background .15s', borderRadius:'4px', alignItems:'center' }
        });
        row.addEventListener('mouseenter', function(){ row.style.background='rgba(255,255,255,.04)'; });
        row.addEventListener('mouseleave', function(){ row.style.background=''; });
        row.addEventListener('click', function() {
          app.openDrillTasks({ tipo:'regiaoSla', arg:r.regiao+'|fora' }, {}, 'FORA SLA: ' + label);
        });

        row.appendChild(U.h('div', { style:{ fontWeight:'600', fontSize:'13px' }, text: label }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontSize:'14px', fontWeight:'700' }, text: String(rTotal) }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontSize:'14px', fontWeight:'700', color:COR_DENTRO }, text: String(r.dentro) }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontSize:'14px', fontWeight:'700', color:COR_FORA   }, text: String(r.fora)   }));
        row.appendChild(U.h('div', { style:{ textAlign:'right',  fontSize:'15px', fontWeight:'800', color:rCor        }, text: r.pct + '%'     }));
        regTable.appendChild(row);
      });

      regLayout.appendChild(regTable);
      sec2.appendChild(regLayout);
      area.appendChild(sec2);
    }

    selReg.addEventListener('change',  function(){ estado.regiao    = selReg.value;  render(); });
    selPrio.addEventListener('change', function(){ estado.prioridade = selPrio.value; render(); });
    render();
  };

})(window.TRJ = window.TRJ || {});
