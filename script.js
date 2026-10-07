// Se carga en <head> sin defer para marcar .js antes de pintar y evitar parpadeos.
document.documentElement.classList.add('js');
// Intro de obra: una vez por sesión (?intro la fuerza). Con movimiento reducido o un enlace a una sección, se omite.
try {
  const forced = /[?&]intro\b/.test(location.search);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && !location.hash && (forced || !sessionStorage.getItem('propzen-intro'))) document.documentElement.classList.add('intro-on');
} catch (e) { /* sin sessionStorage la intro se omite */ }

document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  $('#year').textContent = new Date().getFullYear();

  // Menú móvil
  const toggle = $('.nav__toggle');
  const menu = $('#menu');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Ejecuta fn una sola vez cuando el elemento entra en pantalla
  const whenVisible = (el, fn, threshold = 0.3) => {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { fn(); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { io.disconnect(); fn(); }
    }, { threshold });
    io.observe(el);
  };

  // Desplazamiento con curva propia (más legible que el "smooth" del navegador)
  const animateScroll = (el, to, duration, ease) => {
    const isWindow = el === window;
    const from = isWindow ? window.scrollY : el.scrollTop;
    const change = to - from;
    if (Math.abs(change) < 1) return;
    if (reducedMotion) { isWindow ? window.scrollTo(0, to) : (el.scrollTop = to); return; }
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const y = from + change * ease(p);
      isWindow ? window.scrollTo(0, y) : (el.scrollTop = y);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // cubic-bezier(0.25, 1, 0.5, 1): desacelera de forma progresiva, sin rebote
  const cubicBezier = (x1, y1, x2, y2) => {
    const bez = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    const dBez = (t, a, b) => 3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);
    return (x) => {
      let t = x;
      for (let i = 0; i < 6; i++) {
        const d = dBez(t, x1, x2);
        if (Math.abs(d) < 1e-6) break;
        t = Math.min(1, Math.max(0, t - (bez(t, x1, x2) - x) / d));
      }
      return bez(t, y1, y2);
    };
  };
  const sectionEase = cubicBezier(0.25, 1, 0.5, 1);

  // Navegación entre secciones: scroll de 700 ms + animación de "llegada"
  const nav = $('.nav');
  const arrive = (el) => {
    if (el.tagName !== 'SECTION') return;
    el.classList.remove('section-arrive');
    void el.offsetWidth; // reinicia la animación si se repite en la misma sección
    el.classList.add('section-arrive');
    el.addEventListener('animationend', () => el.classList.remove('section-arrive'), { once: true });
  };
  const scrollToSection = (target) => {
    const y = Math.max(0, target.getBoundingClientRect().top + window.scrollY - nav.offsetHeight);
    animateScroll(window, y, 700, sectionEase);
    setTimeout(() => arrive(target), reducedMotion ? 0 : 700);
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  const cleanUrl = () => { try { history.replaceState(null, '', location.pathname + location.search); } catch (err) { /* file:// */ } };

  $$('a[href^="#"]').forEach((link) => {
    const hash = link.getAttribute('href');
    if (hash.length < 2) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      scrollToSection(target);
      cleanUrl();
    });
  });
  if (location.hash) {
    const initial = document.getElementById(location.hash.slice(1));
    if (initial) window.addEventListener('load', () => { scrollToSection(initial); cleanUrl(); }, { once: true });
  }

  // Sombra del encabezado al bajar
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Aparición escalonada al entrar en pantalla
  const REVEAL = '.hero__intro, #heroVideo, .split__head, .compare-wrap, .section__title, .does__item, .does__also, .section__intro, .tool, .faq details';
  $('#hero-title').classList.add('reveal', 'reveal--hero');
  $$(REVEAL).forEach((el) => {
    el.classList.add('reveal');
    const siblings = [...el.parentElement.children].filter((s) => s.matches(REVEAL));
    const i = siblings.indexOf(el);
    if (i > 0) el.style.transitionDelay = `${Math.min(i, 4) * 80}ms`;
  });
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reducedMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  // Botones con confirmación temporal (simulación visual, no envían nada)
  const flashButton = (btn, text) => {
    if (btn.classList.contains('is-sent')) return;
    const label = $('.remind__label', btn) || btn;
    const original = label.textContent;
    btn.classList.add('is-sent');
    label.textContent = text;
    setTimeout(() => { btn.classList.remove('is-sent'); label.textContent = original; }, 2500);
  };
  $('#remindBtn').addEventListener('click', (e) => flashButton(e.currentTarget, 'Recordatorio enviado a Carla'));

  // Panel con pestañas: fundido cruzado y el alto se adapta a cada pestaña
  const tabs = $$('.tool__tab');
  const toolBody = $('#toolBody');
  const activePanel = () => $('.tool__panel.is-active', toolBody);
  const syncHeight = () => { toolBody.style.height = `${activePanel().offsetHeight}px`; };
  const setBars = (on) => $$('#panel-stats .stat__track i').forEach((bar) => { bar.style.width = on ? `${bar.dataset.w}%` : '0'; });

  const selectTab = (tab, focus) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      panel.classList.toggle('is-active', on);
      panel.inert = !on;
    });
    if (focus) tab.focus();
    syncHeight();
    setBars(tab.id === 'tab-stats');
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab, false));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); selectTab(tabs[(i + 1) % tabs.length], true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); selectTab(tabs[(i - 1 + tabs.length) % tabs.length], true); }
    });
  });
  syncHeight();
  if (document.fonts) document.fonts.ready.then(syncHeight);
  window.addEventListener('resize', syncHeight);

  // Agenda: lo que hay hoy (4 citas a mano, esporádicas) frente a lo que hace Propzen
  // (27 citas que caen como lluvia y luego se ordenan solas por prioridad).
  const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const HOURS = ['09:30', '11:00', '12:30', '15:00', '16:30', '17:30', '19:00'];
  const TYPES = {
    alta: { label: 'Visita de alta prioridad', rank: 0, icon: '<path d="M3 12l7-6 7 6v8H3z"/><path d="M18.5 2.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>' },
    gas: { label: 'Problema de gas', rank: 1, icon: '<path d="M12 3c.5 3 4.5 5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2 1-3.4 2.2-4.4.2 1.7 1 2.7 2.3 3.1C12 9 11 6 12 3z"/>' },
    agua: { label: 'Problema de agua', rank: 2, icon: '<path d="M12 3c3.4 4.2 6 7.4 6 10.6a6 6 0 0 1-12 0C6 10.4 8.6 7.2 12 3z"/>' },
    luz: { label: 'Problema de luz', rank: 3, icon: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>' },
    visita: { label: 'Visita de cliente potencial', rank: 4, icon: '<path d="M4 11l8-6.5 8 6.5v9H4z"/><path d="M10 20v-5h4v5"/>' },
    desgaste: { label: 'Desgaste o mantención', rank: 5, icon: '<path d="M15.5 4a4.5 4.5 0 0 0-4.2 6.1L4 17.4V20h2.6l7.3-7.3A4.5 4.5 0 0 0 20 8.5l-2.7.9-2.2-2.2.9-2.7z"/>' },
    manual: { label: 'Agendada a mano', rank: 9, icon: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>' },
  };
  const PEOPLE = ['Lucía Gómez', 'Mariano Ruiz', 'Ana Castro', 'Javier Herrera', 'Paula Molina', 'Sergio Ortiz', 'Rocío Navarro', 'Valeria Paz', 'Damián Rey', 'Natalia Luna', 'Federico Vega', 'Elena Soto', 'Gonzalo Ibáñez', 'Teresa Rocha', 'Camila Pérez', 'Felipe Araya', 'Josefa Muñoz', 'Matías Silva'];
  const PLACES = ['Depa Ñuñoa', 'Casa La Florida', 'Depa Providencia', 'Depa Santiago Centro', 'Casa Maipú', 'Depa Las Condes', 'Casa Peñalolén', 'Depa San Miguel'];
  const BROKERS = ['Laura', 'Diego', 'Sofía', 'Tomás'];
  const MANUAL = [[0, 2], [2, 5], [3, 0], [5, 1]];   // [día, fila]: Lun 12:30, Mié 17:30, Jue 09:30, Sáb 11:00
  const AI_TYPES = [...Array(5).fill('alta'), ...Array(11).fill('visita'), ...Array(3).fill('agua'), ...Array(3).fill('gas'), ...Array(3).fill('luz'), ...Array(2).fill('desgaste')];
  const PER_DAY = [5, 4, 5, 4, 5, 4];                 // 27 citas de la IA repartidas en la semana
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';

  const cal = $('#cal');
  const calWrap = $('.cal-wrap');
  const phaseEl = $('#calPhase');
  const liveEl = $('#calLive');
  const replayBtn = $('#calReplay');
  const slots = [];
  const mk = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
  cal.appendChild(mk('div', 'cal__day cal__corner'));
  DAYS.forEach((d) => cal.appendChild(mk('div', 'cal__day', d.slice(0, 3))));
  HOURS.forEach((h, r) => {
    cal.appendChild(mk('div', 'cal__time', h));
    slots.push(DAYS.map(() => { const s = mk('div', 'cal__slot'); cal.appendChild(s); return s; }));
  });
  const layer = mk('div', 'cal__layer');
  const calTip = mk('div', 'cal-tip');
  const flash = mk('div', 'cal-flash'); flash.appendChild(mk('i', ''));
  const scan = mk('div', 'cal-scan');
  [layer, calTip, flash, scan].forEach((el) => cal.appendChild(el));
  calTip.setAttribute('aria-hidden', 'true');

  // Reloj que se detiene con la pestaña oculta: las esperas y las animaciones en curso se pausan
  let hiddenNow = document.hidden;
  const pausedAnims = new Set();
  const wait = async (ms) => {
    let left = ms;
    while (left > 0) {
      const t = performance.now();
      await new Promise((r) => setTimeout(r, Math.min(left, 40)));
      if (!hiddenNow) left -= performance.now() - t;
    }
  };
  document.addEventListener('visibilitychange', () => {
    hiddenNow = document.hidden;
    if (hiddenNow) cal.getAnimations({ subtree: true }).forEach((a) => { if (a.playState === 'running') { a.pause(); pausedAnims.add(a); } });
    else { pausedAnims.forEach((a) => a.play()); pausedAnims.clear(); }
  });

  // Geometría: cada cita se ubica sobre su ranura con transform (la ranura sigue en la grilla)
  // Medidas con subpíxeles (offsetTop redondea y en pantallas densas asomaba el borde de la ranura)
  const geo = (r, c) => {
    const s = slots[r][c].getBoundingClientRect(), k = cal.getBoundingClientRect();
    return { x: s.left - k.left - cal.clientLeft, y: s.top - k.top - cal.clientTop, w: s.width, h: s.height };
  };
  const at = (r, c) => { const g = geo(r, c); return `translate(${g.x}px, ${g.y}px)`; };
  const sizeAppt = (ev) => {
    const g = geo(ev.row, ev.col);
    ev.btn.style.width = `${g.w}px`; ev.btn.style.height = `${g.h}px`;
    ev.nameEl.textContent = g.w < 84 ? ev.initials : ev.short;   // pastillas angostas: iniciales
  };
  const setHour = (ev) => {
    ev.hour = HOURS[ev.row];
    ev.btn.setAttribute('aria-label', `${ev.name}, ${TYPES[ev.type].label}, ${ev.dayName} ${ev.hour}. Abre su ficha.`);
  };
  const play = (el, frames, opts) => el.animate(frames, { fill: 'backwards', ...opts });

  // Datos con azar fijo: la historia es la misma cada vez
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const makeEvents = () => {
    seed = 7;
    const list = [];
    const person = () => PEOPLE[Math.floor(rnd() * PEOPLE.length)];
    const addEv = (type, day, row, ia) => {
      const name = person();
      const [first, last] = name.split(' ');
      const ev = { type, day, row, ia, ok: true, name, short: `${first[0]}. ${last}`, initials: `${first[0]}${last[0]}`, place: PLACES[Math.floor(rnd() * PLACES.length)], agent: BROKERS[Math.floor(rnd() * BROKERS.length)], dayName: DAYS[day] };
      ev.day = DAYS[day]; ev.col = day;
      const btn = mk('button', `appt appt--${type}`);
      btn.type = 'button';
      btn.innerHTML = `<span class="appt__in"><svg class="appt__ico" viewBox="0 0 24 24" aria-hidden="true">${TYPES[type].icon}</svg><span class="appt__name"></span></span>`;
      ev.btn = btn; ev.nameEl = btn.querySelector('.appt__name');
      btn.addEventListener('click', () => openAppt(ev));
      const show = () => {
        const g = geo(ev.row, ev.col);
        calTip.textContent = `${TYPES[type].label} · ${ev.place} · ${DAYS[ev.col].slice(0, 3)} ${HOURS[ev.row]}`;
        const half = calTip.offsetWidth / 2 + 4;
        const x = Math.min(Math.max(g.x + g.w / 2, half), cal.offsetWidth - half);
        calTip.style.transform = ev.row === 0 ? `translate(${x}px, ${g.y + g.h + 8}px) translateX(-50%)` : `translate(${x}px, ${g.y - 8}px) translate(-50%, -100%)`;
        calTip.classList.add('is-on');
      };
      btn.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(); });
      btn.addEventListener('pointerleave', () => calTip.classList.remove('is-on'));
      btn.addEventListener('focus', show);
      btn.addEventListener('blur', () => calTip.classList.remove('is-on'));
      list.push(ev);
      return ev;
    };
    MANUAL.forEach(([d, r]) => addEv('manual', d, r, false));
    // Tipos mezclados y repartidos por día; cada día cae en ranuras libres al azar
    const types = AI_TYPES.slice().sort(() => rnd() - .5);
    let k = 0;
    PER_DAY.forEach((count, d) => {
      const free = HOURS.map((_, r) => r).filter((r) => !MANUAL.some(([md, mr]) => md === d && mr === r)).sort(() => rnd() - .5);
      for (let i = 0; i < count; i++) addEv(types[k++], d, free[i], true);
    });
    return list;
  };

  // Orden final: por día, alta prioridad arriba y los problemas urgentes (gas, agua) en la mañana; las manuales no se mueven
  const finalRows = (list) => {
    const out = new Map();
    DAYS.forEach((_, d) => {
      const fixed = list.filter((ev) => !ev.ia && ev.col === d).map((ev) => ev.row);
      const free = HOURS.map((_, r) => r).filter((r) => !fixed.includes(r));
      list.filter((ev) => ev.ia && ev.col === d)
        .sort((a, b) => TYPES[a.type].rank - TYPES[b.type].rank || a.name.localeCompare(b.name))
        .forEach((ev, i) => out.set(ev, free[i]));
    });
    return out;
  };

  const setPhase = async (html, announce) => {
    phaseEl.classList.add('is-out');
    await wait(reducedMotion ? 0 : 250);
    phaseEl.innerHTML = html;
    phaseEl.classList.remove('is-out');
    liveEl.textContent = announce;
  };

  let events = [];
  let runId = 0;
  const reset = () => {
    runId += 1;
    cal.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    pausedAnims.clear();
    layer.textContent = '';                       // nunca se duplican citas al repetir
    calTip.classList.remove('is-on');
    replayBtn.classList.remove('is-in'); replayBtn.hidden = true;
    events = makeEvents();
    return runId;
  };
  const layoutCal = () => {
    // Celular: 3 días visibles a la vez dentro de .cal-wrap
    if (window.innerWidth < 768) cal.style.setProperty('--daycol', `${Math.floor((calWrap.clientWidth - 44 - 18) / 3)}px`);
    else cal.style.removeProperty('--daycol');
    events.forEach((ev) => { if (ev.btn.isConnected) { sizeAppt(ev); ev.btn.style.transform = at(ev.row, ev.col); } });
  };

  async function runAgenda() {
    const id = reset();
    const alive = () => id === runId;
    layoutCal();
    const manual = events.filter((ev) => !ev.ia), ai = events.filter((ev) => ev.ia);

    if (reducedMotion) {
      // Sin caída ni barrido: aparecen ya ordenadas con un fundido
      const fin = finalRows(events);
      events.forEach((ev) => { if (fin.has(ev)) ev.row = fin.get(ev); layer.appendChild(ev.btn); sizeAppt(ev); setHour(ev); ev.btn.style.transform = at(ev.row, ev.col); play(ev.btn, [{ opacity: 0 }, { opacity: 1 }], { duration: 400 }); });
      await setPhase('31 citas, ordenadas por prioridad', '31 citas, ordenadas por prioridad.');
      replayBtn.hidden = false; replayBtn.classList.add('is-in');
      syncHeight();
      return;
    }

    // Fase 1 · Hoy, a mano: 4 citas lentas y dispersas
    await setPhase('Hoy, a mano: 4 citas esta semana', 'Hoy, a mano: 4 citas esta semana.');
    for (const ev of manual) {
      await wait(600 + rnd() * 300); if (!alive()) return;
      layer.appendChild(ev.btn); sizeAppt(ev); setHour(ev);
      const to = at(ev.row, ev.col);
      ev.btn.style.transform = to;
      play(ev.btn, [{ opacity: 0, transform: `${to} scale(.9)` }, { opacity: 1, transform: `${to} scale(1)` }], { duration: 380, easing: EASE });
    }
    await wait(700); if (!alive()) return;

    // Fase 2 · Lluvia de la IA: destello en el borde superior y 27 citas que caen y encajan con rebote
    await setPhase('Con Propzen: llegan solas… <b>4</b>', 'Con Propzen: las citas llegan solas.');
    play(flash.firstChild, [{ opacity: 0, transform: 'translateX(-100%)' }, { opacity: 1, offset: .2 }, { opacity: 1, offset: .8 }, { opacity: 0, transform: `translateX(${cal.offsetWidth}px)` }], { duration: 900, easing: 'ease-in-out' });
    const count = phaseEl.querySelector('b');
    let landed = manual.length;
    const W = cal.offsetWidth;
    for (const ev of ai) {
      if (!alive()) return;
      layer.appendChild(ev.btn); sizeAppt(ev); setHour(ev);
      const g = geo(ev.row, ev.col);
      const to = `translate(${g.x}px, ${g.y}px)`;
      const sx = Math.min(Math.max(g.x + (rnd() - .5) * 2.4 * g.w, 0), W - g.w);
      const rot = (rnd() * 16 - 8).toFixed(1);
      ev.btn.style.transform = to;
      play(ev.btn, [
        { transform: `translate(${sx.toFixed(1)}px, ${-g.h * .4}px) rotate(${rot}deg)`, opacity: 0, offset: 0, easing: 'cubic-bezier(.5, 0, .75, 0)' },
        { opacity: 1, offset: .12 },
        { transform: `${to} translateY(4px) scale(1.05, .9)`, opacity: 1, offset: .7, easing: 'cubic-bezier(.34, 1.56, .64, 1)' },
        { transform: to, opacity: 1 },
      ], { duration: 820 }).finished.then(() => { if (alive()) { landed += 1; count.textContent = String(landed); } }).catch(() => {});
      await wait(70 + rnd() * 40);
    }
    await wait(850); if (!alive()) return;
    count.textContent = '31';

    // Fase 3 · Orden por prioridad: la línea de escaneo barre y a su paso las citas se reacomodan (FLIP)
    await setPhase('31 citas, ordenadas por prioridad', '31 citas, ordenadas por prioridad.');
    const fin = finalRows(events);
    const SWEEP = 1500;
    play(scan, [{ opacity: 0, transform: 'translateX(0)' }, { opacity: 1, offset: .06 }, { opacity: 1, offset: .94 }, { opacity: 0, transform: `translateX(${W}px)` }], { duration: SWEEP, easing: 'linear' });
    const order = DAYS.map((_, d) => { const g = geo(0, d); return { d, t: ((g.x + g.w / 2) / W) * SWEEP }; });
    let elapsed = 0;
    for (const { d, t } of order) {
      await wait(t - elapsed); elapsed = t; if (!alive()) return;
      const before = new Set(events.filter((ev) => ev.col === d).map((ev) => ev.row));
      events.filter((ev) => ev.col === d && fin.has(ev) && fin.get(ev) !== ev.row).forEach((ev) => {
        const from = at(ev.row, ev.col);
        ev.row = fin.get(ev); setHour(ev);
        const to = at(ev.row, ev.col);
        ev.btn.style.transform = to;
        play(ev.btn, [{ transform: from }, { transform: to }], { duration: 520, easing: EASE });
      });
      const after = new Set(events.filter((ev) => ev.col === d).map((ev) => ev.row));
      before.forEach((r) => { if (!after.has(r)) { const s = slots[r][d]; s.classList.remove('is-closing'); void s.offsetWidth; s.classList.add('is-closing'); } });
    }
    await wait(SWEEP - elapsed + 560); if (!alive()) return;
    events.filter((ev) => ev.type === 'alta').forEach((ev) => { ev.btn.classList.remove('is-pulse'); void ev.btn.offsetWidth; ev.btn.classList.add('is-pulse'); });
    await wait(300); if (!alive()) return;
    replayBtn.hidden = false;
    requestAnimationFrame(() => replayBtn.classList.add('is-in'));
  }

  // Al repetir, el foco pasa al calendario (el botón se oculta hasta el final)
  calWrap.tabIndex = -1;
  replayBtn.addEventListener('click', () => { calWrap.focus({ preventScroll: true }); runAgenda(); });
  window.addEventListener('resize', () => { layoutCal(); syncHeight(); });
  layoutCal();
  whenVisible(calWrap, runAgenda, 0.3);

  // Ficha de la visita
  const modal = $('#apptModal');
  const apptStatus = $('#apptStatus');
  let lastFocus = null;
  let modalTimer = null;

  const openAppt = (ev) => {
    lastFocus = ev.btn;
    apptStatus.className = `tag ${ev.ok ? 'tag--ok' : 'tag--pend'}`;
    apptStatus.textContent = ev.ok ? '✓ Confirmada' : '? Falta confirmar';
    $('#apptName').textContent = ev.name;
    $('#apptWhen').textContent = `${ev.day} ${ev.hour}`;
    $('#apptProp').textContent = ev.place;
    $('#apptAgent').textContent = ev.agent;
    $('#apptOrigin').textContent = ev.ia ? `Propzen · ${TYPES[ev.type].label}` : 'Agendada a mano por el corredor';
    clearTimeout(modalTimer);
    modal.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('is-open')));
    $('#apptClose').focus();
  };
  const closeAppt = () => {
    if (modal.hidden) return;
    modal.classList.remove('is-open');
    modalTimer = setTimeout(() => { modal.hidden = true; }, reducedMotion ? 0 : 250);
    if (lastFocus) lastFocus.focus();
  };
  $('#apptClose').addEventListener('click', closeAppt);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAppt(); });
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeAppt(); return; }
    if (e.key !== 'Tab') return;
    // Mantiene el foco dentro de la ficha mientras está abierta
    const focusables = $$('button', modal);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $('#apptRemind').addEventListener('click', (e) => flashButton(e.currentTarget, 'Recordatorio enviado'));
  $('#apptMove').addEventListener('click', (e) => flashButton(e.currentTarget, 'Nuevos horarios enviados al cliente'));

  // Formulario de contacto
  const leadForm = $('#leadForm');
  const formMsg = $('#formMsg');
  // Número de WhatsApp de Propzen: se define una sola vez, en data-whatsapp de #complementos (sección de precios)
  const waNum = (($('#complementos') || {}).dataset?.whatsapp || '').replace(/\D/g, '');
  const waLink = (text) => `https://wa.me/${waNum}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  const chWsp = $('#chWsp');
  if (waNum && chWsp) {
    chWsp.href = waLink('Hola, quiero saber cómo Propzen puede ayudar a mi corredora.');
    chWsp.target = '_blank';
    chWsp.rel = 'noopener';
  }

  // Los botones de cada plan (precios) marcan su ficha en el formulario; al llegar, la ficha hace un pulso amarillo
  $$('[data-plan]').forEach((a) => {
    a.addEventListener('click', () => {
      const chip = leadForm.querySelector(`input[name="plan"][value="${a.dataset.plan}"]`);
      if (!chip) return;
      chip.checked = true;
      const label = chip.nextElementSibling;
      setTimeout(() => { label.classList.remove('is-pulse'); void label.offsetWidth; label.classList.add('is-pulse'); }, reducedMotion ? 0 : 720);
    });
  });

  // WhatsApp chileno: "+56 9 XXXX XXXX", "9 XXXX XXXX", con o sin espacios → "+569XXXXXXXX" (vacío si no es válido)
  const normTel = (v) => {
    const d = v.replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('569')) return `+${d}`;
    if (d.length === 9 && d.startsWith('9')) return `+56${d}`;
    return '';
  };
  const CHECKS = {
    nombre: (v) => (v ? '' : 'Cuéntanos tu nombre'),
    empresa: (v) => (v ? '' : '¿Cómo se llama tu corredora?'),
    telefono: (v) => (normTel(v) ? '' : 'Revisa tu WhatsApp, debe ser un número chileno'),
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Revisa tu correo, debe ser del tipo nombre@corredora.cl'),
    acepto: (v, field) => (field.checked ? '' : 'Debes aceptar la política de privacidad'),
  };

  const validate = (field) => {
    const msg = CHECKS[field.name](field.value.trim(), field);
    field.setAttribute('aria-invalid', String(Boolean(msg)));
    $(`#e-${field.name}`).textContent = msg;
    return !msg;
  };

  // Se valida al salir de un campo que ya se escribió, y se revalida al escribir si estaba con error.
  // El espacio de cada mensaje de error está reservado en el CSS: que aparezca o desaparezca no mueve el botón
  // de envío bajo el puntero (si se moviera, el clic de envío se perdería).
  Object.keys(CHECKS).forEach((name) => {
    const field = leadForm.elements[name];
    if (field.type === 'checkbox') { field.addEventListener('change', () => validate(field)); return; }
    field.addEventListener('input', () => { field.dataset.dirty = '1'; if (field.getAttribute('aria-invalid') === 'true') validate(field); });
    field.addEventListener('blur', () => { if (field.dataset.dirty) validate(field); });
  });

  // Apps Script de contacto@propzen.cl: reenvía cada solicitud por correo y la guarda en la planilla "Leads Propzen"
  const URL_FORMULARIO = 'https://script.google.com/macros/s/AKfycbw9YyKaPUWJXj20bRNB9Hrhm4mzVCssSzKW6KGjWv7G-Le9k9xgzCrXYcfWGBGSFB9U/exec';
  // Versión de la Política de Privacidad que se acepta en el formulario: cámbiala junto con privacidad.html
  const VERSION_POLITICA = '1.0';
  const SEND_ERRORS = {
    datos: 'Revisa los datos del formulario e inténtalo de nuevo.',
    limite: 'Recibimos varias solicitudes seguidas desde tu conexión. Espera unos minutos e inténtalo de nuevo.',
    otro: 'No pudimos enviar tu solicitud. Inténtalo de nuevo en un momento o escríbenos a contacto@propzen.cl.',
  };
  // Envía la solicitud al Apps Script. Responde siempre con estado 200 y { ok: true } o { ok: false, error: 'datos' | 'limite' | 'otro' }.
  // El cuerpo va como texto plano: así el navegador no hace la verificación previa de CORS, que Apps Script no admite;
  // Google responde con una redirección a script.googleusercontent.com, que fetch sigue.
  // Devuelve { ok } o { ok: false, message } con un texto para mostrar; nunca lanza error (20 s como máximo).
  const sendLead = async (data) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(URL_FORMULARIO, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(data),
        redirect: 'follow',
        signal: ctrl.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok === true) return { ok: true };
      return { ok: false, message: SEND_ERRORS[body.error === 'datos' || body.error === 'limite' ? body.error : 'otro'] };
    } catch (err) {
      return { ok: false, message: SEND_ERRORS.otro };
    } finally {
      clearTimeout(timer);
    }
  };

  const done = $('#formDone');
  const formError = $('#formError');
  leadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = leadForm.querySelector('.ct-submit');
    if (btn.disabled) return;
    formMsg.textContent = '';
    const fields = Object.keys(CHECKS).map((n) => leadForm.elements[n]);
    const invalid = fields.filter((f) => !validate(f));
    if (invalid.length) { invalid[0].focus(); return; }

    // Campo trampa: si un bot lo completó, se descarta en silencio
    if (leadForm.elements.web.value) return;

    // Va también el campo trampa (vacío): el Apps Script lo revisa por su cuenta
    const data = Object.fromEntries(new FormData(leadForm));
    data.telefono = normTel(data.telefono);   // siempre "+569XXXXXXXX", el formato que exige el Apps Script
    data.acepto = leadForm.elements.acepto.checked;   // la casilla trae el valor "sí": llega como true
    // Evidencia del consentimiento: casilla obligatoria (sin ella la validación no deja enviar), casilla de novedades,
    // versión de la política aceptada y momento del envío en ISO 8601 (UTC)
    data.consentimiento_contacto = data.acepto;
    data.consentimiento_marketing = leadForm.elements.marketing.checked;
    delete data.marketing;
    data.version_politica = VERSION_POLITICA;
    data.fecha_consentimiento = new Date().toISOString();

    btn.disabled = true;
    btn.classList.add('is-sending');
    formError.hidden = true;
    formMsg.textContent = 'Enviando tu solicitud…';
    // La espera mínima evita que el estado "Enviando…" parpadee si el servidor responde muy rápido
    const [sent] = await Promise.all([sendLead(data), sleep(reducedMotion ? 300 : 900)]);
    if (!sent.ok) {
      btn.disabled = false;
      btn.classList.remove('is-sending');
      formMsg.textContent = '';
      formError.textContent = sent.message;
      formError.hidden = false;
      return;
    }

    // Éxito: el formulario se reemplaza con un fundido por la tarjeta de confirmación
    const nombre = data.nombre.split(' ')[0];
    $('#formDoneText').textContent = `¡Listo, ${nombre}! Te escribiremos por WhatsApp en menos de 2 horas hábiles para agendar tu demo.`;
    const wsp = $('#formDoneWsp');
    if (waNum) { wsp.href = waLink(`Hola, soy ${data.nombre} de ${data.empresa}. Quiero agendar mi demo de Propzen.`); wsp.hidden = false; }
    formMsg.textContent = '';
    const fadeOut = leadForm.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reducedMotion ? 150 : 280, easing: 'ease', fill: 'forwards' });
    await fadeOut.finished;
    leadForm.hidden = true;
    fadeOut.cancel();
    done.hidden = false;
    done.animate(reducedMotion ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 480, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    done.focus({ preventScroll: true });   // el foco pasa a la confirmación (el botón de envío ya no está)
  });
});

