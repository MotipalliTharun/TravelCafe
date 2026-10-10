/* ==========================================================
   Travel Café — scroll-linked story engine (no dependencies)

   Every <section class="scene"> is pinned via a sticky .stage. Its progress p (0 → 1)
   is derived from scroll position, then:
     • elements with data-tw="a-b: prop from to [ease], …; c-d: …" are tweened
     • scene hooks (below) handle bespoke motion (route, menu track, timers)
   ========================================================== */
(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const EASE = {
    l: t => t,
    i: t => t * t * t,
    o: t => 1 - Math.pow(1 - t, 3),
    io: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  };

  /* ---------- colour helpers ---------- */
  const hexToRgb = h => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mixColor = (a, b, t) =>
    `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], t))).join(',')})`;

  /* ---------- tween parsing ---------- */
  const parseValue = raw =>
    raw.startsWith('#')
      ? { color: hexToRgb(raw) }
      : { num: parseFloat(raw), unit: raw.replace(/^[-+\d.]+/, '') };

  function parseTweens(spec) {
    const props = {};
    spec.split(';').map(s => s.trim()).filter(Boolean).forEach(seg => {
      const m = seg.match(/^([\d.]+)\s*-\s*([\d.]+)\s*:(.*)$/);
      if (!m) return;
      const a = parseFloat(m[1]), b = parseFloat(m[2]);
      m[3].split(',').map(s => s.trim()).filter(Boolean).forEach(def => {
        const [name, from, to, ease = 'io'] = def.split(/\s+/);
        (props[name] = props[name] || []).push({
          a, b, from: parseValue(from), to: parseValue(to), ease: EASE[ease] || EASE.io,
        });
      });
    });
    Object.values(props).forEach(list => list.sort((x, y) => x.a - y.a));
    return props;
  }

  // Value of one property at progress p, holding the nearest keyframe outside segments.
  function sample(list, p) {
    let seg = list[0], t = 0;
    for (const s of list) {
      if (p < s.a) break;
      seg = s;
      t = s.b === s.a ? 1 : clamp((p - s.a) / (s.b - s.a));
    }
    if (p < list[0].a) { seg = list[0]; t = 0; }
    const k = seg.ease(t);
    if (seg.from.color) return { color: mixColor(seg.from.color, seg.to.color, k) };
    return { num: lerp(seg.from.num, seg.to.num, k), unit: seg.to.unit || seg.from.unit };
  }

  function applyTween(tw, p) {
    const { el, props, base } = tw;
    let tx = null, ty = null, r = 0, s = 1, sx = 1, sy = 1, hasT = false;
    for (const name in props) {
      const v = sample(props[name], p);
      switch (name) {
        case 'o': el.style.opacity = v.num; break;
        case 'x': tx = v.num + (v.unit || 'px'); hasT = true; break;
        case 'y': ty = v.num + (v.unit || 'px'); hasT = true; break;
        case 'r': r = v.num; hasT = true; break;
        case 's': s = v.num; hasT = true; break;
        case 'sx': sx = v.num; hasT = true; break;
        case 'sy': sy = v.num; hasT = true; break;
        case 'd': el.style.strokeDasharray = '1'; el.style.strokeDashoffset = 1 - v.num; break;
        case 'b': el.style.filter = `blur(${v.num}px)`; break;
        case 'fill': el.setAttribute('fill', v.color); break;
        case 'stop': el.setAttribute('stop-color', v.color); break;
      }
    }
    if (hasT) {
      el.style.transform =
        `${base} translate(${tx || 0}, ${ty || 0}) rotate(${r}deg) scale(${s * sx}, ${s * sy})`;
    }
  }

  /* ---------- scenes ---------- */
  const scenes = [...document.querySelectorAll('.scene')].map(el => ({
    el,
    id: el.id,
    top: 0,
    len: 1,
    p: 0,       // smoothed progress
    target: 0,  // raw progress
    rendered: -1,
    tweens: [...el.querySelectorAll('[data-tw]')].map(t => {
      // data-origin pins the pivot in SVG user units (e.g. a kettle spout).
      if (t.dataset.origin) {
        t.style.transformBox = 'view-box';
        t.style.transformOrigin = t.dataset.origin;
      }
      return {
      el: t,
      base: t.dataset.base || '',
      props: parseTweens(t.dataset.tw),
      };
    }),
  }));

  const hooks = {};

  /* --- Prologue / generic: nothing extra --- */

  /* --- Voyage: trade route, ship and stamps --- */
  (() => {
    const svg = document.getElementById('map-svg');
    if (!svg) return;
    const proj = (lat, lon) => [((lon + 180) / 360) * 1600, ((90 - lat) / 180) * 900];
    const stops = [
      { city: 'Kaffa', year: 'c. 850', lat: 7.3, lon: 36.2, text: 'Where the legend begins: Kaldi and his dancing goats.' },
      { city: 'Mocha', year: '1450', lat: 13.3, lon: 43.25, text: 'Sufi monks in Yemen brew it to stay awake through night prayers.' },
      { city: 'Cairo', year: '1500s', lat: 30.0, lon: 31.2, text: 'Coffee houses spread along the Nile, full of music and chess.' },
      { city: 'Istanbul', year: '1555', lat: 41.0, lon: 29.0, text: 'Grand coffee houses open, called “schools of the wise”.' },
      { city: 'Venice', year: '1645', lat: 45.4, lon: 12.3, text: 'Europe’s first coffee shop opens beside the lagoon.' },
      { city: 'Paris', year: '1686', lat: 48.85, lon: 2.35, text: 'Café Procope pours for philosophers, poets and revolutionaries.' },
      { city: 'Rio de Janeiro', year: '1727', lat: -22.9, lon: -43.2, text: 'A smuggled seedling begins Brazil’s coffee story. And now, your cup.' },
    ];
    const pts = stops.map(s => proj(s.lat, s.lon));

    // Catmull-Rom → cubic Bézier for a hand-drawn curve.
    const curve = list => {
      let d = `M${list[0][0]} ${list[0][1]}`;
      for (let i = 0; i < list.length - 1; i++) {
        const p0 = list[i - 1] || list[i], p1 = list[i], p2 = list[i + 1], p3 = list[i + 2] || p2;
        const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d;
    };
    // Bend the Paris → Rio leg out into the Atlantic.
    const routePts = [...pts.slice(0, 6), proj(28, -22), pts[6]];
    const d = curve(routePts);
    const route = document.getElementById('route');
    const shadow = document.getElementById('route-shadow');
    route.setAttribute('d', d);
    shadow.setAttribute('d', d);
    const total = route.getTotalLength();

    // Path length at which each stop is reached.
    const measure = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const stopLen = stops.map((_, i) => {
      if (i === 0) return 0;
      const idx = i === 6 ? routePts.length : i + 1;
      measure.setAttribute('d', curve(routePts.slice(0, idx)));
      return measure.getTotalLength();
    });

    const NS = 'http://www.w3.org/2000/svg';
    const stampsG = document.getElementById('stamps');
    const colors = ['#c65d3b', '#3a5a8a', '#7d8f69', '#8a3a5a', '#2b6a6a', '#9a6a1a', '#3a7a4a'];
    const stampEls = stops.map((s, i) => {
      const [x, y] = pts[i];
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'stamp-g');
      g.setAttribute('transform', `translate(${x} ${y})`);
      const c = colors[i];
      // Hand-placed stamp offsets so neighbouring stamps never overlap.
      const [ox, oy] = [[-62, 40], [62, 18], [-64, 4], [62, -34], [-4, -64], [-66, -26], [64, 18]][i];
      g.innerHTML = `
        <circle r="7" fill="${c}" stroke="#fbf4e6" stroke-width="2.5"/>
        <g class="stamp-inner" style="opacity:0">
          <g transform="translate(${ox} ${oy}) rotate(${(i % 2 ? 1 : -1) * 9})">
            <circle r="34" fill="#fbf4e6" fill-opacity=".85" stroke="${c}" stroke-width="3"/>
            <circle r="28" fill="none" stroke="${c}" stroke-width="1.2" stroke-dasharray="3 3"/>
            <text y="-6" text-anchor="middle" font-size="${s.city.length > 6 ? 9 : 11}" font-weight="700" fill="${c}" letter-spacing="1">${s.city.toUpperCase()}</text>
            <text y="12" text-anchor="middle" font-size="13" font-weight="600" fill="${c}">${s.year}</text>
          </g>
        </g>`;
      stampsG.appendChild(g);
      return g.querySelector('.stamp-inner');
    });

    const dots = document.getElementById('journal-dots');
    stops.forEach(() => dots.appendChild(document.createElement('li')));
    const dotEls = [...dots.children];
    const jYear = document.getElementById('journal-year');
    const jCity = document.getElementById('journal-city');
    const jText = document.getElementById('journal-text');
    const journal = jCity.closest('.journal');
    const ship = document.getElementById('ship');
    let current = -1;

    const dotsMask = document.createElementNS(NS, 'mask');
    dotsMask.id = 'routeMask';
    dotsMask.setAttribute('maskUnits', 'userSpaceOnUse');
    dotsMask.innerHTML = `<rect width="1600" height="900" fill="black"/><path d="${d}" fill="none" stroke="white" stroke-width="14" stroke-linecap="round"/>`;
    svg.insertBefore(dotsMask, svg.firstChild);
    const maskPath = dotsMask.querySelector('path');
    route.setAttribute('mask', 'url(#routeMask)');

    // Frame the route on narrow screens.
    const frame = () => {
      const portrait = innerWidth / innerHeight < 1;
      svg.setAttribute('viewBox', portrait ? '470 120 580 520' : '200 30 1200 680');
      svg.setAttribute('preserveAspectRatio', portrait ? 'xMidYMid meet' : 'xMidYMid slice');
    };
    frame();
    addEventListener('resize', frame);

    hooks.voyage = p => {
      const t = clamp((p - 0.08) / 0.85);
      const len = t * total;
      // The dotted route is revealed through a mask whose stroke "draws" up to len.
      maskPath.style.strokeDasharray = `${len} ${total + 20}`;
      shadow.style.strokeDasharray = `${len} ${total + 20}`;

      const pt = route.getPointAtLength(Math.max(0.01, len));
      const ahead = route.getPointAtLength(Math.min(total, len + 2));
      const ang = Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * 180 / Math.PI;
      const flip = Math.abs(ang) > 90;
      ship.setAttribute('transform',
        `translate(${pt.x} ${pt.y - 6}) rotate(${flip ? ang + 180 : ang} 0 6) scale(${flip ? -1 : 1} 1)`);
      ship.style.opacity = p < 0.06 ? 0 : 1;

      let reached = 0;
      stopLen.forEach((L, i) => {
        const local = clamp((len - L) / 40 + (i === 0 && t > 0 ? 1 : 0));
        const on = len >= L - 0.5 && t > 0;
        if (on) reached = i;
        const k = on ? EASE.o(clamp(local)) : 0;
        stampEls[i].style.opacity = k;
        stampEls[i].style.transform = `scale(${lerp(1.6, 1, k)})`;
        stampEls[i].style.transformOrigin = 'center';
        stampEls[i].style.transformBox = 'fill-box';
        dotEls[i].classList.toggle('on', on);
      });
      if (reached !== current) {
        current = reached;
        const s = stops[reached];
        jYear.textContent = s.year;
        jCity.textContent = s.city;
        jText.textContent = s.text;
        journal.classList.remove('flip');
        void journal.offsetWidth;
        journal.classList.add('flip');
      }
    };
  })();

  /* --- Roast: beans + temperature readout --- */
  (() => {
    const beansG = document.getElementById('beans');
    if (!beansG) return;
    const NS = 'http://www.w3.org/2000/svg';
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      // Pile the beans toward the bottom of the drum (they tumble as the drum rotates).
      const ang = rand() * Math.PI * 2;
      const rad = 30 + rand() * 105;
      const x = 800 + Math.cos(ang) * rad;
      const y = 430 + Math.sin(ang) * rad;
      const rot = rand() * 180;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(0)})`);
      g.innerHTML = '<ellipse rx="13" ry="9"/><path d="M-10 0c6-4 14 4 20 0" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>';
      beansG.appendChild(g);
    }
    const temp = document.getElementById('temp');
    hooks.roast = p => { temp.textContent = `${Math.round(lerp(160, 224, p))}°C`; };
  })();

  /* --- Pour: brew timer --- */
  (() => {
    const out = document.getElementById('brew-time');
    if (!out) return;
    hooks.pour = p => {
      const secs = Math.round(clamp((p - 0.12) / 0.76) * 210);
      out.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    };
  })();

  /* --- Menu: vertical scroll → horizontal postcard track --- */
  (() => {
    const track = document.getElementById('menu-track');
    if (!track) return;
    const cards = [...track.children];
    const idx = document.getElementById('menu-index');
    hooks.menu = p => {
      const max = Math.max(0, track.scrollWidth - innerWidth);
      const t = EASE.io(clamp((p - 0.06) / 0.88));
      track.style.transform = `translate3d(${-max * t}px,0,0)`;
      const mid = innerWidth / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const off = (r.left + r.width / 2 - mid) / innerWidth; // -1 … 1
        const dist = Math.abs(off);
        if (dist < bestD) { bestD = dist; best = i; }
        c.style.transform =
          `translateY(${(dist * 40).toFixed(1)}px) rotate(${(off * 8).toFixed(2)}deg) scale(${(1 - Math.min(dist, 1) * 0.08).toFixed(3)})`;
      });
      idx.textContent = String(best + 1).padStart(2, '0');
    };
  })();

  /* ---------- layout + render loop ---------- */
  const header = {
    num: document.getElementById('chapter-num'),
    name: document.getElementById('chapter-name'),
    bar: document.getElementById('progress-bar'),
    links: [...document.querySelectorAll('.chapter-nav a')],
  };

  function layout() {
    scenes.forEach(s => {
      const rect = s.el.getBoundingClientRect();
      s.top = rect.top + scrollY;
      s.len = Math.max(1, s.el.offsetHeight - innerHeight);
      s.rendered = -1;
    });
    update(true);
  }

  let activeId = null;
  function update(force) {
    const y = scrollY;
    const vh = innerHeight;
    let anyMoving = false;

    scenes.forEach(s => {
      s.target = clamp((y - s.top) / s.len);
      if (force || reduceMotion) s.p = s.target;
      else {
        s.p += (s.target - s.p) * 0.16;
        if (Math.abs(s.target - s.p) < 0.0004) s.p = s.target;
        else anyMoving = true;
      }
      const visible = y + vh > s.top - vh && y < s.top + s.len + vh * 2;
      if (!visible && !force) return;
      if (s.p === s.rendered) return;
      s.rendered = s.p;
      s.tweens.forEach(tw => applyTween(tw, s.p));
      if (hooks[s.id]) hooks[s.id](s.p, s);
    });

    // Header state follows the scene occupying the middle of the viewport.
    const mid = y + vh * 0.5;
    const cur = scenes.find(s => mid >= s.top && mid < s.top + s.el.offsetHeight) || scenes[scenes.length - 1];
    if (cur && cur.id !== activeId) {
      activeId = cur.id;
      document.body.dataset.theme = cur.el.dataset.theme || 'dark';
      header.num.textContent = cur.el.dataset.num;
      header.name.textContent = cur.el.dataset.name;
      header.links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${cur.id}`));
    }
    const docMax = document.documentElement.scrollHeight - vh;
    header.bar.style.transform = `scaleX(${clamp(y / Math.max(1, docMax))})`;
    return anyMoving;
  }

  let ticking = false;
  function loop() {
    const moving = update(false);
    if (moving) requestAnimationFrame(loop);
    else ticking = false;
  }
  function kick() {
    if (!ticking) { ticking = true; requestAnimationFrame(loop); }
  }

  addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', layout);
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  layout();
})();
