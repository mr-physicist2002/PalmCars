/* ============================================================
   PalmCars — motion engine
   Smooth inertia scroll · cursor · parallax · reveals
   ============================================================ */
(function () {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const smoothOn = canHover && !reduced && window.innerWidth > 1000;

  /* ---------- Configurator car (recolorable SVG) ---------- */
  const carTpl = $('#carTemplate');
  const makeCar = (paint) => { const n = carTpl.content.firstElementChild.cloneNode(true); if (paint) n.style.setProperty('--car-paint', paint); return n; };
  $('#configCarMount').appendChild(makeCar('#ff6a00'));

  /* ---------- Loader ---------- */
  const loader = $('#loader'), pct = $('#loaderPct'), bar = $('.loader__bar span');
  let lp = 0;
  const tick = setInterval(() => {
    lp = Math.min(100, lp + Math.random() * 16 + 7);
    pct.textContent = Math.floor(lp) + '%'; bar.style.width = lp + '%';
    if (lp >= 100) { clearInterval(tick); setTimeout(() => { loader.classList.add('is-done'); document.body.classList.add('is-loaded'); kickReveals(); }, 350); }
  }, 130);

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Split headings into masked lines ---------- */
  $$('[data-split]').forEach(el => {
    const html = el.innerHTML;
    el.innerHTML = `<span class="split-line"><span class="split-line__inner">${html}</span></span>`;
    el.setAttribute('data-reveal', '');
  });
  $$('[data-delay]').forEach(el => el.style.setProperty('--d', el.dataset.delay + 's'));

  /* ============================================================
     Smooth inertia scroll (Lenis-style) + unified rAF loop
     ============================================================ */
  const scrollContent = $('#scroll-content');
  const scrollWrap = $('#scroll');
  let current = 0, target = 0, docHeight = 0;

  const setHeights = () => {
    docHeight = scrollContent.getBoundingClientRect().height;
    if (smoothOn) scrollWrap.style.height = docHeight + 'px';
  };
  if (smoothOn) document.documentElement.classList.add('has-smooth');

  /* reveal + counters + parallax driven from the loop */
  const revealEls = $$('[data-reveal]');
  const parallaxEls = $$('[data-speed]');
  const counters = $$('.count');
  const startedCounters = new WeakSet();

  const animateCount = (el) => {
    if (startedCounters.has(el)) return; startedCounters.add(el);
    const to = parseFloat(el.dataset.to), dec = parseInt(el.dataset.dec || '0', 10), dur = 1700, start = performance.now();
    const fmt = n => n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const step = now => { const t = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - t, 3); el.textContent = fmt(to * e); if (t < 1) requestAnimationFrame(step); else el.textContent = fmt(to); };
    requestAnimationFrame(step);
  };

  const checkReveals = () => {
    const vh = window.innerHeight;
    for (let i = revealEls.length - 1; i >= 0; i--) {
      const el = revealEls[i];
      if (el.getBoundingClientRect().top < vh * 0.86) { el.classList.add('is-in'); revealEls.splice(i, 1); }
    }
    counters.forEach(el => { if (el.getBoundingClientRect().top < vh * 0.9) animateCount(el); });
  };
  const kickReveals = () => checkReveals();

  const applyParallax = () => {
    const vh = window.innerHeight;
    parallaxEls.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const center = r.top + r.height / 2 - vh / 2;
      el.style.transform = `translate3d(0, ${center * parseFloat(el.dataset.speed)}px, 0)`;
    });
  };

  const nav = $('#nav'), progress = $('#scrollProgress');
  let lastY = 0;
  const updateNav = (y) => {
    nav.classList.toggle('is-scrolled', y > 30);
    nav.classList.toggle('is-hidden', y > 420 && y > lastY);
    lastY = y;
    const max = (smoothOn ? docHeight : document.documentElement.scrollHeight) - window.innerHeight;
    progress.style.width = (y / Math.max(1, max)) * 100 + '%';
  };

  const raf = () => {
    target = window.scrollY || window.pageYOffset;
    if (smoothOn) {
      current = lerp(current, target, 0.092);
      if (Math.abs(target - current) < 0.05) current = target;
      scrollContent.style.transform = `translate3d(0, ${-current}px, 0)`;
    } else { current = target; }
    applyParallax();
    checkReveals();
    updateNav(current);
    cursorRaf();
    requestAnimationFrame(raf);
  };

  window.addEventListener('resize', () => { setHeights(); });
  window.addEventListener('load', () => { setHeights(); checkReveals(); });
  // recompute once images settle
  setTimeout(setHeights, 600);
  setHeights();
  requestAnimationFrame(raf);

  /* ---------- Anchor links (work with smooth scroll) ---------- */
  $$('[data-anchor]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (!id || !id.startsWith('#')) return;
      const el = $(id); if (!el) return;
      e.preventDefault();
      const navH = 70;
      const top = el.getBoundingClientRect().top + (smoothOn ? current : window.scrollY) - navH;
      window.scrollTo({ top, behavior: smoothOn ? 'auto' : 'smooth' });
      if (smoothOn) target = top;
      navLinks.classList.remove('is-open'); burger.classList.remove('is-open');
    });
  });

  /* ---------- Mobile menu ---------- */
  const burger = $('#burger'), navLinks = $('#navLinks');
  burger.addEventListener('click', () => { const o = navLinks.classList.toggle('is-open'); burger.classList.toggle('is-open', o); });

  /* ============================================================
     Custom cursor (follow + states + contextual labels + magnetic)
     ============================================================ */
  const cursor = $('#cursor'), dot = $('#cursorDot'), cursorLabel = $('#cursorLabel');
  let mx = 0, my = 0, cxp = 0, cyp = 0, cursorReady = false;
  function cursorRaf() {
    if (!cursorReady) return;
    cxp = lerp(cxp, mx, 0.2); cyp = lerp(cyp, my, 0.2);
    cursor.style.transform = `translate(${cxp}px, ${cyp}px) translate(-50%,-50%)`;
    dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
  }
  if (canHover && !reduced) {
    window.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cursorReady = true; }, { passive: true });
    const LABELS = { view: 'View', drag: 'Drag', explore: 'Explore' };
    $$('a, button, .swatch, [data-cursor]').forEach(el => {
      const label = el.dataset.cursor;
      el.addEventListener('mouseenter', () => {
        if (label && LABELS[label]) { cursor.classList.add('is-label'); cursorLabel.textContent = LABELS[label]; }
        else cursor.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', () => { cursor.classList.remove('is-hover', 'is-label'); cursorLabel.textContent = ''; });
    });
    /* magnetic */
    $$('[data-magnetic]').forEach(btn => {
      btn.addEventListener('mousemove', e => { const r = btn.getBoundingClientRect(); btn.style.transform = `translate(${(e.clientX - r.left - r.width/2) * .25}px, ${(e.clientY - r.top - r.height/2) * .4}px)`; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  } else { cursor.style.display = dot.style.display = 'none'; }

  /* ============================================================
     Models slider (arrows, dots, drag)
     ============================================================ */
  const MODELS = [
    { name: 'Bugatti Chiron Pur Sport', sub: 'W16 · Hypercar', img: 'assets/img/car-1.jpg', tag: 'Hypercar', hp: '1,500', acc: '2.3s', price: '$3,600,000' },
    { name: 'Ferrari F40',              sub: 'Twin-turbo V8 · Legend', img: 'assets/img/car-2.jpg', tag: 'Icon', hp: '471', acc: '4.1s', price: '$2,400,000' },
    { name: 'BMW M4 Competition',       sub: 'Inline-6 · Coupé', img: 'assets/img/car-3.jpg', tag: 'GT', hp: '503', acc: '3.5s', price: '$84,100' },
    { name: 'Porsche Cayman GT4',       sub: 'Flat-six · Track', img: 'assets/img/car-4.jpg', tag: 'Track', hp: '414', acc: '3.8s', price: '$103,000' },
    { name: 'McLaren 600LT',            sub: 'Twin-turbo V8 · Longtail', img: 'assets/img/car-5.jpg', tag: 'Supercar', hp: '592', acc: '2.9s', price: '$256,500' },
  ];
  const track = $('#sliderTrack'), dotsWrap = $('#sliderDots');
  MODELS.forEach(m => {
    const slide = document.createElement('article');
    slide.className = 'slide';
    slide.innerHTML = `
      <div class="slide__img"><span class="slide__tag">${m.tag}</span><img src="${m.img}" alt="${m.name}" loading="lazy" /></div>
      <div class="slide__body">
        <h3 class="slide__name">${m.name}</h3><p class="slide__sub">${m.sub}</p>
        <div class="slide__specs"><div class="slide__spec"><b>${m.hp}</b><span>Power (hp)</span></div><div class="slide__spec"><b>${m.acc}</b><span>0–100 km/h</span></div></div>
        <div class="slide__price"><strong>${m.price}</strong><a href="#configurator" class="btn btn--ghost" data-anchor>Configure</a></div>
      </div>`;
    track.appendChild(slide);
  });
  const slides = $$('.slide', track);
  let index = 0;
  const perView = () => { const w = innerWidth; return w <= 760 ? 1 : w <= 1000 ? 2 : 3; };
  const maxIndex = () => Math.max(0, slides.length - perView());
  const stepW = () => slides[0].getBoundingClientRect().width + 26;
  const buildDots = () => { dotsWrap.innerHTML = ''; for (let i = 0; i <= maxIndex(); i++) { const b = document.createElement('button'); b.setAttribute('aria-label', 'Slide ' + (i + 1)); b.addEventListener('click', () => { index = i; update(); }); dotsWrap.appendChild(b); } };
  const update = () => { index = Math.min(Math.max(0, index), maxIndex()); track.style.transform = `translateX(${-index * stepW()}px)`; $$('button', dotsWrap).forEach((d, i) => d.classList.toggle('is-active', i === index)); };
  $('#nextBtn').addEventListener('click', () => { index = index >= maxIndex() ? 0 : index + 1; update(); });
  $('#prevBtn').addEventListener('click', () => { index = index <= 0 ? maxIndex() : index - 1; update(); });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { buildDots(); update(); }, 150); });
  buildDots(); update();
  let auto = setInterval(() => { index = index >= maxIndex() ? 0 : index + 1; update(); }, 5200);
  const slider = $('#slider');
  slider.addEventListener('mouseenter', () => clearInterval(auto));

  /* drag / swipe */
  let dragStartX = 0, dragStartT = 0, dragging = false;
  const pointerDown = x => { dragging = true; dragStartX = x; dragStartT = -index * stepW(); track.classList.add('is-dragging'); clearInterval(auto); };
  const pointerMove = x => { if (!dragging) return; track.style.transform = `translateX(${dragStartT + (x - dragStartX)}px)`; };
  const pointerUp = x => { if (!dragging) return; dragging = false; track.classList.remove('is-dragging'); const dx = x - dragStartX; if (Math.abs(dx) > 60) index += dx < 0 ? 1 : -1; update(); };
  slider.addEventListener('mousedown', e => { e.preventDefault(); pointerDown(e.clientX); });
  window.addEventListener('mousemove', e => pointerMove(e.clientX));
  window.addEventListener('mouseup', e => pointerUp(e.clientX));
  slider.addEventListener('touchstart', e => pointerDown(e.touches[0].clientX), { passive: true });
  slider.addEventListener('touchmove', e => pointerMove(e.touches[0].clientX), { passive: true });
  slider.addEventListener('touchend', e => pointerUp(e.changedTouches[0].clientX));

  /* ============================================================
     Configurator live recolor
     ============================================================ */
  const swatches = $$('.swatch'), colorName = $('#colorName'), glow = $('#configGlow'), configWrap = $('#configCarMount');
  swatches.forEach(s => {
    s.addEventListener('click', () => {
      swatches.forEach(x => x.classList.remove('is-active')); s.classList.add('is-active');
      const c = s.dataset.color;
      colorName.textContent = s.dataset.name;
      const car = $('#configCarMount .car'); if (car) car.style.setProperty('--car-paint', c);
      glow.style.background = c;
      configWrap.classList.add('is-switching'); setTimeout(() => configWrap.classList.remove('is-switching'), 300);
    });
  });

  /* reservation form */
  const form = $('#reserveForm'), msg = $('#reserveMsg');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#rName').value.trim(), email = $('#rEmail').value.trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.style.color = '#ff7a7a'; msg.textContent = 'Please enter your name and a valid email address.'; return; }
    msg.style.color = ''; msg.textContent = `Thank you, ${name.split(' ')[0]} — your ${colorName.textContent} build is reserved. Our concierge will be in touch.`;
    form.reset();
  });
})();
