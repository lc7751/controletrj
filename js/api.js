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
    if (TRJ && TRJ.config && typeof TRJ.config.getApiUrl === 'function') {
      return TRJ.config.getApiUrl();
    }
    var u = (TRJ.config && TRJ.config.APPS_SCRIPT_URL) || '';
    return (u || '').toString().trim();
  }

  function getToken() {
    // Preferir a helper do config (localStorage-aware), cair back para TRJ.auth se existir
    try {
      if (TRJ && TRJ.config && typeof TRJ.config.getToken === 'function') return TRJ.config.getToken();
    } catch (e) { /* ignore */ }
    try {
      if (TRJ && TRJ.auth && typeof TRJ.auth.getToken === 'function') return TRJ.auth.getToken();
    } catch (e) { /* ignore */ }
    return '';
  }

  async function call(action, params) {
    var url = getUrl();
    if (!url) {
      throw new Error('URL do Apps Script não configurada. Edite o arquivo config.js e cole a URL que termina em /exec.');
    }

    var token = getToken() || '';
    // construir corpo: action + token + params
    var body = Object.assign({}, params || {});
    body.action = action;
    body.token = token;

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
      throw new Error('Resposta inesperada do servidor. Confirme que o Web App está publicado com acesso "Qualquer pessoa" e que a URL está correta.');
    }

    if (!data) throw new Error('Resposta vazia do servidor.');

    // Se o backend retornou ok:false, repassar erro
    if (data && data.ok === false) {
      throw new Error(data.error || 'Erro no servidor.');
    }

    return data;
  }

  // ---- Métodos por ação ----
  A.ping          = function ()            { return call('ping'); };
  A.login         = async function (email, pwd)  {
    var data = await call('login', { email: email, password: pwd });
    // salvar token retornado (se houver) usando TRJ.config.setToken
    try {
      if (data && data.ok && data.token && TRJ && TRJ.config && typeof TRJ.config.setToken === 'function') {
        TRJ.config.setToken(data.token);
      }
    } catch (e) { /* ignore */ }
    return data;
  };
  A.getCities     = function (opts)        { return call('getCities', opts || {}); };
  A.getCitiesMeta = function ()            { return call('getCitiesMeta'); };
  A.lookupCities  = function (ids)         { return call('lookupCities', { ids: ids || [] }); };
  A.getConfig     = function ()            { return call('getConfig'); };
  A.setConfig     = function (config)      { return call('setConfig', { config: config || {} }); };

  // Novo endpoint para salvar/atualizar cadastro de site
  A.saveSite = function (siteObj) {
    // siteObj esperado como objeto { enderecoId, site, cidade, ... } ou parecido
    return call('saveSite', { site: siteObj || {} });
  };

  // Helpers para manipular o token via API cliente (encapsula TRJ.config)
  A.getToken = function () {
    return getToken();
  };
  A.setToken = function (t) {
    try { if (TRJ && TRJ.config && typeof TRJ.config.setToken === 'function') TRJ.config.setToken(t); }
    catch (e) { /* ignore */ }
  };
  A.clearToken = function () {
    try { if (TRJ && TRJ.config && typeof TRJ.config.clearToken === 'function') TRJ.config.clearToken(); }
    catch (e) { /* ignore */ }
  };

  A.call = call;
  A.getUrl = getUrl;

  TRJ.api = A;
})(window.TRJ = window.TRJ || {});
