/* =====================================================================
   DELICIOUS BY DELICE — moteur de scroll
   - Le scroll natif est lissé (inertie) puis pilote UNE seule chronologie :
     chaque scène a un arrière-plan qui avance (zoom / glissement) et des
     textes qui se révèlent l'un après l'autre (haut, milieu, bas).
   - Entre deux scènes : fondu enchaîné, les textes « s'évaporent » en sortant.
   - Uniquement transform / opacity / filter : aucune librairie, aucun reflow.
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  /* ---------------------------------------------------------------
     Header, menu mobile, année
     --------------------------------------------------------------- */
  const header = $('#header'), burger = $('#burger'), menu = $('#mobileMenu');
  const onHeader = () => header.classList.toggle('scrolled', window.scrollY > 24);
  onHeader(); window.addEventListener('scroll', onHeader, { passive: true });
  const setMenu = (open) => { burger.setAttribute('aria-expanded', String(open)); menu.classList.toggle('closed', !open); };
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  const yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---------------------------------------------------------------
     HERO : diaporama — le même effet sur TOUTES les images
     (ouverture circulaire depuis un point chaud + lueur + zoom lent)
     --------------------------------------------------------------- */
  const heroBg = $('#heroBg');
  const slides = $$('.slide', heroBg);
  const cap = $('#heroCap'), flash = $('#flash'), barsBox = $('#heroBars');
  const HOLD = 6500;
  let cur = 0, zTop = 1, timer = null, heroVisible = true;

  const bars = slides.map((sl, i) => {
    const b = document.createElement('button');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Image ' + (i + 1) + ' : ' + sl.dataset.caption.replace(/&amp;/g, '&'));
    b.style.setProperty('--dur', HOLD + 'ms');
    b.addEventListener('click', () => goSlide(i));
    barsBox.appendChild(b); return b;
  });
  const setBar = (i) => bars.forEach((b, k) => { b.classList.remove('on'); if (k === i) { void b.offsetWidth; b.classList.add('on'); } });

  function goSlide(n, first) {
    if (n === cur && !first) return;
    clearTimeout(timer);
    const prev = slides[cur], next = slides[n];
    cur = n;
    cap.innerHTML = next.dataset.caption;
    setBar(n);
    if (!first) {
      zTop++; next.style.zIndex = zTop;
      next.classList.add('active');
      const o = next.dataset.origin || '50% 50%';
      const dur = 1500, ease = 'cubic-bezier(.7,0,.2,1)';
      flash.style.background = `radial-gradient(circle at ${o}, rgba(255,196,90,.95), rgba(226,61,40,.4) 42%, transparent 72%)`;
      const a = next.animate(
        [{ clipPath: `circle(0% at ${o})` }, { clipPath: `circle(150% at ${o})` }],
        { duration: dur, easing: ease }
      );
      prev.animate([{ filter: 'brightness(1)', transform: 'scale(1)' }, { filter: 'brightness(.35)', transform: 'scale(1.08)' }], { duration: dur, easing: ease, fill: 'forwards' });
      flash.animate([{ opacity: 0 }, { opacity: .55, offset: .35 }, { opacity: 0 }], { duration: dur, easing: 'ease-out' });
      a.onfinish = () => { prev.classList.remove('active'); prev.getAnimations().forEach(x => x.cancel()); };
    }
    schedule();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (heroVisible && !document.hidden) goSlide((cur + 1) % slides.length); else schedule(); }, HOLD);
  }

  /* Points clés (à droite) : un texte à la fois */
  const keys = $$('#keys .k');
  let ki = 0;
  function nextKey() {
    if (!keys.length) return;
    const prev = keys[ki];
    ki = (ki + 1) % keys.length;
    prev.classList.remove('on'); prev.classList.add('out');
    setTimeout(() => prev.classList.remove('out'), 950);
    keys[ki].classList.remove('out'); keys[ki].classList.add('on');
  }
  if (!reduce && keys.length) setInterval(() => { if (heroVisible && !document.hidden) nextKey(); }, 3300);

  if (reduce) { setBar(0); bars.forEach(b => b.style.display = 'none'); }
  else { goSlide(0, true); }

  /* Braises qui montent (canvas 2D, uniquement visible sur le hero) */
  const emb = $('#embers'), ectx = emb.getContext('2d');
  let ew = 0, eh = 0, edpr = 1;
  const sparks = Array.from({ length: reduce ? 0 : 70 }, () => ({}));
  const resetSpark = (p, init) => {
    p.x = Math.random() * ew; p.y = init ? Math.random() * eh : eh + 10;
    p.vx = (Math.random() - .5) * 18; p.vy = -(25 + Math.random() * 70);
    p.r = .6 + Math.random() * 2.2; p.life = 0; p.max = 3 + Math.random() * 5; p.ph = Math.random() * 6.28;
    p.hue = Math.random() < .7 ? 22 + Math.random() * 18 : 44;
  };
  function embersStep(dt, t) {
    if (!heroVisible) return;
    const cw = emb.clientWidth, ch = emb.clientHeight;
    if (!cw) return;
    if (cw * edpr !== emb.width || ch * edpr !== emb.height) {
      edpr = Math.min(devicePixelRatio || 1, 2); emb.width = cw * edpr; emb.height = ch * edpr; ew = cw; eh = ch;
      sparks.forEach(p => resetSpark(p, true));
    }
    ectx.setTransform(edpr, 0, 0, edpr, 0, 0);
    ectx.clearRect(0, 0, ew, eh);
    ectx.globalCompositeOperation = 'lighter';
    for (const p of sparks) {
      p.life += dt; p.x += (p.vx + Math.sin(t * 1.6 + p.ph) * 14) * dt; p.y += p.vy * dt;
      if (p.life > p.max || p.y < -10) resetSpark(p, false);
      const a = Math.sin(clamp(p.life / p.max, 0, 1) * Math.PI) * (.55 + .45 * Math.sin(t * 9 + p.ph));
      const g = ectx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, `hsla(${p.hue},100%,62%,${a})`); g.addColorStop(1, `hsla(${p.hue},100%,50%,0)`);
      ectx.fillStyle = g; ectx.beginPath(); ectx.arc(p.x, p.y, p.r * 5, 0, 6.283); ectx.fill();
    }
  }

  /* Poussière d'étoiles très fine : suit la souris / le doigt sur l'accueil */
  const sd = $('#stardust'), sctx = sd.getContext('2d');
  let sw = 0, sh = 0, sdpr = 1, lastPX = null, lastPY = null;
  const dust = [];
  const DUST_MAX = reduce ? 0 : 520;
  const DUST_COLS = ['255,255,255', '255,244,214', '255,226,160', '255,206,150', '255,190,170'];
  function spawnDust(x, y, speed) {
    const n = Math.min(9, 2 + Math.floor(speed / 14));
    for (let i = 0; i < n && dust.length < DUST_MAX; i++) {
      const a = Math.random() * 6.283, v = 6 + Math.random() * 38;
      dust.push({
        x: x + (Math.random() - .5) * 26, y: y + (Math.random() - .5) * 26,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, r: .35 + Math.random() * .85,
        life: 0, max: 1.1 + Math.random() * 2.1, ph: Math.random() * 6.28,
        c: DUST_COLS[(Math.random() * DUST_COLS.length) | 0], star: Math.random() < .09
      });
    }
  }
  function onDustMove(e) {
    if (reduce || !heroVisible) return;
    const r = sd.getBoundingClientRect();
    if (!r.width) return;
    const x = (e.clientX - r.left) * (sw / r.width || 1), y = (e.clientY - r.top) * (sh / r.height || 1);
    if (x < 0 || y < 0 || x > sw || y > sh) { lastPX = null; return; }
    const sp = lastPX == null ? 8 : Math.hypot(x - lastPX, y - lastPY);
    spawnDust(x, y, sp);
    lastPX = x; lastPY = y;
  }
  window.addEventListener('pointermove', onDustMove, { passive: true });
  function dustStep(dt, t) {
    if (!heroVisible) return;
    const cw = sd.clientWidth, ch = sd.clientHeight;
    if (!cw) return;
    if (cw * sdpr !== sd.width || ch * sdpr !== sd.height) {
      sdpr = Math.min(devicePixelRatio || 1, 2); sd.width = cw * sdpr; sd.height = ch * sdpr; sw = cw; sh = ch;
    }
    sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0);
    sctx.clearRect(0, 0, sw, sh);
    if (!dust.length) return;
    sctx.globalCompositeOperation = 'lighter';
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i];
      p.life += dt;
      if (p.life >= p.max) { dust.splice(i, 1); continue; }
      const k = p.life / p.max, drag = Math.pow(.18, dt);
      p.vx *= drag; p.vy = p.vy * drag - 5 * dt;
      p.x += (p.vx + Math.sin(t * 2 + p.ph) * 4) * dt; p.y += p.vy * dt;
      const a = Math.sin(k * Math.PI) * (.55 + .45 * Math.sin(t * 14 + p.ph));
      if (a <= .01) continue;
      sctx.fillStyle = `rgba(${p.c},${a.toFixed(3)})`;
      if (p.star) {
        const L = p.r * 4.2;
        sctx.fillRect(p.x - L, p.y - .35, L * 2, .7);
        sctx.fillRect(p.x - .35, p.y - L, .7, L * 2);
      }
      sctx.beginPath(); sctx.arc(p.x, p.y, p.r, 0, 6.283); sctx.fill();
    }
    sctx.globalCompositeOperation = 'source-over';
  }

  const hv = $('#histVideo');
  const SCENE_IDS = ['hero', 'manifeste', 'plateau', 'macro', 'grill', 'jus', 'histoire', 'contact'];

  /* ---------------------------------------------------------------
     MODE SANS ANIMATION
     --------------------------------------------------------------- */
  if (reduce) {
    root.classList.add('flat');
    $$('[data-go]').forEach(a => a.addEventListener('click', e => {
      const t = $('#s-' + SCENE_IDS[+a.dataset.go]);
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'auto' }); setMenu(false); }
    }));
    if (hv) hv.preload = 'metadata';
    return;
  }

  /* ---------------------------------------------------------------
     MOTEUR
     --------------------------------------------------------------- */
  const stage = $('#stage'), track = $('#track');
  const orderBar = $('#orderBar'), hud = $('#hud');
  const T = 0.5;                       // durée (en écrans) du fondu entre deux scènes
  const ease5 = (x) => { const t = clamp(x, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };   // smootherstep

  /* ---------- Découpage des textes en mots (apparition en cascade) ---------- */
  const SELF = '.ct-card,.pl-wrap,.pl-tag,.keys,.hero-ui,.scroll-cue';
  const BLOCK = '.btn,.price-chip,.also i,.also span,.flavors li,.pillars li,svg';
  const KEEP = ['grad', 'o-text', 'gold'];
  function prep(t) {
    if (t.matches(SELF) || t.matches(BLOCK)) { t.classList.add('pc'); t.style.setProperty('--i', '0'); return; }
    let n = 0;
    const strip = new Map();
    const splitText = (node) => {
      const par = node.parentNode, cls = [];
      for (let a = par; a && a !== t.parentNode; a = a.parentNode) {
        KEEP.forEach(k => { if (a.classList && a.classList.contains(k)) { if (!cls.includes(k)) cls.push(k); strip.set(a, (strip.get(a) || new Set()).add(k)); } });
      }
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/([ \t\n\r]+)/).forEach(w => {
        if (!w) return;
        if (/^[ \t\n\r]+$/.test(w)) { frag.appendChild(document.createTextNode(' ')); return; }
        const wd = document.createElement('span'), wi = document.createElement('span');
        wd.className = 'wd'; wi.className = ('wi ' + cls.join(' ')).trim(); wi.textContent = w;
        wd.style.setProperty('--i', n++); wd.appendChild(wi); frag.appendChild(wd);
      });
      par.replaceChild(frag, node);
    };
    const walk = (node) => {
      [...node.childNodes].forEach(ch => {
        if (ch.nodeType === 1) {
          if (ch.matches('script,style')) return;
          if (ch.matches(BLOCK)) { ch.classList.add('pc'); ch.style.setProperty('--i', n++); return; }
          walk(ch);
        } else if (ch.nodeType === 3 && ch.nodeValue.trim()) splitText(ch);
      });
    };
    walk(t);
    strip.forEach((set, el) => set.forEach(k => el.classList.remove(k)));
    t.style.setProperty('--st', clamp(1.05 / Math.max(n, 1), .014, .06).toFixed(3) + 's');
  }

  /* « s:1,1.2;x:0,-4;y:2,0;r:0,30 » → { s:[1,1.2], x:[0,-4], … } */
  const parsePar = (str) => {
    const o = {};
    (str || '').split(';').forEach(p => { const [k, v] = p.split(':'); if (v) o[k.trim()] = v.split(',').map(Number); });
    return o;
  };

  let cum = 0;
  const sc = $$('.scene').map((el, i) => {
    const len = parseFloat(el.dataset.len) || 2;
    const ats = (el.dataset.ats || '0.05,0.3,0.55').split(',').map(Number);
    const veil = document.createElement('div'); veil.className = 'veil'; el.appendChild(veil);
    const c = {
      el, i, len, S: cum, E: cum + len, name: el.dataset.name, light: el.classList.contains('light'),
      on: false, live: false, op: '', tf: '', vl: '', hook: null, veil,
      ts: $$('.t', el).map((t, k) => {
        prep(t);
        return { el: t, k, in: false, gone: false, at: t.dataset.at != null ? parseFloat(t.dataset.at) : (ats[k] != null ? ats[k] : ats[ats.length - 1]) };
      }),
      pars: $$('.par', el).map(p => {
        if (p.dataset.org) p.style.transformOrigin = p.dataset.org;
        return { el: p, v: parsePar(p.dataset.par), tr: '' };
      }),
    };
    el.style.zIndex = i + 1;
    cum += len;
    return c;
  });
  const N = sc.length, TOTAL = cum;     // TOTAL = longueur de scroll en écrans

  /* Effets propres à une scène */
  const HOOKS = {
    's-plateau': (c, u, now) => {
      const tilt = 66 - 48 * ease5(u / .5) + 22 * ease5((u - .72) / .28);
      const spin = -50 + 170 * clamp(u, 0, 1) + (now / 1000) * 4;
      const st = c.el.style;
      st.setProperty('--tilt', tilt.toFixed(2) + 'deg');
      st.setProperty('--spin', spin.toFixed(2) + 'deg');
      st.setProperty('--spin2', (-spin * 1.7).toFixed(2) + 'deg');
    },
  };
  sc.forEach(c => { c.hook = HOOKS[c.el.id] || null; });

  let W = 1, H = 1, top0 = 0;
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    track.style.height = (TOTAL + 1) * H + 'px';
    top0 = track.getBoundingClientRect().top + window.scrollY;
  }

  /* HUD */
  sc.forEach(c => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', c.name); b.innerHTML = '<span>' + c.name.replace('&', '&amp;') + '</span><i></i>';
    b.addEventListener('click', () => go(c.i));
    hud.appendChild(b); c.dot = b;
  });
  const navLinks = $$('.hd-nav a');

  /* Navigation vers une scène : on atterrit quand le premier texte est révélé */
  function go(i, instant) {
    const c = sc[i];
    const y = top0 + (i === 0 ? 0 : (c.S + c.len * 0.14) * H);
    window.scrollTo({ top: y, behavior: instant ? 'auto' : 'smooth' });
  }
  $$('[data-go]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault(); go(+a.dataset.go); setMenu(false);
  }));

  /* Scroll → cible (pixels). Lu dans la boucle d'animation : aucune saccade d'événement. */
  let target = 0, s = 0, vel = 0;
  const readScroll = () => {
    target = clamp(window.scrollY - top0, 0, TOTAL * H);
    orderBar.classList.toggle('show', window.scrollY > innerHeight * .6);
    hud.classList.toggle('off', window.scrollY - top0 > TOTAL * H + H * .45);
  };
  window.addEventListener('resize', () => { measure(); readScroll(); s = target; vel = 0; });

  /* Les textes ne s'animent qu'une fois la page prête (pour jouer l'intro) */
  let ready = false;

  /* ---------- Une scène à la position pv (en écrans) ---------- */
  function place(c, pv, now) {
    const first = c.i === 0, last = c.i === N - 1;
    const entry = first ? 1 : ease5((pv - (c.S - T)) / T);
    const visible = first ? pv < c.E + .02 : (pv > c.S - T - .02 && (last || pv < c.E + .02));

    if (!visible) {
      if (c.on) {
        c.el.classList.remove('on', 'live'); c.on = false; c.live = false; onHide(c);
        for (const t of c.ts) { t.in = false; t.gone = false; t.el.classList.remove('in', 'gone'); }
      }
      return;
    }
    if (!c.on) { c.el.classList.add('on'); c.on = true; onShow(c); }

    const exitStart = last ? 99 : c.E - T;
    const xo = last ? 0 : ease5((pv - exitStart) / T);        // progression de la sortie (0 → 1)

    /* Fondu enchaîné : la scène entrante glisse et s'éclaircit, la sortante se voile et recule */
    const dropIn = c.light && !first;      // sections blanches : elles descendent depuis le haut
    const op = dropIn ? '1' : entry.toFixed(3);
    if (op !== c.op) { c.el.style.opacity = op; c.op = op; }
    let tf;
    if (dropIn && entry < 1) tf = `translate3d(0,${(-(1 - entry) * 14).toFixed(2)}%,0)`;
    else {
      const sk = (1.045 - .045 * entry) * (1 - .035 * xo);
      tf = (entry < 1 || xo > 0) ? `scale(${sk.toFixed(4)})` : '';
    }
    if (tf !== c.tf) { c.el.style.transform = tf; c.tf = tf; }
    if (dropIn) {
      const p = entry * 118 - 18;        // bord doux du rideau qui descend
      const mk = entry >= 1 ? '' : `linear-gradient(180deg,#000 ${p.toFixed(2)}%,transparent ${(p + 18).toFixed(2)}%)`;
      if (mk !== c.mk) { c.el.style.webkitMaskImage = mk; c.el.style.maskImage = mk; c.mk = mk; }
    }
    const vl = (xo * .62).toFixed(3);
    if (vl !== c.vl) { c.veil.style.opacity = vl; c.vl = vl; }

    const u = (pv - c.S) / c.len;                       // progression locale (peut être <0 à l'entrée)
    const uc = clamp(u, 0, 1);
    const live = entry > .95 && xo < .3;
    if (live !== c.live) { c.live = live; c.el.classList.toggle('live', live); }

    /* Arrière-plans : un mouvement continu, parfaitement lié au scroll */
    const grow = 1 + .07 * (1 - entry);
    for (const p of c.pars) {
      const v = p.v, parts = [];
      if (v.x || v.y) parts.push(`translate3d(${v.x ? lerp(v.x[0], v.x[1], uc).toFixed(3) : 0}%,${v.y ? lerp(v.y[0], v.y[1], uc).toFixed(3) : 0}%,0)`);
      if (v.r) parts.push(`rotate(${lerp(v.r[0], v.r[1], uc).toFixed(2)}deg)`);
      if (v.s) parts.push(`scale(${(lerp(v.s[0], v.s[1], uc) * grow).toFixed(4)})`);
      const tr = parts.join(' ');
      if (tr !== p.tr) { p.el.style.transform = tr; p.tr = tr; }
    }

    /* Textes : mots révélés en cascade (CSS), déclenchés par la position */
    if (ready) {
      for (const t of c.ts) {
        const inn = u >= t.at ? true : (u < t.at - .03 ? false : t.in);
        if (inn !== t.in) { t.in = inn; t.el.classList.toggle('in', inn); }
        const th = exitStart + t.k * .04;
        const gone = !last && (pv >= th ? true : (pv < th - .03 ? false : t.gone));
        if (gone !== t.gone) { t.gone = gone; t.el.classList.toggle('gone', gone); }
      }
    }

    if (c.hook) c.hook(c, u, now);
  }
  function onShow(c) {
    if (c.i === 0) heroVisible = true;
    if (c.el.id === 's-histoire' && hv) { const p = hv.play(); if (p && p.catch) p.catch(() => {}); }
  }
  function onHide(c) {
    if (c.i === 0) heroVisible = false;
    if (c.el.id === 's-histoire' && hv) hv.pause();
  }

  /* ---------- Boucle : ressort amorti (sans rebond) pour un scroll soyeux ---------- */
  const OMEGA = 7.2;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    readScroll();
    const sub = Math.max(1, Math.ceil(dt / .008)), h = dt / sub;
    for (let k = 0; k < sub; k++) {
      const a = -OMEGA * OMEGA * (s - target) - 2 * OMEGA * vel;
      vel += a * h; s += vel * h;
    }
    if (Math.abs(s - target) < .12 && Math.abs(vel) < .4) { s = target; vel = 0; }
    const pv = s / H;

    for (const c of sc) place(c, pv, now);

    // HUD + nav
    let idx = 0;
    for (const c of sc) if (pv >= c.S - T * .5) idx = c.i;
    for (const c of sc) c.dot.classList.toggle('on', c.i === idx);
    hud.classList.toggle('dk', sc[idx].light);
    const map = { 2: 0, 5: 1, 6: 2, 7: 3 };
    navLinks.forEach((a, k) => a.classList.toggle('on', map[idx] === k));

    embersStep(dt, now / 1000);
    dustStep(dt, now / 1000);
    requestAnimationFrame(frame);
  }

  measure(); readScroll(); s = target;
  // lien direct (#menu, #histoire…)
  const hashMap = { '#menu': 2, '#experience': 5, '#histoire': 6, '#contact': 7 };
  if (hashMap[location.hash] != null) { setTimeout(() => { go(hashMap[location.hash], true); readScroll(); s = target; }, 60); }
  requestAnimationFrame(frame);
  setTimeout(() => { void root.offsetWidth; ready = true; }, 160);   // joue l'intro des textes de l'accueil

  const remeasure = () => { measure(); readScroll(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
  window.addEventListener('load', remeasure);
})();
