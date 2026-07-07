/* ============================================================
 * Página: Mapa Operacional TRJ
 * ============================================================
 * Mapa Leaflet com:
 *  • Marcadores de incidentes ativos (sites fora, FLAG 1)
 *  • Toggle para exibir FLAG 0 (demais sites)
 *  • Polylines de enlaces MW (por fornecedor, coloridas)
 *  • Marcadores Hub FO com ícones distintos
 *  • Busca por site, END_ID ou cidade
 *  • Dados de coordenadas extraídos do Genesis HTML
 * ============================================================ */
(function (TRJ) {
  TRJ.pages = TRJ.pages || {};
  var U = TRJ.ui, C = TRJ.constants;

  var LS_COORDS = 'trj_coordMap';
  var LS_MW     = 'trj_mwData';
  var LS_FO     = 'trj_foData';

  // Cores por fornecedor MW (iguais às do Genesis)
  var MW_CORES = {
    'NOKIA': '#9b59b6', 'HUAWEI': '#e74c3c', 'CERAGON': '#f0b429',
    'ERICSSON': '#2c3e80', 'SIAE': '#14c8f0', 'ZTE': '#2ecc71',
    'default': '#7f8c8d'
  };

  // ── Carregar dados do localStorage ──────────────────────────
  function carregarCoords() {
    try { return JSON.parse(localStorage.getItem(LS_COORDS) || '{}') || {}; } catch(e){ return {}; }
  }
  function carregarMW() {
    try { return JSON.parse(localStorage.getItem(LS_MW) || '[]') || []; } catch(e){ return []; }
  }
  function carregarFO() {
    try { return JSON.parse(localStorage.getItem(LS_FO) || '[]') || []; } catch(e){ return []; }
  }
  function salvarDados(coordMap, mwData, foData) {
    try {
      localStorage.setItem(LS_COORDS, JSON.stringify(coordMap));
      localStorage.setItem(LS_MW,     JSON.stringify(mwData));
      localStorage.setItem(LS_FO,     JSON.stringify(foData));
    } catch(e) { console.warn('Mapa: erro ao salvar no localStorage', e); }
  }
  TRJ.mapaSetDados = salvarDados; // Exposto para genesis.js chamar

  // ── Parsear Genesis HTML e extrair mwData/foData/coordMap ──
  function parseGenesisParaMapa(htmlText) {
    var scriptM = htmlText.match(/mwData\s*=\s*(\[[\s\S]*?\]);/);
    var scriptF = htmlText.match(/foData\s*=\s*(\[[\s\S]*?\]);/);
    function cleanJSON(raw) {
      return raw.replace(/\u00a0/g,'').replace(/\\u00a0/g,'');
    }
    var mwData = [], foData = [];
    if (scriptM) { try { mwData = JSON.parse(cleanJSON(scriptM[1])); } catch(e){} }
    if (scriptF) { try { foData = JSON.parse(cleanJSON(scriptF[1])); } catch(e){} }

    function parseCoord(s) {
      try { return parseFloat(String(s).replace(/\u00a0/g,'').replace(',','.')); }
      catch(e){ return null; }
    }
    var coordMap = {};
    mwData.forEach(function(link) {
      var enlace = link.Enlace2 || '';
      var partes = enlace.split(' - ').map(function(p){ return p.trim(); }).filter(Boolean);
      var lats = [parseCoord(link.LAT_A), parseCoord(link.LAT_B)];
      var lons = [parseCoord(link.LONG_A), parseCoord(link.LONG_B)];
      partes.slice(0,2).forEach(function(eid, idx) {
        if (lats[idx] && lons[idx] && eid && !coordMap[eid]) {
          coordMap[eid] = [lats[idx], lons[idx]];
        }
      });
    });
    foData.forEach(function(hub) {
      var hubStr = hub.HUB || '';
      var m = hubStr.match(/\((\w+)\)/);
      var eid = m ? m[1] : (hub.NEName || '');
      var lat = parseCoord(hub.LAT_A), lon = parseCoord(hub.LONG_A);
      if (lat && lon && eid && !coordMap[eid]) coordMap[eid] = [lat, lon];
    });

    salvarDados(coordMap, mwData, foData);
    return { coordMap: coordMap, mwData: mwData, foData: foData };
  }
  TRJ.mapaParseGenesis = parseGenesisParaMapa;

  // ── PÁGINA PRINCIPAL ─────────────────────────────────────────
  TRJ.pages.mapa = function(container, ctx) {
    var app      = ctx.app;
    var data     = ctx.data || {};
    var incidents = data.incidentsEnriched || [];
    var coordMap = carregarCoords();
    var mwData   = carregarMW();
    var foData   = carregarFO();

    var temDados = Object.keys(coordMap).length > 0;

    // ── Layout ──────────────────────────────────────────────────
    container.appendChild(U.pageHeader('🗺️ Mapa Operacional',
      'Incidentes ativos georreferenciados, enlaces MW e hubs FO.'));

    // Barra de controles
    var searchInput = U.h('input', {
      class: 'trj-input', placeholder: '🔍  Buscar por site, END_ID ou cidade...',
      style: { flex: '1', maxWidth: '360px', fontSize: '13px' }
    });

    var chkFlag0  = U.h('input', { type: 'checkbox' });
    var chkMW     = U.h('input', { type: 'checkbox' }); chkMW.checked = true;
    var chkFO     = U.h('input', { type: 'checkbox' }); chkFO.checked = false;

    var lblFlag0 = U.h('label', { style: {display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'} }, [chkFlag0, U.h('span',{text:'FLAG 0 (demais sites)'})]);
    var lblMW    = U.h('label', { style: {display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'} }, [chkMW, U.h('span',{text:'Enlaces MW'})]);
    var lblFO    = U.h('label', { style: {display:'flex',alignItems:'center',gap:'6px',fontSize:'12px',cursor:'pointer',whiteSpace:'nowrap'} }, [chkFO, U.h('span',{text:'Hubs FO'})]);

    // Contadores
    var statsEl = U.h('div', { style: {fontSize:'12px',color:'var(--trj-muted)',display:'flex',gap:'16px',alignItems:'center',flexWrap:'wrap'} });

    // Botão de importar Genesis
    var btnImport = U.h('button', {
      class: 'trj-btn trj-btn-primary clickable',
      style: { fontSize: '12px', padding: '4px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }
    }, [U.h('span',{text:'📡'}), U.h('span',{text:'Importar Genesis (coordenadas)'})]);
    var fileInput = U.h('input', { type: 'file', accept: '.html,.htm', style: { display: 'none' } });
    container.appendChild(fileInput);
    btnImport.addEventListener('click', function(){ fileInput.click(); });
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var result = parseGenesisParaMapa(ev.target.result);
        coordMap = result.coordMap; mwData = result.mwData; foData = result.foData;
        U.toast('Genesis importado: ' + Object.keys(coordMap).length + ' sites com coordenadas.', 'ok');
        fileInput.value = '';
        renderMapa();
      };
      reader.readAsText(file, 'utf-8');
    });

    var controles = U.h('div', { style: {display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap',marginBottom:'12px',padding:'10px 14px',background:'var(--trj-card)',borderRadius:'10px',border:'1px solid var(--trj-border)'} }, [
      searchInput, lblFlag0, lblMW, lblFO, statsEl,
      U.h('div', {style:{marginLeft:'auto'}}, btnImport)
    ]);
    container.appendChild(controles);

    // Container do mapa
    var mapDiv = U.h('div', { id: 'trj-mapa', style: { height: '70vh', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--trj-border)' } });
    container.appendChild(mapDiv);

    // ── Legenda ──────────────────────────────────────────────────
    var legendEl = U.h('div', { style: {display:'flex',gap:'16px',flexWrap:'wrap',marginTop:'10px',fontSize:'11px',color:'var(--trj-muted)'} }, [
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'12px',height:'12px',borderRadius:'50%',background:'#e74c3c',display:'inline-block'}}), U.h('span',{text:'Site fora (FLAG 1)'})]),
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'12px',height:'12px',borderRadius:'50%',background:'#3498db',display:'inline-block'}}), U.h('span',{text:'Com TSK aberta'})]),
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'12px',height:'12px',borderRadius:'50%',background:'#9aa5b1',border:'1px solid #666',display:'inline-block'}}), U.h('span',{text:'FLAG 0'})]),
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'22px',height:'3px',background:'#9b59b6',display:'inline-block'}}), U.h('span',{text:'MW Nokia'})]),
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'22px',height:'3px',background:'#e74c3c',display:'inline-block'}}), U.h('span',{text:'MW Huawei'})]),
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'22px',height:'3px',background:'#f0b429',display:'inline-block'}}), U.h('span',{text:'MW Ceragon'})]),
      U.h('div',{style:{display:'flex',alignItems:'center',gap:'5px'}}, [U.h('span',{style:{width:'12px',height:'12px',borderRadius:'2px',background:'#2ecc71',display:'inline-block'}}), U.h('span',{text:'Hub FO'})]),
    ]);
    container.appendChild(legendEl);

    // ── Inicializar Leaflet ──────────────────────────────────────
    var mapInstance = null;
    var layerIncidentes = null, layerFlag0 = null, layerMW = null, layerFO = null;
    var allIncMarkers = [], allFlag0Markers = [], allMWLines = [], allFOMarkers = [];

    function getLeaflet(cb) {
      if (window.L) { cb(); return; }
      var cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet'; cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(cssLink);
      var script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = cb; document.head.appendChild(script);
    }

    function renderMapa() {
      getLeaflet(function() {
        if (!mapInstance) {
          mapInstance = window.L.map('trj-mapa', { preferCanvas: true })
            .setView([-22.3, -43.1], 8);

          // Tile escuro (CartoDB Dark)
          window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
          }).addTo(mapInstance);

          layerIncidentes = window.L.layerGroup().addTo(mapInstance);
          layerFlag0      = window.L.layerGroup(); // OFF por padrão
          layerMW         = window.L.layerGroup().addTo(mapInstance);
          layerFO         = window.L.layerGroup(); // OFF por padrão

          setupEventos();
        } else {
          layerIncidentes.clearLayers();
          layerFlag0.clearLayers();
          layerMW.clearLayers();
          layerFO.clearLayers();
          allIncMarkers = []; allFlag0Markers = []; allMWLines = []; allFOMarkers = [];
        }

        var incAtivos = incidents.filter(function(i){ return (i.statusTrat||'').toUpperCase() !== 'RESOLVIDO'; });
        var tasksEnriched = data.tasksEnriched || [];

        // Função para obter ícone SVG como URL
        function svgIcon(cor, size, shape) {
          size = size || 14;
          var svg;
          if (shape === 'square') {
            svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '">'
              + '<rect width="' + size + '" height="' + size + '" rx="3" fill="' + cor + '" stroke="#fff" stroke-width="1.5"/></svg>';
          } else {
            svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + (size+4) + '">'
              + '<circle cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + (size/2-1) + '" fill="' + cor + '" stroke="#fff" stroke-width="1.5"/>'
              + '<polygon points="' + (size/2-3) + ',' + (size-1) + ' ' + (size/2+3) + ',' + (size-1) + ' ' + (size/2) + ',' + (size+3) + '" fill="' + cor + '"/></svg>';
          }
          return window.L.divIcon({
            html: svg, className: '', iconSize: [size, shape==='square'?size:size+4],
            iconAnchor: [size/2, shape==='square'?size/2:size+4], popupAnchor: [0, -(size+4)]
          });
        }

        // ── Marcadores de incidentes (FLAG 1) ──────────────────
        var countComCoord = 0, countSemCoord = 0, countComTSK = 0;
        incAtivos.forEach(function(inc) {
          var eid  = inc.enderecoId || '';
          var coords = coordMap[eid];
          if (!coords) { countSemCoord++; return; }
          countComCoord++;

          var tsk = U.tskAberta ? U.tskAberta(inc, tasksEnriched) : null;
          if (tsk) countComTSK++;
          var cor = tsk ? '#3498db' : '#e74c3c';

          var marker = window.L.marker(coords, { icon: svgIcon(cor, 14) });
          var causa = inc.causa || inc.causaGrupo || '/';
          var popContent = '<div style="font-family:ui-monospace,monospace;font-size:12px;min-width:180px">'
            + '<b style="color:' + cor + '">' + (inc.site || eid) + '</b><br>'
            + '<span style="color:#888">END_ID:</span> ' + eid + '<br>'
            + '<span style="color:#888">Horário:</span> ' + (inc.horario || '—') + '<br>'
            + '<span style="color:#888">Duração:</span> ' + (inc.downtime || '—') + '<br>'
            + '<span style="color:#888">Causa:</span> ' + causa + '<br>'
            + (tsk ? '<span style="color:#888">TSK:</span> <b>' + tsk.osNumero + '</b><br>' : '')
            + '<span style="color:#888">Cidade:</span> ' + (inc.cidadeUf || '—') + '</div>';
          marker.bindPopup(popContent);
          marker.bindTooltip(inc.site || eid, { permanent: false, direction: 'top' });
          marker._dados = { eid: eid, site: inc.site || '', cidade: (inc.cidadeUf||'').split('/')[0].trim() };
          allIncMarkers.push(marker);
          marker.addTo(layerIncidentes);
        });

        // ── Marcadores FLAG 0 (sites coord sem incidente ativo) ─
        var eidsAtivos = new Set(incAtivos.map(function(i){ return i.enderecoId||''; }));
        Object.keys(coordMap).forEach(function(eid) {
          if (eidsAtivos.has(eid)) return;
          var coords = coordMap[eid];
          var marker = window.L.circleMarker(coords, {
            radius: 4, color: '#555', fillColor: '#777', fillOpacity: 0.5, weight: 1
          });
          marker.bindTooltip(eid, { permanent: false, direction: 'top' });
          marker._dados = { eid: eid, site: eid, cidade: '' };
          allFlag0Markers.push(marker);
          marker.addTo(layerFlag0);
        });

        // ── Polylines MW ──────────────────────────────────────────
        mwData.forEach(function(link) {
          function pc(s){ try { return parseFloat(String(s).replace(/\u00a0/g,'').replace(',','.')); } catch(e){ return null; } }
          var latA = pc(link.LAT_A), lonA = pc(link.LONG_A);
          var latB = pc(link.LAT_B), lonB = pc(link.LONG_B);
          if (!latA || !lonA || !latB || !lonB) return;
          var forn = (link.FORNECEDOR || '').toUpperCase();
          var cor = MW_CORES[forn] || MW_CORES.default;
          var enlace = link.Enlace2 || link.Enlace || '';
          var line = window.L.polyline([[latA, lonA], [latB, lonB]], {
            color: cor, weight: 1.5, opacity: 0.6, dashArray: forn === 'CERAGON' ? '4,4' : null
          });
          line.bindPopup('<b>' + enlace + '</b><br>' + (link.FORNECEDOR || '') + (link.PROJETO ? '<br>' + link.PROJETO : ''));
          allMWLines.push(line);
          line.addTo(layerMW);
        });

        // ── Marcadores Hub FO ──────────────────────────────────────
        foData.forEach(function(hub) {
          function pc(s){ try { return parseFloat(String(s).replace(/\u00a0/g,'').replace(',','.')); } catch(e){ return null; } }
          var lat = pc(hub.LAT_A), lon = pc(hub.LONG_A);
          if (!lat || !lon) return;
          var marker = window.L.marker([lat, lon], { icon: svgIcon('#2ecc71', 10, 'square') });
          marker.bindPopup('<b>' + (hub.HUB || hub.NEName || '') + '</b><br>'
            + (hub.FORNECEDOR||'') + (hub.PROJETO ? ' | ' + hub.PROJETO : ''));
          allFOMarkers.push(marker);
          marker.addTo(layerFO);
        });

        // Atualizar contadores
        statsEl.innerHTML = '';
        statsEl.appendChild(U.h('span',{text:'🔴 ' + countComCoord + ' sites fora no mapa'}));
        if (countComTSK) statsEl.appendChild(U.h('span',{text:'🔵 ' + countComTSK + ' com TSK'}));
        if (countSemCoord) statsEl.appendChild(U.h('span',{style:{color:'var(--trj-muted)'},text:'⚠️ ' + countSemCoord + ' sem coord'}));
        statsEl.appendChild(U.h('span',{text:'📡 ' + mwData.length + ' enlaces MW'}));
        statsEl.appendChild(U.h('span',{text:'🟢 ' + foData.length + ' hubs FO'}));
      });
    }

    function setupEventos() {
      chkFlag0.addEventListener('change', function(){
        if (chkFlag0.checked) layerFlag0.addTo(mapInstance);
        else layerFlag0.remove();
      });
      chkMW.addEventListener('change', function(){
        if (chkMW.checked) layerMW.addTo(mapInstance);
        else layerMW.remove();
      });
      chkFO.addEventListener('change', function(){
        if (chkFO.checked) layerFO.addTo(mapInstance);
        else layerFO.remove();
      });

      // Busca em tempo real
      var searchTimer = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function() {
          var q = searchInput.value.trim().toLowerCase();
          function match(m) {
            if (!q) return true;
            var d = m._dados || {};
            return (d.eid||'').toLowerCase().indexOf(q) >= 0
              || (d.site||'').toLowerCase().indexOf(q) >= 0
              || (d.cidade||'').toLowerCase().indexOf(q) >= 0;
          }
          allIncMarkers.forEach(function(m){ m.setOpacity(match(m) ? 1 : 0.1); });
          allFlag0Markers.forEach(function(m){ m.setStyle({ fillOpacity: match(m) ? 0.5 : 0.03, opacity: match(m) ? 0.5 : 0.03 }); });

          // Zoom para resultados
          if (q.length >= 3 && mapInstance) {
            var found = allIncMarkers.filter(match);
            if (found.length > 0 && found.length <= 5) {
              var bounds = window.L.latLngBounds(found.map(function(m){ return m.getLatLng(); }));
              mapInstance.fitBounds(bounds.pad(0.3));
            }
          }
        }, 250);
      });
    }

    if (!temDados) {
      // Banner de aviso se não tiver dados
      var banner = U.h('div', {
        style: { padding: '16px', background: 'rgba(240,180,41,.15)', border: '1px solid rgba(240,180,41,.4)', borderRadius: '10px', marginBottom: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '12px' }
      }, [
        U.h('span', { style: { fontSize: '24px' }, text: '⚠️' }),
        U.h('div', null, [
          U.h('b', { text: 'Sem coordenadas carregadas' }),
          U.h('p', { style: { margin: '4px 0 0', color: 'var(--trj-muted)', fontSize: '12px' }, text: 'Clique em "Importar Genesis" e selecione o arquivo HTML do painel G.E.N.E.S.I.S para carregar os dados de mapa.' })
        ])
      ]);
      container.insertBefore(banner, controles.nextSibling);
    }

    renderMapa();
  };

})(window.TRJ = window.TRJ || {});