// Sección del problema: tarjetas de antes y después que giran al tocarlas
document.addEventListener('DOMContentLoaded', () => {
  const section = document.getElementById('problema');
  if (!section) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards = [...section.querySelectorAll('.flip')];
  const items = [...section.querySelectorAll('.disc__item')];
  const opts = [...section.querySelectorAll('.disc__opt')];
  const list = section.querySelector('.disc__cards');
  const dots = [...section.querySelectorAll('.disc__dot')];
  const live = section.querySelector('#discLive');
  const countEl = section.querySelector('#discCount');
  const countNum = countEl.querySelector('b');
  const done = section.querySelector('#discDone');
  let interacted = false;
  let wasDone = false;

  const isAfter = (card) => card.getAttribute('aria-pressed') === 'true';

  // Ambas caras existen en el DOM; la que no se ve queda oculta para lectores de pantalla
  const setCard = (card, after) => {
    card.classList.remove('is-peek');
    card.setAttribute('aria-pressed', String(after));
    card.querySelector('.flip__face--before').setAttribute('aria-hidden', String(after));
    card.querySelector('.flip__face--after').setAttribute('aria-hidden', String(!after));
  };

  const describe = (card) => {
    const face = card.querySelector(isAfter(card) ? '.flip__face--after' : '.flip__face--before');
    const label = face.querySelector('.flip__label').textContent;
    const text = face.querySelector('.flip__text').textContent;
    return `${label}, ${isAfter(card) ? 'con Propzen' : 'hoy'}: ${text}.`;
  };

  const update = (message) => {
    const n = cards.filter(isAfter).length;
    const all = n === cards.length;
    countNum.textContent = n;
    if (n === 0 || all) opts.forEach((o) => o.setAttribute('aria-pressed', String((o.dataset.mode === 'after') === all)));
    if (all && !wasDone) {
      countEl.hidden = true;
      done.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => done.classList.add('is-in')));
    } else if (!all && wasDone) {
      done.classList.remove('is-in');
      done.hidden = true;
      countEl.hidden = false;
    }
    wasDone = all;
    if (message) live.textContent = all ? `${message} Así se ve tu semana con Propzen.` : `${message} ${n} de ${cards.length} descubiertos.`;
  };

  // Clic, toque o Enter/Espacio (el botón nativo ya los maneja)
  cards.forEach((card) => {
    card.addEventListener('click', () => {
      interacted = true;
      setCard(card, !isAfter(card));
      update(describe(card));
    });
  });

  // Interruptor: todas giran en cascada, 80 ms entre cada una
  opts.forEach((opt) => {
    opt.addEventListener('click', () => {
      interacted = true;
      const after = opt.dataset.mode === 'after';
      opts.forEach((o) => o.setAttribute('aria-pressed', String(o === opt)));
      cards.forEach((card, i) => {
        setTimeout(() => {
          setCard(card, after);
          const last = i === cards.length - 1;
          update(last ? (after ? 'Mostrando tu semana con Propzen.' : 'Mostrando tu semana hoy.') : null);
        }, reduced ? 0 : i * 80);
      });
    });
  });

  // Entrada escalonada al aparecer en pantalla y, una sola vez, la primera tarjeta
  // gira sola para enseñar que se pueden tocar (si nadie interactuó antes)
  const enter = () => {
    items.forEach((item, i) => {
      item.style.transitionDelay = `${i * 100}ms`;
      item.classList.add('is-in');
      setTimeout(() => { item.style.transitionDelay = ''; }, 600 + i * 100);
    });
    setTimeout(() => {
      if (interacted) return;
      cards[0].classList.add('is-peek');
      setTimeout(() => cards[0].classList.remove('is-peek'), 1600);
    }, 1200);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { io.disconnect(); enter(); }
    }, { threshold: 0.25 });
    io.observe(list);
  } else {
    enter();
  }

  // Puntos del carrusel en celular: marcan la tarjeta visible
  let ticking = false;
  list.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const step = items[1].offsetLeft - items[0].offsetLeft;
      const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
      const i = atEnd ? items.length - 1 : Math.min(items.length - 1, Math.max(0, Math.round(list.scrollLeft / step)));
      dots.forEach((d, n) => d.classList.toggle('is-active', n === i));
    });
  }, { passive: true });
});

