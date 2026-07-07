/* ============================================================
 * Página: Mapa Operacional TRJ
 * ============================================================
 * Mapa Leaflet com dados de sites vindos da ponte local
 * (http://localhost:5057/api/mapa) que acessa o PHP interno
 * via VPN, ou fallback para dados importados do Genesis HTML.
 *
 * Exibe:
 *  • Marcadores dos sites fora (FLAG 1 por padrão)
 *  • Toggle FLAG 0 (demais sites)
 *  • Polylines enlaces MW (coloridas por fornecedor)
 *  • Marcadores Hub FO
 *  • Busca por site, END_ID ou cidade
 * ============================================================ */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants;

  var LS_COORDS = 'trj_coordMap';
  var LS_MW     = 'trj_mwData';
  var LS_FO     = 'trj_foData';
  var PONTE_URL = 'http://localhost:5057';

  // ── Cores exatas do mapa original ───────────────────────────
  var MW_CORES = {
    'NOKIA':    '#800080',
    'HUAWEI':   '#d20014',
    'CERAGON':  '#dcf014',
    'ERICSSON': '#000078',
    'SIAE':     '#14c8f0',
    'ZTE':      '#2ecc71',
    'default':  '#7f8c8d'
  };

  // ── Utilitários de storage ─────────────────────────────────
  function loadLS(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch(e){ return null; }
  }
  function saveLS(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e){}
  }
  function salvarMapaDados(coordMap, mwData, foData) {
    saveLS(LS_COORDS, coordMap);
    saveLS(LS_MW, mwData);
    saveLS(LS_FO, foData);
  }
  TRJ.mapaSetDados = salvarMapaDados;

  // ── Parsear Genesis HTML → coordenadas + mwData + foData ──
  function parseGenesisParaMapa(htmlText) {
    function cleanJSON(raw) { return raw.replace(/\u00a0/g,'').replace(/\\u00a0/g,''); }
    function extract(pattern) {
      var m = htmlText.match(pattern);
      if (!m) return [];
      try { return JSON.parse(cleanJSON(m[1])); } catch(e){ return []; }
    }
    var mwData = extract(/mwData\s*=\s*(\[[\s\S]*?\]);/);
    var foData = extract(/foData\s*=\s*(\[[\s\S]*?\]);/);

    function pc(s){ try { return parseFloat(String(s).replace(/\u00a0/g,'').replace(',','.')); } catch(e){ return null; } }
    var coordMap = {};
    mwData.forEach(function(link) {
      var parts = (link.Enlace2||'').split(' - ').map(function(p){ return p.trim(); }).filter(Boolean);
      var coords = [[pc(link.LAT_A), pc(link.LONG_A)], [pc(link.LAT_B), pc(link.LONG_B)]];
      parts.slice(0,2).forEach(function(eid, idx) {
        if (coords[idx][0] && coords[idx][1] && eid && !coordMap[eid]) coordMap[eid] = coords[idx];
      });
    });
    foData.forEach(function(hub) {
      var m = (hub.HUB||'').match(/\((\w+)\)/);
      var eid = m ? m[1] : (hub.NEName||'');
      var lat = pc(hub.LAT_A), lon = pc(hub.LONG_A);
      if (lat && lon && eid && !coordMap[eid]) coordMap[eid] = [lat, lon];
    });

    salvarMapaDados(coordMap, mwData, foData);
    return { coordMap: coordMap, mwData: mwData, foData: foData, coordCount: Object.keys(coordMap).length };
  }
  TRJ.mapaParseGenesis = parseGenesisParaMapa;

  // ── PÁGINA ─────────────────────────────────────────────────
  TRJ.pages.mapa = function(container, ctx) {
    var data      = ctx.data || {};
    var incidents = data.incidentsEnriched || [];
    var tasks     = data.tasksEnriched     || [];

    var coordMap  = loadLS(LS_COORDS) || {};
    var mwData    = loadLS(LS_MW)     || [];
    var foData    = loadLS(LS_FO)     || [];

    // ── Construir lookup ENDID → {site} a partir das tarefas ─
    var siteByEndId = {};
    tasks.forEach(function(t) {
      var eid = (t.enderecoId||'').trim();
      if (eid && !siteByEndId[eid]) siteByEndId[eid] = t.siteId || '';
    });
    incidents.forEach(function(i) {
      var eid = (i.enderecoId||i.endId||'').trim();
      if (eid && !siteByEndId[eid]) siteByEndId[eid] = i.site || '';
    });

    // Estado do mapa
    var mapState = { showFlag0: false, showMW: true, showFO: false, flagFilter: '1' };
    var mapInstance = null, layers = {};
    var sitesFlag1 = [], sitesFlag0Raw = [];

    // ── Header ─────────────────────────────────────────────────
    container.appendChild(U.pageHeader('Mapa Operacional',
      'Sites fora georreferenciados, enlaces MW e hubs FO em tempo real.'));

    // ── Barra de controles ─────────────────────────────────────
    var searchInput = U.h('input', {
      class: 'trj-input',
      placeholder: 'Buscar por site, END_ID ou cidade...',
      style: { flex: '1', maxWidth: '340px', fontSize: '13px' }
    });

    function mkCheck(label) {
      var chk = U.h('input', { type: 'checkbox' });
      var lbl = U.h('label', { style: { display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap' }}, [chk, U.h('span',{text:label})]);
      return { chk: chk, el: lbl };
    }

    var ckFlag0 = mkCheck('FLAG 0 (demais sites)');
    var ckMW    = mkCheck('Enlaces MW'); ckMW.chk.checked = true;
    var ckFO    = mkCheck('Hubs FO');

    var statsEl = U.h('div', { style: { fontSize:'12px', color:'var(--trj-muted)', display:'flex', gap:'14px', flexWrap:'wrap', alignItems:'center' } });

    // Botão buscar via ponte
    var btnPonte = U.h('button', {
      class: 'trj-btn trj-btn-primary clickable',
      style: { fontSize:'12px', padding:'4px 14px', display:'inline-flex', alignItems:'center', gap:'6px' }
    }, [U.h('span',{text:'Buscar sites (ponte + VPN)' })]);

    // Botão importar HTML (fallback)
    var btnImport = U.h('button', {
      class: 'trj-btn trj-btn-ghost clickable',
      style: { fontSize:'12px', padding:'4px 12px', display:'inline-flex', alignItems:'center', gap:'6px', opacity:'0.8' }
    }, [U.h('span',{text:'Importar Genesis HTML' })]);
    var fileInput = U.h('input', { type:'file', accept:'.html,.htm', style:{ display:'none' } });
    container.appendChild(fileInput);

    var ctrlBar = U.h('div', {
      style: { display:'flex', alignItems:'center', gap:'12px', flexWrap:'wrap', marginBottom:'10px',
               padding:'10px 14px', background:'var(--trj-card)', borderRadius:'10px', border:'1px solid var(--trj-border)',
               // z-index garante que barra de controles fique sobre o mapa mas abaixo da sidebar
               position:'relative', zIndex:'1' }
    }, [searchInput, ckFlag0.el, ckMW.el, ckFO.el,
        U.h('div', {style:{marginLeft:'auto',display:'flex',gap:'8px'}}, [btnPonte, btnImport])]);
    container.appendChild(ctrlBar);
    container.appendChild(statsEl);

    // ── Container do mapa ──────────────────────────────────────
    // z-index do mapa menor que a sidebar (a sidebar usa z-index 200+)
    var mapDiv = U.h('div', {
      id: 'trj-mapa-leaflet',
      style: { height:'65vh', borderRadius:'12px', overflow:'hidden',
               border:'1px solid var(--trj-border)', marginTop:'10px',
               position:'relative', zIndex:'0' }
    });
    container.appendChild(mapDiv);

    // ── Legenda completa ───────────────────────────────────────
    var legItems = [
      { cor:'#e74c3c', shape:'circle', label:'Site fora — sem TSK' },
      { cor:'#3498db', shape:'circle', label:'Site fora — com TSK' },
      { cor:'#f0b429', shape:'circle', label:'Site fora — recente (<1h)' },
      { cor:'#888',    shape:'circle', label:'FLAG 0 (demais sites)' },
      { cor:'#800080', shape:'line', label:'MW Nokia' },
      { cor:'#d20014', shape:'line', label:'MW Huawei' },
      { cor:'#dcf014', shape:'line', label:'MW Ceragon' },
      { cor:'#000078', shape:'line', label:'MW Ericsson' },
      { cor:'#14c8f0', shape:'line', label:'MW SIAE' },
      { cor:'#2ecc71', shape:'square', label:'Hub FO' },
    ];
    var legEl = U.h('div', { style: { display:'flex', gap:'12px', flexWrap:'wrap', marginTop:'8px', fontSize:'11px', color:'var(--trj-muted)' } },
      legItems.map(function(item) {
        var ico;
        if (item.shape === 'line') {
          ico = U.h('span', { style: { width:'24px', height:'3px', background:item.cor, display:'inline-block', verticalAlign:'middle' } });
        } else if (item.shape === 'square') {
          ico = U.h('span', { style: { width:'10px', height:'10px', background:item.cor, display:'inline-block', borderRadius:'2px', border:'1px solid #fff' } });
        } else {
          ico = U.h('span', { style: { width:'10px', height:'10px', borderRadius:'50%', background:item.cor, display:'inline-block', border:'1px solid rgba(255,255,255,.4)' } });
        }
        return U.h('div', { style: { display:'flex', alignItems:'center', gap:'5px' } }, [ico, U.h('span',{text:item.label})]);
      }));
    container.appendChild(legEl);

    // ── Inicializar Leaflet ───────────────────────────────────
    function getLeaflet(cb) {
      if (window.L) { cb(); return; }
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      js.onload = cb; document.head.appendChild(js);
    }

    function initMap() {
      if (mapInstance) return;
      mapInstance = window.L.map('trj-mapa-leaflet', { preferCanvas: true })
        .setView([-22.3, -43.1], 8);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap | CARTO',
        maxZoom: 19
      }).addTo(mapInstance);

      layers.flag1 = window.L.layerGroup().addTo(mapInstance);
      layers.flag0 = window.L.layerGroup();
      layers.mw    = window.L.layerGroup().addTo(mapInstance);
      layers.fo    = window.L.layerGroup();

      // Eventos de toggle
      ckFlag0.chk.addEventListener('change', function() { if(ckFlag0.chk.checked) layers.flag0.addTo(mapInstance); else layers.flag0.remove(); });
      ckMW.chk.addEventListener('change',   function() { if(ckMW.chk.checked)    layers.mw.addTo(mapInstance);    else layers.mw.remove(); });
      ckFO.chk.addEventListener('change',   function() { if(ckFO.chk.checked)    layers.fo.addTo(mapInstance);    else layers.fo.remove(); });

      // Busca em tempo real
      var timer = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(timer);
        timer = setTimeout(function() { filtrarMarcadores(searchInput.value.trim().toLowerCase()); }, 200);
      });
    }

    function filtrarMarcadores(q) {
      layers.flag1._layers && Object.values(layers.flag1._layers).forEach(function(m) {
        var d = m._d || {};
        var ok = !q || (d.eid||'').toLowerCase().indexOf(q)>=0
               || (d.site||'').toLowerCase().indexOf(q)>=0
               || (d.cidade||'').toLowerCase().indexOf(q)>=0;
        m.setOpacity(ok ? 1 : 0.05);
        if (ok && m.setIcon) {} // não altera ícone
      });
    }

    // ── Ícone DIV customizado ─────────────────────────────────
    function divIcon(cor, sz, shape) {
      sz = sz || 14;
      var html;
      if (shape === 'square') {
        html = '<div style="width:' + sz + 'px;height:' + sz + 'px;background:' + cor + ';border:2px solid #fff;border-radius:3px;box-shadow:0 0 4px rgba(0,0,0,.5)"></div>';
      } else {
        html = '<div style="width:' + sz + 'px;height:' + sz + 'px;background:' + cor + ';border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px ' + cor + '88"></div>';
      }
      return window.L.divIcon({ html:html, className:'', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2], popupAnchor:[0,-sz/2] });
    }

    // ── Renderizar sites (markerData vindos da ponte ou do coordMap) ──
    function renderSites(sitesList) {
      if (!mapInstance) return;
      layers.flag1.clearLayers();
      layers.flag0.clearLayers();

      var cTSK = 0, cSemCoord = 0;
      var tasksAtivas = tasks.filter(function(t){
        var s=(t.status||'').toUpperCase().trim(); return s==='NÃO INICIADO'||s==='NAO INICIADO'||s==='INICIADO';
      });

      sitesFlag1 = sitesList.filter(function(s){ return String(s.flag||s.FLAG||'1') === '1'; });
      sitesFlag0Raw = sitesList.filter(function(s){ return String(s.flag||s.FLAG||'0') === '0'; });

      sitesFlag1.forEach(function(site) {
        var lat = parseFloat(site.latitude || site.lat || '');
        var lon = parseFloat(site.longitude || site.lon || '');
        if (isNaN(lat) || isNaN(lon)) { cSemCoord++; return; }

        var eid    = (site.ENDID || site.endId || '').trim();
        var nome   = site.NEName || site.nome || siteByEndId[eid] || eid;
        var cidade = site.municipio || site.cidade || '';

        // Verificar TSK aberta
        var incMatch = incidents.filter(function(i){ return i.enderecoId === eid; })[0];
        var tsk = (incMatch && U.tskAberta) ? U.tskAberta(incMatch, tasksAtivas) : null;
        if (tsk) cTSK++;

        // Cor baseada no tempo (como o original)
        var tempo = parseInt(site.tempo || '99', 10);
        var cor = tsk ? '#3498db' : (tempo === 0 ? '#f0b429' : '#e74c3c');

        var marker = window.L.marker([lat, lon], { icon: divIcon(cor, 14) });
        marker._d = { eid:eid, site:nome, cidade:cidade };

        var popContent = '<div style="font:12px ui-monospace,monospace;min-width:200px;padding:4px">'
          + '<b style="color:' + cor + ';font-size:13px">' + nome + '</b><br>'
          + '<span style="color:#888">END_ID:</span> ' + eid + '<br>'
          + (cidade ? '<span style="color:#888">Cidade:</span> ' + cidade + '<br>' : '')
          + '<span style="color:#888">Queda:</span> ' + (site.queda||'—') + '<br>'
          + (site.evento ? '<span style="color:#888">Evento:</span> ' + site.evento + '<br>' : '')
          + (site.previsao ? '<span style="color:#888">Previsão:</span> ' + site.previsao + '<br>' : '')
          + (site.celulas ? '<span style="color:#888">Células:</span> ' + site.celulas + '<br>' : '')
          + (tsk ? '<span style="color:#3498db;font-weight:700">TSK: ' + tsk.osNumero + '</span>' : '<span style="color:#e74c3c">Sem TSK aberta</span>')
          + '</div>';
        marker.bindPopup(popContent, { maxWidth: 280 });
        marker.bindTooltip(nome + ' (' + eid + ')', { direction:'top' });
        marker.addTo(layers.flag1);
      });

      // FLAG 0
      sitesFlag0Raw.forEach(function(site) {
        var lat = parseFloat(site.latitude||site.lat||'');
        var lon = parseFloat(site.longitude||site.lon||'');
        if (isNaN(lat) || isNaN(lon)) return;
        var eid  = (site.ENDID||site.endId||'').trim();
        var nome = site.NEName || site.nome || siteByEndId[eid] || eid;
        var m = window.L.circleMarker([lat,lon], { radius:4, color:'#555', fillColor:'#777', fillOpacity:0.5, weight:1 });
        m._d = { eid:eid, site:nome, cidade:site.municipio||'' };
        m.bindTooltip(nome + ' (' + eid + ')', { direction:'top' });
        m.addTo(layers.flag0);
      });

      updateStats(sitesFlag1.length, cTSK, cSemCoord);
    }

    // ── Renderizar MW + FO (static, from stored data) ──────────
    function renderEstaticos() {
      if (!mapInstance) return;
      layers.mw.clearLayers();
      layers.fo.clearLayers();

      mwData.forEach(function(link) {
        function pc(s){ try { return parseFloat(String(s).replace(/\u00a0/g,'').replace(',','.')); } catch(e){ return null; } }
        var latA=pc(link.LAT_A), lonA=pc(link.LONG_A), latB=pc(link.LAT_B), lonB=pc(link.LONG_B);
        if (!latA||!lonA||!latB||!lonB) return;
        var forn  = (link.FORNECEDOR||'').toUpperCase();
        var cor   = MW_CORES[forn] || MW_CORES.default;
        var enlace = (link.Enlace&&link.Enlace.trim().length>5) ? link.Enlace : (link.Enlace2||'');
        var line = window.L.polyline([[latA,lonA],[latB,lonB]], {
          color:cor, weight:5, opacity:0.65,
          dashArray: forn==='CERAGON'?'6,4':null
        });
        line.bindPopup('<b>Enlace:</b> ' + enlace + '<br><b>Fornecedor:</b> ' + (link.FORNECEDOR||'—')
          + (link.PROJETO ? '<br><b>Projeto:</b> ' + link.PROJETO : ''), { maxWidth:220 });
        line.addTo(layers.mw);
      });

      foData.forEach(function(hub) {
        function pc(s){ try { return parseFloat(String(s).replace(/\u00a0/g,'').replace(',','.')); } catch(e){ return null; } }
        var lat=pc(hub.LAT_A), lon=pc(hub.LONG_A);
        if (!lat||!lon) return;
        var m = window.L.marker([lat,lon], { icon: divIcon('#2ecc71', 10, 'square') });
        m.bindPopup('<b>' + (hub.HUB||hub.NEName||'—') + '</b><br>' + (hub.FORNECEDOR||'') + (hub.PROJETO?' | '+hub.PROJETO:''));
        m.bindTooltip(hub.NEName||hub.HUB||'', { direction:'top' });
        m.addTo(layers.fo);
      });
    }

    // ── Renderizar usando coordMap (fallback sem ponte) ────────
    function renderComCoordMap() {
      var incAtivos = incidents.filter(function(i){ return (i.statusTrat||'').toUpperCase()!=='RESOLVIDO'; });
      var fakeMarkers = incAtivos.map(function(inc) {
        var eid = (inc.enderecoId||'').trim();
        var coords = coordMap[eid];
        if (!coords) return null;
        return { ENDID:eid, NEName:inc.site||siteByEndId[eid]||eid, latitude:coords[0], longitude:coords[1],
                 municipio:(inc.cidadeUf||'').split('/')[0].trim(), queda:inc.horario||'', flag:1,
                 evento:inc.causa||'', previsao:'' };
      }).filter(Boolean);

      var flag0Fake = Object.keys(coordMap)
        .filter(function(eid){ return !incAtivos.find(function(i){ return i.enderecoId===eid; }); })
        .slice(0, 3000)
        .map(function(eid) {
          var c = coordMap[eid];
          return { ENDID:eid, NEName:siteByEndId[eid]||eid, latitude:c[0], longitude:c[1], flag:0 };
        });

      renderSites(fakeMarkers.concat(flag0Fake));
    }

    function updateStats(total, comTSK, semCoord) {
      statsEl.innerHTML = '';
      var items = [
        { text:'Sites fora no mapa: ' + total, cor:'#e74c3c' },
        { text:'Com TSK aberta: ' + comTSK, cor:'#3498db' },
        { text:'Sem coordenadas: ' + semCoord, cor:'var(--trj-muted)' },
        { text:'Enlaces MW: ' + mwData.length, cor:'var(--trj-muted)' },
        { text:'Hubs FO: ' + foData.length, cor:'#2ecc71' },
      ];
      items.forEach(function(item) {
        statsEl.appendChild(U.h('span', { style:{ fontSize:'12px', color:item.cor } }, item.text));
      });
    }

    // ── Buscar via ponte ────────────────────────────────────────
    function buscarViaPonte() {
      btnPonte.textContent = 'Buscando...';
      btnPonte.disabled = true;
      fetch(PONTE_URL + '/api/saude')
        .then(function(r) { return r.json(); })
        .then(function() {
          return fetch(PONTE_URL + '/api/mapa?flag=');
        })
        .then(function(r) { return r.json(); })
        .then(function(json) {
          if (json.erro) { U.toast('Erro da ponte: ' + json.erro, 'err'); return; }
          var sites = json.sites || [];
          U.toast('Mapa: ' + sites.length + ' sites carregados via ponte.', 'ok');
          getLeaflet(function() { initMap(); renderSites(sites); renderEstaticos(); });
        })
        .catch(function(e) {
          U.toast('Ponte não disponível. Use "Importar Genesis HTML" ou inicie o ponte_trj.py.', 'err');
        })
        .finally(function() { btnPonte.textContent = 'Buscar sites (ponte + VPN)'; btnPonte.disabled = false; });
    }

    btnPonte.addEventListener('click', buscarViaPonte);
    btnImport.addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var result = parseGenesisParaMapa(ev.target.result);
        coordMap = result.coordMap; mwData = result.mwData; foData = result.foData;
        U.toast('Genesis: ' + result.coordCount + ' coords importadas.', 'ok');
        fileInput.value = '';
        getLeaflet(function() { initMap(); renderComCoordMap(); renderEstaticos(); });
      };
      reader.readAsText(file, 'utf-8');
    });

    // ── Iniciar mapa automaticamente se tiver dados ────────────
    var temMW = mwData.length > 0;
    var temCoords = Object.keys(coordMap).length > 0;

    getLeaflet(function() {
      initMap();
      if (temCoords || incidents.length > 0) {
        renderComCoordMap();
      }
      if (temMW) {
        renderEstaticos();
      }
      if (!temCoords) {
        U.toast('Clique em "Buscar sites" (com ponte+VPN) ou "Importar Genesis HTML" para ver os marcadores.', 'ok');
      }
    });
  };

})(window.TRJ = window.TRJ || {});
