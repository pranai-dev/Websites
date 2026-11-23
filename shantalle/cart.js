/* Pedido de serviços pelo WhatsApp — Shantalle Cristalina */
(() => {
  const CFG = Object.assign({ whatsapp: '5565996628877', pixKey: '', pixHolder: '', pixQrImage: '' }, window.SHANTALLE_CONFIG || {});
  const KEY = 'shantalle-pedido';
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const waUrl = text => `https://wa.me/${CFG.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(cart)) cart = []; } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };
  const has = id => cart.some(l => l.id === id);
  const toCombine = () => cart.some(l => l.price == null);
  const hasFrom = () => cart.some(l => l.from);
  const total = () => cart.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
  const count = () => cart.reduce((s, l) => s + l.qty, 0);
  const priceLabel = l => l.price == null ? 'A combinar' : (l.from ? 'A partir de ' : '') + brl(l.price * l.qty);

  /* ---------- UI base ---------- */
  document.body.insertAdjacentHTML('beforeend', `
    <button class="cart-fab" id="cartFab" type="button" hidden aria-label="Abrir meu pedido"><span style="display:flex;align-items:center;gap:10px"><span class="cart-count" id="cartCount">0</span>Meu pedido</span><span class="cart-sum" id="cartSum"></span></button>
    <div class="cart-backdrop" id="cartBackdrop"><aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle">
      <div class="cart-head"><div class="section-kicker" id="cartKicker">Seu pedido</div><h2 id="cartTitle">Cuidados selecionados</h2><button class="cart-close" id="cartClose" type="button" aria-label="Fechar">×</button></div>
      <div class="cart-body" id="cartBody"></div><div class="cart-foot" id="cartFoot"></div>
    </aside></div>
    <div class="cart-toast" id="cartToast" role="status" aria-live="polite"></div>`);
  const $ = id => document.getElementById(id);
  const backdrop = $('cartBackdrop'), body = $('cartBody'), foot = $('cartFoot');
  let returnFocus = null, sent = null;

  const nav = document.getElementById('navlinks');
  if (nav) { nav.insertAdjacentHTML('beforeend', '<a class="nav-cart" href="#" data-open-cart>Meu pedido</a>'); }

  function toast(msg) {
    const t = $('cartToast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function syncButtons() {
    document.querySelectorAll('[data-add]').forEach(b => {
      const on = has(b.dataset.add);
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '✓ No pedido' : '+ Adicionar';
    });
    const n = count();
    $('cartFab').hidden = n === 0;
    document.body.classList.toggle('has-cart', n > 0);
    $('cartCount').textContent = n;
    $('cartSum').textContent = cart.every(l => l.price == null) ? 'A combinar' : brl(total()) + (toCombine() ? ' +' : '');
  }
  function changed() { save(); syncButtons(); if (backdrop.classList.contains('open') && !sent) render(); }

  /* ---------- Adicionar a partir dos cartões ---------- */
  document.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    const card = btn.closest('[data-id]'); const id = card.dataset.id;
    if (has(id)) { cart = cart.filter(l => l.id !== id); toast('Removido do pedido.'); }
    else {
      const p = card.dataset.price;
      cart.push({ id, name: card.dataset.name, price: p === '' ? null : Number(p), from: card.dataset.from === '1', qty: 1 });
      toast(`${card.dataset.name} adicionado ao pedido.`);
    }
    changed();
  }));

  /* ---------- Painel ---------- */
  function open() {
    returnFocus = document.activeElement; sent = null; render();
    backdrop.classList.add('open'); document.body.style.overflow = 'hidden'; $('cartClose').focus();
  }
  function close() { backdrop.classList.remove('open'); document.body.style.overflow = ''; if (returnFocus) returnFocus.focus(); }
  $('cartFab').addEventListener('click', open);
  $('cartClose').addEventListener('click', close);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && backdrop.classList.contains('open')) close(); });
  document.querySelectorAll('[data-open-cart]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); open(); }));

  function render() {
    $('cartKicker').textContent = 'Seu pedido';
    $('cartTitle').textContent = 'Cuidados selecionados';
    if (!cart.length) {
      body.innerHTML = '<div class="cart-empty">Seu pedido ainda está vazio.<br>Escolha um ou mais cuidados na página de serviços.</div>';
      foot.innerHTML = '<a class="btn" href="servicos.html#servicos">Ver serviços</a>';
      return;
    }
    body.innerHTML = cart.map(l => `<div class="cart-item"><h4>${esc(l.name)}</h4><div class="line-price">${priceLabel(l)}${l.price == null ? '<small>valor no atendimento</small>' : ''}</div>
      <div class="line-tools"><div class="qty"><button type="button" data-q="${l.id}" data-d="-1" aria-label="Diminuir quantidade de ${esc(l.name)}">−</button><span>${l.qty}</span><button type="button" data-q="${l.id}" data-d="1" aria-label="Aumentar quantidade de ${esc(l.name)}">+</button></div><button class="cart-remove" type="button" data-r="${l.id}">Remover</button></div></div>`).join('')
      + (toCombine() ? '<div class="cart-note">Itens sem valor definido aparecem como “a combinar” e não entram no total.</div>' : '')
      + (hasFrom() ? '<div class="cart-note">O Talismã Cristalino tem valor a partir de R$ 100, conforme o cristal escolhido.</div>' : '')
      + `<label class="cart-field"><span>Seu nome</span><input id="cartName" type="text" autocomplete="name" maxlength="60" placeholder="Opcional"></label>
         <label class="cart-field"><span>Melhor dia e horário</span><input id="cartWhen" type="text" maxlength="80" placeholder="Ex.: terça à tarde (opcional)"></label>`;
    body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const l = cart.find(x => x.id === b.dataset.q); l.qty = Math.max(1, Math.min(10, l.qty + Number(b.dataset.d))); changed(); });
    body.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { cart = cart.filter(l => l.id !== b.dataset.r); changed(); });
    const label = cart.every(l => l.price == null) ? 'A combinar' : (hasFrom() ? 'A partir de ' : '') + brl(total());
    foot.innerHTML = `<div class="cart-total"><span>Total${toCombine() ? ' parcial' : ''}</span><strong>${label}</strong></div>
      <p class="cart-hint">O pedido abre no WhatsApp da Shantalle para confirmar horário e forma de pagamento.</p>
      <button class="btn" type="button" id="cartSend">Enviar pedido pelo WhatsApp ↗</button>`;
    $('cartSend').onclick = send;
  }

  function code() { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let r = ''; for (let i = 0; i < 4; i++) r += c[Math.floor(Math.random() * c.length)]; return r; }
  function send() {
    const name = ($('cartName').value || '').trim(), when = ($('cartWhen').value || '').trim();
    const id = code(), t = total(), partial = toCombine(), from = hasFrom();
    const lines = cart.map(l => `• ${l.qty > 1 ? l.qty + 'x ' : ''}${l.name} — ${priceLabel(l).toLowerCase() === 'a combinar' ? 'a combinar' : priceLabel(l)}`).join('\n');
    let msg = `Olá! Gostaria de agendar pelo site da Shantalle Cristalina.\n\n*Pedido #${id}*\n${lines}`;
    if (t > 0) msg += `\n\n*Total${partial ? ' parcial' : ''}: ${from ? 'a partir de ' : ''}${brl(t)}*`;
    if (name) msg += `\nNome: ${name}`;
    if (when) msg += `\nPreferência de horário: ${when}`;
    msg += CFG.pixKey ? `\n\nPagamento via Pix\nChave: ${CFG.pixKey}${CFG.pixHolder ? `\nTitular: ${CFG.pixHolder}` : ''}\nEnvio o comprovante nesta conversa.` : `\n\nForma de pagamento: a combinar.`;
    sent = { id, t, partial, from };
    window.open(waUrl(msg), '_blank', 'noopener');
    done();
  }
  function done() {
    const o = sent;
    $('cartKicker').textContent = `Pedido #${o.id} enviado`;
    $('cartTitle').textContent = CFG.pixKey ? 'Pagamento via Pix' : 'Pedido enviado';
    const amount = o.t > 0 ? `<div class="done-total">${o.from ? 'a partir de ' : ''}${brl(o.t)}</div>` : '';
    const pix = CFG.pixKey
      ? `<div class="pix-box">${CFG.pixQrImage ? `<img src="${esc(CFG.pixQrImage)}" alt="QR Code Pix">` : ''}<div class="pix-key">${esc(CFG.pixKey)}</div>${CFG.pixHolder ? `<div class="cart-hint">Titular: ${esc(CFG.pixHolder)}</div>` : ''}<button class="btn btn-light btn-small" type="button" id="copyPix">Copiar chave Pix</button></div>
         <ol><li>Confira o pedido na conversa do WhatsApp.</li><li>Faça o Pix pelo app do seu banco.</li><li>Envie o comprovante na mesma conversa, citando o pedido #${o.id}.</li></ol>`
      : `<ol><li>Confira o pedido na conversa do WhatsApp.</li><li>A equipe confirma o horário com você.</li><li>A forma de pagamento é combinada no atendimento.</li></ol>`;
    body.innerHTML = `<div class="cart-done"><div class="done-icon">✓</div><div class="section-kicker">Valor ${o.partial ? 'parcial ' : ''}do pedido</div>${amount || '<div class="done-total">A combinar</div>'}${pix}</div>`;
    const cp = $('copyPix');
    if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(CFG.pixKey); toast('Chave Pix copiada.'); } catch (e) { toast(`Chave Pix: ${CFG.pixKey}`); } };
    foot.innerHTML = (CFG.pixKey ? `<a class="btn" href="${waUrl(`Olá! Segue o comprovante do Pix do pedido #${o.id}.`)}" target="_blank" rel="noopener">Enviar comprovante pelo WhatsApp ↗</a>` : `<a class="btn" href="${waUrl(`Olá! Enviei o pedido #${o.id} pelo site.`)}" target="_blank" rel="noopener">Abrir o WhatsApp novamente ↗</a>`)
      + `<button class="btn btn-light" type="button" id="cartFinish">Concluir e limpar o pedido</button>`;
    $('cartFinish').onclick = () => { cart = []; sent = null; changed(); close(); toast('Pedido concluído. Até breve!'); };
  }

  syncButtons();
})();
