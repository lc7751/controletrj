// compute.js (versão defensiva — preserva implementação original, sem logs de debug)
try {
  /* Agregacoes e enriquecimento (portado de app/api/*) */
  (function (TRJ) {
    var C = TRJ.constants;
    var D = TRJ.domain;
    var G = TRJ.genesis;
    var C2 = {};

    function up(s) { return (s == null ? '' : s).toString().toUpperCase().trim(); }
    function cidadeDe(cidadeUf) {
      if (!cidadeUf) return null;
      var parte = cidadeUf.split('/')[0];
      parte = parte ? parte.trim() : '';
      return parte || null;
    }
    function validFor(map, enderecoId, siteId) {
      if (!map) return null;
      var k1 = up(enderecoId), k2 = up(siteId);
      return (k1 && map[k1]) || (k2 && map[k2]) || null;
    }

    // ---- IDs presentes em tasks/incidents para o lookupCities ----
    function collectIds(tasks, incidents) {
      var set = {};
      (tasks || []).forEach(function (t) {
        if (t.enderecoId) set[up(t.enderecoId)] = true;
        if (t.siteId) set[up(t.siteId)] = true;
      });
      (incidents || []).forEach(function (r) {
        if (r.enderecoId) set[up(r.enderecoId)] = true;
        if (r.site) set[up(r.site)] = true;
      });
      return Object.keys(set);
    }

    // ---- Enriquecimento de TASKS (regiao/cidade/SLA) ----
    function enrichTasks(rawTasks, validMap, prazoMap, now) {
      now = now || new Date();
      return (rawTasks || []).map(function (t) {
        var v = validFor(validMap, t.enderecoId, t.siteId);
        var regiao = D.determinarRegiao(t.filaAtual, t.microarea, v);
        var cidade = (v && v.cidade) || cidadeDe(t.cidadeUf) || null;
        var prioridade = (t.prioridade || 'PADRAO') ? (t.prioridade || 'PADRAO') : 'PADRAO';
        var prazoHoras = (prazoMap && prazoMap[prioridade]) != null ? prazoMap[prioridade] : (C && C.SLA_PADRAO_HORAS && C.SLA_PADRAO_HORAS[prioridade]) || 72;
        var vencimento = null;
        if (t.dataVencimento) vencimento = new Date(t.dataVencimento);
        else if (t.dataCriacao) {
          vencimento = new Date(t.dataCriacao);
          vencimento.setHours(vencimento.getHours() + Number(prazoHoras));
        }
        var dentro = true;
        if (vencimento && now) dentro = vencimento >= now;
        return Object.assign({}, t, {
          regiao: regiao, cidade: cidade, prioridade: prioridade,
          prazoHoras: prazoHoras, vencimento: vencimento, dentro: dentro
        });
      });
    }

    // ---- Enriquecimento de INCIDENTS (sites fora) ----
    function enrichIncidents(rawInc, validMap) {
      return (rawInc || []).map(function (r) {
        var v = validFor(validMap, r.enderecoId, r.site);
        var regiao = D.determinarRegiao(r.fila, r.microarea, v);
        var cidade = (v && v.cidade) || cidadeDe(r.cidadeUf) || null;
        var anf = (r.anf != null) ? String(r.anf) : '';
        var ativo = !(r.statusTrat && r.statusTrat.toUpperCase && r.statusTrat.toUpperCase() === 'RESOLVIDO');
        return Object.assign({}, r, { regiao: regiao, cidade: cidade, anf: anf, ativo: ativo });
      });
    }

    // ---- Conversão GENESIS -> INCIDENTS (se necessário) ----
    function genesisToIncidents(parsed) {
      // parsed: { rows: [ { ... } ], meta: { } }
      if (!parsed || !parsed.rows) return [];
      return parsed.rows.map(function (r) {
        return {
          site: r.SITE || r.site || null,
          enderecoId: r.END_ID || r.enderecoId || null,
          statusTrat: r.STATUS || r.status || null,
          fila: r.FILA || r.fila || null,
          microarea: r.MICROAREA || r.microarea || null,
          cidadeUf: r.CIDADE || r.cidadeUf || null,
          anf: r.ANF || r.anf || null,
          inicio: r.INICIO || r.inicio || null,
          fim: r.FIM || r.fim || null,
          observacao: r.OBS || r.observacao || null
        };
      });
    }

    // ---- Dashboard / agregações ----
    function dashboard(tasks, incidents, state) {
      state = state || {};
      var regiao = state.regiao || 'TODAS';
      var prioridade = state.prioridade || 'TODAS';
      var tasksFilt = (tasks || []).filter(function (t) {
        if (regiao && regiao !== 'TODAS' && (t.regiao || 'OTHERS') !== regiao) return false;
        if (prioridade && prioridade !== 'TODAS' && (t.prioridade || 'PADRAO') !== prioridade) return false;
        return true;
      });
      var total = tasksFilt.length;
      var dentro = tasksFilt.filter(function (t) { return t.dentro; }).length;
      var fora = total - dentro;
      var porPrioridade = (C.PRIORIDADES || []).map(function (p) {
        var arr = tasksFilt.filter(function (t) { return (t.prioridade || 'PADRAO') === p; });
        var tot = arr.length;
        var din = arr.filter(function (x) { return x.dentro; }).length;
        var pct = tot ? Math.round((din / tot) * 100) : 100;
        return { prioridade: p, total: tot, dentro: din, fora: tot - din, pct: pct };
      });
      return { total: total, dentro: dentro, fora: fora, porPrioridade: porPrioridade, atualizadoEm: new Date() };
    }

    // ---- SLA page aggregation ----
    function slaPage(tasks, prazoMap) {
      var prios = (C.PRIORIDADES || []);
      var porPrioridade = prios.map(function (p) {
        var arr = (tasks || []).filter(function (t) { return (t.prioridade || 'PADRAO') === p; });
        var tot = arr.length;
        var dentro = arr.filter(function (x) { return x.dentro; }).length;
        var fora = tot - dentro;
        var pct = tot ? Math.round((dentro / tot) * 100) : 100;
        return { prioridade: p, prazo: prazoMap && prazoMap[p] != null ? prazoMap[p] : (C.SLA_PADRAO_HORAS && C.SLA_PADRAO_HORAS[p]), total: tot, dentro: dentro, fora: fora, pct: pct };
      });
      var geralTot = porPrioridade.reduce(function (s, x) { return s + x.total; }, 0);
      var geralDentro = porPrioridade.reduce(function (s, x) { return s + x.dentro; }, 0);
      var geral = { total: geralTot, dentro: geralDentro, fora: geralTot - geralDentro, pct: geralTot ? Math.round((geralDentro / geralTot) * 100) : 100 };
      return { porPrioridade: porPrioridade, geral: geral };
    }

    // ---- Regional page aggregation ----
    function regionalPage(tasks) {
      var reg = (C.REGIOES || []);
      var resumo = reg.map(function (r) {
        var arr = (tasks || []).filter(function (t) { return (t.regiao || 'OTHERS') === r; });
        var tot = arr.length;
        var dentro = arr.filter(function (x) { return x.dentro; }).length;
        var pct = tot ? Math.round((dentro / tot) * 100) : 100;
        return { regiao: r, total: tot, dentro: dentro, fora: tot - dentro, aderencia: pct };
      });
      return { resumo: resumo };
    }

    // ---- Incidents page aggregation ----
    function incidentsPage(incidents, filtros) {
      filtros = filtros || {};
      var arr = (incidents || []).filter(function (i) {
        if (filtros.status && filtros.status !== 'TODAS' && (i.statusTrat || '').toUpperCase() !== filtros.status) return false;
        if (filtros.anf && filtros.anf !== 'TODAS' && (i.anf || '').toString() !== filtros.anf) return false;
        if (filtros.q && filters.q) return true;
        return true;
      });
      // resumo simples por regiao
      var regs = {};
      (arr || []).forEach(function (r) { var k = (r.regiao || 'OTHERS'); regs[k] = (regs[k] || 0) + 1; });
      return { list: arr, resumo: regs };
    }

    // ---- Drill / detalhamento ----
    function drillTasks(tasks, spec, filtros) {
      spec = spec || {};
      var ativos = (tasks || []).filter(function (t) { return !t.cancelado; });
      if (spec.tipo === 'prioridadeSla') return ativos.filter(function (t) { return (t.prioridade || 'PADRAO') === spec.arg && !t.dentro; });
      if (spec.tipo === 'regiao') return ativos.filter(function (t) { return (t.regiao || 'OTHERS') === spec.arg; });
      if (spec.tipo === 'cidade') return ativos.filter(function (t) { return (t.cidade || '').toUpperCase() === (spec.arg || '').toUpperCase(); });
      return ativos;
    }

    function drillIncidents(incidents, spec) {
      var ativos = (incidents || []).filter(function (i) { return (i.ativo || true) !== false; });
      if (!spec || !spec.tipo) return ativos;
      if (spec.tipo === 'sitesFora') return ativos.filter(function (i) { return (i.regiao || 'OTHERS') === spec.arg; });
      if (spec.tipo === 'anf') return ativos.filter(function (i) { return (i.anf || '').toString().trim() === spec.arg; });
      if (spec.tipo === 'cidade') return ativos.filter(function (i) { return up(i.cidade) === up(spec.arg); });
      return [];
    }

    C2.collectIds = collectIds;
    C2.enrichTasks = enrichTasks;
    C2.enrichIncidents = enrichIncidents;
    C2.genesisToIncidents = genesisToIncidents;
    C2.dashboard = dashboard;
    C2.slaPage = slaPage;
    C2.regionalPage = regionalPage;
    C2.incidentsPage = incidentsPage;
    C2.drillTasks = drillTasks;
    C2.drillIncidents = drillIncidents;
    TRJ.compute = C2;
  })(window.TRJ = window.TRJ || {});
} catch (e) {
  // se ocorrer qualquer erro na execução do compute.js original, garantir que
  // o app não quebre: definir um objeto mínimo em TRJ.compute
  window.TRJ = window.TRJ || {};
  window.TRJ.compute = window.TRJ.compute || {};
}
