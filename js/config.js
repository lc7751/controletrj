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
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwC32_8_GXfgJVbOCtZJVFDNWtR21LNb8OThElbZo2PRfbv5VmEZ6DW11Yca_h_U0_reA/exec",

    // Nome exibido no topo (pode personalizar)
    APP_NAME: "CONTROLE TRJ",
    APP_SUB: "Operacional",

    // Intervalo de auto-atualização do dashboard (segundos). 0 = desligado.
    AUTO_REFRESH_SEG: 0
  };
})(window.TRJ = window.TRJ || {});
