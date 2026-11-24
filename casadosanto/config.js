/* ============================================================
   CONFIGURAÇÃO DO SITE  (o único arquivo que você precisa editar)
   ============================================================
   erp: endereço do ERP (o painel da loja), SEM barra no final.
        Ex.: 'https://erp.casadosanto.com.br'
        Deixe '' (vazio) para o site funcionar só com WhatsApp,
        usando o catálogo do arquivo dados/vitrine.json.
   Se o ERP estiver desligado ou fora do ar, o site percebe sozinho
   e manda o pedido completo pelo WhatsApp. Ninguém fica sem pedir.

   Textos, cores, lojas, produtos e preços ficam em dados/vitrine.json
   (baixe pelo painel: Catálogo → "Baixar catálogo para o site"). */
window.SITE_CONFIG = {
  erp: '',
  tempoLimiteMs: 6000
};
