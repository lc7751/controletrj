/* =====================================================================
 * api.js  —  CLIENTE DE COMUNICAÇÃO COM O APPS SCRIPT
 * ---------------------------------------------------------------------
 * Faz todas as chamadas para o backend (a Planilha Google via Apps Script).
 * Usa Content-Type "text/plain" de propósito: assim o navegador NÃO faz
 * a requisição extra de "preflight" (OPTIONS), que o Apps Script não
 * sabe responder. O corpo continua sendo um JSON.
 * ===================================================================== */
(function (TRJ) {
  var A = {};

  function getUrl() {
    var u = (TRJ.config && TRJ.config.APPS_SCRIPT_URL || '').trim();
    return u;
  }

  // Chamada genérica. action = nome da operação; params = objeto extra.
  async function call(action, params) {
    var url = getUrl();
    if (!url) {
      throw new Error('URL do Apps Script não configurada. Edite o arquivo js/config.js e cole a URL que termina em /exec.');
    }
    var token = (TRJ.auth && TRJ.auth.getToken && TRJ.auth.getToken()) || '';
    var body = Object.assign({ action: action, token: token }, params || {});

    var resp;
    try {
      resp = await fetch(url, {
        method: 'POST',
        // text/plain evita o preflight CORS (OPTIONS) no Apps Script
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('Falha de rede ao contatar o servidor. Verifique sua conexão e a URL do Apps Script.');
    }

    var txt = await resp.text();
    var data;
    try {
      data = JSON.parse(txt);
    } catch (e) {
      // Resposta não-JSON normalmente é uma página de erro/login do Google.
      throw new Error('Resposta inesperada do servidor. Confirme que o Web App está publicado com acesso "Qualquer pessoa".');
    }
    if (data && data.ok === false) {
      throw new Error(data.error || 'Erro no servidor.');
    }
    return data;
  }

  // ---- Métodos por ação ----
  A.ping          = function ()            { return call('ping'); };
  A.login         = function (email, pwd)  { return call('login', { email: email, password: pwd }); };
  A.getCities     = function (opts)        { return call('getCities', opts || {}); };
  A.getCitiesMeta = function ()            { return call('getCitiesMeta'); };
  A.lookupCities  = function (ids)         { return call('lookupCities', { ids: ids || [] }); };
  A.getConfig     = function ()            { return call('getConfig'); };
  A.setConfig     = function (config)      { return call('setConfig', { config: config || {} }); };

  A.call = call;
  A.getUrl = getUrl;
  TRJ.api = A;
})(window.TRJ = window.TRJ || {});
