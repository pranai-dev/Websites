/* Vitrine (site estático) – funciona em dois modos:
   - COM ERP (config.js → erp): catálogo, preços e pedidos vêm do ERP. O pedido fica registrado lá
     (estoque reservado, comissão do vendedor, acompanhamento) e o cliente avisa a loja pelo WhatsApp.
   - SEM ERP (ERP desligado, fora do ar ou não configurado): usa dados/vitrine.json e o pedido
     vai completo pelo WhatsApp da loja escolhida. O site nunca deixa o cliente sem conseguir pedir.
   O navegador só guarda a sacola e, se o cliente permitir, os dados dele (localStorage). */
(function () {
  'use strict';

  /* ---------- utilitários ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const soDig = t => String(t || '').replace(/\D/g, '');
  /* ícones vetoriais (traço), herdam a cor do texto */
  const svg = (d, t) => '<svg class="ico" viewBox="0 0 24 24" width="' + (t || 22) + '" height="' + (t || 22) + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
  const IC = {
    loja: svg('<path d="M3 9.5 4.5 4h15L21 9.5"/><path d="M4 9.5V20h16V9.5"/><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M10 20v-5h4v5"/>'),
    entrega: svg('<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    brasil: svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>'),
    preco: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>'),
    pagamento: svg('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>'),
    check: svg('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9"/>'),
    imagem: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>', 34),
    camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 14),
    sacola: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', 44),
    whats: '<svg class="ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>',
    ok: svg('<circle cx="12" cy="12" r="10"/><path d="m7.5 12.5 3 3 6-6.5"/>', 52)
  };
  const icone = k => IC[k] && k !== 'whats' ? IC[k] : IC.check;
  const CFG = window.SITE_CONFIG || {};
  const ERP = String(CFG.erp || '').trim().replace(/\/+$/, '');
  const TEMPO = Number(CFG.tempoLimiteMs) || 6000;
  const imgOk = u => /^(fotos\/[\w.\-\/]+|https?:\/\/\S+)$/.test(String(u || ''));

  const mem = {
    ler(k, padrao) { try { const v = localStorage.getItem('cds:' + k); return v == null ? padrao : JSON.parse(v); } catch (e) { return padrao; } },
    gravar(k, v) { try { localStorage.setItem('cds:' + k, JSON.stringify(v)); } catch (e) { /* navegador sem armazenamento */ } },
    apagar(k) { try { localStorage.removeItem('cds:' + k); } catch (e) { /* idem */ } }
  };

  async function api(metodo, url, corpo, ms) {
    const op = { method: metodo, headers: { Accept: 'application/json' }, credentials: 'omit', cache: 'no-store' };
    if (corpo !== undefined) { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(corpo); }
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    if (ctl) { op.signal = ctl.signal; setTimeout(() => ctl.abort(), ms || TEMPO); }
    let r;
    try { r = await fetch(url, op); } catch (e) { throw Object.assign(new Error('Sem conexão. Verifique a internet e tente de novo.'), { status: 0 }); }
    let j = null; try { j = await r.json(); } catch (e) { /* sem corpo */ }
    if (!r.ok) throw Object.assign(new Error((j && j.erro) || 'Erro ' + r.status), { status: r.status, dados: j });
    return j;
  }

  let toastT;
  function toast(msg, ms) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms || 3200);
  }

  /* ---------- estado ---------- */
  const E = {
    loja: null, site: {}, rec: {}, categorias: [], produtos: [], porId: {}, catPorId: {},
    cat: 'todos', busca: '',
    sacola: mem.ler('sacola', []),          // [{id, q}]
    cliente: mem.ler('cliente', null),      // {nome, tel, end, bairro, entrega, loja, pag}
    ref: mem.ler('ref', null),              // {codigo, nome, ate}
    entrega: 'Entrega', endConfirmado: false, lojaManual: false,
    calc: null, chave: null, enviando: false, ultimoFoco: null,
    online: false                           // true = ERP respondeu
  };

  /* ---------- preço e quantidade (mesma regra do servidor) ---------- */
  const passoDe = p => p.un === 'g' ? (p.passo || 100) : 1;
  const precoFinal = p => p.desconto > 0 ? Math.round(p.preco * (100 - p.desconto) / 100) : p.preco;   // mesma regra do ERP
  const valorItem = (p, q) => p.un === 'g' ? Math.round(precoFinal(p) * q / (p.base || 100)) : precoFinal(p) * q;
  const qtdTxt = (p, q) => p.un === 'g' ? (q >= 1000 ? (q / 1000).toLocaleString('pt-BR') + ' kg' : q + ' g') : q + ' un';
  const unPreco = p => p.un === 'g' ? ((p.base || 100) === 1000 ? '/kg' : '/' + (p.base || 100) + ' g') : '/un';
  const maxQ = p => p.un === 'g' ? 100000 : 999;
  const qNaSacola = id => (E.sacola.find(i => i.id === id) || {}).q || 0;

  function mudarQtd(id, delta) {
    const p = E.porId[id]; if (!p) return;
    const passo = passoDe(p);
    let it = E.sacola.find(i => i.id === id);
    if (!it) { if (delta <= 0) return; it = { id, q: 0 }; E.sacola.push(it); }
    it.q = Math.min(maxQ(p), Math.max(0, it.q + delta * passo));
    if (!it.q) E.sacola = E.sacola.filter(i => i.id !== id);
    if (E.sacola.length > 50) { E.sacola.pop(); toast('Limite de 50 produtos diferentes por pedido.'); }
    salvarSacola(); renderGrid(); renderSacola(); renderDestaque(); renderCtlProduto();
  }
  function salvarSacola() { mem.gravar('sacola', E.sacola); $('#qtdSacola').textContent = E.sacola.length; E.chave = null; }

  /* ---------- link do vendedor (?v= ou ?ref=) ---------- */
  async function tratarRef() {
    const u = new URL(location.href);
    const cod = u.searchParams.get('v') || u.searchParams.get('ref');
    if (!cod) return;
    u.searchParams.delete('v'); u.searchParams.delete('ref');
    history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
    const codigo = cod.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
    if (!codigo || (E.ref && E.ref.ate > Date.now())) return;     // o primeiro vendedor vale por 30 dias
    let nome = null;
    if (ERP) {
      try { const r = await api('POST', ERP + '/api/ref', { codigo }, 4000); if (!r || !r.ok) return; nome = r.nome; }
      catch (e) { /* ERP fora: guarda o código mesmo assim; a loja vê no WhatsApp */ }
    }
    E.ref = { codigo, nome, ate: Date.now() + 30 * 864e5 };
    mem.gravar('ref', E.ref);
    if (nome) toast('Você está sendo atendido(a) por ' + nome + '.');
  }
  if (E.ref && E.ref.ate < Date.now()) { E.ref = null; mem.apagar('ref'); }

  /* ---------- carregar vitrine ---------- */
  async function carregar() {
    let v = null;
    if (ERP) { try { v = await api('GET', ERP + '/api/vitrine', undefined, 4000); E.online = true; } catch (e) { E.online = false; } }
    if (!v) {
      try { v = await api('GET', 'dados/vitrine.json', undefined, 8000); }
      catch (e) { $('#grid').innerHTML = '<div class="vz">Não foi possível carregar os produtos. <button class="b2" id="tentar">Tentar de novo</button></div>'; $('#tentar').onclick = carregar; $('#aviso').textContent = e.message; return; }
    }
    E.loja = v.loja; E.site = (v.loja && v.loja.site) || {}; E.rec = (v.loja && v.loja.recursos) || {};
    aplicarTema(); E.categorias = v.categorias || []; E.produtos = v.produtos || [];
    E.porId = {}; E.produtos.forEach(p => { E.porId[p.id] = p; });
    E.catPorId = {}; E.categorias.forEach(c => { E.catPorId[c.id] = c; });
    // sacola guardada: descarta o que saiu do catálogo e ajusta ao passo atual
    const antes = E.sacola.length;
    E.sacola = E.sacola.filter(i => E.porId[i.id] && Number.isInteger(i.q) && i.q > 0).map(i => { const p = E.porId[i.id], s = passoDe(p); return { id: i.id, q: Math.min(maxQ(p), Math.max(s, Math.round(i.q / s) * s)) }; });
    if (E.sacola.length < antes) toast('Alguns itens da sua sacola não estão mais disponíveis e foram retirados.');
    salvarSacola();
    E.vista = E.vista || 'home';
    renderLoja(); renderMenu(); renderCats(); renderDestaque(); renderGrid(); renderLojas(); prepararForm(); renderSacola();
  }

  /* ---------- tema (cores) e módulos ligados/desligados ---------- */
  function aplicarTema() {
    const t = E.site.tema || {}, r = document.documentElement.style;
    const mapa = { primaria: '--primaria', primariaEscura: '--primaria-escura', destaque: '--destaque', destaqueClara: '--destaque-clara', fundo: '--fundo', texto: '--texto', whatsapp: '--verde' };
    Object.keys(mapa).forEach(k => { if (/^#[0-9a-f]{3,8}$/i.test(t[k] || '')) r.setProperty(mapa[k], t[k]); });
    if (t.primaria) document.querySelector('meta[name=theme-color]').content = t.primaria;
    const umaLoja = E.rec.multiLojas === false || (E.loja.unidades || []).length < 2;
    $('#lblLoja').hidden = umaLoja;
    $('#btEnvio').hidden = E.rec.envio === false;
    if (E.rec.entrega === false) { $('#titEntrega').hidden = true; $('#segEntrega').hidden = true; definirEntrega('Retirada na loja'); }
  }

  /* ---------- cabeçalho, hero, rodapé ---------- */
  function waLink(num, texto) { return 'https://wa.me/' + soDig(num) + (texto ? '?text=' + encodeURIComponent(texto) : ''); }
  function renderLoja() {
    const L = E.loja;
    const S = E.site;
    document.title = S.titulo || L.nome;
    if (S.descricao) document.querySelector('meta[name=description]').content = S.descricao;
    $('#marcaNome').textContent = L.nome; $('#rodNome').textContent = L.nome; if (L.simbolo) { $('#marcaSimbolo').textContent = L.simbolo; $('#marcaSimbolo').hidden = false; }
    $('#marcaSub').textContent = (L.cidade || '') + (L.uf ? ' · ' + L.uf : '');
    if (L.logoUrl && imgOk(L.logoUrl)) {
      const im = $('#marcaLogo'); im.src = L.logoUrl; im.alt = L.nome;
      im.onload = () => { im.hidden = false; $('#marcaSimbolo').hidden = true; };
      im.onerror = () => { im.hidden = true; $('#marcaSimbolo').hidden = !L.simbolo; };
    }
    $('#heroSobre').textContent = (S.tipoLoja || 'Nossa loja') + (L.cidade ? ' em ' + L.cidade : '');
    $('#heroTitulo').innerHTML = esc(S.heroTitulo || L.nome).replace(/\*([^*]+)\*/g, '<em>$1</em>');     // *palavra* = destaque
    if (S.buscaExemplo) $('#busca').placeholder = S.buscaExemplo;
    $('#privacidade').textContent = S.privacidade || 'Usamos seus dados apenas para preparar e entregar o seu pedido.';
    $('#heroTexto').textContent = L.subtitulo || '';
    $('#rodape').textContent = L.rodape || '';
    const msgOi = 'Olá! Vim pelo site da ' + L.nome + '.';
    $('#heroWa').href = waLink(L.whatsapp, msgOi); $('#fab').href = waLink(L.whatsapp, msgOi);
    const fr = L.frete || {};
    $('#aviso').innerHTML = esc((L.selos || []).map(s => s.replace(/^✓\s*/, '')).join(' · ')) +
      (fr.gratisAcimaCentavos ? ' · <b>Frete grátis acima de ' + esc(brl(fr.gratisAcimaCentavos)) + '</b>' : '');
    const difs = (S.diferenciais || []).slice(0, 3).map(d => ({ i: icone(d.icone), b: d.titulo || '', s: d.texto || '' }));
    difs.push({ i: IC.pagamento, b: 'Pague como preferir', s: (L.pagamentos || []).join(', ') });
    $('#difs').innerHTML = difs.map(d => '<div><i>' + d.i + '</i><span><b>' + esc(d.b) + '</b><small>' + esc(d.s) + '</small></span></div>').join('');
  }

  /* ---------- categorias ---------- */
  function renderMenu() {
    const bt = (id, nome) => '<button type="button" data-cat="' + esc(id) + '"' + (E.vista !== 'home' && E.cat === id ? ' class="on" aria-current="true"' : '') + '>' + esc(nome) + '</button>';
    $('#menuCats').innerHTML = bt('todos', 'Todos') + E.categorias.map(c => bt(c.id, c.nome)).join('');
    $('#chipsCats').innerHTML = $('#menuCats').innerHTML;
  }
  function renderCats() {
    $('#cats').innerHTML = E.categorias.map(c => {
      const n = E.produtos.filter(p => p.cat === c.id).length;
      const capa = imgOk(c.img) ? c.img : (E.produtos.find(p => p.cat === c.id && imgOk(p.img)) || {}).img;     // foto da categoria ou de um produto dela
      return '<button type="button" class="cat" data-cat="' + esc(c.id) + '"><div class="im" style="--bg:' + esc(c.bg || '#f1efe6') + '">' + (capa ? '<img src="' + esc(capa) + '" alt="" loading="lazy" data-semfoto="1">' : semFoto()) + '</div><b>' + esc(c.nome) + '</b><small>' + n + ' produto' + (n === 1 ? '' : 's') + '</small></button>';
    }).join('');
  }
  /* páginas: início (#), categoria (#categoria-ID), todos os produtos (#todos). O produto abre por cima (#produto-ID). */
  let homeY = 0;
  function irPara(hash) {
    if (location.hash === hash || (!hash && !location.hash)) return aplicarRota();
    E.veioDoInicio = E.vista === 'home';
    history.pushState(null, '', hash || (location.pathname + location.search));
    aplicarRota();
  }
  function definirVista(tipo, cat) {
    const mudou = E.vista !== tipo || (tipo === 'cat' && E.cat !== cat);
    if (mudou && E.vista === 'home') homeY = scrollY;
    E.vista = tipo; E.cat = tipo === 'cat' && E.catPorId[cat] ? cat : 'todos';
    if (tipo !== 'todos') { E.busca = ''; $('#busca').value = ''; }
    const home = tipo === 'home';
    $('#vHero').hidden = !home; $('#vDif').hidden = !home; $('#vHome').hidden = !home; $('#vPagina').hidden = home;
    renderMenu(); renderGrid();
    if (mudou) { if (home) { scrollTo(0, homeY); requestAnimationFrame(() => scrollTo(0, homeY)); } else scrollTo(0, 0); }
  }
  function aplicarRota() {
    const h = location.hash; let m;
    if ((m = h.match(/^#produto-(.+)$/))) { if (!E.vista) definirVista('home'); if (E.loja) abrirProduto(decodeURIComponent(m[1]), false); return; }
    if (pmAberto) fecharProduto(true);
    if ((m = h.match(/^#categoria-(.+)$/))) definirVista('cat', decodeURIComponent(m[1]));
    else if (h === '#todos') definirVista('todos');
    else definirVista('home');
  }
  const escolherCat = id => irPara(id === 'todos' ? '#todos' : '#categoria-' + encodeURIComponent(id));

  /* ---------- produtos ---------- */
  const semFoto = () => '<span class="semfoto">' + IC.imagem + '</span>';
  function foto(p, cls) {
    if (!p.img || !imgOk(p.img)) return semFoto();
    return '<img src="' + esc(p.img) + '" alt="' + esc(p.nome) + '" loading="lazy" data-semfoto="1"' + (cls ? ' class="' + cls + '"' : '') + '>';
  }
  function precoHtml(p) {
    return (p.desconto > 0 ? '<s>' + brl(p.preco) + '</s> ' : '') + brl(precoFinal(p)) + ' <small>' + esc(unPreco(p)) + '</small>';
  }
  const seloDesc = p => p.desconto > 0 ? '<span class="off">-' + String(p.desconto).replace('.', ',') + '%</span>' : '';
  function cartao(p) {
    const cat = E.catPorId[p.cat] || {};
    const tag = p.tag ? '<span class="sel' + (/fict/i.test(p.tag) ? ' ft' : '') + '">' + esc(p.tag) + '</span>' : '';
    const q = qNaSacola(p.id);
    return '<article class="card" data-ver="' + esc(p.id) + '" tabindex="0" aria-label="' + esc(p.nome) + ' – ver detalhes">' +
      '<div class="ph" style="--bg:' + esc(cat.bg || '#f1efe6') + '">' + foto(p) + tag + seloDesc(p) + ((p.imgs || []).length ? '<span class="nf">' + IC.camera + ' ' + (1 + p.imgs.length) + '</span>' : '') + '</div>' +
      '<div class="cb"><small>' + esc(cat.nome || '') + '</small><h3>' + esc(p.nome) + '</h3><p>' + esc(p.desc || '') + '</p>' +
      '<div class="pr">' + precoHtml(p) + '</div>' +
      (q ? controle(p) : '<button type="button" class="add" data-ver="' + esc(p.id) + '">Ver detalhes</button>') + '</div></article>';
  }
  function controle(p) {
    const q = qNaSacola(p.id);
    if (!q) return '<button type="button" class="add" data-mais="' + esc(p.id) + '">Adicionar' + (p.un === 'g' ? ' ' + qtdTxt(p, passoDe(p)) : '') + '</button>';
    return '<div class="stp"><button type="button" data-menos="' + esc(p.id) + '" aria-label="Diminuir ' + esc(p.nome) + '">−</button><span aria-live="polite">' + esc(qtdTxt(p, q)) + '</span><button type="button" data-mais="' + esc(p.id) + '" aria-label="Aumentar ' + esc(p.nome) + '">+</button></div>';
  }
  function filtrados() {
    const b = norm(E.busca).trim();
    return E.produtos.filter(p => (E.cat === 'todos' || p.cat === E.cat) &&
      (!b || b.split(/\s+/).every(t => norm(p.nome + ' ' + (p.desc || '') + ' ' + ((E.catPorId[p.cat] || {}).nome || '')).includes(t))));
  }
  function renderGrid() {
    const ps = filtrados();
    const c = E.catPorId[E.cat];
    $('#titProdutos').textContent = E.busca ? 'Resultado da busca' : (c ? c.nome : 'Todos os produtos');
    $('#contProdutos').textContent = ps.length + ' produto' + (ps.length === 1 ? '' : 's');
    $('#grid').innerHTML = ps.length ? ps.map(cartao).join('') :
      '<div class="vz">Nenhum produto encontrado' + (E.busca ? ' para “' + esc(E.busca) + '”' : '') + '.<br><button type="button" class="b2" data-limpar style="margin-top:12px">Ver todos os produtos</button>' +
      (E.loja ? ' <a class="b2" style="margin-top:12px;display:inline-block" target="_blank" rel="noopener" href="' + esc(waLink(E.loja.whatsapp, 'Olá! Vocês têm ' + (E.busca || 'este produto') + '?')) + '">Perguntar no WhatsApp</a>' : '') + '</div>';
    const pref = E.produtos.filter(p => p.tag && !/fict/i.test(p.tag)).concat(E.produtos.filter(p => !p.tag || /fict/i.test(p.tag)));
    $('#gridHome').innerHTML = pref.slice(0, 8).map(cartao).join('');
    renderDestaques();
  }
  function renderDestaques() {
    const ds = E.produtos.filter(p => p.destaque);
    $('#secDestaques').hidden = !ds.length;
    $('#gridDestaques').innerHTML = ds.map(cartao).join('');
  }
  function renderDestaque() {
    const p = E.produtos.find(x => x.destaque) || E.produtos.find(x => /mais vendido/i.test(x.tag || '')) || E.produtos.find(x => x.tag && !/fict/i.test(x.tag)) || E.produtos[0];
    const d = $('#destaque');
    if (!p) { d.hidden = true; return; }
    const cat = E.catPorId[p.cat] || {};
    d.innerHTML = '<div class="ft" style="background:' + esc(cat.bg || '#eee') + ';display:grid;place-items:center;font-size:4rem">' + foto(p) + '</div>' +
      (p.tag || p.destaque ? '<span class="lb">' + esc(p.tag || 'Destaque') + '</span>' : '') +
      '<div class="tx"><div><h3>' + esc(p.nome) + '</h3><small>' + esc(cat.nome || '') + '</small></div><div class="pc">' + (p.desconto > 0 ? '<s>' + brl(p.preco) + '</s>' : '') + brl(precoFinal(p)) + '<span>' + esc(unPreco(p)) + '</span></div></div>' +
      '<button type="button" class="add" data-ver="' + esc(p.id) + '">Ver detalhes</button>';
    d.dataset.ver = p.id;
    d.hidden = false;
  }

  /* ---------- lojas ---------- */
  function horarioTxt(h) {
    if (!h) return '';
    const f = x => x ? x[0] + '–' + x[1] : 'fechado';
    return 'Seg a sex ' + f(h.seg_sex) + ' · Sáb ' + f(h.sab) + ' · Dom ' + f(h.dom);
  }
  function renderLojas() {
    $('#listaLojas').innerHTML = E.loja.unidades.map(u =>
      '<a class="lj" href="' + esc(waLink(u.whatsapp, 'Olá! Vim pelo site da ' + E.loja.nome + ((E.loja.unidades || []).length > 1 ? ' (loja ' + u.nome + ')' : '') + '.')) + '" target="_blank" rel="noopener">' +
      '<h3>' + esc(u.nome) + '</h3><p>' + esc(horarioTxt(u.horario)) + '</p>' + '<b>' + IC.whats + ' Chamar no WhatsApp</b></a>').join('');
  }

  /* ---------- sacola (gaveta) ---------- */
  function abrir() {
    if ($('#sacola').classList.contains('on')) return;
    E.ultimoFoco = document.activeElement;
    $('#ov').classList.add('on'); const d = $('#sacola'); d.classList.add('on'); d.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => (d.querySelector('.x') || d).focus(), 60);
  }
  function fechar() {
    $('#ov').classList.remove('on'); const d = $('#sacola'); d.classList.remove('on'); d.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (/^#pedido-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    if ($('#final').dataset.feito === '1') { $('#final').hidden = true; $('#final').dataset.feito = ''; renderSacola(); }
    if (E.ultimoFoco && E.ultimoFoco.focus) E.ultimoFoco.focus();
  }
  // mantém o Tab dentro da gaveta enquanto aberta
  function prenderFoco(ev) {
    const d = $('#sacola'); if (!d.classList.contains('on') || ev.key !== 'Tab') return;
    const f = Array.from(d.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled && el.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
    else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
  }

  function subtotalLocal() { return E.sacola.reduce((s, i) => s + (E.porId[i.id] ? valorItem(E.porId[i.id], i.q) : 0), 0); }

  function renderSacola() {
    if ($('#final').hidden === false) return;               // tela de pedido enviado/acompanhamento
    $('#sacolaTit').textContent = 'Sua sacola';
    const vazio = !E.sacola.length;
    $('#rodSacola').hidden = vazio;
    $('#form').hidden = vazio;
    $('#btnFinalizar').disabled = vazio || E.enviando;
    if (vazio) {
      $('#itens').innerHTML = '<div class="vzs"><p class="vzi">' + IC.sacola + '</p><p>Sua sacola está vazia.</p><button type="button" class="b2" data-fechar style="margin-top:14px">Escolher produtos</button></div>';
      return;
    }
    $('#itens').innerHTML = E.sacola.map(i => {
      const p = E.porId[i.id], cat = E.catPorId[p.cat] || {};
      return '<div class="ln"><div class="mi" style="--bg:' + esc(cat.bg || '#eee') + '">' + foto(p) + '</div>' +
        '<div class="t"><b>' + esc(p.nome) + '</b><small>' + (p.desconto > 0 ? '<s>' + brl(p.preco) + '</s> ' : '') + brl(precoFinal(p)) + ' ' + esc(unPreco(p)) + ' · ' + brl(valorItem(p, i.q)) + '</small></div>' +
        '<div class="qt"><button type="button" data-menos="' + esc(p.id) + '" aria-label="Diminuir ' + esc(p.nome) + '">−</button><span>' + esc(qtdTxt(p, i.q)) + '</span><button type="button" data-mais="' + esc(p.id) + '" aria-label="Aumentar ' + esc(p.nome) + '">+</button></div></div>';
    }).join('');
    $('#vSub').textContent = brl(subtotalLocal());
    pedirCalculo();
  }

  /* frete por bairro e loja sugerida: mesma regra do ERP (o ERP recalcula tudo ao receber o pedido) */
  function calculoLocal(bairro) {
    const L = E.loja, f = L.frete || {}, b = norm(bairro).trim();
    const subtotal = subtotalLocal();
    let frete = 0, aCombinar = false;
    if (E.entrega === 'Envio') aCombinar = true;                 // outras cidades: Correios/transportadora, frete combinado
    else if (E.entrega === 'Entrega' && !(f.gratisAcimaCentavos && subtotal >= f.gratisAcimaCentavos)) {
      const x = (f.bairros || []).find(y => norm(y.nome) === b);
      if (x) frete = x.centavos; else aCombinar = true;
    }
    const u = (E.entrega === 'Envio' && (L.unidades || []).find(y => y.nome === L.lojaEnvio)) ||
      (L.unidades || []).find(y => (y.bairros || []).some(nm => norm(nm) === b)) || (L.unidades || [])[0] || {};
    return { subtotal, frete, freteACombinar: aCombinar, total: subtotal + frete, lojaSugerida: u.nome };
  }
  let calcT, calcN = 0;
  function pedirCalculo() { clearTimeout(calcT); calcT = setTimeout(calcular, 250); }
  async function calcular() {
    if (!E.sacola.length) return;
    const n = ++calcN;
    const bairro = $('#fBairro').value.trim();
    try {
      const r = calculoLocal(bairro);
      if (n !== calcN) return;
      E.calc = r;
      $('#vSub').textContent = brl(r.subtotal);
      $('#vFrete').textContent = E.entrega === 'Retirada na loja' ? 'Retirada (grátis)' : E.entrega === 'Envio' ? 'a combinar (envio)' : r.freteACombinar ? (bairro ? 'a combinar' : 'informe o bairro') : (r.frete ? brl(r.frete) : 'grátis');
      $('#vTot').textContent = brl(r.total) + (E.entrega !== 'Retirada na loja' && r.freteACombinar ? ' + frete' : '');
      if (!E.lojaManual && r.lojaSugerida) $('#fLoja').value = r.lojaSugerida;
      atualizarIndic();
    } catch (e) {
      if (n !== calcN) return;
      E.calc = null; $('#vFrete').textContent = '—';
      if (e.dados && e.dados.produto) { E.sacola = E.sacola.filter(i => i.id !== e.dados.produto); salvarSacola(); renderGrid(); renderSacola(); }
      toast(e.message);
    }
  }

  /* ---------- formulário de checkout ---------- */
  function prepararForm() {
    const L = E.loja;
    $('#listaBairros').innerHTML = ((L.frete && L.frete.bairros) || []).map(b => '<option value="' + esc(b.nome) + '">' + esc(b.nome + ' – ' + brl(b.centavos)) + '</option>').join('');
    $('#fLoja').innerHTML = L.unidades.map(u => '<option>' + esc(u.nome) + '</option>').join('');
    $('#fPag').innerHTML = '<option value="">Escolha…</option>' + L.pagamentos.map(p => '<option>' + esc(p) + '</option>').join('');
    const c = E.cliente;
    if (c) {
      $('#fNome').value = c.nome || ''; $('#fTel').value = c.tel || ''; $('#fEnd').value = c.end || ''; $('#fBairro').value = c.bairro || '';
      $('#fCep').value = cepFmt(c.cep || ''); $('#fCidade').value = c.cidade || '';
      if (c.loja && L.unidades.some(u => u.nome === c.loja)) { $('#fLoja').value = c.loja; E.lojaManual = true; }
      if (c.pag && L.pagamentos.includes(c.pag)) $('#fPag').value = c.pag;
      if (c.entrega) definirEntrega(c.entrega);
      $('#fSalvar').checked = true;
      $('#saud').innerHTML = 'Olá de novo, <b>' + esc(String(c.nome || '').split(' ')[0]) + '</b>! Preenchemos seus dados.<button type="button" id="esquecer">Não é você?</button>';
      $('#saud').hidden = false;
    }
    if (!E.ref) $('#indic').textContent = ''; else atualizarIndic();
  }
  function atualizarIndic() {
    const partes = [];
    if (E.ref) partes.push('Atendimento: ' + (E.ref.nome || E.ref.codigo));
    if (E.entrega === 'Retirada na loja') partes.push('Retirar em ' + $('#fLoja').value);
    $('#indic').textContent = partes.join(' · ');
  }
  function definirEntrega(v) {
    E.entrega = v === 'Retirada na loja' || v === 'Envio' ? v : 'Entrega';
    if (E.entrega === 'Envio' && E.rec.envio === false) E.entrega = 'Entrega';
    $$('.seg button').forEach(b => { const on = b.dataset.entrega === E.entrega; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('#blocoEnd').hidden = E.entrega === 'Retirada na loja';
    $('#blocoEnvio').hidden = E.entrega !== 'Envio'; $('#lblBairro').hidden = E.entrega === 'Envio';
    $('#envioAviso').hidden = E.entrega !== 'Envio';
    $('#envioAviso').textContent = (E.site && E.site.envioTexto) || 'Enviamos para todo o Brasil. O frete (Correios ou transportadora) é combinado pelo WhatsApp.';
    marcarEndereco(false);
    pedirCalculo(); atualizarIndic();
  }
  const cepFmt = v => { const d = soDig(v).slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; };
  function enderecoTxt() {
    const e = $('#fEnd').value.trim();
    if (E.entrega === 'Envio') return e + ' – ' + $('#fCidade').value.trim() + ' – CEP ' + cepFmt($('#fCep').value);
    return e + ($('#fBairro').value.trim() ? ' – ' + $('#fBairro').value.trim() : '');
  }
  function marcarEndereco(ok) {
    E.endConfirmado = ok;
    const b = $('#confEnd');
    b.classList.toggle('ok', ok); b.setAttribute('aria-pressed', ok);
    b.textContent = ok ? '✓ Endereço confirmado' : 'Confirmar endereço de entrega';
    const a = $('#endAviso'); a.classList.remove('erro');
    a.textContent = ok ? enderecoTxt() : (E.entrega === 'Envio' ? 'Confira rua, número, cidade e CEP antes de confirmar.' : 'Confira rua, número e bairro antes de confirmar.');
  }
  function esquecerDados() {
    mem.apagar('cliente'); mem.apagar('ref'); E.cliente = null; E.ref = null;
    ['#fNome', '#fTel', '#fEnd', '#fBairro', '#fObs'].forEach(s => { $(s).value = ''; });
    $('#fPag').value = ''; $('#fSalvar').checked = false; $('#saud').hidden = true; E.lojaManual = false;
    marcarEndereco(false); atualizarIndic(); toast('Seus dados foram apagados deste aparelho.');
  }

  function validar() {
    const erros = [];
    const nome = $('#fNome').value.trim(), tel = soDig($('#fTel').value);
    if (nome.length < 2) erros.push(['#fNome', 'Informe seu nome.']);
    if (tel.replace(/^55(?=\d{10,11}$)/, '').length < 10 || tel.replace(/^55(?=\d{10,11}$)/, '').length > 11) erros.push(['#fTel', 'Informe seu WhatsApp com DDD.']);
    if (E.entrega === 'Envio') {
      if (soDig($('#fCep').value).length !== 8) erros.push(['#fCep', 'Informe o CEP (8 números).']);
      else if ($('#fCidade').value.trim().length < 3) erros.push(['#fCidade', 'Informe a cidade e o estado.']);
    }
    if (E.entrega !== 'Retirada na loja') {
      if ($('#fEnd').value.trim().length < 8) erros.push(['#fEnd', 'Informe o endereço completo de entrega.']);
      else if (!E.endConfirmado) erros.push(['#confEnd', 'Confirme o endereço de entrega.']);
    }
    if (!$('#fPag').value) erros.push(['#fPag', 'Escolha a forma de pagamento.']);
    if (erros.length) {
      const [sel, msg] = erros[0];
      toast(msg); const el = $(sel); el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (sel === '#confEnd') { $('#endAviso').classList.add('erro'); $('#endAviso').textContent = msg; }
      return false;
    }
    return true;
  }

  async function enviar() {
    if (E.enviando || !E.sacola.length || !validar()) return;
    E.enviando = true;
    const bt = $('#btnFinalizar'); bt.disabled = true; bt.textContent = 'Enviando…';
    E.chave = E.chave || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
    const corpo = {
      chave: E.chave, site: $('#fSite').value,
      cliente: { nome: $('#fNome').value.trim(), tel: $('#fTel').value.trim(), end: $('#fEnd').value.trim(), bairro: E.entrega === 'Envio' ? '' : $('#fBairro').value.trim(),
        cep: E.entrega === 'Envio' ? soDig($('#fCep').value) : '', cidade: E.entrega === 'Envio' ? $('#fCidade').value.trim() : '' },
      entrega: E.entrega, endConfirmado: E.entrega !== 'Retirada na loja' ? E.endConfirmado : false,
      itens: E.sacola.map(i => ({ id: i.id, q: i.q })),
      loja: $('#fLoja').value, pagamento: $('#fPag').value, obs: $('#fObs').value.trim(),
      ref: E.ref ? E.ref.codigo : undefined,
      consent: { salvar: $('#fSalvar').checked, whatsapp: $('#fWpp').checked }
    };
    let r = null;
    if (ERP) {
      try { r = await api('POST', ERP + '/api/pedidos', corpo); }
      catch (e) {
        if (e.status >= 400 && e.status < 500) {                     // erro de dados: o cliente corrige
          if (e.dados && e.dados.codigo === 'endereco_nao_confirmado') marcarEndereco(false);
          if (e.dados && e.dados.produto) { E.sacola = E.sacola.filter(i => i.id !== e.dados.produto); salvarSacola(); renderGrid(); renderSacola(); }
          toast(e.message, 5000);
          E.enviando = false; bt.textContent = 'Enviar pedido'; bt.disabled = !E.sacola.length;
          return;
        }
        /* ERP fora do ar: segue só pelo WhatsApp */
      }
    }
    try {
      if ($('#fSalvar').checked) {
        E.cliente = { nome: corpo.cliente.nome, tel: corpo.cliente.tel, end: corpo.cliente.end, bairro: corpo.cliente.bairro, cep: corpo.cliente.cep, cidade: corpo.cliente.cidade, entrega: corpo.entrega, loja: corpo.loja, pag: corpo.pagamento };
        mem.gravar('cliente', E.cliente);
      } else { mem.apagar('cliente'); E.cliente = null; }
      const ped = r ? r.pedido : pedidoLocal(corpo);
      const token = r ? r.token : null;
      if (token) { const pedidos = mem.ler('pedidos', []); pedidos.unshift({ token, num: ped.num, t: Date.now() }); mem.gravar('pedidos', pedidos.slice(0, 10)); history.replaceState(null, '', '#pedido-' + token); }
      E.sacola = []; salvarSacola(); renderGrid();
      $('#fObs').value = ''; marcarEndereco(false);
      mostrarPedido(ped, token, true);
      toast('Pedido #' + ped.num + ' pronto! Envie pelo WhatsApp.');
    } catch (e) {
      toast(e.message, 5000);
    } finally {
      E.enviando = false; bt.textContent = 'Enviar pedido'; bt.disabled = !E.sacola.length;
    }
  }

  /* ---------- pedido enviado / acompanhamento ---------- */
  const STATUS = { novo: ['Recebido', 'pen'], confirmado: ['Confirmado pela loja', 'ok'], pago: ['Pago', 'ok'], entregue: ['Entregue', 'ok'], cancelado: ['Cancelado', 'nok'], expirado: ['Expirado', 'nok'] };
  /* pedido montado no próprio site (ERP fora do ar): vai completo pelo WhatsApp */
  function pedidoLocal(c) {
    const calc = calculoLocal(c.cliente.bairro);
    const u = (E.loja.unidades || []).find(x => x.nome === c.loja) || (E.loja.unidades || [])[0] || {};
    const cod = 'S' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
    return {
      local: true, num: cod, status: 'novo', loja: u.nome || c.loja, entrega: c.entrega, pagamento: c.pagamento, obs: c.obs,
      cliente: c.cliente, ref: c.ref, whatsappLoja: u.whatsapp || E.loja.whatsapp,
      itens: c.itens.map(i => { const p = E.porId[i.id]; return { nome: p.nome, qtd: qtdTxt(p, i.q), valor: valorItem(p, i.q) }; }),
      subtotal: calc.subtotal, frete: calc.frete, freteACombinar: calc.freteACombinar, total: calc.total, hist: []
    };
  }
  const linkAcomp = token => location.origin + location.pathname.replace(/index\.html$/, '') + '#pedido-' + token;
  function textoWhats(p, token) {
    const linhas = p.itens.map(i => '• ' + i.qtd + ' – ' + i.nome + ' – ' + brl(i.valor)).join('\n');
    const frete = p.entrega === 'Envio' ? '\nEnvio para outra cidade – frete a combinar' : p.entrega === 'Entrega' ? '\nFrete: ' + (p.freteACombinar ? 'a combinar' : brl(p.frete)) : '\nVou retirar na loja' + ((E.loja.unidades || []).length > 1 ? ' ' + p.loja : '');
    if (!p.local) return 'Olá! Acabei de fazer o pedido *#' + p.num + '* no site.\n\n' + linhas + frete +
      '\n*Total: ' + brl(p.total) + '*\nPagamento: ' + p.pagamento + '\n\nAcompanhar: ' + linkAcomp(token);
    const c = p.cliente;
    return 'Olá! Quero fazer este pedido (código *' + p.num + '*):\n\n' + linhas + frete +
      '\n*Total: ' + brl(p.total) + '*' + (p.freteACombinar ? ' + frete' : '') +
      '\n\n*Nome:* ' + c.nome + '\n*WhatsApp:* ' + c.tel +
      (p.entrega === 'Entrega' ? '\n*Entrega:* ' + c.end + (c.bairro ? ' – ' + c.bairro : '') : '') +
      (p.entrega === 'Envio' ? '\n*Envio para:* ' + c.end + ' – ' + c.cidade + ' – CEP ' + cepFmt(c.cep) : '') +
      '\n*Pagamento:* ' + p.pagamento + (p.obs ? '\n*Obs.:* ' + p.obs : '') + (p.ref ? '\n*Vendedor(a):* ' + p.ref : '');
  }
  function mostrarPedido(p, token, novo) {
    const f = $('#final');
    const st = STATUS[p.status] || [p.status, 'pen'];
    const wa = p.whatsappLoja ? waLink(p.whatsappLoja, textoWhats(p, token)) : null;
    let pix = '';
    if (p.pix) {
      pix = p.pix.copiaecola
        ? '<div class="box" style="margin-top:14px"><h3>Pix copia e cola</h3><p class="mut">Copie o código abaixo e cole no app do seu banco (Pix → Copia e cola). Valor: <b>' + brl(p.total) + '</b>' + (p.freteACombinar ? ' (sem o frete, que será combinado)' : '') + '.</p>' +
          '<textarea class="copia" id="pixCodigo" readonly>' + esc(p.pix.copiaecola) + '</textarea><button type="button" class="b1" id="copiarPix">Copiar código Pix</button>' +
          '<p class="mut">Depois de pagar, a confirmação aparece aqui. Se preferir, envie o comprovante pelo WhatsApp.</p></div>'
        : '<div class="box" style="margin-top:14px"><h3>Pagamento por Pix</h3><p class="mut">A loja vai enviar a chave Pix pelo WhatsApp. Código do pedido: <b>' + esc(p.pix.txid) + '</b>.</p></div>';
    }
    f.innerHTML =
      (novo ? '<div class="vzs" style="padding:24px 0 8px"><p class="vzi ok">' + IC.ok + '</p><h3 style="color:var(--primaria-escura)">' + (p.local ? 'Pedido pronto!' : 'Pedido recebido!') + '</h3><p class="mut">Falta só um passo: <b>envie o pedido pelo WhatsApp</b> para a loja' + ((E.loja.unidades || []).length > 1 ? ' ' + esc(p.loja) : '') + ' confirmar.</p></div>' : '') +
      '<div class="pc" style="margin-top:12px"><div class="pc1"><b>Pedido #' + esc(p.num) + '</b><span class="pill ' + st[1] + '">' + esc(st[0]) + '</span></div>' +
      '<div class="pc3">' + esc(p.loja) + ' · ' + esc(p.entrega) + ' · ' + esc(p.pagamento) + '</div>' +
      p.itens.map(i => '<div class="pc2"><span>' + esc(i.qtd) + ' – ' + esc(i.nome) + '</span><span>' + brl(i.valor) + '</span></div>').join('') +
      '<div class="pc4">' +
      '<div class="rw"><span>Subtotal</span><span>' + brl(p.subtotal) + '</span></div>' +
      (p.entrega !== 'Retirada na loja' ? '<div class="rw"><span>Frete</span><span>' + (p.freteACombinar ? 'a combinar' : brl(p.frete)) + '</span></div>' : '') +
      '<div class="rw tot" style="margin:6px 0 0"><span>Total</span><span>' + brl(p.total) + '</span></div></div></div>' +
      pix +
      (p.hist && p.hist.length ? '<ul class="est" style="margin-top:14px" aria-label="Andamento">' + p.hist.map(h => '<li class="' + ((STATUS[h.para] || [])[1] === 'nok' ? 'bad' : 'ok') + '">' + esc(new Date(h.t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })) + ' – ' + esc((STATUS[h.para] || [h.para])[0]) + '</li>').join('') + '</ul>' : '') +
      (wa ? '<a class="wa" style="display:block;text-align:center;text-decoration:none;margin-top:16px" href="' + esc(wa) + '" target="_blank" rel="noopener">' + (novo ? 'Enviar pedido no WhatsApp' : 'Falar com a loja no WhatsApp') + '</a>' : '') +
      (token ? '<button type="button" class="b2" style="width:100%;margin-top:10px" id="linkPedido">Copiar link de acompanhamento</button>' : '') +
      '<button type="button" class="b2" style="width:100%;margin-top:10px" data-fechar>Continuar comprando</button>';
    f.dataset.feito = '1'; f.dataset.token = token || ''; f.hidden = false;
    $('#itens').innerHTML = ''; $('#form').hidden = true; $('#rodSacola').hidden = true;
    $('#sacolaTit').textContent = 'Pedido #' + p.num;
    abrir();
    const cp = $('#copiarPix'); if (cp) cp.onclick = () => copiar($('#pixCodigo').value, 'Código Pix copiado!');
    if (token) $('#linkPedido').onclick = () => copiar(linkAcomp(token), 'Link copiado!');
  }
  async function copiar(txt, ok) {
    try { await navigator.clipboard.writeText(txt); toast(ok); }
    catch (e) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast(ok); } catch (x) { toast('Selecione e copie manualmente.'); } t.remove(); }
  }
  async function abrirAcompanhamento() {
    const m = location.hash.match(/^#pedido-([a-f0-9]{8,64})$/i);
    if (!m) return;
    if (!ERP) return;
    try { const p = await api('GET', ERP + '/api/pedidos/publico/' + m[1]); mostrarPedido(p, m[1], false); }
    catch (e) { toast(e.status === 404 ? 'Pedido não encontrado. Confira o link.' : 'O acompanhamento está indisponível agora. Fale com a loja pelo WhatsApp.', 5000); }
  }

  /* ---------- página do produto (pop-up) ---------- */
  let pmAberto = null, pmFoco = null, pmEmpurrou = false, pmY = 0;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  function abrirProduto(id, empurrar) {
    const p = E.porId[id]; if (!p) return;
    if (pmAberto === id && !$('#prodModal').hidden) return;
    const cat = E.catPorId[p.cat] || {};
    const fotos = [p.img].concat(p.imgs || []).filter(imgOk);
    if (!pmAberto) { pmFoco = document.activeElement; pmY = scrollY; }
    pmAberto = id;
    $('#pmCat').textContent = cat.nome || '';
    $('#pmNome').textContent = p.nome;
    $('#pmPreco').innerHTML = precoHtml(p) + seloDesc(p);
    $('#pmDesc').textContent = p.desc || '';
    $('#pmInfo').innerHTML = p.info ? '<h4>Informações</h4>' + esc(p.info).split(/\n+/).map(l => '<p>' + l + '</p>').join('') : '';
    const mostrar = i => {
      $('#pmFoto').innerHTML = fotos.length ? '<img src="' + esc(fotos[i]) + '" alt="' + esc(p.nome) + (fotos.length > 1 ? ' – foto ' + (i + 1) : '') + '" data-semfoto="1">' : semFoto();
      $('#pmFoto').style.setProperty('--bg', cat.bg || '#f1efe6');
      $$('#pmMinis button').forEach((b, j) => b.classList.toggle('on', j === i));
    };
    $('#pmMinis').innerHTML = fotos.length > 1 ? fotos.map((f, i) => '<button type="button" data-foto="' + i + '" aria-label="Foto ' + (i + 1) + '"><img src="' + esc(f) + '" alt="" loading="lazy"></button>').join('') : '';
    $('#pmMinis').onclick = ev => { const b = ev.target.closest('[data-foto]'); if (b) mostrar(+b.dataset.foto); };
    mostrar(0);
    renderCtlProduto();
    $('#ovProd').classList.add('on'); $('#prodModal').hidden = false; document.body.classList.add('travado');
    $('#prodModal').scrollTop = 0; $('#prodModal').focus();
    if (empurrar) { history.pushState({ produto: id }, '', '#produto-' + encodeURIComponent(id)); pmEmpurrou = true; }
  }
  function renderCtlProduto() {
    if (!pmAberto) return;
    const p = E.porId[pmAberto], q = qNaSacola(p.id);
    $('#pmCtl').innerHTML = q
      ? controle(p) + '<button type="button" class="wa" id="pmSacola">Ver sacola e finalizar</button>'
      : '<button type="button" class="add grande" data-mais="' + esc(p.id) + '">Adicionar à sacola' + (p.un === 'g' ? ' (' + esc(qtdTxt(p, passoDe(p))) + ')' : '') + '</button>';
    const s = $('#pmSacola'); if (s) s.onclick = () => { fecharProduto(); renderSacola(); abrir(); };
  }
  function fecharProduto(doHistorico) {
    if (!pmAberto) return;
    if (!doHistorico && pmEmpurrou && /^#produto-/.test(location.hash)) { history.back(); return; }   // o popstate termina de fechar
    if (!doHistorico && /^#produto-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    pmAberto = null; pmEmpurrou = false;
    $('#ovProd').classList.remove('on'); $('#prodModal').hidden = true; document.body.classList.remove('travado');
    if (pmFoco && pmFoco.focus) pmFoco.focus({ preventScroll: true });
    const y = pmY; scrollTo(0, y); requestAnimationFrame(() => scrollTo(0, y));             // volta ao ponto anterior
  }
  window.addEventListener('popstate', aplicarRota);
  $('#pmFechar').addEventListener('click', () => fecharProduto());
  $('#pmVoltar').addEventListener('click', () => fecharProduto());
  $('#ovProd').addEventListener('click', () => fecharProduto());

  /* ---------- eventos ---------- */
  document.addEventListener('click', ev => {
    const t = ev.target.closest('button, a') || ev.target.closest('[data-ver]'); if (!t) return;
    if (t.dataset.ver && !t.dataset.mais && !t.dataset.menos) { abrirProduto(t.dataset.ver, true); return; }
    if (t.dataset.mais) { mudarQtd(t.dataset.mais, +1); if (!$('#sacola').classList.contains('on') && qNaSacola(t.dataset.mais) === passoDe(E.porId[t.dataset.mais])) toast(E.porId[t.dataset.mais].nome + ' adicionado à sacola.'); }
    else if (t.dataset.menos) mudarQtd(t.dataset.menos, -1);
    else if (t.dataset.cat) escolherCat(t.dataset.cat);
    else if (t.hasAttribute('data-limpar')) { E.busca = ''; $('#busca').value = ''; escolherCat('todos'); renderGrid(); }
    else if (t.hasAttribute('data-fechar')) fechar();
    else if (t.classList.contains('lnkPriv')) { ev.preventDefault(); if ($('#sacola').classList.contains('on')) fechar(); $('#privacidade').hidden = false; $('#privacidade').scrollIntoView({ behavior: 'smooth' }); }
    else if (t.id === 'esquecer') esquecerDados();
  });
  document.addEventListener('error', ev => {           // foto ausente -> emoji da categoria
    const im = ev.target;
    if (im.tagName === 'IMG' && im.dataset.semfoto) { const s = document.createElement('span'); s.className = 'semfoto'; s.innerHTML = IC.imagem; im.replaceWith(s); }
  }, true);
  $('#marca').addEventListener('click', ev => { ev.preventDefault(); homeY = 0; irPara(''); scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#pgVoltar').addEventListener('click', () => { if (E.veioDoInicio) history.back(); else irPara(''); });
  $('#esquecerRodape').addEventListener('click', ev => { ev.preventDefault(); esquecerDados(); mem.apagar('pedidos'); mem.apagar('sacola'); E.sacola = []; salvarSacola(); renderGrid(); renderSacola(); });
  let buscaT;
  $('#busca').addEventListener('input', ev => {
    clearTimeout(buscaT);
    buscaT = setTimeout(() => {
      const b = ev.target.value;
      if (b.trim() && E.vista !== 'todos') irPara('#todos');
      E.busca = b; $('#busca').value = b; renderGrid();
    }, 200);
  });
  $('#busca').addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); ev.target.blur(); } });
  $('#abrirSacola').addEventListener('click', () => { if ($('#final').dataset.feito === '1' && !/^#pedido-/.test(location.hash)) { $('#final').hidden = true; $('#final').dataset.feito = ''; } renderSacola(); abrir(); });
  $('#fecharSacola').addEventListener('click', fechar);
  $('#ov').addEventListener('click', fechar);
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && pmAberto) { ev.preventDefault(); fecharProduto(); return; }
    if (ev.key === 'Enter' && ev.target.matches && ev.target.matches('article[data-ver]')) { abrirProduto(ev.target.dataset.ver, true); return; }
    if (ev.key === 'Escape' && $('#sacola').classList.contains('on')) { ev.preventDefault(); fechar(); } else prenderFoco(ev);
  });
  $$('.seg button').forEach(b => b.addEventListener('click', () => definirEntrega(b.dataset.entrega)));
  $('#confEnd').addEventListener('click', () => {
    if ($('#fEnd').value.trim().length < 8) { $('#endAviso').classList.add('erro'); $('#endAviso').textContent = 'Escreva rua, número e complemento antes de confirmar.'; $('#fEnd').focus(); return; }
    marcarEndereco(!E.endConfirmado);
  });
  ['#fEnd', '#fBairro', '#fCep', '#fCidade'].forEach(s => $(s).addEventListener('input', () => { if (E.endConfirmado) marcarEndereco(false); }));
  $('#fCep').addEventListener('blur', ev => { ev.target.value = cepFmt(ev.target.value); });
  $('#fBairro').addEventListener('input', pedirCalculo);
  $('#fLoja').addEventListener('change', () => { E.lojaManual = true; atualizarIndic(); });
  $('#btnFinalizar').addEventListener('click', enviar);
  $('#form').addEventListener('submit', ev => { ev.preventDefault(); enviar(); });
  $('#fTel').addEventListener('blur', ev => {             // formata (65) 99999-9999
    let d = soDig(ev.target.value); if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    if (d.length === 11) ev.target.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    else if (d.length === 10) ev.target.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  });
  window.addEventListener('hashchange', () => { if (/^#pedido-/.test(location.hash)) abrirAcompanhamento(); else aplicarRota(); });
  // a sacola muda em outra aba -> sincroniza
  window.addEventListener('storage', ev => { if (ev.key === 'cds:sacola') { E.sacola = mem.ler('sacola', []).filter(i => E.porId[i.id]); $('#qtdSacola').textContent = E.sacola.length; renderGrid(); renderSacola(); } });

  /* ---------- início ---------- */
  $('#btnFinalizar').textContent = 'Enviar pedido';
  $('#qtdSacola').textContent = E.sacola.length;
  (async () => {
    await tratarRef();
    await carregar();
    if (E.loja) { if (/^#pedido-/.test(location.hash)) { definirVista('home'); abrirAcompanhamento(); } else aplicarRota(); }
  })();
})();