// Hero: video introductorio. Arranca solo, en silencio y en bucle cuando está en pantalla; en la primera visita
// espera a que termine la intro de obra, para que se vea desde el comienzo. Fuera de pantalla se pausa y al volver
// sigue. El <video> no lleva el atributo autoplay a propósito: así el navegador no descarga los megas del video
// hasta que este se acerca a la pantalla (en celular queda bajo el pliegue); lo inicia este script.
// Con "reducir movimiento" queda el póster con el botón Reproducir; si el navegador bloquea la reproducción
// automática (por ejemplo, iPhone en modo de bajo consumo), aparece el mismo botón. Mientras corre, el botón
// queda en la esquina como "Pausar video".
// Pantalla completa (botón de la esquina o doble clic sobre el video): en computador, Android y iPad pasa a pantalla
// completa el contenedor entero, con sus botones, y en Android además gira a horizontal; en iPhone, que no permite
// poner elementos en pantalla completa, se abre el reproductor nativo. Pedirla con el video detenido lo hace correr.
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('heroVideo');
  if (!wrap) return;
  const video = wrap.querySelector('video');
  if (video.dataset.poster) video.poster = video.dataset.poster;   // ver el comentario del <video> en index.html
  const btn = wrap.querySelector('.hero-video__btn');
  const label = btn.querySelector('.hero-video__label');
  const fsBtn = wrap.querySelector('.hero-video__fs');
  const fsLabel = fsBtn.querySelector('.sr-only');
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;
  const canFs = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  const canNativeFs = !canFs && typeof video.webkitEnterFullscreen === 'function';   // iPhone
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  let wanted = !reduced;      // corre salvo que la persona, el sistema o el navegador digan lo contrario
  let onScreen = !hasIO;
  let idleTimer = 0;

  // En pantalla completa y con el video corriendo, .is-idle esconde botones y cursor tras 2,5 s sin moverse
  const wake = () => {
    clearTimeout(idleTimer);
    wrap.classList.remove('is-idle');
    if (wanted && fsElement() === wrap) idleTimer = setTimeout(() => wrap.classList.add('is-idle'), 2500);
  };
  // El botón refleja la intención y no el estado real: al pausarse fuera de pantalla no cambia y no salta al volver
  const render = () => {
    wrap.classList.toggle('is-playing', wanted);
    label.textContent = wanted ? 'Pausar video' : 'Reproducir video';
    wake();
  };
  const showBtn = () => {
    render();
    btn.hidden = false;
    if (canFs || canNativeFs) { wrap.classList.add('has-fs'); fsBtn.hidden = false; }
  };
  const play = () => {
    const p = video.play();
    // Solo NotAllowedError es un bloqueo real; AbortError ocurre si se pausa antes de arrancar (pasar rápido de largo)
    if (p && p.catch) p.catch((err) => { if (err && err.name === 'NotAllowedError') { wanted = false; showBtn(); } });
  };
  const update = () => {
    const visible = onScreen || fsElement() === wrap || video.webkitDisplayingFullscreen;
    if (wanted && visible && !root.classList.contains('intro-on')) { if (video.paused) play(); }
    else if (!video.paused) video.pause();
  };

  if (reduced) showBtn();                                    // solo el póster y "Reproducir video"
  else video.addEventListener('playing', showBtn, { once: true });

  btn.addEventListener('click', () => {
    wanted = !wanted;
    render();
    update();
  });

  if (canFs || canNativeFs) {
    // iPhone: webkitEnterFullscreen falla si el video aún no tiene metadatos (iOS no precarga). El mismo toque llama a
    // play() (en update), que lo carga, y se entra apenas llegan: ese toque ya habilitó la pantalla completa del video
    const enterNative = () => {
      if (video.readyState >= 1) { try { video.webkitEnterFullscreen(); } catch (e) { /* el próximo toque lo reintenta */ } return; }
      video.addEventListener('loadedmetadata', () => { try { video.webkitEnterFullscreen(); } catch (e) { /* ídem */ } }, { once: true });
    };
    const toggleFs = () => {
      if (fsElement()) {
        const r = (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        if (r && r.catch) r.catch(() => {});
        return;
      }
      wanted = true;
      showBtn();                 // por si se pidió con doble clic antes de que el video arrancara
      if (canFs) {
        const r = (wrap.requestFullscreen || wrap.webkitRequestFullscreen).call(wrap);
        if (r && r.catch) r.catch(() => {});
      } else enterNative();
      update();
    };
    fsBtn.addEventListener('click', toggleFs);
    video.addEventListener('dblclick', toggleFs);
    // Toda salida pasa por aquí (el botón, Esc, el gesto atrás de Android, el navegador): se restablece todo
    let wasFs = false;
    const onFsChange = () => {
      const on = fsElement() === wrap;
      if (on === wasFs) return;  // Safari avisa con y sin prefijo
      wasFs = on;
      wrap.classList.toggle('is-fs', on);
      fsLabel.textContent = fsBtn.title = on ? 'Salir de pantalla completa' : 'Ver en pantalla completa';
      if (on) {
        // Celular: horizontal, para que el video 16:9 llene la pantalla (Android; en computador e iPad falla en silencio)
        try { screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* sin API de orientación */ }
        // Si se entró con doble clic (o en Safari, que no enfoca botones al hacer clic), el foco pasa a los botones
        if (!wrap.contains(document.activeElement)) fsBtn.focus({ preventScroll: true });
      } else {
        try { screen.orientation.unlock(); } catch (e) { /* sin API de orientación */ }
      }
      wake();
      update();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    // En pantalla completa no se ve nada de la página: Tab y Mayús+Tab van de un botón al otro
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || fsElement() !== wrap) return;
      e.preventDefault();
      (document.activeElement === btn ? fsBtn : btn).focus();
    });
    // iPhone: al cerrar el reproductor nativo, iOS puede dejar el video en pausa. Si debía seguir corriendo, vuelve
    // a play() (si el navegador no lo deja, play() pasa el botón a "Reproducir video"); se revisa otra vez al rato
    // por si la pausa llega justo después del aviso
    video.addEventListener('webkitendfullscreen', () => { update(); setTimeout(update, 300); });
    // Botones ocultos (.is-idle): reaparecen al mover el mouse, tocar, usar el teclado o recibir el foco con Tab
    ['pointermove', 'pointerdown', 'keydown', 'focusin'].forEach((type) => wrap.addEventListener(type, wake));
  }

  if (hasIO) {
    // Precarga cuando el video está a menos de media pantalla de distancia (en la primera visita, durante la intro),
    // pero recién después del evento load: los megas del video no compiten con lo que necesita la primera pintura
    const afterLoad = (fn) => (document.readyState === 'complete' ? fn() : window.addEventListener('load', fn, { once: true }));
    const near = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !wanted) return;
      near.disconnect();
      afterLoad(() => { video.preload = 'auto'; });
    }, { rootMargin: '50% 0px' });
    near.observe(wrap);
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      update();
    }).observe(wrap);
  }
  // La intro de obra quita .intro-on de <html> al terminar (o al saltarla)
  if (root.classList.contains('intro-on')) {
    const mo = new MutationObserver(() => {
      if (root.classList.contains('intro-on')) return;
      mo.disconnect();
      update();
    });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  update();
});

