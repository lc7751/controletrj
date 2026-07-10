/* Página: SLA / Aderência — v3 */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;

  var META_PRIO = { P1:80, P2:75, P3:70, P4:70, P5:70 };
  var COR_D  = C.CORES_TRJ.green;   // #2ecc71  dentro
  var COR_F  = C.CORES_TRJ.red;     // #e74c3c  fora
  var COR_W  = C.CORES_TRJ.orange;  // #ff8c00  warning
  var COR_D_LIGHT = '#4dd87e';       // hover dentro — levemente mais clara
  var COR_F_LIGHT = '#f06960';       // hover fora   — levemente mais clara
  var COR_LABEL = 'var(--trj-muted)';

  function pctCor(pct, prio) {
    var meta = prio ? (META_PRIO[prio]||70) : 70;
    return pct >= meta ? COR_D : COR_F;
  }
  function clarear(hex) { return hex === COR_D ? COR_D_LIGHT : COR_F_LIGHT; }

  /* ── Plugin glow: ilumina a fatia ativa ── */
  var glowPlugin = {
    id: 'glowOnHover',
    afterDraw: function(chart) {
      var active = chart._active;
      if (!active || !active.length) return;
      var ctx = chart.ctx;
      var el  = chart.getDatasetMeta(0).data[active[0].index];
      if (!el) return;
      var cor = el.options.backgroundColor;
      ctx.save();
      ctx.shadowColor  = cor;
      ctx.shadowBlur   = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      el.draw(ctx);
      ctx.restore();
    }
  };

  /* ── Criar donut ─────────────────────────────────────────────────────
   *  • hover: clareia (não escurece) + hoverOffset
   *  • sem tooltip (valores já visíveis no centro)
   *  • glow na fatia ativa via plugin
   *  • centro: mostra dentro/fora dinamicamente no hover
   * ─────────────────────────────────────────────────────────────────── */
  function mkDonut(canvas, dentro, fora, opts) {
    opts = opts || {};
    if (!window.Chart) return;
    var total = dentro + fora;
    var border = '#0e0e16';

    // Elemento de centro (atualizado no hover)
    var centroEl = opts.centroEl || null;

    var ch = new window.Chart(canvas, {
      type: 'doughnut',
      plugins: [glowPlugin],
      data: {
        labels: ['Dentro do SLA', 'Fora do SLA'],
        datasets: [{
          data: [dentro, fora],
          backgroundColor:      [COR_D, COR_F],
          hoverBackgroundColor: [COR_D_LIGHT, COR_F_LIGHT],
          hoverOffset: 10,
          borderColor:      border,
          hoverBorderColor: border,
          borderWidth:  3,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }   // tooltips desativados — valores no centro
        },
        hover: { mode: 'nearest' },
        onHover: function(ev, els) {
          if (!centroEl) return;
          if (els && els.length) {
            var idx = els[0].index;
            var val = idx === 0 ? dentro : fora;
            var lab = idx === 0 ? 'DENTRO' : 'FORA';
            var cor = idx === 0 ? COR_D : COR_F;
            centroEl.innerHTML = '<div style="font-size:clamp(18px,2.8vw,26px);font-weight:800;color:'+cor+';line-height:1">' + val + '</div>'
                               + '<div style="font-size:10px;color:var(--trj-muted);margin-top:2px">' + lab + '</div>';
          } else {
            // Restaurar percentual
            if (centroEl._pctHtml) centroEl.innerHTML = centroEl._pctHtml;
          }
        },
        onClick: opts.onClick ? function(ev, els) {
          if (els && els.length) opts.onClick(els[0].index);
        } : undefined,
        animation: { duration: 500, easing: 'easeInOutCubic' }
      }
    });
    return ch;
  }

  /* ══════════════════════════════════════════════════════════════════ */
  TRJ.pages.sla = function(container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class:'trj-card p-6 text-center', text:'Sem dados.' })); return; }

    var tasks  = data.tasksEnriched || [];
    var estado = { regiao:'TODAS', prioridade:'TODAS' };

    container.appendChild(U.pageHeader('SLA / Aderência',
      'Aderência por prioridade e região. Clique para detalhar.'));

    /* ── Filtros ───────────────────────────────────────────────────── */
    function mkSel(options) {
      return U.h('select', { class:'trj-select',
        style:{ padding:'6px 12px', fontSize:'12px', cursor:'pointer',
                minWidth:'168px', borderRadius:'8px' }
      }, options.map(function(o){ return U.h('option', { value:o.v, text:o.t }); }));
    }
    var selReg  = mkSel([{ v:'TODAS', t:'Todas as regiões' }]
      .concat(C.REGIOES.filter(function(r){ return r!=='OTHERS'; })
              .map(function(r){ return { v:r, t:C.REGIAO_LABELS[r]||r }; })));
    var selPrio = mkSel([{ v:'TODAS', t:'Todas as prioridades' }]
      .concat(['P1','P2','P3','P4','P5'].map(function(p){ return { v:p, t:p }; })));

    function leg(cor, txt) {
      return U.h('div', { style:{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', color:'var(--trj-muted)' } }, [
        U.h('span', { style:{ width:'10px', height:'10px', borderRadius:'50%', background:cor, display:'inline-block' } }),
        U.h('span', { text:txt })
      ]);
    }
    container.appendChild(U.h('div', {
      style:{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap', marginBottom:'18px' }
    }, [ selReg, selPrio,
      U.h('div', { style:{ marginLeft:'auto', display:'flex', gap:'14px' } }, [
        leg(COR_D,'Dentro do SLA'), leg(COR_F,'Fora do SLA')
      ])
    ]));

    var area = U.h('div');
    container.appendChild(area);

    /* ══════════════════════════════════════════════════════════════════
     * RENDER PRINCIPAL
     * ══════════════════════════════════════════════════════════════════ */
    function render() {
      area.innerHTML = '';
      var tf = tasks.filter(function(t) {
        if (estado.regiao!=='TODAS' && (t.regiao||'OTHERS')!==estado.regiao) return false;
        if (estado.prioridade!=='TODAS' && (t.prioridade||'')!==estado.prioridade) return false;
        return true;
      });
      var d   = Comp.slaPage(tf, data.prazoMap) || {};
      var por = d.porPrioridade || [];
      var reg = d.porRegiao     || [];
      var ger = d.geral         || { pct:0, dentro:0, fora:0 };

      /* ════════════════════════════════════════════════════════════
       * SEÇÃO 1 — Aderência por Prioridade
       * ════════════════════════════════════════════════════════════ */
      var sec1 = U.h('div', { class:'trj-card p-5 mb-5' });
      sec1.appendChild(U.h('div', {
        style:{ fontWeight:'800', fontSize:'13px', letterSpacing:'.07em',
                color:'var(--trj-fg)', textTransform:'uppercase',
                marginBottom:'18px', borderBottom:'1px solid var(--trj-border)', paddingBottom:'10px' }
      }, 'ADERÊNCIA POR PRIORIDADE'));

      var grid = U.h('div', {
        style:{ display:'grid',
                gridTemplateColumns:'repeat('+Math.max(por.length,1)+',1fr)',
                gap:'14px' }
      });

      por.forEach(function(p) {
        var total = p.dentro + p.fora;
        var cor   = pctCor(p.pct, p.prioridade);
        var meta  = META_PRIO[p.prioridade]||70;

        // Card — hover SOMENTE no gráfico, card sem hover de borda
        var card = U.h('div', {
          style:{ background:'var(--trj-card2)', borderRadius:'14px',
                  padding:'18px 14px 14px', display:'flex', flexDirection:'column',
                  alignItems:'center', border:'1px solid var(--trj-border)',
                  position:'relative', overflow:'visible' }
        });

        /* Título prioridade — destaque */
        card.appendChild(U.h('div', {
          style:{ fontWeight:'900', fontSize:'16px', letterSpacing:'.06em',
                  color:'var(--trj-fg)', alignSelf:'flex-start',
                  marginBottom:'8px', textShadow:'0 0 18px rgba(255,255,255,.08)' }
        }, p.prioridade));

        /* Canvas wrapper — hover + glow no wrapper do gráfico */
        var cWrap = U.h('div', {
          style:{ position:'relative', width:'100%', aspectRatio:'1/1',
                  borderRadius:'50%',
                  filter:'drop-shadow(0 4px 14px rgba(0,0,0,.55))',
                  transition:'filter .25s' }
        });
        cWrap.addEventListener('mouseenter', function(){
          cWrap.style.filter = 'drop-shadow(0 0 14px '+cor+'66)';
        });
        cWrap.addEventListener('mouseleave', function(){
          cWrap.style.filter = 'drop-shadow(0 4px 14px rgba(0,0,0,.55))';
        });

        var cnv = U.h('canvas', {
          style:{ position:'absolute', inset:'0', width:'100%', height:'100%' }
        });
        cWrap.appendChild(cnv);

        /* Centro: percentual (substituído no hover por dentro/fora) */
        var centroEl = U.h('div', {
          style:{ position:'absolute', top:'50%', left:'50%',
                  transform:'translate(-50%,-52%)', textAlign:'center',
                  pointerEvents:'none', userSelect:'none', minWidth:'70px' }
        });
        var pctHtml = '<div style="font-size:clamp(20px,3.2vw,28px);font-weight:800;color:'+cor+';line-height:1;letter-spacing:-.02em">'
                    + p.pct+'%</div>'
                    + '<div style="font-size:10px;color:var(--trj-muted);margin-top:3px">aderência</div>';
        centroEl.innerHTML = pctHtml;
        centroEl._pctHtml  = pctHtml;
        cWrap.appendChild(centroEl);
        card.appendChild(cWrap);

        /* Dentro/Fora inline — abaixo do gráfico */
        card.appendChild(U.h('div', {
          style:{ display:'flex', justifyContent:'space-between', width:'100%',
                  marginTop:'12px', alignItems:'center' }
        }, [
          U.h('div', { style:{ fontSize:'13px', fontWeight:'700', color:COR_D } }, [
            U.h('b', { style:{ fontSize:'clamp(14px,2vw,18px)' }, text: String(p.dentro)+' ' }),
            U.h('span', { style:{ fontSize:'10px', fontWeight:'400', color:COR_LABEL }, text:'dentro' })
          ]),
          U.h('div', { style:{ fontSize:'13px', fontWeight:'700', color:COR_F } }, [
            U.h('b', { style:{ fontSize:'clamp(14px,2vw,18px)' }, text: String(p.fora)+' ' }),
            U.h('span', { style:{ fontSize:'10px', fontWeight:'400', color:COR_LABEL }, text:'fora' })
          ])
        ]));

        /* Rodapé: Prazo / Total / Meta na mesma linha, mesma cor */
        card.appendChild(U.h('div', {
          style:{ display:'flex', justifyContent:'space-between', width:'100%',
                  marginTop:'10px', paddingTop:'8px', borderTop:'1px solid var(--trj-border)',
                  color:COR_LABEL, fontSize:'11px' }
        }, [
          U.h('span', null, [
            U.h('b', { style:{ fontSize:'13px', color:'var(--trj-fg)' }, text: p.prazoHoras+'h ' }),
            U.h('span', { text:'prazo' })
          ]),
          U.h('span', { style:{ textAlign:'center' } }, [
            U.h('b', { style:{ fontSize:'13px', color:'var(--trj-fg)' }, text: String(total)+' ' }),
            U.h('span', { text:'total' })
          ]),
          U.h('span', { style:{ textAlign:'right' } }, [
            U.h('b', { style:{ fontSize:'13px', color:'var(--trj-fg)' }, text: meta+'% ' }),
            U.h('span', { text:'meta' })
          ])
        ]));

        grid.appendChild(card);
        mkDonut(cnv, p.dentro, p.fora, { centroEl: centroEl, onClick: function(i) {
          var lado = i===0 ? 'dentro' : 'fora';
          app.openDrillTasks({ tipo:'prioridadeSla', arg:p.prioridade+'|'+lado }, {},
            (lado==='fora'?'FORA SLA: ':'DENTRO SLA: ') + p.prioridade);
        }});
      });

      sec1.appendChild(grid);
      area.appendChild(sec1);

      /* ════════════════════════════════════════════════════════════
       * SEÇÃO 2 — Aderência por Região
       *   LEFT : donut geral (tamanho = 1 coluna do grid acima)
       *   RIGHT: tabela de regiões alinhada
       * ════════════════════════════════════════════════════════════ */
      var sec2 = U.h('div', { class:'trj-card p-5' });
      sec2.appendChild(U.h('div', {
        style:{ fontWeight:'800', fontSize:'13px', letterSpacing:'.07em',
                color:'var(--trj-fg)', textTransform:'uppercase',
                marginBottom:'16px', borderBottom:'1px solid var(--trj-border)', paddingBottom:'10px' }
      }, 'ADERÊNCIA POR REGIÃO'));

      var gerTotal = ger.dentro + ger.fora;
      var gerCor   = pctCor(ger.pct, null);

      var regLayout = U.h('div', {
        style:{ display:'flex', gap:'28px', alignItems:'flex-start' }
      });

      /* ── Donut geral à esquerda ── */
      var gerSide = U.h('div', {
        style:{ display:'flex', flexDirection:'column', alignItems:'center', gap:'10px',
                // mesma largura que 1 card de prioridade (aprox)
                width:'calc(20% - 12px)', minWidth:'140px', flexShrink:'0' }
      });

      var gerCWrap = U.h('div', {
        style:{ position:'relative', width:'100%', aspectRatio:'1/1',
                filter:'drop-shadow(0 4px 14px rgba(0,0,0,.55))',
                transition:'filter .25s' }
      });
      gerCWrap.addEventListener('mouseenter', function(){
        gerCWrap.style.filter = 'drop-shadow(0 0 14px '+gerCor+'66)';
      });
      gerCWrap.addEventListener('mouseleave', function(){
        gerCWrap.style.filter = 'drop-shadow(0 4px 14px rgba(0,0,0,.55))';
      });

      var gerCnv = U.h('canvas', { style:{ position:'absolute', inset:'0', width:'100%', height:'100%' } });
      gerCWrap.appendChild(gerCnv);

      var gerCentro = U.h('div', {
        style:{ position:'absolute', top:'50%', left:'50%',
                transform:'translate(-50%,-52%)', textAlign:'center',
                pointerEvents:'none', minWidth:'64px' }
      });
      var gerPctHtml = '<div style="font-size:clamp(18px,2.4vw,24px);font-weight:800;color:'+gerCor+';line-height:1">'
                     + ger.pct+'%</div>'
                     + '<div style="font-size:10px;color:var(--trj-muted);margin-top:3px">aderência</div>';
      gerCentro.innerHTML = gerPctHtml;
      gerCentro._pctHtml  = gerPctHtml;
      gerCWrap.appendChild(gerCentro);
      gerSide.appendChild(gerCWrap);

      /* Texto abaixo do donut geral */
      gerSide.appendChild(U.h('div', {
        style:{ textAlign:'center', lineHeight:'1.6', fontSize:'11px' }
      }, [
        U.h('div', { style:{ fontWeight:'800', fontSize:'12px', color:'var(--trj-fg)', letterSpacing:'.04em' }, text:'ADERÊNCIA GERAL' }),
        U.h('div', null, [
          U.h('b', { style:{ color:COR_D }, text: String(ger.dentro) }),
          U.h('span', { style:{ color:COR_LABEL }, text:' dentro / ' }),
          U.h('b', { style:{ color:COR_F }, text: String(ger.fora) }),
          U.h('span', { style:{ color:COR_LABEL }, text:' fora' })
        ]),
        U.h('div', { style:{ color:COR_LABEL }, text:'Total: '+gerTotal })
      ]));

      regLayout.appendChild(gerSide);
      mkDonut(gerCnv, ger.dentro, ger.fora, { centroEl: gerCentro });

      /* ── Tabela de regiões à direita ── */
      var tbl = U.h('div', { style:{ flex:'1', display:'flex', flexDirection:'column', justifyContent:'flex-start', padding:'0 32px' } });

      // Cabeçalho alinhado
      tbl.appendChild(U.h('div', {
        style:{ display:'grid',
                gridTemplateColumns:'1fr 60px 70px 60px 80px',
                padding:'0 8px 8px 8px', gap:'8px',
                borderBottom:'1px solid var(--trj-border)',
                fontSize:'10px', fontWeight:'700', letterSpacing:'.06em',
                color:COR_LABEL, textTransform:'uppercase' }
      }, ['REGIÃO','TOTAL','DENTRO','FORA','ADERÊNCIA'].map(function(t, i){
        return U.h('div', { style:{ textAlign: i===0?'left':'center' }, text:t });
      })));

      reg.forEach(function(r) {
        var rTotal = r.dentro + r.fora;
        var rCor   = pctCor(r.pct, null);
        var label  = (C.REGIAO_LABELS[r.regiao]||r.label||r.regiao||'').toUpperCase();

        var row = U.h('div', {
          style:{ display:'grid',
                  gridTemplateColumns:'1fr 60px 70px 60px 80px',
                  padding:'11px 8px', gap:'8px',
                  borderBottom:'1px solid rgba(255,255,255,.05)',
                  cursor:'pointer', transition:'background .15s', borderRadius:'6px',
                  alignItems:'center' }
        });
        row.addEventListener('mouseenter', function(){ row.style.background='rgba(255,255,255,.04)'; });
        row.addEventListener('mouseleave', function(){ row.style.background=''; });
        row.addEventListener('click', function(){
          app.openDrillTasks({ tipo:'regiaoSla', arg:r.regiao+'|fora' }, {}, 'FORA SLA: '+label);
        });

        row.appendChild(U.h('div', { style:{ fontWeight:'600', fontSize:'13px', color:'var(--trj-fg)' }, text:label }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontWeight:'700', fontSize:'14px', color:'var(--trj-fg)' }, text:String(rTotal) }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontWeight:'700', fontSize:'14px', color:COR_D }, text:String(r.dentro) }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontWeight:'700', fontSize:'14px', color:COR_F }, text:String(r.fora) }));
        row.appendChild(U.h('div', { style:{ textAlign:'center', fontWeight:'800', fontSize:'15px', color:rCor }, text:r.pct+'%' }));
        tbl.appendChild(row);
      });

      regLayout.appendChild(tbl);
      sec2.appendChild(regLayout);
      area.appendChild(sec2);
    }

    selReg.addEventListener('change',  function(){ estado.regiao     = selReg.value;  render(); });
    selPrio.addEventListener('change', function(){ estado.prioridade  = selPrio.value; render(); });
    render();
  };

})(window.TRJ = window.TRJ || {});
