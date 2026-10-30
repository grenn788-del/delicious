/* =====================================================================
   DELICIOUS BY DELICE — étape 2 : un effet souris par partie
   - Box & Cocktails  → ondes de flou (anneaux qui floutent l'image)
   - Grillades        → fumée qui s'élève du curseur et tourbillonne
   - Manifeste        → gouttes colorées qui tombent et font des taches
   - Notre histoire   → lucioles qui flottent et viennent vers le curseur
   Module autonome : il lit seulement les classes .on / .live posées par
   main.js sur chaque scène. Aucune librairie.
   ===================================================================== */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const $ = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const coarse = matchMedia('(pointer: coarse)').matches;

  /* ---------------------------------------------------------------
     Pointeur partagé (souris ou doigt)
     --------------------------------------------------------------- */
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, has: false, t: 0 };
  const fxs = [];
  let down = null;

  function trackMove(e) {
    const now = performance.now(), dt = Math.max(8, now - ptr.t) / 1000;
    if (ptr.has) { ptr.vx = (e.clientX - ptr.x) / dt; ptr.vy = (e.clientY - ptr.y) / dt; }
    else { ptr.vx = 0; ptr.vy = 0; }
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.t = now; ptr.has = true;
    for (const f of fxs) if (f.live()) f.move(e);
  }
  addEventListener('pointermove', trackMove, { passive: true });
  addEventListener('pointerdown', (e) => {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = e.pointerType === 'mouse'; ptr.t = performance.now();
    down = { x: e.clientX, y: e.clientY, type: e.pointerType, ui: !!(e.target.closest && e.target.closest('a,button,#header,#hud,#orderBar')) };
    if (down.type === 'mouse' && !down.ui) burst(e);
  }, { passive: true });
  addEventListener('pointerup', (e) => {
    // doigt : une pression courte (sans glisser) = une rafale ; le défilement n'en déclenche pas
    if (down && down.type !== 'mouse' && !down.ui && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10) burst(e);
    if (e.pointerType !== 'mouse') ptr.has = false;
    down = null;
  }, { passive: true });
  addEventListener('pointercancel', () => { ptr.has = false; down = null; }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { ptr.has = false; });
  addEventListener('blur', () => { ptr.has = false; });
  function burst(e) { for (const f of fxs) if (f.live() && f.burst) f.burst(e); }

  /* ---------------------------------------------------------------
     Base : un canevas par scène, redimensionné à la demande
     --------------------------------------------------------------- */
  function makeCanvas(scene, before) {
    const cv = document.createElement('canvas');
    cv.className = 'fx';
    cv.setAttribute('aria-hidden', 'true');
    scene.insertBefore(cv, before || null);
    const o = { cv, ctx: cv.getContext('2d'), w: 0, h: 0, dpr: 1 };
    o.fit = () => {
      const cw = cv.clientWidth, ch = cv.clientHeight;
      if (!cw || !ch) return false;
      const d = Math.min(devicePixelRatio || 1, 2);
      if (cw * d !== cv.width || ch * d !== cv.height) {
        cv.width = cw * d; cv.height = ch * d; o.w = cw; o.h = ch; o.dpr = d;
        if (o.onResize) o.onResize();
      }
      o.ctx.setTransform(d, 0, 0, d, 0, 0);
      return true;
    };
    // position du pointeur dans le repère du canevas
    o.local = (e) => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (o.w / (r.width || 1)), y: (e.clientY - r.top) * (o.h / (r.height || 1)) };
    };
    o.inside = (p) => p.x >= 0 && p.y >= 0 && p.x <= o.w && p.y <= o.h;
    return o;
  }
  const sceneOf = (id) => document.getElementById(id);
  const isOn = (el) => el.classList.contains('on');
  const isLive = (el) => el.classList.contains('live');

  /* =================================================================
     1 · BOX & COCKTAILS — ondes de flou
     Chaque mouvement lance des anneaux de flou qui s'élargissent et
     s'effacent, comme une vague sur le verre. Une petite lentille floue
     suit le curseur.
     ================================================================= */
  (function ripples() {
    const scene = sceneOf('s-jus'); if (!scene) return;
    const box = document.createElement('div');
    box.className = 'fx fx-ripples'; box.setAttribute('aria-hidden', 'true');
    scene.insertBefore(box, $('.stack', scene));
    const lens = document.createElement('div'); lens.className = 'fx-lens'; box.appendChild(lens);

    const idle = [], busy = new Set();
    const MAX = coarse ? 5 : 9;
    let lastX = -999, lastY = -999, lastT = 0, lx = 0, ly = 0, lensA = 0, lensGoal = 0, has = false;

    function ring(x, y, size, delay, dur) {
      let el = idle.pop();
      if (el && el._a) el._a.cancel();
      if (!el) {
        if (busy.size >= MAX) { const old = busy.values().next().value; old._a && old._a.cancel(); busy.delete(old); el = old; }
        else { el = document.createElement('div'); el.className = 'fx-ring'; box.appendChild(el); }
      }
      el.style.width = el.style.height = size + 'px';
      el.style.left = (x - size / 2) + 'px'; el.style.top = (y - size / 2) + 'px';
      el.style.display = 'block'; busy.add(el);
      const a = el.animate(
        [{ transform: 'scale(.12)', opacity: 0 }, { transform: 'scale(.5)', opacity: 1, offset: .22 }, { transform: 'scale(1)', opacity: 0 }],
        { duration: dur, delay, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'both' }
      );
      el._a = a;
      a.onfinish = () => { if (!busy.has(el)) return; busy.delete(el); el.style.display = 'none'; idle.push(el); };
    }

    function toLocal(e) { const r = box.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; }

    fxs.push({
      live: () => isLive(scene),
      move(e) {
        const p = toLocal(e);
        if (p.x < 0 || p.y < 0 || p.x > p.w || p.y > p.h) { lensGoal = 0; return; }
        if (!has) { lx = p.x; ly = p.y; has = true; }
        lensGoal = 1;
        const now = performance.now(), d = Math.hypot(p.x - lastX, p.y - lastY);
        if ((d > 64 && now - lastT > 70) || (d > 14 && now - lastT > 260)) {
          const sp = clamp(Math.hypot(ptr.vx, ptr.vy) / 900, 0, 1);
          const size = 150 + sp * 150 + rnd(0, 40);
          ring(p.x, p.y, size, 0, 1300 + sp * 500);
          if (sp > .35) ring(p.x, p.y, size * .72, 150, 1200);
          lastX = p.x; lastY = p.y; lastT = now;
        }
      },
      burst(e) {
        const p = toLocal(e);
        ring(p.x, p.y, 320, 0, 1700); ring(p.x, p.y, 240, 170, 1500); ring(p.x, p.y, 170, 340, 1300);
      },
      step(dt) {
        const on = isOn(scene);
        if (!ptr.has) lensGoal = 0;
        lensA += (lensGoal - lensA) * Math.min(1, dt * 6);
        if (!on) { lensA = 0; has = false; }
        if (has) {
          const r = box.getBoundingClientRect();
          const tx = ptr.x - r.left, ty = ptr.y - r.top, k = Math.min(1, dt * 9);
          lx += (tx - lx) * k; ly += (ty - ly) * k;
        }
        lens.style.opacity = lensA.toFixed(3);
        lens.style.transform = `translate3d(${(lx - 70).toFixed(1)}px,${(ly - 70).toFixed(1)}px,0) scale(${(.85 + .15 * lensA).toFixed(3)})`;
      },
    });
  })();

  /* =================================================================
     2 · GRILLADES — fumée
     Des volutes montent du curseur (même à l'arrêt, un filet continu),
     grossissent, se tordent et s'effacent. Un geste de souris les
     pousse et les fait tourbillonner.
     ================================================================= */
  (function smoke() {
    const scene = sceneOf('s-grill'); if (!scene) return;
    const o = makeCanvas(scene, $('.stack', scene));
    const MAX = coarse ? 70 : 130;
    const ps = [];

    // sprites : nuages irréguliers faits de plusieurs halos
    const sprites = Array.from({ length: 4 }, () => {
      const s = 128, c = document.createElement('canvas'); c.width = c.height = s;
      const g = c.getContext('2d');
      for (let i = 0; i < 9; i++) {
        const a = rnd(0, TAU), d = rnd(0, 26), r = rnd(22, 44), x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
        const rg = g.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, 'rgba(238,232,226,.16)'); rg.addColorStop(.55, 'rgba(226,218,210,.065)'); rg.addColorStop(1, 'rgba(220,210,200,0)');
        g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      return c;
    });

    function puff(x, y, vx, vy) {
      if (ps.length >= MAX) return;
      ps.push({
        x: x + rnd(-8, 8), y: y + rnd(-4, 6), vx: vx * .06 + rnd(-14, 14), vy: -rnd(34, 78) + vy * .04,
        r0: rnd(14, 28), grow: rnd(2.6, 4.2), rot: rnd(0, TAU), vr: rnd(-.5, .5), life: 0, max: rnd(2.4, 4.4),
        a: rnd(.4, .7), ph: rnd(0, TAU), sp: sprites[(Math.random() * sprites.length) | 0],
      });
    }
    let acc = 0;

    fxs.push({
      live: () => isLive(scene),
      move(e) {
        const p = o.local(e); if (!o.inside(p)) return;
        const sp = Math.hypot(ptr.vx, ptr.vy), n = clamp(1 + Math.floor(sp / 380), 1, 3);
        for (let i = 0; i < n; i++) puff(p.x, p.y, ptr.vx, ptr.vy);
      },
      burst(e) { const p = o.local(e); for (let i = 0; i < 14; i++) puff(p.x + rnd(-24, 24), p.y + rnd(-10, 14), rnd(-300, 300), rnd(-200, 100)); },
      step(dt, t) {
        const on = isOn(scene);
        if (!on) { if (ps.length) { ps.length = 0; if (o.fit()) o.ctx.clearRect(0, 0, o.w, o.h); } return; }
        if (!o.fit()) return;
        const c = o.ctx;
        c.clearRect(0, 0, o.w, o.h);

        // filet continu quand le curseur reste sur la scène
        if (ptr.has && isLive(scene)) {
          const p = o.local({ clientX: ptr.x, clientY: ptr.y });
          if (o.inside(p)) { acc += dt; if (acc > .09) { acc = 0; puff(p.x, p.y, 0, 0); } }
        }
        if (!ps.length) return;

        // le geste du pointeur pousse la fumée proche
        let px = 0, py = 0, pvx = 0, pvy = 0, push = false;
        if (ptr.has && isLive(scene)) {
          const p = o.local({ clientX: ptr.x, clientY: ptr.y }); px = p.x; py = p.y;
          pvx = clamp(ptr.vx, -1600, 1600); pvy = clamp(ptr.vy, -1600, 1600); push = true;
          ptr.vx *= .9; ptr.vy *= .9;
        }
        for (let i = ps.length - 1; i >= 0; i--) {
          const p = ps[i]; p.life += dt;
          if (p.life >= p.max) { ps.splice(i, 1); continue; }
          const k = p.life / p.max;
          // turbulence + flottabilité qui s'accélère
          p.vx += (Math.sin(p.y * .013 + t * 1.2 + p.ph) * 60 + Math.cos(p.y * .031 - t * .8 + p.ph * 2) * 22) * dt;
          p.vy -= 22 * dt;
          if (push) {
            const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
            if (d2 < 150 * 150) {
              const f = (1 - Math.sqrt(d2) / 150) * dt * 3.2;
              p.vx += pvx * f * .5 - dy * f * 2.2;    // poussée + léger tourbillon
              p.vy += pvy * f * .5 + dx * f * 2.2;
            }
          }
          const drag = Math.pow(.55, dt);
          p.vx *= drag; p.vy = Math.max(p.vy * Math.pow(.8, dt), -170);
          p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
          const r = p.r0 * (1 + (p.grow - 1) * Math.sqrt(k));
          const a = p.a * Math.sin(Math.min(1, k * 4.5) * Math.PI / 2) * Math.pow(1 - k, 1.35);
          if (a < .004) continue;
          c.globalAlpha = a;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.drawImage(p.sp, -r * 1.6, -r * 1.6, r * 3.2, r * 3.2);
          c.restore();
        }
        c.globalAlpha = 1;
      },
    });
  })();

  /* =================================================================
     3 · MANIFESTE — gouttes colorées
     Le curseur laisse tomber des gouttes brillantes qui s'étirent en
     tombant puis éclaboussent le fond en taches qui se mélangent.
     ================================================================= */
  (function drops() {
    const scene = sceneOf('s-manifeste'); if (!scene) return;
    const o = makeCanvas(scene, $('.mf-stack', scene));
    const COLS = ['226,61,40', '240,112,42', '244,196,48', '233,60,120', '30,160,140', '120,80,210', '255,150,60'];
    const MAXD = coarse ? 120 : 220, MAXS = coarse ? 90 : 160;
    const fall = [], stains = [];

    function drop(x, y, vx, vy, big) {
      if (fall.length >= MAXD) return;
      fall.push({
        x, y, vx, vy, r: big ? rnd(5, 10) : rnd(2.6, 7), col: COLS[(Math.random() * COLS.length) | 0],
        g: rnd(1300, 1900), dist: rnd(70, 300), y0: y, trail: [],
      });
    }
    function splat(d) {
      if (stains.length >= MAXS) stains.shift();
      const n = 3 + ((Math.random() * 4) | 0), sat = [];
      for (let i = 0; i < n; i++) { const a = rnd(0, TAU); sat.push({ a, d: rnd(1.1, 2.1), r: rnd(.16, .38) }); }
      stains.push({ x: d.x, y: d.y, r: d.r * rnd(1.9, 3), col: d.col, life: 0, max: rnd(2.6, 3.8), sat, sq: rnd(.55, .85), rot: rnd(-.4, .4) });
    }

    fxs.push({
      live: () => isLive(scene),
      move(e) {
        const p = o.local(e); if (!o.inside(p)) return;
        const sp = Math.hypot(ptr.vx, ptr.vy), n = clamp(1 + Math.floor(sp / 650), 1, 3);
        for (let i = 0; i < n; i++)
          drop(p.x + rnd(-10, 10), p.y + rnd(-6, 8), ptr.vx * .06 + rnd(-40, 40), -rnd(0, 170) + ptr.vy * .05, false);
      },
      burst(e) {
        const p = o.local(e);
        for (let i = 0; i < 22; i++) { const a = rnd(0, TAU), v = rnd(120, 520); drop(p.x, p.y, Math.cos(a) * v, Math.sin(a) * v - 160, true); }
      },
      step(dt) {
        const on = isOn(scene);
        if (!on) { if (fall.length || stains.length) { fall.length = 0; stains.length = 0; if (o.fit()) o.ctx.clearRect(0, 0, o.w, o.h); } return; }
        if (!o.fit()) return;
        const c = o.ctx;
        c.clearRect(0, 0, o.w, o.h);
        if (!fall.length && !stains.length) return;

        // taches : elles s'étalent vite puis s'effacent doucement (multiply : les couleurs se mélangent)
        c.globalCompositeOperation = 'multiply';
        for (let i = stains.length - 1; i >= 0; i--) {
          const s = stains[i]; s.life += dt;
          if (s.life >= s.max) { stains.splice(i, 1); continue; }
          const k = s.life / s.max, grow = 1 - Math.pow(1 - Math.min(1, s.life / .22), 3);
          const a = (k < .35 ? 1 : 1 - (k - .35) / .65) * .82;
          c.fillStyle = `rgba(${s.col},${a.toFixed(3)})`;
          c.beginPath(); c.ellipse(s.x, s.y, s.r * grow, s.r * grow * s.sq, s.rot, 0, TAU); c.fill();
          for (const m of s.sat) {
            const rr = s.r * m.r * grow;
            c.beginPath(); c.arc(s.x + Math.cos(m.a) * s.r * m.d * grow, s.y + Math.sin(m.a) * s.r * m.d * grow * s.sq, rr, 0, TAU); c.fill();
          }
        }
        c.globalCompositeOperation = 'source-over';

        // gouttes en chute : étirées dans le sens du mouvement, avec un reflet
        for (let i = fall.length - 1; i >= 0; i--) {
          const d = fall[i];
          d.vy += d.g * dt; d.vx *= Math.pow(.35, dt);
          d.x += d.vx * dt; d.y += d.vy * dt;
          if (d.y - d.y0 > d.dist && d.vy > 0 || d.y > o.h - 4) { splat(d); fall.splice(i, 1); continue; }
          const sp = Math.hypot(d.vx, d.vy), st = 1 + clamp(sp / 900, 0, 1.1), ang = Math.atan2(d.vy, d.vx);
          c.fillStyle = `rgba(${d.col},.9)`;
          c.beginPath(); c.ellipse(d.x, d.y, d.r * st, d.r / Math.sqrt(st), ang, 0, TAU); c.fill();
          c.fillStyle = 'rgba(255,255,255,.62)';
          c.beginPath(); c.arc(d.x - d.r * .3, d.y - d.r * .35, Math.max(.7, d.r * .26), 0, TAU); c.fill();
        }
      },
    });
  })();

  /* =================================================================
     4 · NOTRE HISTOIRE — lucioles
     Des lucioles flottent toujours doucement, scintillent, et viennent
     tournoyer autour du curseur. Chaque mouvement en réveille de
     nouvelles qui s'éteignent peu après.
     ================================================================= */
  (function fireflies() {
    const scene = sceneOf('s-histoire'); if (!scene) return;
    const o = makeCanvas(scene, $('.stack', scene));
    const BASE = coarse ? 20 : 34, EXTRA = coarse ? 14 : 26;
    const flies = [];

    const halo = (() => {
      const s = 64, c = document.createElement('canvas'); c.width = c.height = s;
      const g = c.getContext('2d'), rg = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      rg.addColorStop(0, 'rgba(235,255,150,1)'); rg.addColorStop(.18, 'rgba(225,255,120,.7)');
      rg.addColorStop(.45, 'rgba(255,214,90,.2)'); rg.addColorStop(1, 'rgba(255,200,80,0)');
      g.fillStyle = rg; g.fillRect(0, 0, s, s); return c;
    })();

    function fly(x, y, temp) {
      return {
        x, y, a: rnd(0, TAU), sp: rnd(10, 26), turn: rnd(-1, 1), r: rnd(2.6, 5.2), ph: rnd(0, TAU), fq: rnd(1.4, 3.4),
        temp: !!temp, life: 0, max: temp ? rnd(5, 9) : 1e9, tr: [],
      };
    }
    o.onResize = () => { if (!flies.some(f => !f.temp)) for (let i = 0; i < BASE; i++) flies.push(fly(rnd(0, o.w), rnd(0, o.h), false)); };

    fxs.push({
      live: () => isLive(scene),
      move(e) {
        const p = o.local(e); if (!o.inside(p)) return;
        const extra = flies.filter(f => f.temp).length;
        if (extra < EXTRA && Math.random() < .35) flies.push(fly(p.x + rnd(-60, 60), p.y + rnd(-60, 60), true));
      },
      burst(e) {
        const p = o.local(e);
        for (let i = 0; i < 8 && flies.filter(f => f.temp).length < EXTRA + 8; i++) {
          const f = fly(p.x, p.y, true); f.sp = rnd(60, 140); flies.push(f);
        }
      },
      step(dt, t) {
        const on = isOn(scene);
        if (!on) { if (flies.length) { for (let i = flies.length - 1; i >= 0; i--) if (flies[i].temp) flies.splice(i, 1); if (o.fit()) o.ctx.clearRect(0, 0, o.w, o.h); } return; }
        if (!o.fit()) return;
        const c = o.ctx;
        c.clearRect(0, 0, o.w, o.h);
        if (!flies.length) return;
        c.globalCompositeOperation = 'lighter';

        let px = 0, py = 0, near = false;
        if (ptr.has && isLive(scene)) { const p = o.local({ clientX: ptr.x, clientY: ptr.y }); if (o.inside(p)) { px = p.x; py = p.y; near = true; } }

        for (let i = flies.length - 1; i >= 0; i--) {
          const f = flies[i]; f.life += dt;
          if (f.life > f.max) { flies.splice(i, 1); continue; }

          // errance douce : le cap dérive lentement
          f.turn += (Math.random() - .5) * dt * 6; f.turn = clamp(f.turn, -1.3, 1.3);
          f.a += f.turn * dt;
          let vx = Math.cos(f.a) * f.sp, vy = Math.sin(f.a) * f.sp - 3;

          // attirées par le curseur : elles tournoient autour au lieu de s'y coller
          if (near) {
            const dx = px - f.x, dy = py - f.y, d = Math.hypot(dx, dy) || 1, R = 300;
            if (d < R) {
              const w = (1 - d / R), pull = d > 70 ? 1 : -.6, nx = dx / d, ny = dy / d;
              vx += (nx * pull * 90 - ny * 70) * w; vy += (ny * pull * 90 + nx * 70) * w;
            }
          }
          f.x += vx * dt; f.y += vy * dt;
          // elles restent dans la scène (rebouclent doucement)
          if (f.x < -20) f.x = o.w + 20; else if (f.x > o.w + 20) f.x = -20;
          if (f.y < -20) f.y = o.h + 20; else if (f.y > o.h + 20) f.y = -20;

          f.tr.push(f.x, f.y); if (f.tr.length > 14) f.tr.splice(0, 2);

          const fl = .5 + .5 * Math.sin(t * f.fq + f.ph), flick = .18 + .82 * fl * fl;
          const fade = f.temp ? Math.sin(clamp(f.life / f.max, 0, 1) * Math.PI) : 1;
          const A = flick * fade;
          if (A < .01) continue;

          // petite traînée
          for (let j = 0; j < f.tr.length; j += 2) {
            const kk = (j / 2 + 1) / (f.tr.length / 2), s = f.r * 4 * kk;
            c.globalAlpha = A * kk * kk * .38;
            c.drawImage(halo, f.tr[j] - s, f.tr[j + 1] - s, s * 2, s * 2);
          }
          const s = f.r * 6.5 * (.8 + .4 * flick);
          c.globalAlpha = A; c.drawImage(halo, f.x - s, f.y - s, s * 2, s * 2);
          c.globalAlpha = Math.min(1, A * 1.2); c.fillStyle = '#fbffd0';
          c.beginPath(); c.arc(f.x, f.y, Math.max(.8, f.r * .32), 0, TAU); c.fill();
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      },
    });
  })();

  /* ---------------------------------------------------------------
     Boucle commune
     --------------------------------------------------------------- */
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    for (const f of fxs) f.step(dt, now / 1000);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