// ===== Intro de obra: ladrillos → vaciado de hormigón → logo → página =====
// Duraciones en milisegundos. Cambia estos valores para ajustar cada fase.
const INTRO = {
  bricks: 1800,   // levantar el muro, fila por fila de abajo hacia arriba
  brick: 320,     // lo que tarda un ladrillo en caer y asentarse
  gap: 150,       // pausa con el muro terminado
  pour: 1700,     // vaciado del hormigón de arriba hacia abajo
  dry: 700,       // el hormigón húmedo se aclara hasta el tono del fondo
  logoIn: 500,    // aparición del logo y el nombre
  logoHold: 700,  // logo visible
  logoOut: 400,   // desaparición del logo
};

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const intro = document.getElementById('intro');
  if (!intro || !root.classList.contains('intro-on')) return;

  const content = [...document.querySelectorAll('body > .skip, body > .nav, body > main, body > .footer')];
  content.forEach((el) => { el.inert = true; });

  const canvas = document.getElementById('introCanvas');
  const brand = document.getElementById('introBrand');
  const ctx = canvas.getContext('2d', { alpha: false });
  // En celulares 1,5× basta para que se vea nítido y dibuja muchos menos píxeles
  const dpr = Math.min(window.innerWidth < 600 ? 1.5 : 2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  brand.style.setProperty('--intro-logo-in', `${INTRO.logoIn}ms`);
  brand.style.setProperty('--intro-logo-out', `${INTRO.logoOut}ms`);

  // Azar con semilla: el muro sale igual en cada visita
  let seed = 20261002;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const hash = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const vnoise = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------- Muro: aparejo trabado ----------
  const rows = W < 600 ? 26 : 24;
  const ch = H / rows;               // alto de cada hilada
  const cw = ch * 2.75;              // largo del ladrillo con su junta
  const joint = Math.max(2, ch * .11);
  const bw = cw - joint, bh = ch - joint;
  const cols = Math.ceil(W / cw) + 2;

  // Ladrillos con textura: manchas de cocción, grano, pintas, aristas tostadas y bisel
  const PALETTE = [[169, 79, 45], [184, 94, 55], [147, 67, 42], [160, 74, 44], [176, 88, 52], [133, 60, 40], [190, 104, 64]];
  const makeBrick = (k) => {
    const w = Math.max(4, Math.round(bw * dpr)), h = Math.max(4, Math.round(bh * dpr));
    const c = makeCanvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h), p = img.data;
    const base = PALETTE[k % PALETTE.length].map((v) => v * (.94 + rand() * .12));
    const corner = [rand() * 3, rand() * 3, rand() * 3, rand() * 3].map((r) => r * dpr);
    for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
      const i = (y * w + xx) * 4;
      const blot = .86 + vnoise(xx / (w * .2), y / (h * .45), k + 1) * .26;
      const fine = (vnoise(xx / (2.4 * dpr), y / (2.4 * dpr), k + 9) - .5) * .14;
      const grain = (rand() - .5) * .12;
      const r = rand(); const speck = r < .009 ? .62 : r < .015 ? 1.28 : 1;
      const d = Math.min(xx, w - 1 - xx, y, h - 1 - y) / dpr;
      // Aristas tostadas de ancho irregular y un bisel suave (cara superior algo más clara)
      const edge = 2.2 + vnoise(xx / (5 * dpr), y / (5 * dpr), k + 21) * 2.6;
      const burn = d < edge ? 1 - (edge - d) / edge * .22 : 1;
      const bevel = y < 1.2 * dpr ? 1.06 : y > h - 1.8 * dpr ? .88 : 1;
      const f = blot * (1 + fine + grain) * burn * bevel * speck;
      p[i] = base[0] * f; p[i + 1] = base[1] * f; p[i + 2] = base[2] * f; p[i + 3] = 255;
      // Aristas desportilladas en las esquinas
      const cx = xx < w / 2 ? xx : w - 1 - xx, cy = y < h / 2 ? y : h - 1 - y, rr = corner[(xx < w / 2 ? 0 : 1) + (y < h / 2 ? 0 : 2)];
      if (cx < rr && cy < rr && Math.hypot(rr - cx, rr - cy) > rr) p[i + 3] = 0;
    }
    x.putImageData(img, 0, 0);
    return c;
  };
  const SPRITES = Array.from({ length: 10 }, (_, k) => makeBrick(k));

  // Mortero: textura propia, gris arena con grano
  const mortarTile = (() => {
    const s = Math.round(64 * dpr), c = makeCanvas(s, s), x = c.getContext('2d'), img = x.createImageData(s, s);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (rand() - .5) * 26, px = (i / 4) % s, py = Math.floor(i / 4 / s);
      const n = (vnoise(px / (6 * dpr), py / (6 * dpr), 77) - .5) * 18;
      img.data[i] = 189 + v + n; img.data[i + 1] = 180 + v + n; img.data[i + 2] = 166 + v + n; img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const pat = ctx.createPattern(c, 'repeat'); pat.setTransform(new DOMMatrix().scale(1 / dpr));
    return pat;
  })();

  // Lienzo fijo donde se "hornean" los ladrillos ya asentados; la pantalla solo copia de él las zonas que cambian
  const stat = makeCanvas(canvas.width, canvas.height), sctx = stat.getContext('2d');
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.fillStyle = '#241E1A'; sctx.fillRect(0, 0, W, H);
  ctx.drawImage(stat, 0, 0, W, H);
  // La luz de obra y el fraguado son capas CSS: las anima el compositor, sin redibujar el canvas
  const lightEl = document.getElementById('introLight');
  const wetEl = document.getElementById('introWet');
  wetEl.style.setProperty('--intro-dry', `${INTRO.dry}ms`);
  const blit = (x, y, w, h) => {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.ceil(x + w)), y1 = Math.min(H, Math.ceil(y + h));
    if (x1 > x0 && y1 > y0) ctx.drawImage(stat, x0 * dpr, y0 * dpr, (x1 - x0) * dpr, (y1 - y0) * dpr, x0, y0, x1 - x0, y1 - y0);
  };

  const rowSpread = 260;
  const rowDelay = (INTRO.bricks - INTRO.brick - rowSpread) / (rows - 1);
  const bricks = [];
  for (let r = 0; r < rows; r++) {
    const y = H - (r + 1) * ch, x0 = r % 2 ? -cw / 2 : 0;
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * cw;
      if (x > W || x + cw < 0) continue;
      // Leve desalineado de muro hecho a mano
      bricks.push({ cx: x, cy: y, x: x + joint / 2 + (rand() - .5) * 1.2, y: y + joint / 2 + (rand() - .5) * 1, t: r * rowDelay + (c / cols) * rowSpread * .65 + rand() * rowSpread * .35, s: SPRITES[Math.floor(rand() * SPRITES.length)], mortar: false });
    }
  }
  bricks.sort((a, b) => a.t - b.t);
  const drop = ch * .42;
  const easeOutBack = (p) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

  // ---------- Hormigón ----------
  // Lado de la baldosa de hormigón armado, leído de --concreto-size (styles.css): 720 px, 480 px en celulares
  const concreteSize = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--concreto-size')) || 720;
  const concrete = new Image();
  let concretePat = null, wetPat = null, size = concreteSize();
  concrete.onload = () => {
    // Mismo hormigón, mismo tamaño (--concreto-size) y mismo origen (esquina superior izquierda de la ventana)
    // que body::before: el paso final no tiene corte. El patrón se dibuja en píxeles CSS (ctx ya está escalado por dpr)
    size = concreteSize();
    const m = new DOMMatrix().scale(size / concrete.naturalWidth);
    concretePat = ctx.createPattern(concrete, 'repeat'); concretePat.setTransform(m);
    // Hormigón húmedo: la misma textura oscurecida una sola vez
    const wc = makeCanvas(concrete.naturalWidth, concrete.naturalHeight), wx = wc.getContext('2d');
    wx.drawImage(concrete, 0, 0); wx.fillStyle = 'rgba(48,45,41,.38)'; wx.fillRect(0, 0, wc.width, wc.height);
    wetPat = ctx.createPattern(wc, 'repeat'); wetPat.setTransform(m);
  };
  concrete.src = 'textures/hormigon-armado.jpg';
  // Lenguas de hormigón que se adelantan en el borde
  const lobes = Array.from({ length: Math.max(4, Math.round(W / 220)) }, () => ({ x: rand() * W, w: 50 + rand() * 110, a: 18 + rand() * 42, ph: rand() * 6.28 }));
  const easeInOut = (p) => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
  const edgeY = (x, tp, p) => {
    const base = -H * .14 + H * 1.42 * easeInOut(p);
    const calm = p > .82 ? Math.max(0, 1 - (p - .82) / .18) : 1;
    let y = base + calm * (Math.sin(x * .011 + tp * .0016) * 13 + Math.sin(x * .029 - tp * .0024 + 1.7) * 6);
    for (const l of lobes) { const d = (x - l.x) / l.w; y += calm * l.a * (.65 + .35 * Math.sin(tp * .0021 + l.ph)) * Math.exp(-d * d); }
    return y;
  };
  const edgePath = (tp, p, dy) => {
    const step = Math.max(6, W / 160);
    const path = new Path2D();
    path.moveTo(0, -10); path.lineTo(W, -10);
    for (let x = W; x >= -step; x -= step) path.lineTo(Math.max(0, x), edgeY(x, tp, p) + dy);
    path.closePath();
    return path;
  };
  const edgeLine = (tp, p, dy) => {
    const step = Math.max(6, W / 160), path = new Path2D();
    for (let x = -step; x <= W + step; x += step) { const y = edgeY(x, tp, p) + dy; x === -step ? path.moveTo(x, y) : path.lineTo(x, y); }
    return path;
  };

  // ---------- Reloj ----------
  const T_BRICKS = INTRO.bricks;
  const T_POUR = T_BRICKS + INTRO.gap;
  const T_DRY = T_POUR + INTRO.pour;
  const T_LOGO = T_DRY + 120;
  const T_LOGO_OUT = T_LOGO + INTRO.logoIn + INTRO.logoHold;
  const T_END = T_LOGO_OUT + INTRO.logoOut;
  let t0 = 0, raf = 0, ended = false, pourT0 = null, dryT0 = null, logoShown = false, logoHidden = false;
  let nextBrick = 0, prevMin = 0, prevMax = 0;
  const active = [];
  const edgeRange = (tp, p) => {
    let lo = Infinity, hi = -Infinity;
    for (let x = 0; x <= W; x += Math.max(6, W / 160)) { const y = edgeY(x, tp, p); if (y < lo) lo = y; if (y > hi) hi = y; }
    return [lo, hi];
  };

  const frame = (now) => {
    if (ended) return;
    if (!t0) t0 = now;
    const t = now - t0;

    if (t < T_POUR || !wetPat) {
      // Ladrillos: hiladas de abajo hacia arriba; cada ladrillo cae y se asienta.
      // Primero se extiende la cama de mortero (junta inferior y lateral), el ladrillo cae sobre ella
      // y al asentarse se completa el resto de la junta.
      while (nextBrick < bricks.length && bricks[nextBrick].t <= t) {
        const b = bricks[nextBrick++];
        sctx.fillStyle = mortarTile;
        sctx.fillRect(b.cx, b.cy + ch - joint, cw, joint);
        sctx.fillRect(b.cx, b.cy, joint * .6, ch);
        active.push(b);
      }
      const settled = [];
      for (let i = active.length - 1; i >= 0; i--) {
        const b = active[i];
        if (t - b.t >= INTRO.brick) {
          sctx.fillStyle = mortarTile; sctx.fillRect(b.cx, b.cy, cw, ch);
          sctx.drawImage(b.s, b.x, b.y, bw, bh);
          settled.push(b); active.splice(i, 1);
        }
      }
      // Solo se redibuja la zona de cada ladrillo en movimiento: primero se restauran todas, luego se pintan
      for (const b of active) blit(b.cx - 2, b.cy - drop - 4, cw + 4, ch + drop + 10);
      for (const b of settled) blit(b.cx - 2, b.cy - drop - 4, cw + 4, ch + drop + 10);
      for (const b of active) {
        const p = Math.min(1, (t - b.t) / INTRO.brick);
        const dy = -drop * (1 - easeOutBack(p));
        if (p > .45) { ctx.fillStyle = `rgba(15,10,8,${.32 * (p - .45) / .55})`; ctx.fillRect(b.x + 1, b.y + bh - 1, bw - 2, 2); }   // sombra de contacto al asentarse
        ctx.globalAlpha = Math.min(1, p / .12);
        ctx.drawImage(b.s, b.x, b.y + dy, bw, bh);
        ctx.globalAlpha = 1;
      }
    } else if (dryT0 === null && (pourT0 === null || now - pourT0 < INTRO.pour)) {
      // Vaciado: masa gris viscosa con borde líquido irregular que cubre el muro
      if (pourT0 === null) {
        while (nextBrick < bricks.length) active.push(bricks[nextBrick++]);
        active.forEach((b) => { sctx.fillStyle = mortarTile; sctx.fillRect(b.cx, b.cy, cw, ch); sctx.drawImage(b.s, b.x, b.y, bw, bh); }); active.length = 0;
        ctx.drawImage(stat, 0, 0, W, H);
        lightEl.classList.add('is-off');
        pourT0 = now;
        [prevMin, prevMax] = edgeRange(0, 0);
      }
      const tp = now - pourT0, p = Math.min(1, tp / INTRO.pour);
      const [lo, hi] = edgeRange(tp, p);
      // Solo se redibuja la franja del frente: arriba ya es hormigón y abajo siguen los ladrillos
      // Bordes enteros: un recorte en coordenadas fraccionarias deja líneas finas sobre el hormigón
      const top = Math.floor(Math.min(lo, prevMin) - 190), bottom = Math.ceil(Math.max(hi, prevMax) + 30);
      prevMin = lo; prevMax = hi;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, top, W, bottom - top); ctx.clip();
      blit(0, top, W, bottom - top);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(12,9,7,.2)'; ctx.lineWidth = 16; ctx.stroke(edgeLine(tp, p, 7));   // sombra del borde sobre los ladrillos
      const body = edgePath(tp, p, 0);
      ctx.fillStyle = wetPat; ctx.fill(body);
      const base = -H * .14 + H * 1.42 * easeInOut(p);
      const sheen = ctx.createLinearGradient(0, base - 160, 0, base + 30);
      sheen.addColorStop(0, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(255,255,255,.09)');
      ctx.fillStyle = sheen; ctx.fill(body);                                          // brillo de masa fresca cerca del frente
      ctx.strokeStyle = 'rgba(30,27,24,.38)'; ctx.lineWidth = 6; ctx.stroke(edgeLine(tp, p, -1));   // menisco del borde
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.stroke(edgeLine(tp, p, -5));
      ctx.restore();
    } else {
      // Fraguado: el canvas queda en hormigón seco y la capa húmeda (CSS) se desvanece sobre él
      if (dryT0 === null) {
        dryT0 = now;
        ctx.fillStyle = concretePat; ctx.fillRect(0, 0, W, H);
        wetEl.classList.add('is-on');
        void wetEl.offsetWidth;
        wetEl.classList.add('is-drying');
      }
      if (!logoShown && t >= T_LOGO) { brand.classList.add('is-in'); logoShown = true; }
      if (!logoHidden && t >= T_LOGO_OUT) { brand.classList.replace('is-in', 'is-out'); logoHidden = true; }
      if (t >= T_END && now - dryT0 >= INTRO.dry) { finish(); return; }
    }
    raf = requestAnimationFrame(frame);
  };

  function finish() {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(raf);
    try { sessionStorage.setItem('propzen-intro', '1'); } catch (e) { /* sin almacenamiento: se verá otra vez */ }
    intro.classList.add('is-leaving');
    root.classList.remove('intro-on');
    content.forEach((el) => { el.inert = false; });
    root.classList.add('intro-cascade');
    window.removeEventListener('resize', onResize);
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { intro.classList.remove('is-leaving'); intro.hidden = true; }, 350);
    setTimeout(() => root.classList.remove('intro-cascade'), 1800);
  }
  const onKey = (e) => { if (e.key === 'Escape') finish(); };
  // Solo un cambio real de tamaño (girar el teléfono) interrumpe la intro; la barra del navegador no
  // Si la ventana cambia mucho, o cruza el corte de 767 px y cambia --concreto-size, la intro termina: el canvas no se
  // vuelve a dibujar y así el hormigón del fondo nunca queda a otro tamaño que el del vaciado
  const onResize = () => { if (Math.abs(window.innerWidth - W) > 40 || Math.abs(window.innerHeight - H) > 160 || concreteSize() !== size) finish(); };
  document.getElementById('introSkip').addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  raf = requestAnimationFrame(frame);
});

