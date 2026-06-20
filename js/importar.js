// importar.js - importação de arquivos e parser de incidentes via texto
(function(){
  function showMsg(elId, msg, kind='info'){
    const el = document.getElementById(elId);
    if(el) el.innerText = msg;
  }

  function detectSeparator(line){
    if(!line) return ';';
    if(line.indexOf(';')>=0) return ';';
    if(line.indexOf('|')>=0) return '|';
    if(line.indexOf('	')>=0) return '	';
    if(line.indexOf(',')>=0) return ',';
    return ';';
  }

  function parseIncidentesText(text){
    const lines = text.split(/?
/).map(l=>l.trim()).filter(Boolean);
    if(lines.length===0) return [];
    const sep = detectSeparator(lines[0]);
    const firstCols = lines[0].split(sep).map(c=>c.trim().toUpperCase());
    const hasHeader = ['END_ID','SITE','BAIRRO','RESPONSÁVEL','RESPONSAVEL','DATA'].some(h=> firstCols.includes(h));
    const results = [];
    let startIdx = hasHeader ? 1 : 0;
    for(let i=startIdx;i<lines.length;i++){
      const cols = lines[i].split(sep).map(c=>c.trim());
      let obj = {};
      if(hasHeader){
        firstCols.forEach((h, idx)=> obj[h] = cols[idx] || '');
      } else {
        obj['END_ID'] = cols[0] || '';
        obj['SITE'] = cols[1] || '';
        obj['BAIRRO'] = cols[2] || '';
        obj['RESPONSAVEL'] = cols[3] || '';
        obj['DATA'] = cols[4] || '';
        obj['OBS'] = cols.slice(5).join(' ') || '';
      }
      results.push(obj);
    }
    return results;
  }

  document.addEventListener('DOMContentLoaded', function(){
    const btnParse = document.getElementById('btn-parse-incidentes');
    const txt = document.getElementById('incidentes-text');
    const result = document.getElementById('incidentes-parse-result');
    const fileInput = document.getElementById('file-input');
    const btnProcess = document.getElementById('btn-process-upload');
    const btnConnect = document.getElementById('btn-connect-folder');

    btnParse && btnParse.addEventListener('click', () => {
      const text = txt.value || '';
      const parsed = parseIncidentesText(text);
      if(parsed.length===0){
        showMsg('incidentes-parse-result','Nenhum incidente detectado. Verifique o formato.');
        return;
      }
      console.log('Incidentes detectados:', parsed);
      showMsg('incidentes-parse-result', `Detectados ${parsed.length} incidentes. Importando...`);
      if(window.TRJ && TRJ.api && TRJ.api.importIncidentes){
        TRJ.api.importIncidentes(parsed).then(()=> showMsg('incidentes-parse-result','Incidentes importados com sucesso.'))
          .catch(e=> showMsg('incidentes-parse-result','Erro ao importar: '+(e.message||e)));
      } else {
        const stored = JSON.parse(localStorage.getItem('trj_incidentes')||'[]').concat(parsed);
        localStorage.setItem('trj_incidentes', JSON.stringify(stored));
        showMsg('incidentes-parse-result','Incidentes gravados localmente (fallback).');
        // Dispatch event to notify other parts
        document.dispatchEvent(new CustomEvent('trj:incidentesImported', { detail: { count: parsed.length } }));
      }
    });

    btnProcess && btnProcess.addEventListener('click', () => {
      const files = fileInput.files;
      if(!files || files.length===0){
        alert('Selecione um arquivo para upload.');
        return;
      }
      const f = files[0];
      const reader = new FileReader();
      reader.onload = function(e){
        const data = e.target.result;
        let workbook = XLSX.read(data, {type:'binary'});
        const first = workbook.SheetNames[0];
        const sheet = workbook.Sheets[first];
        const json = XLSX.utils.sheet_to_json(sheet, {defval:''});
        if(window.TRJ && TRJ.files && TRJ.files.setTasks){
          TRJ.files.setTasks(json);
        } else {
          localStorage.setItem('trj_tasks', JSON.stringify(json));
        }
        document.dispatchEvent(new CustomEvent('trj:tasksLoaded'));
        alert('Arquivo processado com sucesso.');
      };
      reader.readAsBinaryString(f);
    });

    btnConnect && btnConnect.addEventListener('click', async () => {
      if(window.TRJ && TRJ.files && TRJ.files.connectFolder){
        try {
          await TRJ.files.connectFolder();
          alert('Pasta conectada. Monitoração automática iniciada.');
        } catch(err){ alert('Não foi possível conectar a pasta: '+err.message); }
      } else alert('Função de conexão de pasta não implementada.');
    });

  });

})();
