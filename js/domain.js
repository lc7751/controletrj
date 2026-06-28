/* Logica de dominio TRJ (portado de lib/domain/*.ts) */
(function (TRJ) {
  var C = TRJ.constants;
  var D = {};

  function up(s) { return (s == null ? '' : s).toString().toUpperCase().trim(); }
  function normalize(s) {
    return (s == null ? '' : s).toString()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toUpperCase().replace(/\s+/g, ' ').trim();
  }

  // ===================== REGIAO (region.ts) =====================
  var CRITERIOS_FILA = {
    'TRJ-RJ-ZNO01-ANG01': 'INTERIOR',
    'TRJ-RJ-INT01-CBF01': 'INTERIOR',
    'TRJ-RJ-INT01-NFB03': 'INTERIOR',
    'TRJ-RJ-INT01-PET04': 'INTERIOR',
    'TRJ-RJ-INT01-VRD05': 'INTERIOR',
    'OPERADOR_CSM_FMT-RJ_INT_INT': 'INTERIOR',
    'TRJ-ES-EPS01-SMT02': 'ESPIRITO SANTO',
    'TRJ-ES-EPS01-CIM01': 'ESPIRITO SANTO',
    'TRJ-ES-EPS01-VIT03': 'ESPIRITO SANTO',
    'TRJ-RJ-INT01-CPS02': 'ESPIRITO SANTO',
    'OPERADOR_CSM_FMT-ES_EPS': 'ESPIRITO SANTO',
    'TRJ-RJ-GRD01-ZSL01': 'GRANDE RJ',
    'TRJ-RJ-BXD01-NIT02': 'GRANDE RJ',
    'OPERADOR_CSM_FMT-RJ-GRD01-ZSL01': 'GRANDE RJ',
    'TRJ-RJ-BXD01-BXD01': 'BAIXADA',
    'OPERADOR_CSM_FMT-RJ_BXD01-BXD01': 'BAIXADA',
    'TRJ-RJ-ZNO01-ZOE02': 'ZONA OESTE',
    'OPERADOR_CSM_FMT-BXB_ZOE': 'ZONA OESTE',
    'OPERADOR_CSM_TRJ': 'ZONA OESTE'
  };

  function mapearPorCodigoFila(texto) {
    var s = up(texto);
    if (!s) return null;
    for (var k in CRITERIOS_FILA) {
      if (CRITERIOS_FILA.hasOwnProperty(k) && s.indexOf(k) >= 0) return CRITERIOS_FILA[k];
    }
    if (s.indexOf('NIT02') >= 0 || s.indexOf('NIT01') >= 0) return 'GRANDE RJ';
    if (s.indexOf('ANG01') >= 0) return 'INTERIOR';
    if (s.indexOf('CPS02') >= 0 || s.indexOf('CPS01') >= 0) return 'ESPIRITO SANTO';
    if (s.indexOf('ZSL01') >= 0 || s.indexOf('GRD01') >= 0) return 'GRANDE RJ';
    if (s.indexOf('ZOE02') >= 0 || s.indexOf('ZNO01') >= 0 || s.indexOf('BXB_ZOE') >= 0) return 'ZONA OESTE';
    if (s.indexOf('BXD01') >= 0 || s.indexOf('_BXD') >= 0) return 'BAIXADA';
    if (s.indexOf('INT01') >= 0 || s.indexOf('_INT_') >= 0 || s.indexOf('INT_INT') >= 0) return 'INTERIOR';
    if (s.indexOf('EPS01') >= 0 || s.indexOf('_ES_') >= 0 || s.indexOf('ES-EPS') >= 0 ||
        s.indexOf('-ES_') >= 0 || s.indexOf('VIT03') >= 0 || s.indexOf('SMT02') >= 0 || s.indexOf('CIM01') >= 0)
      return 'ESPIRITO SANTO';
    return null;
  }

  function mapearRegiaoPorArea(novaArea) {
    var s = up(novaArea);
    if (!s) return 'OTHERS';
    if (s.indexOf('INTERIOR') >= 0 || s.indexOf('COSTA VERDE') >= 0) return 'INTERIOR';
    if (s.indexOf('BAIXADA') >= 0) return 'BAIXADA';
    if (s.indexOf('ESPIRITO SANTO') >= 0 || s.indexOf('ES -') >= 0 || s.indexOf('ES_') >= 0 || s.indexOf('CAMPOS') >= 0) return 'ESPIRITO SANTO';
    if (s.indexOf('NITEROI') >= 0 || s.indexOf('NITERÓI') >= 0) return 'GRANDE RJ';
    if (s.indexOf('ZONA OESTE') >= 0 || s.indexOf('OESTE') >= 0 || s.indexOf('ZOE') >= 0) return 'ZONA OESTE';
    if (s.indexOf('ZONA NORTE') >= 0 || s.indexOf('ZONA SUL') >= 0) return 'GRANDE RJ';
    return 'OTHERS';
  }

  function mapearRegiaoPorCoordenador(coordenador) {
    var s = up(coordenador);
    if (!s) return 'OTHERS';
    if (s.indexOf('INTERIOR') >= 0 || s.indexOf('COSTA VERDE') >= 0 || s.indexOf('CAMPOS') >= 0) return 'INTERIOR';
    if (s.indexOf('BAIXADA') >= 0) return 'BAIXADA';
    if (s.indexOf('ESPIRITO SANTO') >= 0 || s.indexOf('ES -') >= 0) return 'ESPIRITO SANTO';
    if (s.indexOf('ZONA OESTE') >= 0 || s.indexOf('OESTE') >= 0) return 'ZONA OESTE';
    if (s.indexOf('CENTRO') >= 0 || s.indexOf('ZONA SUL') >= 0 || s.indexOf('ZONA NORTE') >= 0 || s.indexOf('NITEROI') >= 0) return 'GRANDE RJ';
    return 'OTHERS';
  }

  function determinarRegiao(filaAtual, microarea, valid) {
    var porFila = mapearPorCodigoFila(filaAtual || '') || mapearPorCodigoFila(microarea || '');
    if (porFila) return porFila;
    if (valid) {
      var porArea = mapearRegiaoPorArea(valid.novaArea);
      if (porArea !== 'OTHERS') return porArea;
      var porCoord = mapearRegiaoPorCoordenador(valid.coordenador);
      if (porCoord !== 'OTHERS') return porCoord;
    }
    return 'OTHERS';
  }

  // ===================== DATETIME (datetime.ts) =====================
  function parsePlatformDate(valor, baseDate) {
    if (!valor) return null;
    var s = String(valor).trim();
    if (!s) return null;
    var m = s.match(/(\d{1,2})[/\-](\d{1,2})(?:[/\-](\d{2,4}))?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (m) {
      var p1 = parseInt(m[1], 10);
      var p2 = parseInt(m[2], 10);
      var yy = m[3] ? parseInt(m[3], 10) : (baseDate || new Date()).getFullYear();
      if (yy < 100) yy += 2000;
      var hh = parseInt(m[4], 10);
      var mi = parseInt(m[5], 10);
      var ss = m[6] ? parseInt(m[6], 10) : 0;
      var dia, mes;
      if (p1 > 12) { dia = p1; mes = p2; }
      else if (p2 > 12) { mes = p1; dia = p2; }
      else { dia = p1; mes = p2; }
      var d = new Date(yy, mes - 1, dia, hh, mi, ss);
      if (!isNaN(d.getTime())) return d;
    }
    var mh = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (mh && baseDate) {
      var d2 = new Date(baseDate);
      d2.setHours(parseInt(mh[1], 10), parseInt(mh[2], 10), mh[3] ? parseInt(mh[3], 10) : 0, 0);
      return d2;
    }
    var iso = new Date(s);
    if (!isNaN(iso.getTime())) return iso;
    return null;
  }

  function toDate(d) {
    if (!d) return null;
    var date = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
    return isNaN(date.getTime()) ? null : date;
  }

  function formatarDuracao(totalMin) {
    var abs = Math.abs(Math.round(totalMin));
    var dias = Math.floor(abs / 1440);
    var horas = Math.floor((abs % 1440) / 60);
    var min = abs % 60;
    var out = '';
    if (dias > 0) out += dias + 'd ';
    if (horas > 0 || dias > 0) out += horas + 'h';
    out += String(min).padStart(2, '0') + 'min';
    return out.trim();
  }

  function formatarDataBR(d) {
    if (!d) return '—';
    var date = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
    if (isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
    }).format(date);
  }

  function getAgingBucket(minutos) {
    for (var i = 0; i < C.AGING_BUCKETS.length; i++) {
      var b = C.AGING_BUCKETS[i];
      if (minutos >= b.min && minutos < b.max) return b.label;
    }
    return C.AGING_BUCKETS[C.AGING_BUCKETS.length - 1].label;
  }

  // ===================== SLA (sla.ts) =====================
  var STATUS_BACKLOG = ['NÃO INICIADO', 'NAO INICIADO', 'INICIADO', 'PENDENTE'];
  var STATUS_FECHADO = ['CONCLUÍDA', 'CONCLUIDA', 'CANCELADA', 'CANCELADO'];

  function isBacklogStatus(status) {
    var s = up(status);
    if (STATUS_FECHADO.indexOf(s) >= 0) return false;
    if (STATUS_BACKLOG.indexOf(s) >= 0) return true;
    return s !== '';
  }

  function computeSla(task, prazoMap, now) {
    var criacao = toDate(task.dataCriacao);
    var isBacklog = isBacklogStatus(task.status);
    var falha = up(task.tipoFalha);
    var agingMinutos = criacao ? Math.round((now.getTime() - criacao.getTime()) / 60000) : null;

    if (falha.indexOf('PREDICAO INDISP') >= 0 || falha.indexOf('PREDIÇÃO INDISP') >= 0) {
      return { vencimentoCalc: null, fonteSla: 'PREDITIVA', statusSla: 'PREDITIVA', minutosRestantes: null, agingMinutos: agingMinutos, isBacklog: isBacklog };
    }

    var vencimento = null;
    var fonte = 'SEM DADOS';
    var venPlat = parsePlatformDate(task.vencimentoSla, criacao);
    if (venPlat) {
      vencimento = venPlat; fonte = 'SLA CONT';
    } else if (criacao) {
      var prazo = prazoMap[up(task.prioridade)] || 0;
      if (prazo > 0) {
        vencimento = new Date(criacao.getTime() + prazo * 3600 * 1000);
        fonte = 'SLA CAL';
      }
    }

    if (!vencimento) {
      return { vencimentoCalc: null, fonteSla: 'SEM DADOS', statusSla: isBacklog ? 'INDEFINIDO' : 'CONCLUIDO', minutosRestantes: null, agingMinutos: agingMinutos, isBacklog: isBacklog };
    }

    var minutosRestantes = Math.round((vencimento.getTime() - now.getTime()) / 60000);
    var statusSla;
    if (!isBacklog) statusSla = 'CONCLUIDO';
    else statusSla = minutosRestantes < 0 ? 'FORA DO SLA' : 'DENTRO DO SLA';

    return { vencimentoCalc: vencimento, fonteSla: fonte, statusSla: statusSla, minutosRestantes: minutosRestantes, agingMinutos: agingMinutos, isBacklog: isBacklog };
  }

  function montarPrazoMap(override) {
    var m = {};
    for (var k in C.SLA_PADRAO_HORAS) if (C.SLA_PADRAO_HORAS.hasOwnProperty(k)) m[k] = C.SLA_PADRAO_HORAS[k];
    if (override) for (var k2 in override) if (override.hasOwnProperty(k2)) {
      var v = parseFloat(override[k2]);
      if (!isNaN(v)) m[k2] = v;
    }
    return m;
  }

  // ===================== TICKETS (tickets.ts) =====================
  function isTicketCorretiva(tipoAtividade) {
    return normalize(tipoAtividade).indexOf('CORRETIV') >= 0;
  }

  function categoriaManual(tipoAtividade) {
    var t = normalize(tipoAtividade);
    if (t.indexOf('PREVENT') >= 0) return 'prev';
    if (t.indexOf('CONJUNT') >= 0) return 'conj';
    if (t.indexOf('WO') >= 0 || t.indexOf('WORK ORDER') >= 0) return 'wo';
    return 'outras';
  }

  function classificarCciCampo(filaAtual) {
    return normalize(filaAtual).indexOf('OPERADOR_') >= 0 ? 'CCI' : 'Campo';
  }

  function dedupPorTsk(rows) {
    var best = {};
    var semOs = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var k = ((r.osNumero == null ? '' : r.osNumero).toString()).trim();
      if (!k) { semOs.push(r); continue; }
      var cur = best[k];
      var sid = (r.sequenciaId == null ? -1 : Number(r.sequenciaId));
      if (!cur || sid > (cur.sequenciaId == null ? -1 : Number(cur.sequenciaId))) best[k] = r;
    }
    var out = [];
    for (var kk in best) if (best.hasOwnProperty(kk)) out.push(best[kk]);
    return out.concat(semOs);
  }

  function separarTicketsManuais(rows, jaDeduplicado) {
    var base = jaDeduplicado ? rows : dedupPorTsk(rows);
    var tickets = [], manuais = [];
    for (var i = 0; i < base.length; i++) {
      if (isTicketCorretiva(base[i].tipoAtividade)) tickets.push(base[i]);
      else manuais.push(base[i]);
    }
    return { tickets: tickets, manuais: manuais };
  }

  // ===================== CAUSA (causa.ts) =====================
  function agruparCausa(causa) {
    var s = up(causa);
    if (!s) return 'Outros';
    if (s.indexOf('FURTO') >= 0 || s.indexOf('VANDAL') >= 0 || s.indexOf('ROUBO') >= 0) return 'Furto';
    if (s.indexOf('ENERGIA') >= 0 || s.indexOf('ENERG') >= 0) return 'Energia';
    if (s.indexOf('FO') >= 0 || s.indexOf('FIBRA') >= 0 || s.indexOf('ROMPIMENTO') >= 0) return 'Fibra';
    if (s.indexOf('TX') >= 0 || s.indexOf('TRANSMISS') >= 0 || s.indexOf('PROVEDOR') >= 0 || s.indexOf('MW') >= 0 || s.indexOf('BACKHAUL') >= 0) return 'Transmissão';
    return 'Outros';
  }

  D.up = up;
  D.normalize = normalize;
  D.determinarRegiao = determinarRegiao;
  D.mapearRegiaoPorArea = mapearRegiaoPorArea;
  D.mapearRegiaoPorCoordenador = mapearRegiaoPorCoordenador;
  D.parsePlatformDate = parsePlatformDate;
  D.toDate = toDate;
  D.formatarDuracao = formatarDuracao;
  D.formatarDataBR = formatarDataBR;
  D.getAgingBucket = getAgingBucket;
  D.isBacklogStatus = isBacklogStatus;
  D.computeSla = computeSla;
  D.montarPrazoMap = montarPrazoMap;
  D.isTicketCorretiva = isTicketCorretiva;
  D.categoriaManual = categoriaManual;
  D.classificarCciCampo = classificarCciCampo;
  D.dedupPorTsk = dedupPorTsk;
  D.separarTicketsManuais = separarTicketsManuais;
  D.agruparCausa = agruparCausa;

  TRJ.domain = D;
})(window.TRJ = window.TRJ || {});
