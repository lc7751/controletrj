// sites-fora.js - módulo antigo mantido como fallback
(function(){
  function importFromFile(fallbackJson){
    // implementação legacy — se quiser, adapte para chamar TRJ.files.setTasks
    console.log('sites-fora import called', fallbackJson);
    alert('Import (legacy) executed.');
  }
  window.TRJ = window.TRJ || {}; window.TRJ.sitesFora = window.TRJ.sitesFora || {}; window.TRJ.sitesFora.importFromFile = importFromFile;
})();
