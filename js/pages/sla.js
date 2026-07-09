/* Página: SLA / Aderência — redesign completo */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  var COR_DENTRO = '#2ecc71';
  var COR_FORA   = '#e74c3c';
  var COR_ORANGE = '#f0b429';

  function pctCor(pct) { return pct >= 90 ? COR_DENTRO : pct >= 70 ? COR_ORANGE : COR_FORA; }

  /* ── Cria donut via Chart.js (sem usar U.donutChart para ter controle total) ── */
  function mkDonut(canvas, dentro, fora, opts) {
    opts = opts || {};
    var total = dentro + fora;
    var pct   = total > 0 ? Math.round((dentro / total) * 100 * 10) / 10 : 0;
    var border = getComputedStyle(document.body).getPropertyValue('--trj-card').trim() || '#1a1a2a';

    if (window.Chart) {
      var ch = new window.Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Dentro do SLA', 'Fora do SLA'],
          datasets: [{ data: [dentro, fora],
            backgroundColor: [COR_DENTRO, COR_FORA],
            hoverBackgroundColor: ['#27ae60','#c0392b'],
            borderColor: border, borderWidth: 3, hoverBorderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '70%',
          plugins: { legend: { display: false }, tooltip: {
            callbacks: { label: function(ctx) { return ' ' + ctx.label + ': ' + ctx.raw + ' (' + (total>0?Math.round(ctx.raw/total*100):0) + '%)'; } }
          }},
          onClick: opts.onClick ? function(ev, els) { if (els && els.length) opts.onClick(els[0].index); } : undefined,
          animation: { duration: 600, easing: 'easeInOutQuart' }
        }
      });
      return { chart: ch, pct: pct };
    }
    return { pct: pct };
  }

  /* ── PÁGINA ─────────────────────────────────────────────────────────── */
  TRJ.pages.sla = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) {
      container.appendChild(U.h('div', { class: 'trj-card p-6 text-center', text: 'Sem dados para exibir.' }));
      return;
    }

    var tasks = data.tasksEnriched || [];
    var state = { regiao: 'TODAS', prioridade: 'TODAS' };

    container.appendChild(U.pageHeader('SLA / Aderência', 'Clique nas prioridades ou regiões para detalhar.'));

    /* ── Filtros ──────────────────────────────────────────────────────── */
    var selReg  = U.h('select', { class: 'trj-btn trj-btn-ghost', style: { fontSize:'12px', padding:'6px 14px', cursor:'pointer' } },
      [U.h('option', { value:'TODAS', text:'Todas as regiões' })]
      .concat(C.REGIOES.filter(function(r){ return r !== 'OTHERS'; }).map(function(r) {
        return U.h('option', { value: r, text: C.REGIAO_LABELS[r] || r });
      })));
    var selPrio = U.h('select', { class: 'trj-btn trj-btn-ghost', style: { fontSize:'12px', padding:'6px 14px', cursor:'pointer' } },
      [U.h('option', { value:'TODAS', text:'Todas as prioridades' })]
      .concat(['P1','P2','P3','P4','P5'].map(function(p) { return U.h('option', { value:p, text:p }); })));

    var conteudo = U.h('div');
    function renderTudo() {
      conteudo.innerHTML = '';
      var tf = tasks.filter(function(t) {
        if (state.regiao   !== 'TODAS' && (t.regiao   || 'OTHERS') !== state.regiao)   return false;
        if (state.prioridade !== 'TODAS' && (t.prioridade || '')    !== state.prioridade) return false;
        return true;
      });
      var d = Comp.slaPage(tf, data.prazoMap) || {};
      buildView(d);
    }

    selReg.addEventListener('change',  function(){ state.regiao    = selReg.value;  renderTudo(); });
    selPrio.addEventListener('change', function(){ state.prioridade = selPrio.value; renderTudo(); });

    container.appendChild(U.h('div', {
      style: { display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', marginBottom:'18px' }
    }, [
      U.h('span', { style:{ fontSize:'12px', color:'var(--trj-muted)' }, text:'Filtrar:' }),
      selReg, selPrio,
      /* Legenda */
      U.h('div', { style:{ marginLeft:'auto', display:'flex', gap:'14px', alignItems:'center', flexWrap:'wrap' } }, [
        U.h('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px' } }, [
          U.h('span', { style:{ width:'12px', height:'12px', borderRadius:'50%', background:COR_DENTRO, display:'inline-block' } }),
          U.h('span', { text:'Dentro do SLA' })
        ]),
        U.h('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px' } }, [
          U.h('span', { style:{ width:'12px', height:'12px', borderRadius:'50%', background:COR_FORA, display:'inline-block' } }),
          U.h('span', { text:'Fora do SLA' })
        ])
      ])
    ]));

    container.appendChild(conteudo);

    /* ── Construir view com os dados calculados ─────────────────────── */
    function buildView(d) {
      var porPrioridade = d.porPrioridade || [];
      var porRegiao     = d.porRegiao     || [];
      var geral         = d.geral         || { pct: 0, dentro: 0, fora: 0 };

      /* ════════════════════════════════════════════════════════════════
       * SEÇÃO 1: Aderência por Prioridade — cards grandes tipo Image 1
       * ════════════════════════════════════════════════════════════════ */
      var prioSection = U.h('div', { class:'trj-card p-5 mb-5' });
      prioSection.appendChild(U.h('div', {
        style:{ fontWeight:'800', fontSize:'13px', letterSpacing:'.07em', color:'var(--trj-muted)',
                textTransform:'uppercase', marginBottom:'18px' }
      }, 'ADERÊNCIA POR PRIORIDADE'));

      var prioRow = U.h('div', {
        style:{ display:'grid', gridTemplateColumns:'repeat(' + porPrioridade.length + ',1fr)', gap:'12px' }
      });

      porPrioridade.forEach(function(p) {
        var total  = p.dentro + p.fora;
        var cor    = pctCor(p.pct);

        var card = U.h('div', {
          style:{ background:'var(--trj-card2)', borderRadius:'14px', padding:'18px 14px',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:'0',
                  border:'1px solid var(--trj-border)', transition:'all .2s', cursor:'pointer',
                  position:'relative' }
        });
        card.addEventListener('mouseenter', function(){ card.style.boxShadow='0 6px 24px rgba(0,0,0,.4)'; card.style.borderColor=cor; });
        card.addEventListener('mouseleave', function(){ card.style.boxShadow=''; card.style.borderColor='var(--trj-border)'; });

        /* Título prioridade */
        card.appendChild(U.h('div', {
          style:{ fontWeight:'800', fontSize:'15px', letterSpacing:'.05em',
                  color:'var(--trj-muted)', marginBottom:'10px', alignSelf:'flex-start' }
        }, p.prioridade));

        /* Wrapper do donut com números sobrepostos */
        var chartArea = U.h('div', { style:{ position:'relative', width:'100%', paddingBottom:'100%' } });
        var cnv = U.h('canvas', { style:{ position:'absolute', inset:'0', width:'100%', height:'100%' } });
        chartArea.appendChild(cnv);

        /* Percentual centralizado */
        var centro = U.h('div', {
          style:{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-58%)',
                  textAlign:'center', pointerEvents:'none' }
        }, [
          U.h('div', { style:{ fontSize:'clamp(20px,3.5vw,30px)', fontWeight:'800', color:cor, lineHeight:'1.1' },
            text: p.pct + '%' }),
          U.h('div', { style:{ fontSize:'10px', color:'var(--trj-muted)', marginTop:'2px' }, text:'aderência' })
        ]);
        chartArea.appendChild(centro);

        /* Números dentro / fora nos cantos inferiores */
        var numDentro = U.h('div', {
          style:{ position:'absolute', bottom:'12px', left:'8px', textAlign:'left', pointerEvents:'none' }
        }, [
          U.h('div', { style:{ fontSize:'clamp(14px,2.2vw,20px)', fontWeight:'800', color:COR_DENTRO, lineHeight:'1' }, text: String(p.dentro) }),
          U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)', textTransform:'uppercase' }, text:'dentro' })
        ]);
        var numFora = U.h('div', {
          style:{ position:'absolute', bottom:'12px', right:'8px', textAlign:'right', pointerEvents:'none' }
        }, [
          U.h('div', { style:{ fontSize:'clamp(14px,2.2vw,20px)', fontWeight:'800', color:COR_FORA, lineHeight:'1' }, text: String(p.fora) }),
          U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)', textTransform:'uppercase' }, text:'fora' })
        ]);
        chartArea.appendChild(numDentro);
        chartArea.appendChild(numFora);
        card.appendChild(chartArea);

        /* Rodapé: prazo + total */
        card.appendChild(U.h('div', {
          style:{ display:'flex', justifyContent:'space-between', width:'100%', marginTop:'12px', fontSize:'11px', color:'var(--trj-muted)' }
        }, [
          U.h('span', null, [U.h('span', { text:'Prazo:  ' }),
            U.h('b', { style:{ color:'var(--trj-fg)', fontSize:'14px' }, text: p.prazoHoras + 'h' })]),
          U.h('span', null, [U.h('span', { text:'Total:  ' }),
            U.h('b', { style:{ color:'var(--trj-fg)', fontSize:'14px' }, text: String(total) })])
        ]));

        prioRow.appendChild(card);

        /* Renderizar donut */
        mkDonut(cnv, p.dentro, p.fora, {
          onClick: function(i) {
            var lado = i === 0 ? 'dentro' : 'fora';
            app.openDrillTasks({ tipo: 'prioridadeSla', arg: p.prioridade + '|' + lado }, {},
              (lado === 'fora' ? 'FORA SLA: ' : 'DENTRO SLA: ') + p.prioridade);
          }
        });
      });

      prioSection.appendChild(prioRow);
      conteudo.appendChild(prioSection);

      /* ════════════════════════════════════════════════════════════════
       * SEÇÃO 2: Aderência por Região — geral + regiões em linhas
       *          Cada linha: donut à esquerda, stats à direita
       * ════════════════════════════════════════════════════════════════ */
      var regSection = U.h('div', { class:'trj-card p-5' });
      regSection.appendChild(U.h('div', {
        style:{ fontWeight:'800', fontSize:'13px', letterSpacing:'.07em', color:'var(--trj-muted)',
                textTransform:'uppercase', marginBottom:'4px' }
      }, 'ADERÊNCIA POR REGIÃO'));

      function mkRegRow(label, dentro, fora, regiao, isGeral) {
        var total = dentro + fora;
        var pct   = total > 0 ? Math.round((dentro / total) * 100 * 10) / 10 : 0;
        var cor   = pctCor(pct);

        var row = U.h('div', {
          style:{ display:'flex', alignItems:'center', gap:'20px', padding:'14px 0',
                  borderBottom:'1px solid var(--trj-border)',
                  cursor: isGeral ? 'default' : 'pointer',
                  transition:'background .15s', borderRadius:'6px' }
        });
        if (!isGeral) {
          row.addEventListener('mouseenter', function(){ row.style.background='rgba(255,255,255,.03)'; });
          row.addEventListener('mouseleave', function(){ row.style.background=''; });
          row.addEventListener('click', function() {
            app.openDrillTasks({ tipo: 'regiaoSla', arg: regiao + '|fora' }, {}, 'FORA SLA: ' + label);
          });
        }

        /* Donut pequeno à esquerda */
        var donutWrap = U.h('div', {
          style:{ position:'relative', width:'90px', height:'90px', flexShrink:'0' }
        });
        var cnv = U.h('canvas', { style:{ width:'90px', height:'90px' } });
        donutWrap.appendChild(cnv);
        donutWrap.appendChild(U.h('div', {
          style:{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                  textAlign:'center', pointerEvents:'none' }
        }, [
          U.h('div', { style:{ fontSize:'14px', fontWeight:'800', color:cor, lineHeight:'1' }, text: pct + '%' }),
        ]));
        row.appendChild(donutWrap);

        /* Nome da região + stats */
        var info = U.h('div', { style:{ flex:'1', display:'flex', alignItems:'center', flexWrap:'wrap', gap:'8px 24px', minWidth:'0' } });
        info.appendChild(U.h('div', {
          style:{ minWidth:'140px', fontWeight:'700', fontSize:'14px',
                  color: isGeral ? 'var(--trj-primary)' : 'var(--trj-fg)' }
        }, label));

        function statBox(tit, val, cor2) {
          return U.h('div', { style:{ textAlign:'center' } }, [
            U.h('div', { style:{ fontSize:'clamp(16px,2vw,22px)', fontWeight:'800', color:cor2, lineHeight:'1' }, text: String(val) }),
            U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)', textTransform:'uppercase', marginTop:'3px' }, text: tit })
          ]);
        }
        info.appendChild(statBox('TOTAL',  total,  'var(--trj-fg)'));
        info.appendChild(statBox('DENTRO', dentro, COR_DENTRO));
        info.appendChild(statBox('FORA',   fora,   COR_FORA));
        info.appendChild(U.h('div', { style:{ textAlign:'center' } }, [
          U.h('div', { style:{ fontSize:'clamp(18px,2.2vw,26px)', fontWeight:'800', color:cor, lineHeight:'1' }, text: pct + '%' }),
          U.h('div', { style:{ fontSize:'9px', color:'var(--trj-muted)', textTransform:'uppercase', marginTop:'3px' }, text:'aderência' })
        ]));
        row.appendChild(info);

        /* Renderizar donut */
        mkDonut(cnv, dentro, fora, {
          onClick: isGeral ? null : function(i) {
            app.openDrillTasks({ tipo: 'regiaoSla', arg: regiao + '|' + (i===0?'dentro':'fora') }, {}, label);
          }
        });

        return row;
      }

      /* Linha Geral (primeira, destacada) */
      regSection.appendChild(mkRegRow('ADERÊNCIA GERAL', geral.dentro, geral.fora, null, true));

      /* Linhas por região */
      porRegiao.forEach(function(r) {
        var label = (C.REGIAO_LABELS[r.regiao] || r.label || r.regiao || '').toUpperCase();
        regSection.appendChild(mkRegRow(label, r.dentro, r.fora, r.regiao, false));
      });

      conteudo.appendChild(regSection);
    }

    renderTudo();
  };

})(window.TRJ = window.TRJ || {});