// Funciones: carrusel de cuatro tarjetas con materiales.
// Escenario 3D, arrastre con inercia, avance automático de 5 s y tarjetas que se abren para investigar.
document.addEventListener('DOMContentLoaded', () => {
  const car = document.getElementById('funciones');
  if (!car || !car.classList.contains('car')) return;
  const viewport = car.querySelector('.car__viewport');
  const cards = [...car.querySelectorAll('.card')];
  const pills = [...car.querySelectorAll('.car__pill')];
  const halos = [...car.querySelectorAll('.car__halo i')];
  const live = car.querySelector('#carLive');
  const pauseBtn = car.querySelector('#carPause');
  const n = cards.length;   // el avance automático dura 5 s: se ajusta en el CSS (animation car-fill)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const mqTablet = window.matchMedia('(max-width: 1199px)');
  const NAMES = cards.map((c) => c.querySelector('.card__verb').textContent);
  const WINS = cards.map((c) => c.querySelector('.card__win').textContent);
  let active = 0;
  let openIdx = -1;
  const pause = { user: false, hover: false, focus: false, touch: false, open: false, offscreen: true, hidden: document.hidden };
  car.classList.toggle('is-reduced', reduced);

  // Posición relativa de cada tarjeta respecto de la activa (0 centro, ±1 vecinas, ±2 ocultas)
  const relPos = (i) => { let d = (((i - active) % n) + n) % n; if (d > n / 2) d -= n; return d; };
  const pos = cards.map((_, i) => relPos(i));

  // Separación entre tarjetas: en escritorio las vecinas se asoman casi completas, en iPad un 30 %, en celular un borde
  const metrics = () => {
    const w = cards[0].offsetWidth;
    return { gap: w * (mqMobile.matches ? .96 : mqTablet.matches ? .33 : .78), rot: !mqMobile.matches };
  };
  const place = (x, m) => {
    const ax = Math.abs(x);
    if (reduced) return { t: 'none', o: ax < .5 ? 1 : 0, z: ax < .5 ? 10 : 1 };
    const s = ax <= 1 ? 1 - .12 * ax : Math.max(.7, .88 - .12 * (ax - 1));
    const o = ax <= 1 ? 1 - .4 * ax : Math.max(0, .6 - .6 * (ax - 1));
    const r = m.rot ? -8 * Math.max(-1, Math.min(1, x)) : 0;
    return { t: `perspective(1400px) translateX(${(x * m.gap).toFixed(1)}px) scale(${s.toFixed(3)}) rotateY(${r.toFixed(2)}deg)`, o, z: 10 - Math.round(ax * 3) };
  };
  const layout = (drag = 0) => {
    const m = metrics();
    cards.forEach((c, i) => {
      const { t, o, z } = place(pos[i] - drag / m.gap, m);
      c.style.transform = t; c.style.opacity = o; c.style.zIndex = z;
      c.style.pointerEvents = o < .05 ? 'none' : '';   // las ocultas no reciben clics
    });
  };

  // Accesibilidad y controles: solo la tarjeta activa se enfoca; el resto queda oculto a lectores de pantalla
  const syncCards = () => {
    cards.forEach((c, i) => {
      const on = i === active;
      c.setAttribute('aria-hidden', String(!on));
      c.querySelector('.card__more').tabIndex = on && openIdx === -1 ? 0 : -1;
      c.querySelector('.card__close').tabIndex = on && openIdx === i ? 0 : -1;
    });
    pills.forEach((p, i) => { p.classList.remove('is-active'); if (i === active) p.setAttribute('aria-current', 'true'); else p.removeAttribute('aria-current'); });
    void pills[active].offsetWidth;          // reinicia la barra de tiempo de la pastilla
    pills[active].classList.add('is-active');
    halos.forEach((h, i) => h.classList.toggle('is-on', i === active));
  };

  const running = () => !reduced && !pause.user && !pause.hover && !pause.focus && !pause.touch && !pause.open && !pause.offscreen && !pause.hidden;
  const syncPause = () => {
    car.classList.toggle('is-auto', !reduced && !pause.user);
    car.classList.toggle('is-paused', !running());
    car.classList.toggle('is-user-paused', pause.user);
    const label = pause.user ? 'Reanudar' : 'Pausar';
    pauseBtn.querySelector('span').textContent = label;
    pauseBtn.setAttribute('aria-label', `${label} el avance automático`);
  };

  function go(target, user = false) {
    if (openIdx !== -1) closeCard(false);
    active = (((target % n) + n) % n);
    cards.forEach((c, i) => {
      // Se elige la posición equivalente más cercana a la anterior para que ninguna tarjeta cruce el escenario
      const base = relPos(i);
      const next = [base, base - n, base + n].filter((v) => Math.abs(v) <= 2)
        .reduce((a, b) => (Math.abs(b - pos[i]) < Math.abs(a - pos[i]) ? b : a));
      if (Math.abs(next - pos[i]) > 2) {   // estaba oculta en un extremo: aparece en su lugar con fundido
        c.classList.add('is-snap');
        setTimeout(() => c.classList.remove('is-snap'), 650);
      }
      pos[i] = next;
    });
    layout();
    syncCards();
    if (user) live.textContent = `${active + 1} de ${n}: ${NAMES[active]}. ${WINS[active]}`;
  }

  function openCard() {
    if (openIdx !== -1) return;
    openIdx = active;
    const c = cards[active];
    c.classList.add('is-open');
    c.querySelector('.card__more').setAttribute('aria-expanded', 'true');
    c.querySelector('.card__detail').setAttribute('aria-hidden', 'false');
    syncCards();
    pause.open = true; syncPause();
    setTimeout(() => c.querySelector('.card__close').focus({ preventScroll: true }), reduced ? 0 : 260);
  }
  function closeCard(returnFocus = true) {
    if (openIdx === -1) return;
    const c = cards[openIdx];
    openIdx = -1;
    c.classList.remove('is-open');
    c.querySelector('.card__more').setAttribute('aria-expanded', 'false');
    c.querySelector('.card__detail').setAttribute('aria-hidden', 'true');
    syncCards();
    pause.open = false; syncPause();
    if (returnFocus) c.querySelector('.card__more').focus({ preventScroll: true });
  }

  // Navegación: flechas, pastillas, clic en tarjeta lateral, teclado
  car.querySelector('.car__arrow--prev').addEventListener('click', () => go(active - 1, true));
  car.querySelector('.car__arrow--next').addEventListener('click', () => go(active + 1, true));
  pills.forEach((p, i) => p.addEventListener('click', () => go(i, true)));
  let dragged = false;
  cards.forEach((c, i) => c.addEventListener('click', (e) => {
    if (dragged) { dragged = false; return; }
    if (i !== active) { e.preventDefault(); go(active + pos[i], true); return; }
    if (e.target.closest('.card__more')) openCard();
    else if (e.target.closest('.card__close')) closeCard();
  }));
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1, true); }
    else if (e.key === 'Enter' && e.target === viewport) { e.preventDefault(); openCard(); }
  });
  car.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openIdx !== -1) { e.preventDefault(); closeCard(); } });

  // Arrastre con mouse y swipe con el dedo, con inercia y ajuste a la tarjeta más cercana
  let drag = null;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('.card__detail')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dir: null, hist: [[e.timeStamp, e.clientX]] };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.dir === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      drag.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.dir === 'x') { viewport.setPointerCapture(e.pointerId); viewport.classList.add('is-dragging'); if (openIdx !== -1) closeCard(false); }
    }
    if (drag.dir !== 'x') return;
    dragged = true;
    drag.dx = dx;
    drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    if (!reduced) layout(dx);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    viewport.classList.remove('is-dragging');
    if (d.dir !== 'x') return;
    const [t0, x0] = d.hist[0], [t1, x1] = d.hist[d.hist.length - 1];
    const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;        // px por ms
    const projected = d.dx + v * 220;                      // inercia
    const gap = metrics().gap;
    let steps = Math.max(-2, Math.min(2, Math.round(-projected / gap)));
    if (steps === 0 && Math.abs(projected) > gap * .22) steps = projected < 0 ? 1 : -1;
    if (steps) go(active + steps, true); else layout();
    setTimeout(() => { dragged = false; }, 0);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  // Paralaje y brillo sobre la superficie del material de la tarjeta activa (máximo 8 px)
  cards.forEach((c, i) => {
    const mat = c.querySelector('.card__mat'), tex = c.querySelector('.card__tex'), shine = c.querySelector('.card__shine');
    let raf = 0;
    const leave = () => { cancelAnimationFrame(raf); tex.style.transform = ''; mat.classList.remove('is-look'); };
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || i !== active || openIdx !== -1 || reduced || drag) return;
      const r = mat.getBoundingClientRect();
      if (e.clientY > r.bottom) { leave(); return; }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        tex.style.transform = `translate(${(-px * 16).toFixed(1)}px, ${(-py * 16).toFixed(1)}px)`;
        shine.style.transform = `translate(${(e.clientX - r.left).toFixed(0)}px, ${(e.clientY - r.top).toFixed(0)}px)`;
        mat.classList.add('is-look');
      });
    });
    c.addEventListener('pointerleave', leave);
  });

  // Avance automático: la pastilla activa se llena en 5 s (animación CSS) y al terminar pasa a la siguiente
  car.querySelector('.car__pills').addEventListener('animationend', (e) => {
    if (e.animationName === 'car-fill' && e.target.closest('.car__pill.is-active') && running()) go(active + 1);
  });
  pauseBtn.addEventListener('click', () => { pause.user = !pause.user; syncPause(); });
  const stageWrap = car.querySelector('.car__stage-wrap');
  stageWrap.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { pause.hover = true; syncPause(); } });
  stageWrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { pause.hover = false; syncPause(); } });
  car.addEventListener('focusin', (e) => { pause.focus = e.target.matches(':focus-visible'); syncPause(); });
  car.addEventListener('focusout', (e) => { if (!car.contains(e.relatedTarget)) { pause.focus = false; syncPause(); } });
  let touchTimer = 0;
  viewport.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { clearTimeout(touchTimer); pause.touch = true; syncPause(); } });
  const releaseTouch = (e) => { if (e.pointerType === 'touch') { clearTimeout(touchTimer); touchTimer = setTimeout(() => { pause.touch = false; syncPause(); }, 3000); } };
  viewport.addEventListener('pointerup', releaseTouch);
  viewport.addEventListener('pointercancel', releaseTouch);
  document.addEventListener('visibilitychange', () => { pause.hidden = document.hidden; syncPause(); });

  // Entrada al aparecer en pantalla: suben escalonadas (120 ms) y la central respira 1 → 1,03 → 1
  let entered = false;
  const enter = () => {
    entered = true;
    cards.forEach((c, i) => { c.querySelector('.card__body').style.transitionDelay = `${(pos[i] + 1) * 120}ms`; });
    car.classList.add('is-in');
    setTimeout(() => cards.forEach((c) => { c.querySelector('.card__body').style.transitionDelay = ''; }), 1100);
    if (!reduced) setTimeout(() => { const c = cards[active]; c.classList.add('is-breath'); setTimeout(() => c.classList.remove('is-breath'), 750); }, 800);
  };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      pause.offscreen = !entry.isIntersecting;
      if (entry.isIntersecting && !entered) enter();
      syncPause();
    }, { threshold: .35 }).observe(viewport);
  } else { pause.offscreen = false; enter(); }

  window.addEventListener('resize', () => layout());
  layout();
  syncCards();
  syncPause();
});

