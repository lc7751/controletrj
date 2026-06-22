/* =====================================================================
 * config.js  —  CONFIGURAÇÃO DO SITE
 * ---------------------------------------------------------------------
 * Cole aqui a URL do seu Web App do Apps Script (a que termina em /exec).
 * Veja o passo a passo no arquivo LEIA-ME.md.
 *
 * Exemplo:
 *   APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycb..../exec"
 * ===================================================================== */
(function (TRJ) {
  TRJ.config = {
    // >>>>>>>>>>>>>>  COLE A URL DO SEU APPS SCRIPT AQUI  <<<<<<<<<<<<<<
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwuBPGxfIwz1q-Fqd3NBm4wwEe1rTeb9pd__POmbwg9Kk9AhDjHu1jCOhyKX9NRnQjnEA/exec",

    // Token de API gerado por configurarTudo() no Apps Script.
    // Opcional: pode deixar vazio e usar o token retornado pelo login, que será salvo em localStorage.
    // Ex.: "1a2b3c4d..."
    API_TOKEN: "",

    // Chave usada para armazenar token no localStorage após login
    API_TOKEN_STORAGE_KEY: "trj_token",

    // Nome exibido no topo (pode personalizar)
    APP_NAME: "CONTROLE TRJ",
    APP_SUB: "Operacional",

    // Intervalo de auto-atualização do dashboard (segundos). 0 = desligado.
    AUTO_REFRESH_SEG: 0,

    /* =======================
       Funções utilitárias
       Use TRJ.config.getApiUrl(), TRJ.config.getToken(), TRJ.config.setToken(token)
       para obter a URL e o token de forma consistente no frontend.
       ======================= */
    getApiUrl: function () {
      var u = (this.APPS_SCRIPT_URL || "").toString().trim();
      if (!u) return "";
      // garantir que termina em /exec (evitar barras duplicadas)
      u = u.replace(/\/+$/, "");
      if (!/\/exec$/.test(u)) u = u + "/exec";
      return u;
    },

    getToken: function () {
      var stored = null;
      try { stored = localStorage.getItem(this.API_TOKEN_STORAGE_KEY); } catch (e) { /* ignore */ }
      return (stored && stored.toString()) || (this.API_TOKEN && this.API_TOKEN.toString()) || "";
    },

    setToken: function (token) {
      try {
        if (token) localStorage.setItem(this.API_TOKEN_STORAGE_KEY, token);
        else localStorage.removeItem(this.API_TOKEN_STORAGE_KEY);
      } catch (e) { /* ignore storage errors (e.g., privacy mode) */ }
    },

    clearToken: function () {
      try { localStorage.removeItem(this.API_TOKEN_STORAGE_KEY); } catch (e) { /* ignore */ }
    },

    // Retorna payload-base usado nas chamadas para o Apps Script (ex.: fetch body)
    basePayload: function () {
      return { token: this.getToken() };
    }
  };
})(window.TRJ = window.TRJ || {});
