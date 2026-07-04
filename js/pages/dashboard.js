/* Página: Dashboard */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants, Comp = TRJ.compute;
  var state = { regiao: 'TODAS', prioridade: 'TODAS' };

  TRJ.pages.dashboard = function (container, ctx) {
    var data = ctx.data, app = ctx.app;
    if (!data) { container.appendChild(U.h('div', { class: 'trj-card p-6', text: 'Sem dados carregados.' })); return; }

    // Calcula o dashboard. Se algo vier vazio/indefinido, usamos defaults
    // defensivos para nunca quebrar a renderização (ex.: kpis.foraSla).
    var d = Comp.dashboard(data.tasksEnriched, data.incidentsEnriched, state) || {};
    var f = state;
    var K = d.kpis || {};
    var topCidades = d.topCidades || { totalSitesFora: 0, porAnf: [], cidades: [] };

    // Publica automaticamente uma "foto" SEM FILTROS (visão completa, não
    // o que o operador estiver filtrando agora) pro link público de
    // visualização — silencioso, não bloqueia a tela nem mostra erro.
    publicarSnapshotPublico(data);

    // ---- filtros + ações ----
    var selReg = U.h('select', { class: 'trj-select', style: { width: 'auto' }, onchange: function () { state.regiao = this.value; app.render(); } },
      [U.h('option', { value: 'TODAS', text: 'Todas as regiões' })].concat(C.REGIOES.map(function (r) {
        return U.h('option', { value: r, text: C.REGIAO_LABELS[r] || r, selected: f.regiao === r ? 'selected' : null });
      })));
    var selPri = U.h('select', { class: 'trj-select', style: { width: 'auto' }, onchange: function () { state.prioridade = this.value; app.render(); } },
      [U.h('option', { value: 'TODAS', text: 'Todas as prioridades' })].concat(C.PRIORIDADES.map(function (p) {
        return U.h('option', { value: p, text: p, selected: f.prioridade === p ? 'selected' : null });
      })));
    var btnWa = U.h('button', { class: 'trj-btn trj-btn-ghost', text: '📱 Copiar resumo', onclick: function () { copiarResumo(d); } });
    var btnExcel = U.h('button', {
      class: 'trj-btn clickable',
      style: { background: 'rgba(33,115,70,.18)', color: '#2e7d46', border: '1px solid rgba(33,115,70,.4)', fontWeight: '700', gap: '6px', transition: 'all .2s ease' },
      onclick: function () { exportarExcelDashboard(d, data); },
      onmouseenter: function (ev) { ev.currentTarget.style.background = 'rgba(33,115,70,.35)'; ev.currentTarget.style.borderColor = '#2e7d46'; ev.currentTarget.style.boxShadow = '0 4px 14px rgba(33,115,70,.3)'; },
      onmouseleave: function (ev) { ev.currentTarget.style.background = 'rgba(33,115,70,.18)'; ev.currentTarget.style.borderColor = 'rgba(33,115,70,.4)'; ev.currentTarget.style.boxShadow = ''; }
    }, [
      U.h('svg', { width: '15', height: '15', viewBox: '0 0 24 24', fill: '#2e7d46', style: { flexShrink: '0' } }, [
        U.h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
        U.h('polyline', { fill: 'none', stroke: 'rgba(33,115,70,.25)', 'stroke-width': '1.5', points: '14 2 14 8 20 8' }),
        U.h('line', { fill: 'none', stroke: '#fff', 'stroke-width': '1.5', x1: '8', y1: '13', x2: '16', y2: '21' }),
        U.h('line', { fill: 'none', stroke: '#fff', 'stroke-width': '1.5', x1: '16', y1: '13', x2: '8', y2: '21' })
      ]),
      U.h('span', { text: 'Extrair Excel' })
    ]);
    var btnRef = U.h('button', { class: 'trj-btn trj-btn-primary', html: app.icon('refresh') + ' Atualizar', onclick: function () { app.refresh(); } });
    var right = U.h('div', { class: 'flex items-center gap-2 flex-wrap' }, [selReg, selPri, btnWa, btnExcel, btnRef]);
    var atualizadoEm = d.atualizadoEm ? new Date(d.atualizadoEm).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    container.appendChild(U.pageHeader('Dashboard Operacional', 'Atualizado em ' + atualizadoEm, right));

    // ---- KPIs ----
    var kpiDefs = [
      { label: 'Fora do SLA', value: U.fmtNum(K.foraSla), cor: C.CORES_TRJ.red, spec: { tipo: 'foraSla' }, t: 'Backlog fora do SLA' },
      { label: 'Backlog Total', value: U.fmtNum(K.backlogTotal), cor: C.CORES_TRJ.orange, spec: { tipo: 'backlogTotal' }, t: 'Backlog total' },
      { label: 'Backlog Indefinido', value: U.fmtNum(K.backlogIndef), cor: C.CORES_TRJ.red, spec: { tipo: 'backlogIndef' }, t: 'Backlog sem SLA definido' },
      { label: 'Preditiva', value: U.fmtNum(K.preditiva), cor: C.CORES_TRJ.orange, spec: { tipo: 'preditiva' }, t: 'Atividades preditivas' },
      { label: 'Produtividade (Concluídas)', value: U.fmtNum(K.produtividade), cor: C.CORES_TRJ.green, spec: { tipo: 'produtividade' }, t: 'TSKs concluídas' },
      { label: 'SLA Geral (Concluídas)', value: U.fmtPct(K.slaGeral), cor: C.CORES_TRJ.green, spec: { tipo: 'produtividade' }, t: 'TSKs concluídas — % dentro do prazo' }
    ];
    var kpiGrid = U.h('div', { class: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5' }, kpiDefs.map(function (k) {
      return U.kpiCard({ label: k.label, value: k.value, cor: k.cor, onClick: k.spec ? function () { app.openDrillTasks(k.spec, f, k.t); } : null });
    }));
    container.appendChild(kpiGrid);

    // ---- charts grid ----
    var aging = U.chartCard('AGING DO BACKLOG');
    // ============================================================
    // HELPERS COMPARTILHADOS DE CÓPIA
    // ============================================================
    function fmtMinutos(min) {
      if (min <= 0) return 'VENCIDO';
      if (min < 60) return min + 'min';
      var h = Math.floor(min/60), m = min%60;
      return h + 'h' + (m > 0 ? m + 'min' : '');
    }

    function calcUpdateStr(motivoCancelamento) {
      if (!motivoCancelamento) return 'SEM ATUALIZAÇÃO';
      if (U.isTextoSemAtualizacao && U.isTextoSemAtualizacao(motivoCancelamento))
        return 'SEM ATUALIZAÇÃO';
      var DT_RE = /(\d{4}[\/\-]\d{2}[\/\-]\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s+\d{1,2}:\d{2}(?::\d{2})?)/g;
      var t = (motivoCancelamento||'').toString(), matches = [], m;
      while ((m = DT_RE.exec(t)) !== null) {
        var dt = U.parseDataHoraBG ? U.parseDataHoraBG(m[1]) : null;
        if (dt && !isNaN(dt.getTime())) matches.push(dt);
      }
      if (!matches.length) return 'SEM ATUALIZAÇÃO';
      var maisRec = matches.reduce(function(a,b){ return a>b?a:b; });
      var diffMin = Math.round((Date.now() - maisRec.getTime()) / 60000);
      if (diffMin < 0) return 'ATUALIZADO AGORA';
      if (diffMin < 60) return 'ATUALIZADO A ' + diffMin + 'min';
      var h = Math.floor(diffMin/60), mn = diffMin%60;
      return 'ATUALIZADO A ' + h + 'h' + (mn > 0 ? mn + 'min' : '');
    }

    function prioLabel(t) {
      return t && t.prioridade ? '*' + t.prioridade + '*' : '';
    }

    function copyText(txt) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt)
          .then(function(){ U.toast('✓ Copiado!', 'ok'); })
          .catch(function(){ _fb(txt); });
      } else { _fb(txt); }
      function _fb(s) {
        var ta = document.createElement('textarea');
        ta.value = s; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); U.toast('✓ Copiado!', 'ok'); }
        catch(e){ U.toast('Não foi possível copiar.','err'); }
        document.body.removeChild(ta);
      }
    }

    // ============================================================
    // SITES FORA — geração de texto para cópia
    // ============================================================
    function gerarTextoSitesFora(regiaoFiltro) {
      var incAtivos = (pageData.incidentsEnriched || []).filter(function(inc){
        return (inc.statusTrat||'').toUpperCase() !== 'RESOLVIDO' &&
               (!regiaoFiltro || (inc.regiao||'OTHERS') === regiaoFiltro);
      });
      var tasksEnriched = pageData.tasksEnriched || [];
      var regioesMapa = {};
      incAtivos.forEach(function(inc){
        var r = inc.regiao || 'OTHERS';
        if (!regioesMapa[r]) regioesMapa[r] = [];
        regioesMapa[r].push(inc);
      });

      var linhas = [];
      Object.keys(regioesMapa).sort().forEach(function(r){
        var regLabel = (C.REGIAO_LABELS[r] || r).toUpperCase();
        linhas.push('*' + regLabel + '*');
        linhas.push('*SITES FORA NA FILA*');

        var comTSK = [], semTSK = [];
        regioesMapa[r].forEach(function(inc){
          var tsk = U.tskAberta ? U.tskAberta(inc, tasksEnriched) : null;
          if (tsk) {
            var tf = tasksEnriched.filter(function(t){ return t.osNumero === tsk.osNumero; })[0];
            comTSK.push({inc:inc, tsk:tsk, tf:tf});
          } else semTSK.push(inc);
        });

        // --- TSK first ---
        comTSK.forEach(function(item){
          var tsk = item.tsk, tf = item.tf;
          var prio = tf && tf.prioridade ? '*' + tf.prioridade + '* ' : '';
          var tskNum = tsk.osNumero || 'SEM TSK';
          var site = (tf && tf.siteId) || item.inc.site || '—';
          var upd = calcUpdateStr((tf||{}).motivoCancelamento || (tsk||{}).motivoCancelamento);
          linhas.push(prio + tskNum + ' / ' + site + ' · ' + upd);
        });

        // --- Sem TSK ---
        semTSK.forEach(function(inc){
          var hor = inc.horario || '—';
          var site = inc.site || '—';
          var tec = inc.tecnologia ? ' (' + inc.tecnologia + ')' : '';
          linhas.push(hor + ' · SEM TSK · ' + site + tec);
        });

        linhas.push('');
      });
      return linhas.join('\n').trim();
    }

    // ============================================================
    // PRAZOS A VENCER — geração de texto
    // (definidas ANTES dos botões que as chamam)
    // ============================================================
    function gerarTextoPrazosRegiao(regiaoFiltro) {
      var now = Date.now();
      var tasksVenc = (pageData.tasksEnriched || []).filter(function(t){
        return t.statusSla === 'DENTRO DO SLA' && t.vencimentoCalc &&
               (!regiaoFiltro || (t.regiao||'OTHERS') === regiaoFiltro);
      });
      var regioesMapa = {};
      tasksVenc.forEach(function(t){
        var r = t.regiao||'OTHERS';
        if(!regioesMapa[r]) regioesMapa[r]=[];
        regioesMapa[r].push(t);
      });
      var linhas = [];
      Object.keys(regioesMapa).sort().forEach(function(r){
        var regLabel = (C.REGIAO_LABELS[r]||r).toUpperCase();
        linhas.push('*' + regLabel + '*');
        var arr = regioesMapa[r].slice().sort(function(a,b){
          var pa = parseInt((a.prioridade||'P9').replace(/\D/g,''),10)||9;
          var pb = parseInt((b.prioridade||'P9').replace(/\D/g,''),10)||9;
          if(pa!==pb) return pa-pb;
          return new Date(a.vencimentoCalc).getTime()-new Date(b.vencimentoCalc).getTime();
        });
        arr.forEach(function(t){
          var prio = t.prioridade ? '*' + t.prioridade + '* ' : '';
          var tsk  = t.osNumero || '—';
          var site = t.siteId || t.enderecoId || '—';
          var falha = (t.tipoFalha||'—').toUpperCase();
          var rest = Math.round((new Date(t.vencimentoCalc).getTime()-now)/60000);
          var tempoStr = rest<=0 ? 'VENCIDO' : 'VENCE EM '+fmtMinutos(rest);
          linhas.push(prio + [tsk, site, falha, tempoStr].filter(Boolean).join(' · '));
        });
        linhas.push('');
      });
      return linhas.join('\n').trim();
    }
    function gerarTextoPrazosTodasRegioes() { return gerarTextoPrazosRegiao(null); }

    // Prazos a Vencer — botão copiar (ao lado do título)
    var vencBtnCopiar = U.h('button', {
      class: 'trj-btn trj-btn-ghost clickable',
      style: { fontSize: '11px', padding: '2px 9px', display: 'inline-flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(255,255,255,.15)' },
      onclick: function(){ copyText(gerarTextoPrazosTodasRegioes()); }
    }, [U.h('span',{text:'📋'}), U.h('span',{text:'Copiar'})]);
    var venc = U.chartCard('PRAZOS A VENCER', { hint: null, rightEl: vencBtnCopiar });

    // ============================================================
    // SITES FORA — toggle + botão copiar todos
    // ============================================================
    var sfAgrupar = { value: false };
    var switchSf = U.switch(false, 'AGRUPAR POR END_ID', function(v){ sfAgrupar.value = v; });

    var btnCopiarTodosSF = U.h('button', {
      class: 'trj-btn trj-btn-ghost clickable',
      style: { fontSize: '11px', padding: '2px 9px', display: 'inline-flex', alignItems: 'center', gap: '5px', border: '1px solid rgba(255,255,255,.15)' },
      onclick: function(){ copyText(gerarTextoSitesFora(null)); }
    }, [U.h('span',{text:'📋'}), U.h('span',{text:'Copiar'})]);

    var sfControls = U.h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } }, [switchSf, btnCopiarTodosSF]);
    var sites = U.chartCard('SITES FORA POR REGIÃO', { rightEl: sfControls });
    var slaReg = U.chartCard('SLA POR REGIÃO');
    var manu = U.chartCard('ATIVIDADES MANUAIS', { hint: 'inclui cancelamentos' });
    var prod = U.chartCard('PRODUTIVIDADE — ENCERRADAS DENTRO/FORA DO SLA');
    var grid = U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5' }, [aging.card, venc.card, sites.card, slaReg.card, manu.card, prod.card]);
    container.appendChild(grid);

    // ---- top cidades ----
    container.appendChild(buildTopCidades(topCidades, app));

    // ---- desenha charts (canvas já no DOM) ----

    var aData = d.aging || [], vData = d.prazosVencimento || [], sfData = d.sitesForaRegiao || [], srData = d.slaPorRegiao || [], amData = d.atividadesManuais || [], pData = d.produtividade || [];
    U.barChart(aging.canvas, aData, { onBar: function (i) { app.openDrillTasks({ tipo: 'aging', arg: i }, f, 'AGING: ' + aData[i].label); } });
    U.hbarChart(venc.canvas, vData, { onBar: function (i) {
      var bucket = vData[i];
      var regiaoFiltro = null;
      // Cópia só do período do drill
      var onCopyDrill = function () {
        var now = Date.now();
        var b = C.VENCIMENTO_BUCKETS[i];
        var tasks = (pageData.tasksEnriched || []).filter(function(t){
          if(t.statusSla!=='DENTRO DO SLA'||!t.vencimentoCalc) return false;
          var rest=Math.round((new Date(t.vencimentoCalc).getTime()-now)/60000);
          return rest>=0 && rest>=b.min && rest<b.max;
        });
        var linhas = ['*' + ('A VENCER: ' + (bucket.label||'')).toUpperCase() + '*', ''];
        var regioesMapa = {};
        tasks.forEach(function(t){ var r=t.regiao||'OTHERS'; if(!regioesMapa[r]) regioesMapa[r]=[]; regioesMapa[r].push(t); });
        Object.keys(regioesMapa).sort().forEach(function(r){
          linhas.push('*' + (C.REGIAO_LABELS[r]||r).toUpperCase() + '*');
          var arr = regioesMapa[r].slice().sort(function(a,b2){
            var pa=parseInt((a.prioridade||'P9').replace(/\D/g,''),10)||9;
            var pb=parseInt((b2.prioridade||'P9').replace(/\D/g,''),10)||9;
            return pa!==pb?pa-pb:new Date(a.vencimentoCalc).getTime()-new Date(b2.vencimentoCalc).getTime();
          });
          arr.forEach(function(t){
            var prio=t.prioridade?'*'+t.prioridade+'* ':'';
            var rest2=Math.round((new Date(t.vencimentoCalc).getTime()-now)/60000);
            var cid=(t.cidade||t.cidadeUf||'').replace(/\s*\/.*$/,'').trim().toUpperCase();
            linhas.push(prio+(t.osNumero||'—')+' · '+(t.siteId||t.enderecoId||'—')+' · '+(t.tipoFalha||'—').toUpperCase()+' · VENCE EM '+fmtMinutos(rest2));
          });
          linhas.push('');
        });
        return linhas.join('\n').trim();
      };
      app.openDrillTasks({ tipo: 'vencimento', arg: i }, f, 'A VENCER: ' + (bucket.label||''), {}, onCopyDrill);
    }});
    U.barChart(sites.canvas, sfData.map(function (x) { return { label: x.label.toUpperCase(), total: x.total, cor: C.CORES_TRJ.red }; }), {
      onBar: function (i) {
        var tipo = sfAgrupar.value ? 'sitesForaAgrupado' : 'sitesFora';
        var regiao = sfData[i].regiao;
        var titulo = 'SITES FORA: ' + (sfData[i].label||'').toUpperCase();
        app.openDrillIncidents({ tipo: tipo, arg: regiao }, titulo, {
          onCopy: function(){ return gerarTextoSitesFora(regiao); }
        });
      }
    });
    U.stackedChart(slaReg.canvas, srData, { onSeg: function (i, ds) { var r = srData[i]; app.openDrillTasks({ tipo: 'slaRegiao', arg: r.regiao + '|' + (ds === 1 ? 'fora' : 'dentro') }, f, 'SLA ' + r.label); } });
    U.donutChart(manu.canvas, amData, {
      cores: C.DONUT_CORES,
      onSlice: function (i) {
        var nm = amData[i].name;
        var ehCancel = nm.indexOf('Cancel.') === 0;
        var spec = ehCancel
          ? { tipo: 'cancelCorretiva', arg: nm.indexOf('Associa') >= 0 ? 'assoc' : 'auto' }
          : { tipo: 'atividades', arg: argAtiv(nm) };
        app.openDrillTasks(spec, f, nm, ehCancel ? { modoCancelamento: true } : {});
      }
    });
    U.stackedChart(prod.canvas, pData.map(function (p) { return { label: p.categoria, dentro: p.dentro, fora: p.fora, preditiva: p.preditiva }; }), {
      onSeg: function (i, ds) {
        var cat = pData[i].categoria;
        var lado = ds === 2 ? 'preditiva' : (ds === 1 ? 'fora' : 'dentro');
        var titulo = 'Produtividade ' + cat + (ds === 2 ? ' — Preditiva' : (ds === 1 ? ' — Fora do SLA' : ' — Dentro do SLA'));
        app.openDrillTasks({ tipo: 'produtividadeCat', arg: cat + '|' + lado }, f, titulo, { modoResultado: true });
      }
    });

    // Botões de região no Prazos a Vencer — APÓS todos os charts estarem renderizados
    // (gerarTextoPrazosRegiao já está definida acima — botão vencBtnCopiar funciona sem buildVencRegioeBtns)
    try { if (typeof buildVencRegioeBtns === 'function') buildVencRegioeBtns(); } catch (e) { /* opcional */ }
  };

  function argAtiv(name) {
    if (/WO/i.test(name)) return 'wo';
    if (/Prevent/i.test(name)) return 'prev';
    if (/Conjunta/i.test(name)) return 'conj';
    return 'outras';
  }

  // Publica uma "foto" do Dashboard SEM FILTROS (visão completa da
  // equipe) pro link público de visualização. Best-effort: nunca trava a
  // tela nem mostra erro pro operador, e só manda de novo se algo mudou
  // desde a última publicação (evita gravação repetida sem necessidade).
  // Publica os dados BRUTOS (tarefas + incidentes) pro link público de
  // visualização — não os números já calculados, pra a página pública
  // poder filtrar por região e abrir os drills igual ao painel principal.
  // Best-effort: nunca trava a tela nem mostra erro pro operador, e só
  // manda de novo se algo mudou desde a última publicação.
  var _ultimoSnapshotJSON = null;

  // Reduz cada tarefa enriquecida a só os campos que o dashboard público
  // (compute.js + ui.js, rodando de novo do zero em cima do snapshot)
  // realmente lê. Sem isso, o JSON publicado vinha gigante: testei com
  // 270 tarefas reais e deu ~770KB só de tasksEnriched — boa parte disso
  // é a coluna "Diário de Trabalho" (motivoCancelamento), que pode ter
  // até ~10 mil caracteres em uma única tarefa cancelada. Como só
  // importa saber se contém "ASSOCIAÇÃO DE ATIVIDADES" ou não, mantemos
  // o MESMO nome de campo (pra não mudar nada em compute.js) só que com
  // o texto cortado pro essencial.
  function slimTaskForPublish(t) {
    var motivo = (t.motivoCancelamento || '').toString();
    var motivoSlim = /ASSOCIA/i.test(motivo) ? 'ASSOCIAÇÃO DE ATIVIDADES' : (motivo ? 'AUTOMACAO' : '');
    return {
      osNumero: t.osNumero, sequenciaId: t.sequenciaId, tipoAtividade: t.tipoAtividade,
      status: t.status, filaAtual: t.filaAtual, prioridade: t.prioridade,
      dataCriacao: t.dataCriacao, enderecoId: t.enderecoId, siteId: t.siteId,
      cidade: t.cidade, regiao: t.regiao, tipoFalha: t.tipoFalha,
      vencimentoCalc: t.vencimentoCalc, fimCalc: t.fimCalc,
      statusSla: t.statusSla, fonteSla: t.fonteSla, motivoCancelamento: motivoSlim
    };
  }

  function publicarSnapshotPublico(data) {
    try {
      var payload = {
        tasksEnriched: (data.tasksEnriched || []).map(slimTaskForPublish),
        incidentsEnriched: data.incidentsEnriched || []
      };
      var jsonStr = JSON.stringify(payload);
      if (jsonStr === _ultimoSnapshotJSON) return;
      _ultimoSnapshotJSON = jsonStr;
      TRJ.api.saveDashboardSnapshot(payload).catch(function () {});
    } catch (e) { /* nunca deixa a publicação quebrar o Dashboard */ }
  }

  function buildTopCidades(tc, app) {
    var porAnf = tc.porAnf || [], cidades = tc.cidades || [];

    var anfList = U.h('div', { class: 'flex flex-wrap gap-2 mb-4' }, porAnf.map(function (a) {
      var chip = U.h('button', {
        class: 'trj-btn trj-btn-ghost',
        style: { fontSize: '12px', transition: 'all .2s ease' },
        onclick: function () { app.openDrillIncidents({ tipo: 'anf', arg: a.anfRaw }, a.anf); }
      }, [
        U.h('span', { class: 'font-bold', text: a.anf }),
        U.h('span', { style: { color: 'var(--trj-primary)', marginLeft: '6px' }, text: String(a.total) }),
        U.h('span', { style: { color: 'var(--trj-muted)', marginLeft: '4px', fontSize: '11px' }, text: '(' + a.pct + '%)' })
      ]);
      chip.addEventListener('mouseenter', function () { chip.style.transform = 'translateY(-2px)'; chip.style.borderColor = 'rgba(255,140,0,.6)'; chip.style.boxShadow = '0 6px 16px rgba(255,140,0,.2)'; });
      chip.addEventListener('mouseleave', function () { chip.style.transform = ''; chip.style.borderColor = ''; chip.style.boxShadow = ''; });
      return chip;
    }));

    var bars = U.h('div', { class: 'flex flex-col gap-1' }, cidades.slice(0, 15).map(function (c) {
      var barra = U.h('div', { style: { width: c.pct + '%', height: '8px', borderRadius: '6px', background: 'var(--trj-primary)', transition: 'all .2s ease' } });
      var item = U.h('div', { style: { cursor: 'pointer', padding: '5px 8px', borderRadius: '8px', transition: 'background .18s ease' } }, [
        U.h('div', { class: 'flex justify-between text-xs mb-1' }, [
          U.h('span', { style: { fontWeight: '600' }, text: c.cidade }),
          U.h('span', { style: { color: 'var(--trj-primary)', fontWeight: '700' }, text: String(c.total) })
        ]),
        U.h('div', { style: { background: 'rgba(255,255,255,.07)', borderRadius: '6px', height: '8px', overflow: 'hidden' } }, barra)
      ]);
      item.addEventListener('mouseenter', function () {
        item.style.background = 'rgba(255,140,0,.1)';
        barra.style.background = 'var(--trj-primary2)';
        barra.style.boxShadow = '0 0 10px rgba(255,140,0,.5)';
      });
      item.addEventListener('mouseleave', function () { item.style.background = ''; barra.style.background = 'var(--trj-primary)'; barra.style.boxShadow = ''; });
      item.addEventListener('click', function () { app.openDrillIncidents({ tipo: 'cidade', arg: c.cidade }, c.cidade); });
      return item;
    }));

    var total = U.h('div', {
      class: 'trj-card p-5 flex flex-col items-center justify-center clickable',
      style: { minWidth: '180px', cursor: 'pointer', transition: 'box-shadow .15s', border: '2px solid transparent' },
      title: 'Clique para ver todos os sites fora',
      onclick: function () { app.openDrillIncidents({ tipo: 'sitesFora', arg: null }, 'TODOS OS SITES FORA'); }
    }, [
      U.h('div', { class: 'text-xs uppercase', style: { color: 'var(--trj-muted)' }, text: 'TOTAL SITES FORA' }),
      U.h('div', { class: 'font-extrabold', style: { fontSize: '56px', color: C.CORES_TRJ.red, lineHeight: '1', textShadow: '0 0 20px rgba(231,76,60,.4)' }, text: U.fmtNum(tc.totalSitesFora) }),
      U.h('div', { style: { fontSize: '10px', color: 'var(--trj-muted)', marginTop: '4px' }, text: '▼ ver incidentes' })
    ]);
    return U.h('div', { class: 'trj-card p-4' }, [
      U.h('div', { class: 'flex items-center gap-2 mb-3' }, [
        U.h('span', { class: 'trj-chart-dot' }),
        U.h('h3', { class: 'text-sm font-bold', text: 'TOP CIDADES — SITES FORA' }),
        U.h('span', { class: 'text-xs font-normal', style: { color: 'var(--trj-muted)' }, text: '(clique em qualquer cidade ou ANF para detalhar)' })
      ]),
      U.h('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-4' }, [
        total,
        U.h('div', { class: 'lg:col-span-2' }, [anfList, bars])
      ])
    ]);
  }

  function copiarResumo(d) {
    var K = d.kpis || {};
    var tc = d.topCidades || {};
    var linhas = [
      '*Controle TRJ — Resumo*',
      'Fora do SLA: ' + (K.foraSla || 0),
      'Backlog Total: ' + (K.backlogTotal || 0),
      'Backlog Indef.: ' + (K.backlogIndef || 0),
      'Preditiva: ' + (K.preditiva || 0),
      'Produtividade (Concluídas): ' + (K.produtividade || 0),
      'SLA Geral (Concluídas): ' + (K.slaGeral || 0) + '%',
      'Sites fora: ' + (tc.totalSitesFora || 0),
      'Atualizado: ' + new Date(d.atualizadoEm || Date.now()).toLocaleString('pt-BR')
    ];
    var txt = linhas.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { U.toast('Resumo copiado!', 'ok'); }, function () { U.toast('Não foi possível copiar.', 'err'); });
    else U.toast('Cópia não suportada neste navegador.', 'err');
  }

  // Extrai todos os dados do Dashboard (KPIs + todos os gráficos) num único
  // arquivo Excel, uma aba por bloco — pra quem preferir analisar fora do site.
  function exportarExcelDashboard(d, pageData) {
    if (typeof XLSX === 'undefined') { U.toast('Biblioteca de Excel não carregou. Recarregue a página.', 'err'); return; }
    var wb = XLSX.utils.book_new();
    var dom = TRJ.domain;
    var now = new Date();

    // Aplica formatação básica na aba: freeze do cabeçalho + larguras de coluna
    function formatarAba(ws, colWidths) {
      // Congelar primeira linha
      if (!ws['!freeze']) ws['!freeze'] = { ySplit: 1 };
      // Larguras das colunas
      if (colWidths && colWidths.length) {
        ws['!cols'] = colWidths.map(function(w){ return { wch: w }; });
      }
    }

    function aba(nome, aoa, colWidths) {
      var ws = XLSX.utils.aoa_to_sheet(aoa);
      formatarAba(ws, colWidths);
      XLSX.utils.book_append_sheet(wb, ws, nome.slice(0, 31));
    }

    function abaLista(nome, rows, cols, colWidths) {
      var hdr = cols.map(function (c) { return (c.h||'').toUpperCase(); });
      var aoa = [hdr];
      (rows || []).forEach(function (r) {
        aoa.push(cols.map(function (c) {
          var v = r[c.k];
          if (v == null) return '';
          if (c.dt && v) { try { return new Date(v).toLocaleString('pt-BR'); } catch(e){ return v; } }
          return v;
        }));
      });
      aba(nome, aoa, colWidths || cols.map(function(){ return 18; }));
    }

    // ---- KPIs ----
    var K = d.kpis || {};
    var tc = d.topCidades || {};
    aba('DASHBOARD', [
      ['INDICADOR', 'VALOR'],
      ['FORA DO SLA', K.foraSla || 0],
      ['BACKLOG TOTAL', K.backlogTotal || 0],
      ['BACKLOG INDEFINIDO', K.backlogIndef || 0],
      ['PREDITIVA', K.preditiva || 0],
      ['PRODUTIVIDADE (CONCLUÍDAS)', K.produtividade || 0],
      ['SLA GERAL (%)', K.slaGeral || 0],
      ['SITES FORA (TOTAL)', tc.totalSitesFora || 0],
      ['EXTRAÍDO EM', now.toLocaleString('pt-BR')]
    ], [40, 20]);

    var tasksE = (pageData && pageData.tasksEnriched) || [];
    var incE   = (pageData && pageData.incidentsEnriched) || [];
    var sep    = dom.separarTicketsManuais(tasksE);
    var ticketsCorretiva = sep.tickets, manuaisFull = sep.manuais;

    var colsTask = [
      { k:'osNumero', h:'TSK', w:20 }, { k:'status', h:'STATUS', w:14 }, { k:'prioridade', h:'PRIORIDADE', w:12 },
      { k:'regiao', h:'REGIÃO', w:16 }, { k:'cidade', h:'CIDADE', w:20 }, { k:'enderecoId', h:'END_ID', w:16 },
      { k:'siteId', h:'SITE', w:16 }, { k:'tipoFalha', h:'TIPO FALHA', w:22 }, { k:'filaAtual', h:'FILA ATUAL', w:40 },
      { k:'dataCriacao', h:'CRIAÇÃO', w:18, dt:1 }, { k:'vencimentoCalc', h:'VENCIMENTO SLA', w:18, dt:1 },
      { k:'statusSla', h:'STATUS SLA', w:16 }, { k:'tipoAtividade', h:'TIPO ATIVIDADE', w:30 }
    ];

    // ---- Backlog ----
    abaLista('BACKLOG', tasksE.filter(function(t){ return dom.isBacklogStatus(t.status); }),
      colsTask, colsTask.map(function(c){ return c.w||18; }));

    // ---- Concluídas ----
    abaLista('CONCLUÍDAS', ticketsCorretiva.filter(function(t){
      var s=(t.status||'').toUpperCase().trim(); return s==='CONCLUÍDA'||s==='CONCLUIDA';
    }), [
      {k:'osNumero',h:'TSK',w:20},{k:'status',h:'STATUS',w:14},{k:'prioridade',h:'PRIORIDADE',w:12},
      {k:'regiao',h:'REGIÃO',w:16},{k:'cidade',h:'CIDADE',w:20},{k:'enderecoId',h:'END_ID',w:16},
      {k:'siteId',h:'SITE',w:16},{k:'tipoFalha',h:'TIPO FALHA',w:22},{k:'filaAtual',h:'FILA ATUAL',w:40},
      {k:'dataCriacao',h:'CRIAÇÃO',w:18,dt:1},{k:'fimCalc',h:'ENCERRAMENTO',w:18,dt:1},
      {k:'vencimentoCalc',h:'VENCIMENTO SLA',w:18,dt:1},{k:'statusSla',h:'STATUS SLA',w:16}
    ].map(function(c){ return c; }), null);

    // ---- Canceladas ----
    abaLista('CANCELADAS', ticketsCorretiva.filter(function(t){
      var s=(t.status||'').toUpperCase().trim(); return s==='CANCELADA'||s==='CANCELADO';
    }).map(function(t){
      var m=(t.motivoCancelamento||'').toString().toUpperCase();
      return Object.assign({},t,{tipoCancelamento:m.indexOf('ASSOCIA')>=0?'ASSOCIAÇÃO':'AUTOMAÇÃO'});
    }), [
      {k:'osNumero',h:'TSK',w:20},{k:'tipoCancelamento',h:'TIPO CANCELAMENTO',w:20},{k:'prioridade',h:'PRIORIDADE',w:12},
      {k:'regiao',h:'REGIÃO',w:16},{k:'cidade',h:'CIDADE',w:20},{k:'enderecoId',h:'END_ID',w:16},
      {k:'siteId',h:'SITE',w:16},{k:'tipoFalha',h:'TIPO FALHA',w:22},{k:'filaAtual',h:'FILA ATUAL',w:40},
      {k:'dataCriacao',h:'CRIAÇÃO',w:18,dt:1}
    ], null);

    // ---- Atividades Manuais ----
    abaLista('ATIVIDADES MANUAIS', manuaisFull, [
      {k:'osNumero',h:'TSK',w:20},{k:'tipoAtividade',h:'TIPO ATIVIDADE',w:30},{k:'status',h:'STATUS',w:14},
      {k:'regiao',h:'REGIÃO',w:16},{k:'cidade',h:'CIDADE',w:20},{k:'enderecoId',h:'END_ID',w:16},
      {k:'siteId',h:'SITE',w:16},{k:'filaAtual',h:'FILA ATUAL',w:40},{k:'dataCriacao',h:'CRIAÇÃO',w:18,dt:1}
    ], null);

    // ---- Sites Fora (detalhado) ----
    var incAtivos = incE.filter(function(i){ return (i.statusTrat||'ATIVO').toUpperCase()!=='RESOLVIDO'; });
    abaLista('SITES FORA', incAtivos, [
      {k:'horario',h:'HORÁRIO',w:12},{k:'downtime',h:'DURAÇÃO',w:10},{k:'site',h:'SITE',w:20},
      {k:'enderecoId',h:'END_ID',w:16},{k:'anf',h:'ANF',w:8},{k:'cidadeUf',h:'CIDADE/UF',w:22},
      {k:'regiao',h:'REGIÃO',w:16},{k:'tecnologia',h:'TECNOLOGIA',w:12},
      {k:'causa',h:'CAUSA',w:30},{k:'causaGrupo',h:'CAUSA GRUPO',w:20},
      {k:'detalhe',h:'DETALHE',w:40},{k:'previsao',h:'PREVISÃO',w:14},
      {k:'statusTrat',h:'STATUS TRAT.',w:16},{k:'infra',h:'INFRA',w:14},{k:'peso',h:'PESO',w:8}
    ], null);

    // ---- Backlog por região (resumo) ----
    abaLista('SLA POR REGIÃO', d.slaPorRegiao||[], [
      {k:'label',h:'REGIÃO',w:20},{k:'dentro',h:'DENTRO DO SLA',w:16},{k:'fora',h:'FORA DO SLA',w:16}
    ], [20,16,16]);

    abaLista('PRAZOS A VENCER', d.prazosVencimento||[], [
      {k:'label',h:'FAIXA',w:14},{k:'total',h:'TOTAL',w:10}
    ], [14,10]);

    abaLista('AGING BACKLOG', d.aging||[], [
      {k:'label',h:'FAIXA',w:14},{k:'total',h:'TOTAL',w:10}
    ], [14,10]);

    abaLista('SITES FORA POR REGIÃO', d.sitesForaRegiao||[], [
      {k:'label',h:'REGIÃO',w:20},{k:'total',h:'TOTAL',w:10}
    ], [20,10]);

    abaLista('PRODUTIVIDADE', d.produtividade||[], [
      {k:'categoria',h:'CATEGORIA',w:20},{k:'dentro',h:'DENTRO DO SLA',w:16},
      {k:'fora',h:'FORA DO SLA',w:16},{k:'preditiva',h:'PREDITIVA',w:14}
    ], null);

    var ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    XLSX.writeFile(wb, 'Dashboard_TRJ_' + ts + '.xlsx');
    U.toast('Excel exportado com ' + (tasksE.length+incAtivos.length) + ' registros em ' + wb.SheetNames.length + ' abas!', 'ok');
  }
    if (typeof XLSX === 'undefined') { U.toast('Biblioteca de Excel não carregou. Recarregue a página.', 'err'); return; }

})(window.TRJ = window.TRJ || {});