// Cómo funciona: carrusel de cinco pasos con iluminación, sin avance automático.
// Cada paso reproduce su mini escena al llegar. Las escenas son animaciones WAAPI con relleno "backwards":
// el estado final es el del CSS, así que cancelar una escena la deja completa y repetirla parte de cero.
document.addEventListener('DOMContentLoaded', () => {
  const sec = document.getElementById('como-funciona');
  if (!sec || !sec.classList.contains('imp')) return;
  const $ = (s, el = sec) => el.querySelector(s);
  const $$ = (s, el = sec) => [...el.querySelectorAll(s)];
  const stage = $('.imp__stage');
  const viewport = $('.imp__viewport');
  const slides = $$('.imp-slide');
  const dots = $$('.imp__dot');
  const segs = $$('.imp__seg');
  const halos = $$('.imp__halo');
  const spot = $('.imp__spot');
  const flash = $('.imp__flash');
  const live = $('#impLive');
  const today = $('.imp__today');
  const prevBtn = $('.imp__arrow--prev');
  const nextBtn = $('.imp__arrow--next');
  const countEl = $('#onCount');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const mqHover = window.matchMedia('(hover: hover) and (pointer: fine)');
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const BACK = 'cubic-bezier(.34, 1.56, .64, 1)';
  const n = slides.length;
  const TITLES = slides.map((s) => s.querySelector('.imp-slide__title').textContent);
  const DAYS = slides.map((s) => s.dataset.day);
  let active = 0;
  let entered = false;
  $$('[data-v]').forEach((el) => el.style.setProperty('--v', el.dataset.v));

  // Posición de cada diapositiva: la activa al centro y las vecinas en penumbra (opacidad .45, escala .9)
  const gapOf = () => slides[0].offsetWidth * .95 + (mqMobile.matches ? 10 : 28);
  const layout = (dx = 0) => {
    const gap = gapOf();
    slides.forEach((s, i) => {
      if (reduced) { s.style.opacity = i === active ? '1' : '0'; s.style.zIndex = i === active ? '2' : '1'; return; }
      const p = i - active + dx / gap;
      const a = Math.abs(p);
      s.style.transform = `translateX(${(p * gap).toFixed(1)}px) scale(${(1 - .1 * Math.min(a, 1)).toFixed(3)})`;
      s.style.opacity = String(a <= 1 ? 1 - .55 * a : Math.max(0, .45 - .45 * (a - 1)));
      s.style.zIndex = String(10 - Math.round(a * 3));
    });
  };

  // Estado visible: diapositiva activa, puntos encendidos, tramos cargados y halo del color del paso
  const sync = () => {
    slides.forEach((s, i) => { const on = i === active; s.classList.toggle('is-active', on); s.inert = !on; });
    dots.forEach((d, i) => {
      d.classList.toggle('is-lit', entered && i <= active);
      if (i === active) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
    });
    segs.forEach((g, i) => g.classList.toggle('is-on', entered && i < active));
    halos.forEach((h, i) => h.classList.toggle('is-on', entered && i === active));
    prevBtn.setAttribute('aria-disabled', String(active === 0));
    nextBtn.setAttribute('aria-disabled', String(active === n - 1));
    today.textContent = `${DAYS[active]} · Paso ${active + 1} de ${n}`;
  };
  // Los tramos se cargan uno tras otro en el sentido del avance
  const chargeLine = (from, to) => segs.forEach((g, i) => {
    const k = to > from ? i - from : from - 1 - i;
    g.style.transitionDelay = reduced ? '0ms' : `${Math.max(0, k) * 160}ms`;
  });

  // Foco de luz: sigue al cursor en escritorio; en celular, con toque o movimiento reducido queda detrás de la activa
  const SPOT = 400;
  let spotRaf = 0;
  const moveSpot = (x, y) => { spot.style.transform = `translate(${Math.round(x - SPOT)}px, ${Math.round(y - SPOT)}px)`; };
  const centerSpot = () => moveSpot(stage.clientWidth / 2, viewport.offsetTop + viewport.offsetHeight / 2);
  const follows = () => !reduced && mqHover.matches && !mqMobile.matches;
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !follows()) return;
    cancelAnimationFrame(spotRaf);
    spotRaf = requestAnimationFrame(() => { const r = stage.getBoundingClientRect(); moveSpot(e.clientX - r.left, e.clientY - r.top); });
  });
  stage.addEventListener('pointerleave', () => { cancelAnimationFrame(spotRaf); centerSpot(); });

  // ---- Motor de escenas ----
  const own = (root) => root.getAnimations({ subtree: true }).filter((a) => !(a instanceof CSSTransition) && !(a instanceof CSSAnimation));
  // Con movimiento reducido se quitan transform y filter: quedan solo los fundidos
  const strip = (frames) => (reduced ? frames.map(({ transform, filter, ...f }) => f) : frames);
  const hasProps = (f) => Object.keys(f).some((k) => k !== 'offset' && k !== 'easing');
  const T = (el, frames, delay, duration, opts = {}) => {
    if (!el) return null;
    const kf = strip(frames);
    if (!kf.some(hasProps)) return null;
    return el.animate(kf, { delay, duration, easing: EASE, fill: 'backwards', ...opts });
  };
  const IN = [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }];
  const POP = [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'none' }];
  const FADE = [{ opacity: 0 }, { opacity: 1 }];
  const TYPING = [{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .85 }, { opacity: 0 }];
  const typing = (root, at, dur) => {
    const el = $('.wsp-typing', root);
    T(el, TYPING, at, dur, { fill: 'none' });
    $$('i', el).forEach((d, j) => T(d, [{ transform: 'translateY(0)' }, { transform: 'translateY(-3px)' }, { transform: 'translateY(0)' }], at + j * 120, 380, { iterations: 2, fill: 'none' }));
  };
  // Posición de un elemento dentro de la escena según el layout (no la afectan las transformaciones del carrusel)
  const rel = (el, root) => {
    let x = 0, y = 0;
    for (let e = el; e && e !== root; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  };

  // Paso 3: la respuesta depende de los interruptores y del tono
  const cfgRoot = slides[2];
  const isOn = (k) => $(`.cfg-sw[data-opt="${k}"]`, cfgRoot).getAttribute('aria-checked') === 'true';
  const reply = () => {
    const formal = $('.cfg-tone [aria-pressed="true"]', cfgRoot).dataset.tone === 'formal';
    if (!isOn('h24')) {
      return { a: formal ? 'Gracias por escribir. Le responderemos mañana a partir de las 09:00.' : '¡Gracias por escribir! Te respondo mañana desde las 09:00.', meta: 'Fuera de horario · 23:48', hot: false };
    }
    const hi = formal ? 'Buenas noches. Sí, el departamento sigue disponible.' : '¡Hola! Sí, el depa sigue disponible.';
    const ask = isOn('pie')
      ? (formal ? '¿Cuenta con pie o crédito hipotecario preaprobado?' : '¿Tienes pie o crédito preaprobado?')
      : (formal ? '¿Le acomoda agendar una visita esta semana?' : '¿Te tinca visitarlo esta semana?');
    return { a: `${hi} ${ask}`, meta: 'Respondido en 2 s · 23:48', hot: isOn('hot') };
  };

  let countRaf = 0;
  const SCENES = [
    // 1 · Fotos a la nube: las miniaturas aparecen, vuelan con estela turquesa y la ficha se completa
    (root) => {
      const sc = $('.scn', root);
      const cloud = $('.scn-cloud__icon', root);
      $$('.scn-thumb', root).forEach((th, i) => {
        T(th, POP, 150 + i * 280, 420, { easing: BACK });
        const t = 1500 + i * 380;
        T($('.scn-thumb__ok', th), POP, t + 520, 300, { easing: BACK });
        T(cloud, [{ transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: .4 }, { transform: 'scale(1)' }], t + 560, 380, { fill: 'none' });
        if (reduced) return;
        const a = rel(th, sc), b = rel(cloud, sc);
        const h = a.w * 44 / 64;
        const dx = b.x + b.w / 2 - (a.x + a.w / 2), dy = b.y + b.h / 2 - (a.y + h / 2);
        const rot = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
        const fly = th.cloneNode(true);
        fly.className = 'scn-fly'; fly.setAttribute('aria-hidden', 'true');
        fly.style.left = `${a.x}px`; fly.style.top = `${a.y}px`; fly.style.width = `${a.w}px`;
        const trail = document.createElement('i');
        trail.className = 'scn-trail';
        trail.style.left = `${a.x + a.w / 2}px`; trail.style.top = `${a.y + h / 2}px`; trail.style.width = `${Math.round(Math.hypot(dx, dy))}px`;
        sc.append(trail, fly);
        const drop = (el, anim) => anim && anim.finished.then(() => el.remove(), () => {});
        drop(trail, T(trail, [{ transform: `${rot} scaleX(0)`, opacity: 0 }, { transform: `${rot} scaleX(1)`, opacity: 1, offset: .55 }, { transform: `${rot} scaleX(1)`, opacity: 0 }], t, 780, { fill: 'both' }));
        drop(fly, T(fly, [{ transform: 'none', opacity: 0 }, { transform: 'none', opacity: 1, offset: .06 }, { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(.2)`, opacity: .25 }], t, 640, { easing: 'cubic-bezier(.55, 0, .35, 1)', fill: 'both' }));
      });
      T($('.scn-cloud__glow', root), FADE, 2100, 500);
      T($('.scn-status', root), IN, 3200, 360);
      T($('.fx', root), [{ opacity: 0, transform: 'translateY(-10px) scaleY(.7)' }, { opacity: 1, transform: 'none' }], 3300, 480);
      $$('.fx__list li', root).forEach((li, i) => T(li, [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], 3650 + i * 300, 340));
      T($('.fx__ok', root), POP, 4900, 400, { easing: BACK });
    },
    // 2 · Datos desde WhatsApp: audio con onda, texto, respuesta de la IA y la ficha cambia el precio
    (root) => {
      T($('.wsp-audio', root), IN, 250, 380);
      $$('.wsp-wave i', root).forEach((b, j) => T(b, [{ transform: 'scaleY(.3)' }, { transform: 'scaleY(1)' }, { transform: 'scaleY(.3)' }], 650 + j * 40, 480, { iterations: 3, fill: 'none', easing: 'ease-in-out' }));
      T($$('.wsp-b--out', root)[1], IN, 2350, 380);
      typing(root, 2900, 900);
      T($('.wsp-b--in', root), IN, 3800, 380);
      T($('.fx__strike', root), [{ opacity: 0, transform: 'scaleX(0)' }, { opacity: 1, transform: 'scaleX(1)' }], 4200, 420);
      T($('.fx__new', root), [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], 4500, 420);
      T($('.fx__glow', root), [{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: 0 }], 4500, 1300, { fill: 'none' });
      T($('.fx__tag', root), POP, 5000, 400, { easing: BACK });
    },
    // 3 · Respuestas automáticas: la vista previa responde según la configuración (quick: sin repetir la pregunta)
    (root, quick) => {
      const r = reply();
      const a = $('#cfgReply', root), meta = $('#cfgMeta', root), hot = $('#cfgHot', root);
      a.textContent = r.a; meta.textContent = r.meta; hot.hidden = !r.hot;
      const t0 = quick ? -450 : 0;
      if (!quick) T($('.cfg__q', root), IN, 150, 340);
      typing(root, t0 + 550, 850);
      T(a, IN, t0 + 1350, 400);
      T(meta, FADE, t0 + 1650, 300);
      if (r.hot) T(hot, POP, t0 + 1900, 360, { easing: BACK });
    },
    // 4 · Panel de corredores: filas, barras de comisión y gráfica de personas por propiedad
    (root) => {
      $$('.team__r', root).forEach((r, i) => T(r, [{ opacity: 0, transform: 'translateX(-12px)' }, { opacity: 1, transform: 'none' }], 150 + i * 160, 420));
      $$('.team__bar i', root).forEach((b, i) => T(b, [{ opacity: .4, transform: 'scaleX(0)' }, { opacity: 1, transform: `scaleX(${b.dataset.v})` }], 650 + i * 160, 1000));
      T($('.team__chart', root), FADE, 1200, 400);
      $$('.team__cbar', root).forEach((b, i) => T(b, [{ opacity: .4, transform: 'scaleY(0)' }, { opacity: 1, transform: `scaleY(${b.dataset.v})` }], 1400 + i * 130, 800));
    },
    // 5 · Encendido: el interruptor se enciende, el carrusel destella en amarillo y entran tres consultas
    (root) => {
      const knob = $('.imp-power__knob', root);
      const kx = $('.imp-power__track', root).clientWidth - knob.offsetWidth - 8;
      T(knob, [{ transform: `translateX(${-kx}px)` }, { transform: 'none' }], 250, 420);
      T($('.imp-power__on', root), FADE, 300, 380);
      T($('.imp-power__glow', root), FADE, 400, 500);
      T(flash, [{ opacity: 0 }, { opacity: 1, offset: .25 }, { opacity: 0 }], 450, 1000, { fill: 'none' });
      T($('.on-panel__status', root), FADE, 800, 300);
      const as = $$('.on-a', root);
      $$('.on-q', root).forEach((q, i) => { T(q, IN, 1200 + i * 1050, 340); T(as[i], IN, 1700 + i * 1050, 340); });
      // El contador sigue el reloj de una animación: se pausa con ella y vuelve a 12 si se cancela
      const clock = countEl.animate([{ opacity: 1 }, { opacity: 1 }], { delay: 1200, duration: 3300 });
      countEl.textContent = '0';
      const tick = () => {
        if (clock.playState === 'idle' || clock.playState === 'finished') { countEl.textContent = '12'; return; }
        const p = Math.min(1, Math.max(0, ((clock.currentTime || 0) - 1200) / 3300));
        countEl.textContent = String(Math.round(p * 12));
        countRaf = requestAnimationFrame(tick);
      };
      countRaf = requestAnimationFrame(tick);
      T($('.imp-demo', root), [{ opacity: 0, visibility: 'hidden', transform: 'translateY(8px)' }, { opacity: 1, visibility: 'visible', transform: 'none' }], 4700, 450);
    },
  ];

  const stopScene = (i) => {
    const root = slides[i];
    own(root).forEach((a) => a.cancel());
    $$('.scn-fly, .scn-trail', root).forEach((el) => el.remove());
    if (i === 4) { cancelAnimationFrame(countRaf); countEl.textContent = '12'; flash.getAnimations().forEach((a) => a.cancel()); }
  };
  const held = new Set();
  const pauseAll = () => own(sec).forEach((a) => { if (a.playState === 'running') { a.pause(); held.add(a); } });
  const playScene = (i, opt) => { stopScene(i); SCENES[i](slides[i], opt); if (document.hidden) pauseAll(); };
  // Pestaña oculta: todo se detiene y sigue donde quedó al volver
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseAll();
    else { held.forEach((a) => { if (a.playState === 'paused') a.play(); }); held.clear(); }
  });

  function go(target) {
    const i = Math.max(0, Math.min(n - 1, target));
    if (i === active) { layout(); return; }
    if (!entered) enter();
    const prev = active;
    const hadFocus = slides[prev].contains(document.activeElement);
    stopScene(prev);
    chargeLine(prev, i);
    active = i;
    layout();
    sync();
    if (hadFocus) viewport.focus({ preventScroll: true });   // la diapositiva anterior queda inerte
    live.textContent = `Paso ${i + 1} de ${n}: ${TITLES[i]}. ${DAYS[i]}.`;
    playScene(i);
  }

  // Entrada: la escena 1 y el dibujo de la línea se preparan en pausa apenas asoma la sección,
  // y arrancan cuando el escenario está a la vista: la línea se dibuja y el paso 1 se enciende
  let primed = [];
  let litTimer = 0;
  const prime = () => {
    if (primed.length || entered) return;
    T($('.imp__rail'), [{ transform: 'scaleX(0)', opacity: .3 }, { transform: 'scaleX(1)', opacity: 1 }], 0, 900);
    dots.forEach((d, i) => T(d, POP, 120 + i * 150, 420, { easing: BACK }));
    $$('.imp__day').forEach((d, i) => T(d, FADE, 200 + i * 250, 450));
    playScene(0);
    primed = own(sec);
    primed.forEach((a) => a.pause());
  };
  function enter() {
    if (entered) return;
    prime();
    entered = true;
    primed.forEach((a) => { if (a.playState === 'paused') a.play(); });
    primed = [];
    litTimer = setTimeout(sync, reduced ? 0 : 750);
  }
  if ('IntersectionObserver' in window) {
    const lineIO = new IntersectionObserver(([e]) => { if (e.isIntersecting) { prime(); lineIO.disconnect(); } });
    lineIO.observe($('.imp__line'));
    const stageIO = new IntersectionObserver(([e]) => { if (e.isIntersecting) { enter(); stageIO.disconnect(); } }, { threshold: .3 });
    stageIO.observe(stage);
  } else { enter(); }

  // Navegación: flechas, puntos, clic en una vecina, teclado
  prevBtn.addEventListener('click', () => go(active - 1));
  nextBtn.addEventListener('click', () => go(active + 1));
  dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
  });
  $$('.imp-act').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset.scene); if (i === active) playScene(i); }));
  $$('.cfg-sw', cfgRoot).forEach((b) => b.addEventListener('click', () => {
    b.setAttribute('aria-checked', String(b.getAttribute('aria-checked') !== 'true'));
    playScene(2, true);
  }));
  const tones = $$('.cfg-tone button', cfgRoot);
  tones.forEach((b) => b.addEventListener('click', () => { tones.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); playScene(2, true); }));

  // Arrastre con mouse y swipe con el dedo, con ajuste a la diapositiva más cercana
  let drag = null;
  let dragged = false;
  viewport.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }, true);
  viewport.addEventListener('click', (e) => {
    if (e.target.closest('.imp-slide.is-active')) return;
    const r = slides[active].getBoundingClientRect();
    if (e.clientX < r.left) go(active - 1); else if (e.clientX > r.right) go(active + 1);
  });
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse' && e.target.closest('button, a, table')) return;   // con mouse, los controles se pulsan
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dir: null, hist: [[e.timeStamp, e.clientX]] };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.dir === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.dir === 'x') { viewport.setPointerCapture(e.pointerId); viewport.classList.add('is-dragging'); }
    }
    if (drag.dir !== 'x') return;
    dragged = true;
    const edge = (active === 0 && dx > 0) || (active === n - 1 && dx < 0);   // resistencia en los extremos
    drag.dx = edge ? dx * .35 : dx;
    drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    if (!reduced) layout(drag.dx);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    viewport.classList.remove('is-dragging');
    if (d.dir !== 'x') return;
    const [t0, x0] = d.hist[0], [t1, x1] = d.hist[d.hist.length - 1];
    const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
    const projected = d.dx + v * 200;
    const gap = gapOf();
    let step = Math.max(-2, Math.min(2, Math.round(-projected / gap)));
    if (step === 0 && Math.abs(projected) > gap * .18) step = projected < 0 ? 1 : -1;
    if (step) go(active + step); else layout();
    setTimeout(() => { dragged = false; }, 0);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  window.addEventListener('resize', () => { layout(); centerSpot(); });
  layout();
  sync();
  centerSpot();
});

// Precios: carrusel 3D circular de tres planes, con Dúplex (recomendado) al centro al cargar.
// Rota cada 6 s: la barra de progreso es la animación CSS pr-fill y al terminar pasa al plan siguiente.
// Se pausa con hover, foco de teclado, toque, fuera de pantalla, pestaña oculta, una tarjeta girada o el botón Pausar.
document.addEventListener('DOMContentLoaded', () => {
  const sec = document.getElementById('precios');
  if (!sec || !sec.classList.contains('pr')) return;
  const $ = (s, el = sec) => el.querySelector(s);
  const $$ = (s, el = sec) => [...el.querySelectorAll(s)];
  const stage = $('.pr__stage');
  const viewport = $('.pr__viewport');
  const cards = $$('.pr-card');
  const tabs = $$('.pr__tab');
  const bar = $('.pr__progress i');
  const pauseBtn = $('.pr__pause');
  const live = $('#prLive');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mqMobile = window.matchMedia('(max-width: 767px)');
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const n = cards.length;
  const NAMES = cards.map((c) => c.dataset.planName);
  const PRICES = cards.map((c) => c.dataset.price);
  const fmt = (v) => v.toFixed(2).replace('.', ',');   // formato chileno: 3,30
  let active = 1;   // Dúplex
  let pos = 1;      // posición continua del carrusel: el entero más cercano es la tarjeta al centro
  sec.classList.toggle('is-reduced', reduced);

  // La misma curva del CSS, para el giro que se dibuja cuadro a cuadro
  const bezier = (x1, y1, x2, y2) => {
    const f = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
    const d = (t, a, b) => 3 * (1 - t) * (1 - t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);
    return (x) => {
      let t = x;
      for (let k = 0; k < 8; k++) { const s = d(t, x1, x2); if (Math.abs(s) < 1e-6) break; t = Math.min(1, Math.max(0, t - (f(t, x1, x2) - x) / s)); }
      return f(t, y1, y2);
    };
  };
  const ease = bezier(.22, 1, .36, 1);

  // Posición relativa en el círculo, entre -1,5 y 1,5: 0 al centro, ±1 atrás a los lados.
  // Al pasar por ±1,5 la tarjeta es invisible y cambia de lado, como si girara por detrás.
  const wrap = (p) => ((((p + 1.5) % n) + n) % n) - 1.5;
  const gapOf = () => cards[0].offsetWidth * (mqMobile.matches ? .6 : .62);
  const layout = () => {
    const gap = gapOf();
    cards.forEach((c, i) => {
      if (reduced) { c.style.opacity = i === active ? '1' : '0'; c.style.zIndex = i === active ? '3' : '1'; return; }
      const p = wrap(i - pos), a = Math.abs(p);
      const s = a <= 1 ? 1 - .15 * a : .85 - .1 * (a - 1);
      const o = a <= 1 ? 1 - .5 * a : Math.max(0, .5 - (a - 1));
      const r = mqMobile.matches ? 0 : 20 * p;   // en celular, sin giro 3D
      c.style.transform = `perspective(1600px) translateX(${(p * gap).toFixed(1)}px) rotateY(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`;
      c.style.opacity = o.toFixed(3);
      c.style.zIndex = String(10 - Math.round(a * 4));
    });
  };
  const sync = () => {
    cards.forEach((c, i) => { const on = i === active; c.classList.toggle('is-active', on); c.inert = !on; });
    tabs.forEach((t, i) => { if (i === active) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current'); });
  };

  // Giro de 700 ms cuadro a cuadro (solo transform y opacidad)
  let raf = 0;
  const spin = (to, dur) => {
    cancelAnimationFrame(raf);
    if (reduced) {
      // Solo fundido. Va con WAAPI porque styles.css anula toda transición CSS con movimiento reducido.
      const before = cards.map((c) => c.style.opacity || '0');
      pos = ((to % n) + n) % n;
      layout();
      cards.forEach((c, i) => { if (before[i] !== c.style.opacity) c.animate([{ opacity: before[i] }, { opacity: c.style.opacity }], { duration: 450, easing: 'ease' }); });
      return;
    }
    const from = pos, t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      pos = from + (to - from) * ease(k);
      layout();
      if (k < 1) raf = requestAnimationFrame(step);
      else { pos = ((to % n) + n) % n; layout(); }
    };
    raf = requestAnimationFrame(step);
  };
  // El precio del plan que llega al centro entra con un fundido y un leve desplazamiento vertical
  const enterPrice = (i) => {
    const amt = $('.pr-card__amount', cards[i]);
    amt.getAnimations().forEach((a) => a.cancel());
    amt.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: reduced ? 0 : 220, easing: EASE, fill: 'backwards' });
  };
  // La mensualidad cuenta desde 0,00 hasta su valor en 600 ms
  const countUp = (i, delay) => {
    const el = $('.pr-card__num', cards[i]);
    const v = parseFloat(el.dataset.v);
    if (reduced) { el.textContent = fmt(v); return; }
    const t0 = performance.now() + delay;
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - t0) / 600));
      el.textContent = fmt(v * ease(k));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // ---- Rotación automática ----
  const pause = { user: false, hover: false, focus: false, touch: false, flip: false, offscreen: true, hidden: document.hidden };
  const running = () => !reduced && !Object.values(pause).some(Boolean);
  const syncPause = () => {
    sec.classList.toggle('is-paused', !running());
    sec.classList.toggle('is-user-paused', pause.user);
    const label = pause.user ? 'Reanudar' : 'Pausar';
    pauseBtn.querySelector('span').textContent = label;
    pauseBtn.setAttribute('aria-label', `${label} la rotación automática`);
    // Mientras rota sola no se anuncia cada cambio; detenida, sí
    live.setAttribute('aria-live', running() ? 'off' : 'polite');
  };
  const restartTimer = () => {
    if (reduced) return;
    bar.classList.remove('is-run');
    void bar.offsetWidth;   // reinicia la animación de la barra
    bar.classList.add('is-run');
  };
  bar.addEventListener('animationend', (e) => { if (e.animationName === 'pr-fill' && running()) go(active + 1); });

  // ---- Tarjetas de dos caras: el precio adelante y lo que incluye atrás ----
  // Solo una puede estar girada; mientras lo está, la rotación automática se detiene.
  const faceLive = $('#prFace');
  let flipped = -1;
  const setFace = (i, back, { focus = true, announce = true } = {}) => {
    const c = cards[i];
    if (c.classList.contains('is-flipped') === back) return;
    const front = $('.pr-card__front', c), rear = $('.pr-card__back', c);
    if (back) rear.scrollTop = 0;
    c.classList.toggle('is-flipped', back);
    front.inert = back; front.setAttribute('aria-hidden', String(back));
    rear.inert = !back; rear.setAttribute('aria-hidden', String(!back));
    $('.pr-card__turn', c).setAttribute('aria-expanded', String(back));
    if (reduced) {   // sin giro: fundido entre caras, con WAAPI (styles.css anula las transiciones con movimiento reducido)
      (back ? rear : front).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease' });
      (back ? front : rear).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, easing: 'ease' });
    }
    if (back) flipped = i; else if (flipped === i) flipped = -1;
    pause.flip = flipped !== -1;
    syncPause();
    if (announce) faceLive.textContent = back ? `Plan ${NAMES[i]}: lo que incluye.` : `Plan ${NAMES[i]}: precio.`;
    if (focus) $(back ? '.pr-back__title' : '.pr-card__name', c).focus({ preventScroll: true });   // primer elemento de la cara visible
  };
  $$('.pr-card__turn').forEach((b) => b.addEventListener('click', () => setFace(cards.indexOf(b.closest('.pr-card')), true)));
  $$('.pr-card__return').forEach((b) => b.addEventListener('click', () => setFace(cards.indexOf(b.closest('.pr-card')), false)));
  sec.addEventListener('keydown', (e) => { if (e.key === 'Escape' && flipped !== -1) { e.preventDefault(); setFace(flipped, false); } });
  // Penthouse: "Todo lo de Dúplex" se despliega al tocarlo
  $$('.pr-back__more').forEach((b) => b.addEventListener('click', () => {
    const list = document.getElementById(b.getAttribute('aria-controls'));
    const open = b.getAttribute('aria-expanded') !== 'true';
    b.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    if (open) list.animate(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE });
  }));

  function go(target, user = false) {
    const i = ((target % n) + n) % n;
    const delta = wrap(i - pos);   // el camino más corto alrededor del círculo
    const hadFocus = cards[active].contains(document.activeElement);
    const changed = i !== active;
    if (changed && flipped !== -1) setFace(flipped, false, { focus: false, announce: false });   // la girada vuelve sola al frente
    active = i;
    sync();
    if (hadFocus && changed) viewport.focus({ preventScroll: true });   // la tarjeta anterior queda inerte
    spin(pos + delta, 700 * Math.max(.45, Math.min(1, Math.abs(delta))));
    if (changed) enterPrice(i);
    if (user) live.textContent = `Plan ${NAMES[i]}: ${PRICES[i]} UF al mes más IVA. Implementación de 6,45 UF, pago único más IVA.`;
    restartTimer();
  }

  // Navegación: flechas, pestañas, teclado y clic en una tarjeta lateral
  $('.pr__arrow--prev').addEventListener('click', () => go(active - 1, true));
  $('.pr__arrow--next').addEventListener('click', () => go(active + 1, true));
  tabs.forEach((t, i) => t.addEventListener('click', () => go(i, true)));
  const arrowKey = (e) => (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
  $('.pr__tabs').addEventListener('keydown', (e) => {
    const k = arrowKey(e);
    if (!k) return;
    e.preventDefault(); go(active + k, true); tabs[active].focus();
  });
  stage.addEventListener('keydown', (e) => { const k = arrowKey(e); if (k) { e.preventDefault(); go(active + k, true); } });

  // Arrastre con mouse y swipe con el dedo, con ajuste a la tarjeta más cercana
  let drag = null;
  let dragged = false;
  viewport.addEventListener('click', (e) => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged = false; } }, true);
  viewport.addEventListener('click', (e) => {
    if (e.target.closest('.pr-card.is-active')) return;
    const r = cards[active].getBoundingClientRect();
    if (e.clientX < r.left) go(active - 1, true); else if (e.clientX > r.right) go(active + 1, true);
  });
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.pointerType === 'mouse' && e.target.closest('a, button')) return;   // con mouse, los botones se pulsan
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null, start: pos, hist: [[e.timeStamp, e.clientX]] };
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.dir === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      drag.dir = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (drag.dir !== 'x') return;
      cancelAnimationFrame(raf);   // si estaba girando, se toma desde donde va
      drag.start = pos; drag.x = e.clientX;
      viewport.setPointerCapture(e.pointerId);
      viewport.classList.add('is-dragging');
    }
    if (drag.dir !== 'x') return;
    dragged = true;
    drag.hist.push([e.timeStamp, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    if (!reduced) { pos = drag.start - (e.clientX - drag.x) / gapOf(); layout(); }
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    viewport.classList.remove('is-dragging');
    if (d.dir !== 'x') return;
    const [t0, x0] = d.hist[0], [t1, x1] = d.hist[d.hist.length - 1];
    const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;
    const dx = e.clientX - d.x;
    const projected = dx + v * 200;
    const base = Math.round(d.start);
    let target = Math.round(d.start - projected / gapOf());
    if (target === base && Math.abs(projected) > gapOf() * .2) target = base + (projected < 0 ? 1 : -1);
    go(Math.max(base - 1, Math.min(base + 1, target)), true);
    setTimeout(() => { dragged = false; }, 0);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  // Pausas
  pauseBtn.addEventListener('click', () => { pause.user = !pause.user; syncPause(); });
  stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { pause.hover = true; syncPause(); } });
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { pause.hover = false; syncPause(); } });
  sec.addEventListener('focusin', (e) => { pause.focus = e.target.matches(':focus-visible'); syncPause(); });
  sec.addEventListener('focusout', (e) => { if (!sec.contains(e.relatedTarget)) { pause.focus = false; syncPause(); } });
  let touchTimer = 0;
  viewport.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { clearTimeout(touchTimer); pause.touch = true; syncPause(); } });
  const releaseTouch = (e) => { if (e.pointerType === 'touch') { clearTimeout(touchTimer); touchTimer = setTimeout(() => { pause.touch = false; syncPause(); }, 4000); } };
  viewport.addEventListener('pointerup', releaseTouch);
  viewport.addEventListener('pointercancel', releaseTouch);
  document.addEventListener('visibilitychange', () => { pause.hidden = document.hidden; syncPause(); });

  // Entrada: las tarjetas se preparan ocultas apenas asoma el escenario y aparecen con fundido
  // escalonado (de izquierda a derecha) cuando está a la vista; luego cuenta la mensualidad activa
  let entered = false;
  let primed = [];
  const prime = () => {
    if (entered || primed.length) return;
    const order = cards.map((c, i) => [c, wrap(i - pos)]).sort((a, b) => a[1] - b[1]).map(([c]) => c);
    primed = order.map((c, k) => $('.pr-card__front', c).animate(
      reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }],
      { duration: 600, delay: k * 140, easing: EASE, fill: 'backwards' },
    ));
    primed.forEach((a) => a.pause());
    if (!reduced) $('.pr-card__num', cards[active]).textContent = fmt(0);
  };
  const enter = () => {
    if (entered) return;
    prime();
    entered = true;
    primed.forEach((a) => a.play());
    primed = [];
    countUp(active, reduced ? 0 : 280);
    restartTimer();
  };
  if ('IntersectionObserver' in window) {
    const primeIO = new IntersectionObserver(([e]) => { if (e.isIntersecting) { prime(); primeIO.disconnect(); } });
    primeIO.observe(stage);
    new IntersectionObserver(([e]) => {
      pause.offscreen = !e.isIntersecting;
      if (e.isIntersecting) enter();
      syncPause();
    }, { threshold: .35 }).observe(stage);
  } else { pause.offscreen = false; enter(); }

  // Comparar todos los planes: acordeón con fundido y leve desplazamiento
  const cmpBtn = $('.pr__compare-btn');
  const cmp = $('#prCompare');
  cmpBtn.addEventListener('click', () => {
    const open = cmpBtn.getAttribute('aria-expanded') !== 'true';
    cmpBtn.setAttribute('aria-expanded', String(open));
    cmp.getAnimations().forEach((a) => a.cancel());
    const frames = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(-10px) scaleY(.96)' }, { opacity: 1, transform: 'none' }];
    if (open) { cmp.hidden = false; cmp.animate(frames, { duration: 420, easing: EASE }); return; }
    cmp.animate(frames, { duration: 260, easing: EASE, direction: 'reverse', fill: 'forwards' })
      .finished.then((a) => { cmp.hidden = true; a.cancel(); }, () => {});
  });

  window.addEventListener('resize', layout);
  layout();
  sync();
  syncPause();
});

// Precios: complementos. Los botones "Pedir por WhatsApp" arman su enlace con el número de data-whatsapp del bloque
// y el mensaje de data-msg de cada botón; si no hay número, quedan apuntando al formulario de #contacto.
// Al entrar en pantalla, las tarjetas suben con fundido escalonado (100 ms entre cada una).
document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('complementos');
  if (!box) return;
  const num = (box.dataset.whatsapp || '').replace(/\D/g, '');
  box.querySelectorAll('.addon__cta').forEach((a) => {
    const title = a.closest('.addon').querySelector('.addon__title').textContent;
    a.setAttribute('aria-label', `${a.textContent}: ${title}`);
    if (!num) return;
    // Se reemplaza por un clon: el desplazamiento suave ya capturó al cargar los enlaces que empiezan con "#"
    const link = a.cloneNode(true);
    link.href = `https://wa.me/${num}?text=${encodeURIComponent(a.dataset.msg)}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.setAttribute('aria-label', `${a.textContent}: ${title} (se abre WhatsApp)`);
    a.replaceWith(link);
  });

  const cards = [...box.querySelectorAll('.addon')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const frames = reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }];
  let anims = null;
  let done = false;
  // Se preparan ocultas apenas asoma la grilla y arrancan cuando ya se ve una parte
  const prime = () => {
    if (anims || done) return;
    anims = cards.map((c, i) => c.animate(frames, { duration: 600, delay: i * 100, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
    anims.forEach((x) => x.pause());
  };
  const play = () => { if (done) return; prime(); done = true; anims.forEach((x) => x.play()); };
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    if (!e.isIntersecting) return;
    prime();
    if (e.intersectionRatio >= 0.2) { play(); io.disconnect(); }
  }, { threshold: [0, 0.2] });
  io.observe(box.querySelector('.addons__grid'));
});

// Contacto: al entrar en pantalla, el panel sube 24 px con un fundido y luego entran escalonados (60 ms)
// la invitación y los campos del formulario. Con movimiento reducido, solo fundidos.
document.addEventListener('DOMContentLoaded', () => {
  const sec = document.getElementById('contacto');
  if (!sec || !sec.classList.contains('ct')) return;
  const panel = sec.querySelector('.ct__panel');
  const items = [...sec.querySelectorAll('.ct__intro > *, .ct-form > :not(.hp)')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const rise = (px) => (reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: `translateY(${px}px)` }, { opacity: 1, transform: 'none' }]);
  let anims = null;
  let done = false;
  // Se preparan ocultos apenas asoma el panel y arrancan cuando ya se ve una parte
  const prime = () => {
    if (anims || done) return;
    anims = [
      panel.animate(rise(24), { duration: 700, easing: EASE, fill: 'backwards' }),
      ...items.map((el, i) => el.animate(rise(12), { duration: 500, delay: 260 + i * 60, easing: EASE, fill: 'backwards' })),
    ];
    anims.forEach((a) => a.pause());
  };
  const play = () => { if (done) return; prime(); done = true; anims.forEach((a) => a.play()); };
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    if (!e.isIntersecting) return;
    prime();
    if (e.intersectionRatio >= 0.15) { play(); io.disconnect(); }
  }, { threshold: [0, 0.15] });
  io.observe(panel);
  // Si alguien llega directo (por ejemplo, desde "Elegir Dúplex") y enfoca algo antes de que termine, todo queda visible
  sec.addEventListener('focusin', play);
});

// Propzen Studio (#web): interruptor "Con un plan Propzen (−20%) / Solo la web", tres paquetes elegibles y el botón
// para cotizar. El HTML trae los valores "con plan" para leerse igual sin JS; aquí se recalculan desde WEB.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('web');
  if (!root) return;

  // Precios de Propzen Studio: se cambian solo en este objeto (UF, pago único, netos + IVA).
  // El descuento aplica con cualquier plan Propzen; las cuotas son el total dividido en WEB.cuotas, redondeado a 2 decimales.
  const WEB = {
    descuento: 0.2,
    cuotas: 6,
    paquetes: {
      vitrina: { nombre: 'Vitrina', normal: 11 },
      portal: { nombre: 'Portal', normal: 16.5 },
      medida: { nombre: 'A medida', normal: 22, desde: true },
    },
  };
  const MODO = { plan: 'con plan Propzen', solo: 'solo la web' };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const EASE = 'cubic-bezier(.22, 1, .36, 1)';
  const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  const fmt = (n) => n.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const precio = (p, modo) => r2(modo === 'plan' ? p.normal * (1 - WEB.descuento) : p.normal);
  const cuota = (p, modo) => r2(precio(p, modo) / WEB.cuotas);
  const ahorro = (p) => r2(p.normal - precio(p, 'plan'));

  const opts = [...root.querySelectorAll('.web-switch__opt')];
  const radios = [...root.querySelectorAll('.web-pack__input')];
  const hint = document.getElementById('webHint');
  const live = document.getElementById('webLive');
  let cta = root.querySelector('.web__cta');
  let modo = 'plan';
  let elegido = null;

  // Textos que salen de los precios: "Desde 8,80 UF", la nota de precios normales y las pastillas de descuento
  root.querySelector('[data-web-from]').textContent = fmt(Math.min(...Object.values(WEB.paquetes).map((p) => precio(p, 'plan'))));
  root.querySelectorAll('[data-web-normal]').forEach((el) => { el.textContent = fmt(WEB.paquetes[el.dataset.webNormal].normal); });
  root.querySelectorAll('.web-switch__pill, .web-card__off').forEach((el) => { el.textContent = `−${Math.round(WEB.descuento * 100)}%`; });

  const shown = new Map();   // valor que se ve en cada número, para que el conteo parta desde ahí
  const setNum = (el, v) => { shown.set(el, v); el.textContent = fmt(v); };
  const cards = radios.map((input) => {
    const card = input.nextElementSibling;
    const v = (k) => card.querySelector(`[data-v="${k}"]`);
    const c = { p: WEB.paquetes[input.value], price: v('price'), fee: v('fee'), was: card.querySelector('.web-card__was'), saveRow: card.querySelector('.web-card__save') };
    v('normal').textContent = fmt(c.p.normal);
    v('save').textContent = fmt(ahorro(c.p));
    setNum(c.price, precio(c.p, modo));
    setNum(c.fee, cuota(c.p, modo));
    return c;
  });

  // Conteo de 400 ms hacia el nuevo valor; con movimiento reducido, el número cambia con un fundido
  const frame = new Map();
  const countTo = (el, to) => {
    cancelAnimationFrame(frame.get(el));
    if (reduced) { setNum(el, to); el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE }); return; }
    const from = shown.get(el);
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 400);
      setNum(el, k < 1 ? from + (to - from) * (1 - (1 - k) ** 3) : to);
      if (k < 1) frame.set(el, requestAnimationFrame(step));
    };
    frame.set(el, requestAnimationFrame(step));
  };
  // Tachado y ahorro: el CSS los oculta en "Solo web" sin soltar su espacio; aquí solo se funden
  const fade = (el, show) => {
    el.getAnimations().forEach((a) => a.cancel());
    el.animate(show ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1, visibility: 'visible' }, { opacity: 0, visibility: 'visible' }], { duration: show ? 300 : 220, easing: EASE });
  };

  // Botón: si hay número de WhatsApp (el de esta sección o, si no, el de #complementos), abre WhatsApp en otra pestaña;
  // si no, sigue apuntando a #contacto con el desplazamiento suave de la página
  const num = (root.dataset.whatsapp || (document.getElementById('complementos') || {}).dataset?.whatsapp || '').replace(/\D/g, '');
  if (num) {
    // Se reemplaza por un clon: el desplazamiento suave ya capturó al cargar los enlaces que empiezan con "#"
    const link = cta.cloneNode(true);
    link.target = '_blank';
    link.rel = 'noopener';
    cta.replaceWith(link);
    cta = link;
  }
  const label = cta.textContent;
  // Sin paquete elegido el botón no hace nada: el clic se corta aquí, antes de llegar al enlace
  root.addEventListener('click', (e) => {
    if (!e.target.closest('.web__cta') || cta.getAttribute('aria-disabled') !== 'true') return;
    e.preventDefault();
    e.stopPropagation();
    hint.animate([{ opacity: 1 }, { opacity: .35 }, { opacity: 1 }], { duration: 600, easing: EASE });
  }, true);
  cta.addEventListener('animationend', () => cta.classList.remove('is-pulse'));

  const updateCta = () => {
    if (!elegido) return;
    const p = WEB.paquetes[elegido];
    const name = document.createElement('b');
    name.textContent = p.nombre;
    hint.replaceChildren('Cotizarás: ', name, ` · ${MODO[modo]} · ${p.desde ? 'desde ' : ''}${fmt(precio(p, modo))} UF + IVA`);
    if (!num) return;
    cta.href = `https://wa.me/${num}?text=${encodeURIComponent(`Hola, quiero cotizar con Propzen Studio la web ${p.nombre} ${MODO[modo]}.`)}`;
    cta.setAttribute('aria-label', `${label} (se abre WhatsApp)`);
  };
  const choose = (value) => {
    const first = !elegido;
    elegido = value;
    if (first) {
      cta.removeAttribute('aria-disabled');
      if (!reduced) { cta.classList.remove('is-pulse'); void cta.offsetWidth; cta.classList.add('is-pulse'); }
    }
    updateCta();
  };
  radios.forEach((r) => r.addEventListener('change', () => choose(r.value)));
  // El navegador puede devolver una elección anterior al volver atrás
  const restored = radios.find((r) => r.checked);
  if (restored) choose(restored.value);

  // Interruptor de precio: radiogroup con flechas, Inicio y Fin (el foco va con la opción elegida)
  const setModo = (m, focus) => {
    const btn = opts.find((o) => o.dataset.mode === m);
    if (focus) btn.focus();
    if (m === modo) return;
    modo = m;
    root.dataset.mode = m;
    opts.forEach((o) => { const on = o === btn; o.setAttribute('aria-checked', String(on)); o.tabIndex = on ? 0 : -1; });
    cards.forEach((c) => {
      countTo(c.price, precio(c.p, m));
      countTo(c.fee, cuota(c.p, m));
      fade(c.was, m === 'plan');
      fade(c.saveRow, m === 'plan');
    });
    live.textContent = `Precios ${MODO[m]}: ${cards.map((c) => `${c.p.nombre} ${c.p.desde ? 'desde ' : ''}${fmt(precio(c.p, m))} UF`).join(', ')}.`;
    updateCta();
  };
  opts.forEach((o) => o.addEventListener('click', () => setModo(o.dataset.mode, false)));
  root.querySelector('.web-switch').addEventListener('keydown', (e) => {
    const i = opts.indexOf(document.activeElement);
    if (i < 0) return;
    const keys = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: opts.length - 1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    setModo(opts[(keys[e.key] + opts.length) % opts.length].dataset.mode, true);
  });

  // Entrada: el rótulo y el panel suben con un fundido; luego los avatares llegan desde la izquierda (80 ms entre cada uno)
  // y las tarjetas suben escalonadas (100 ms). Se preparan ocultos apenas asoma el panel. Con movimiento reducido, solo fundidos.
  const panel = root.querySelector('.web__panel');
  const move = (from) => (reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }]);
  let anims = null;
  let done = false;
  const prime = () => {
    if (anims || done) return;
    anims = [
      ...[root.querySelector('.web__eyebrow'), panel].map((el) => el.animate(move('translateY(24px)'), { duration: 700, easing: EASE, fill: 'backwards' })),
      ...[...root.querySelectorAll('.web-av')].map((el, i) => el.animate(move('translateX(-18px)'), { duration: 500, delay: 320 + i * 80, easing: EASE, fill: 'backwards' })),
      ...[...root.querySelectorAll('.web-pack')].map((el, i) => el.animate(move('translateY(18px)'), { duration: 600, delay: 380 + i * 100, easing: EASE, fill: 'backwards' })),
    ];
    anims.forEach((a) => a.pause());
  };
  const play = () => { if (done) return; prime(); done = true; anims.forEach((a) => a.play()); };
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    const e = entries[entries.length - 1];
    if (!e.isIntersecting) return;
    prime();
    if (e.intersectionRatio >= 0.15) { play(); io.disconnect(); }
  }, { threshold: [0, 0.15] });
  io.observe(panel);
  root.addEventListener('focusin', play);
});
