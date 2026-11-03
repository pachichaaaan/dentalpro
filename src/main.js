import '@fontsource-variable/manrope/wght.css';
import '@fontsource/fraunces/latin-300-italic.css';
import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Booking requests are finished in Messenger with the clinic's Facebook Page,
// so they arrive in the Page inbox in Meta Business Suite.
const MESSENGER_PAGE_ID = '100549332021492';
const MESSENGER_URL = `https://m.me/${MESSENGER_PAGE_ID}?ref=website-booking`;

const TREATMENTS = [
  {
    title: 'Teeth Whitening',
    value: 'Whitening',
    headline: 'A brighter smile, done safely.',
    text: 'We check your teeth, protect your gums and apply a professional whitening gel in timed stages, lifting years of stains for a bright, natural finish.',
    good: ['Coffee & tea stains', 'Yellowing', 'Special occasions'],
  },
  {
    title: 'Braces & Orthodontics',
    value: 'Braces',
    headline: 'Straighter teeth, a balanced bite.',
    text: 'We map your bite and smile, explain your options, then guide your teeth into place with regular, carefully planned adjustments.',
    good: ['Crowding', 'Gaps', 'Bite problems', 'Teens & adults'],
  },
  {
    title: 'Deep Cleaning',
    value: 'Deep cleaning',
    headline: 'Healthy gums, a fresh start.',
    text: 'Scaling removes hardened tartar above and below the gumline, then polishing leaves every surface smooth: the foundation of a healthy smile.',
    good: ['Bleeding gums', 'Tartar build-up', 'Bad breath', 'Six-month care'],
  },
  {
    title: 'Aesthetic Restorations',
    value: 'Restorations',
    headline: 'Repairs that simply blend in.',
    text: 'Decay, chips and dark fillings are replaced with tooth-coloured composite, layered and polished to match your natural teeth.',
    good: ['Cavities', 'Chipped teeth', 'Old fillings', 'Small gaps'],
  },
  {
    title: 'Dentures & Bridges',
    value: 'Dentures & bridges',
    headline: 'A complete smile, restored.',
    text: 'Missing or damaged teeth are replaced with dentures or bridges designed around your bite and face: natural-looking and comfortable.',
    good: ['Missing teeth', 'Worn teeth', 'Loose dentures'],
  },
];

const BASE = import.meta.env.BASE_URL;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const mqMobile = window.matchMedia('(max-width: 900px)');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

document.documentElement.classList.add('js');
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

/* ==========================================================================
   Smooth scroll
   ========================================================================== */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

const scrollToEl = (target) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (target === 0) window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  else target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};

/* ==========================================================================
   WebGL scene
   ========================================================================== */
const canvas = $('.webgl');
let scene = null;
let introStarted = false;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
})();
// The 3D engine downloads alongside the rest of the page instead of blocking it.
const sceneReady = hasWebGL
  ? import('./scene.js')
      .then(({ ToothScene }) => {
        scene = new ToothScene(canvas, { isMobile: mqMobile.matches, reduced });
        attachScene();
        return scene;
      })
      .catch((err) => {
        console.warn('[Dental Pro] WebGL unavailable', err);
        canvas.remove();
        return null;
      })
  : Promise.resolve(null);
if (!hasWebGL) canvas.remove();

/* ==========================================================================
   Text splitting
   ========================================================================== */
function splitWords(el, cls, masked) {
  const build = (src, dest) => {
    src.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) {
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return dest.appendChild(document.createTextNode(' '));
          const inner = document.createElement('span');
          inner.className = cls;
          inner.textContent = part;
          if (masked) {
            const wrap = document.createElement('span');
            wrap.className = 'w';
            wrap.appendChild(inner);
            dest.appendChild(wrap);
          } else dest.appendChild(inner);
        });
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        const clone = n.cloneNode(false);
        dest.appendChild(clone);
        build(n, clone);
      }
    });
  };
  const frag = document.createDocumentFragment();
  build(el, frag);
  el.textContent = '';
  el.appendChild(frag);
  return $$('.' + cls, el);
}

/* ==========================================================================
   Loader → intro
   ========================================================================== */
const loaderState = { target: 0, shown: 0 };
const countEl = $('.loader__count b');
const barEl = $('.loader__bar i');
const hotspotGates = [0, 1, 2].map(() => ({ v: 0 }));
const heroVideo = $('.stage__video');

gsap
  .timeline()
  .to('.loader__mono path', { strokeDashoffset: 0, duration: 1, ease: 'power2.inOut', stagger: 0.1 })
  .to('.loader__mono path', { fillOpacity: 1, strokeOpacity: 0, duration: 0.6, ease: 'power2.out' }, 0.85);

const paintCount = () => {
  countEl.textContent = Math.round(loaderState.shown * 100);
  barEl.style.transform = `scaleX(${loaderState.shown})`;
};
const loaderTick = () => {
  loaderState.shown += (loaderState.target * 0.96 - loaderState.shown) * 0.07;
  paintCount();
};
gsap.ticker.add(loaderTick);

let modelP = 0;
let fontsP = 0;
let videoP = 0;
const setTarget = () => {
  loaderState.target = hasWebGL ? modelP * 0.6 + fontsP * 0.2 + videoP * 0.2 : fontsP * 0.6 + videoP * 0.4;
};
const tasks = [
  document.fonts.ready.then(() => { fontsP = 1; setTarget(); }),
  new Promise((resolve) => {
    if (heroVideo.readyState >= 2) return resolve();
    heroVideo.addEventListener('loadeddata', resolve, { once: true });
    heroVideo.addEventListener('error', resolve, { once: true });
  }).then(() => { videoP = 1; setTarget(); }),
];
if (hasWebGL) {
  tasks.push(
    sceneReady
      .then((s) => s && s.load((p) => { modelP = p; setTarget(); }))
      .then(() => { modelP = 1; setTarget(); })
      .catch((err) => {
        console.warn('[Dental Pro] Model failed to load', err);
        scene = null;
        canvas.remove();
      })
  );
}
const minTime = new Promise((r) => setTimeout(r, reduced ? 300 : 1100));
// never hold visitors on the loader for long — a slow model simply fades in when ready
const loadedOrTimeout = Promise.race([Promise.allSettled(tasks), new Promise((r) => setTimeout(r, 8000))]);

Promise.all([loadedOrTimeout, minTime]).then(() => {
  gsap.ticker.remove(loaderTick);
  gsap.to(loaderState, { shown: 1, duration: 0.6, ease: 'power2.out', onUpdate: paintCount, onComplete: exitLoader });
});

function exitLoader() {
  heroVideo.play().catch(() => {});
  gsap.timeline()
    .to('.loader__center, .loader__tag, .loader__count', { y: -30, opacity: 0, duration: 0.7, ease: 'power3.in', stagger: 0.05 })
    .to('.loader', { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.1, ease: 'expo.inOut' }, 0.3)
    .fromTo('.stage__video', { scale: 1.25 }, { scale: 1.08, duration: 2.4, ease: 'expo.out' }, 0.4)
    .add(() => {
      document.body.classList.remove('is-loading');
      $('.loader').remove();
      lenis?.start();
      ScrollTrigger.refresh();
    })
    .add(introHero, 0.7);
}

function introHero() {
  introStarted = true;
  const tl = gsap.timeline();
  tl.to('.hero__title .ln > span', { yPercent: 0, y: 0, duration: 1.4, ease: 'expo.out', stagger: 0.09 })
    .to('[data-intro]', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08 }, 0.3)
    .from('.nav', { y: -24, opacity: 0, duration: 1, ease: 'power3.out', clearProps: 'transform,opacity' }, 0.2);
  if (scene) tl.to(scene.intro, { p: 1, duration: 2.6, ease: 'expo.out' }, 0);
  hotspotGates.forEach((g, i) => tl.to(g, { v: 1, duration: 1, ease: 'power2.out' }, 1.5 + i * 0.18));
}

// runs once the 3D engine has loaded (normally during the loading screen)
function attachScene() {
  window.addEventListener('pointermove', (e) => {
    scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  }, { passive: true });
  window.addEventListener('resize', () => scene?.resize());
  computeKeys();
  if (introStarted) gsap.to(scene.intro, { p: 1, duration: 2.6, ease: 'expo.out' });
}

/* ==========================================================================
   Scroll choreography for the tooth
   ========================================================================== */
let keys = [];
const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
const storyEl = $('.story');
const storyRange = { start: 0, end: 1 };

function computeKeys() {
  const vh = window.innerHeight;
  storyRange.start = absTop(storyEl);
  storyRange.end = Math.max(storyRange.start + 1, storyRange.start + storyEl.offsetHeight - vh);
  if (!scene) return;
  const mob = mqMobile.matches;
  const PI = Math.PI;
  const why = $('.why');
  const wTop = absTop(why);
  const wEnd = Math.max(wTop + 10, wTop + why.offsetHeight - vh);
  const sTop = storyRange.start;
  const sLen = storyRange.end - storyRange.start;
  const tTop = absTop($('.treatments'));
  const fTop = absTop($('.footer'));
  const maxS = Math.max(fTop + 20, ScrollTrigger.maxScroll(window));

  // keep the tooth and its annotation column inside the viewport at every width
  const vw = window.innerWidth;
  const padX = parseFloat(getComputedStyle($('.hero')).paddingRight) || 24;
  const room = (labels) => Math.max(...labels.map((h) => $('.hotspot__label', h.el).offsetWidth)) + 24;
  const fitX = (x, s, labels) => {
    const maxCenter = vw - padX - room(labels) - 36 - 0.5 * scene.pxPerUnit * s;
    return Math.min(x, (maxCenter - vw / 2) / scene.pxPerUnit);
  };
  const heroHot = vw >= 1080;

  const hero = mob
    ? { x: 0, y: 0.78, rx: 0.06, ry: -0.25, rz: 0.04, s: 0.58, alpha: 1, rim: 0, hot: 0 }
    : { x: heroHot ? fitX(1.25, 1, heroLabels) : 1.15, y: 0.02, rx: 0.05, ry: -0.3, rz: 0.07, s: 1, alpha: 1, rim: 0, hot: heroHot ? 1 : 0 };
  const heroOut = { ...hero, y: hero.y + 0.12, ry: hero.ry + 0.35, hot: 0 };
  const whyA = mob
    ? { x: 0, y: 1.5, rx: 0.1, ry: PI * 0.9, rz: 0, s: 0.42, alpha: 0, rim: 0, hot: 0 }
    : { x: -1.5, y: -0.04, rx: 0.14, ry: PI * 0.92, rz: -0.12, s: 0.9, alpha: 1, rim: 0, hot: 0 };
  const whyB = mob
    ? { ...whyA, ry: PI * 1.4 }
    : { x: -1.55, y: 0.08, rx: -0.06, ry: PI * 1.55, rz: 0.1, s: 0.94, alpha: 1, rim: 0, hot: 0 };
  // "Inside the smile": centre-stage, turning gently while each chapter plays
  const st = mob
    ? { x: 0, y: 0.78, rx: 0.04, ry: PI * 2, rz: 0, s: 0.66, alpha: 1, rim: 0, hot: 0 }
    : { x: fitX(1.05, 1.12, storyLabels), y: 0, rx: 0.04, ry: PI * 2, rz: 0, s: 1.12, alpha: 1, rim: 0, hot: 0 };
  const stTurn = { ...st, ry: PI * 2 - 0.45, rx: 0.1, y: st.y + 0.04 };
  const stBack = { ...st, ry: PI * 2 + 0.3, rz: -0.04 };
  const gone = { x: mob ? 0 : 2.4, y: 1.6, rx: 0.2, ry: PI * 2.6, rz: 0.2, s: 0.5, alpha: 0, rim: 0.3, hot: 0 };
  const footIn = { x: 0, y: -1.8, rx: 0, ry: PI * 5, rz: 0, s: 0.55, alpha: 0, rim: 1, hot: 0 };
  const foot = mob
    ? { x: 0, y: -0.08, rx: 0.06, ry: PI * 6, rz: 0, s: 0.48, alpha: 1, rim: 1, hot: 0 }
    : { x: 0, y: 0.08, rx: 0.06, ry: PI * 6, rz: 0, s: 0.7, alpha: 1, rim: 1, hot: 0 };

  const list = [
    [0, hero],
    [vh * 0.3, heroOut],
    [wTop - vh * 0.12, whyA],
    [wEnd, whyB],
    [sTop, st],
    [sTop + sLen * 0.2, stTurn],
    [sTop + sLen * 0.5, st],
    [sTop + sLen * 0.8, stBack],
    [sTop + sLen, st],
    [tTop - vh * 0.2, gone],
    [fTop - vh * 0.5, footIn],
  ];
  if (mob) {
    // phones: the tooth rests in the footer's open space, then scrolls away with the page
    const yc = vh / 2 - foot.y * scene.pxPerUnit;
    const at = Math.min(maxS, absTop($('.footer__stage')) + vh * 0.23 - yc);
    list.push([at, foot]);
    if (maxS > at + 1) list.push([maxS, { ...foot, y: foot.y + (maxS - at) / scene.pxPerUnit }, true]);
  } else {
    list.push([maxS, foot]);
  }
  // keep keyframes strictly increasing
  keys = [];
  let last = -Infinity;
  list.forEach(([at, s, linear]) => {
    const a = Math.max(at, last + 1);
    keys.push({ at: a, s, linear });
    last = a;
  });
}

function sampleKeys(y) {
  if (!keys.length) return null;
  if (y <= keys[0].at) return keys[0].s;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (y <= b.at) {
      let t = (y - a.at) / (b.at - a.at);
      if (!b.linear) t = t * t * (3 - 2 * t);
      const o = {};
      for (const k in a.s) o[k] = a.s[k] + (b.s[k] - a.s[k]) * t;
      return o;
    }
  }
  return keys[keys.length - 1].s;
}

/* story chapters */
const chapters = $$('.chapter');
const storyBars = $$('.story__progress b');
let chapterIdx = 0;
function updateStory() {
  const p = gsap.utils.clamp(0, 1, (window.scrollY - storyRange.start) / (storyRange.end - storyRange.start));
  const idx = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
  if (idx !== chapterIdx) {
    chapterIdx = idx;
    chapters.forEach((c, i) => {
      c.classList.toggle('is-active', i === idx);
      c.classList.toggle('is-past', i < idx);
    });
  }
  storyBars.forEach((b, i) => (b.style.transform = `scaleX(${gsap.utils.clamp(0, 1, (p - i * 0.34) / 0.32)})`));
  storyEl.classList.toggle('is-ending', p > 0.9);
  return p;
}

/* annotations anchored to the tooth */
const toLabel = (el) => ({ el, line: $('.hotspot__line', el), o: 0 });
const heroLabels = $$('.hotspot[data-hotspot]').map(toLabel);
const storyLabels = $$('.hotspot[data-story-label]').map(toLabel);
function placeLabels(list, pts, weight) {
  pts.forEach((p, i) => {
    const h = list[i];
    const to = weight(i) * (p.front ? 1 : 0);
    h.o += (to - h.o) * 0.14;
    if (h.o < 0.003 && to === 0) {
      h.el.style.opacity = 0;
      return;
    }
    h.el.style.opacity = h.o.toFixed(3);
    h.el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    h.line.style.width = `${Math.max(24, p.labelX - p.x).toFixed(1)}px`;
  });
}
function updateLabels() {
  if (!scene || mqMobile.matches) {
    [...heroLabels, ...storyLabels].forEach((h) => (h.el.style.opacity = 0));
    return;
  }
  const vis = scene.visible ? 1 : 0;
  placeLabels(heroLabels, scene.project(scene.heroAnchors), (i) => scene.current.hot * hotspotGates[i].v * vis);
  const g = gsap.utils.clamp(0, 1, (scene.glass - 0.6) / 0.4) * vis;
  placeLabels(storyLabels, scene.project(scene.storyAnchors), (i) => gsap.utils.clamp(0, 1, g * 1.6 - i * 0.3));
}

ScrollTrigger.addEventListener('refresh', computeKeys);
computeKeys();
gsap.ticker.add(() => {
  const p = updateStory();
  if (!scene) return;
  const st = sampleKeys(window.scrollY);
  if (st) Object.assign(scene.target, st);
  scene.setStory(p);
  scene.update();
  updateLabels();
});

/* ==========================================================================
   Hero stage → page
   ========================================================================== */
gsap.to('.stage', {
  opacity: 0,
  ease: 'none',
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom 15%',
    scrub: true,
    onLeave: () => heroVideo.pause(),
    onEnterBack: () => heroVideo.play().catch(() => {}),
  },
});
gsap.to('.glow', { opacity: 1, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'center top', end: 'bottom top', scrub: true } });
if (!reduced) {
  gsap.to('.hero__content', { yPercent: -18, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 25%', scrub: true } });
}

/* ==========================================================================
   Reveals
   ========================================================================== */
$$('[data-reveal]').forEach((el) => {
  const words = splitWords(el, 'wi', true);
  if (reduced) return;
  gsap.set(words, { yPercent: 115 });
  ScrollTrigger.create({
    trigger: el,
    start: 'top 86%',
    once: true,
    onEnter: () => gsap.to(words, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.045 }),
  });
});

$$('[data-fade]').forEach((el) => {
  gsap.to(el, {
    opacity: 1,
    y: 0,
    duration: reduced ? 0.01 : 1.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 90%', once: true },
  });
});

$$('[data-words]').forEach((el) => {
  const words = splitWords(el, 'mw', false);
  gsap.to(words, {
    opacity: 1,
    ease: 'none',
    stagger: 0.1,
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 50%', scrub: 0.6 },
  });
});

/* ==========================================================================
   Theme (light / tint / dark sections)
   ========================================================================== */
const setTheme = (t) => {
  document.body.classList.toggle('theme-dark', t === 'dark');
  document.body.classList.toggle('theme-tint', t === 'tint');
};
$$('[data-theme]').forEach((sec) => {
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => self.isActive && setTheme(sec.dataset.theme),
  });
});

/* ==========================================================================
   Treatments showcase
   ========================================================================== */
const tabs = $$('.tx');
const panel = $('#tx-panel');
const media = $$('.showcase__media img');
const card = $('.showcase__card');
const sc = {
  tag: $('.showcase__tag', card),
  title: $('.showcase__title', card),
  text: $('.showcase__text', card),
  good: $('.showcase__good', card),
};
let txIndex = 0;

function fillTreatment(i) {
  const d = TREATMENTS[i];
  sc.tag.textContent = d.title;
  sc.title.textContent = d.headline;
  sc.text.textContent = d.text;
  sc.good.replaceChildren(...d.good.map((g) => Object.assign(document.createElement('li'), { textContent: g })));
}

function selectTreatment(i, focus) {
  if (i === txIndex && card.dataset.ready) return;
  txIndex = i;
  card.dataset.ready = '1';
  tabs.forEach((t, j) => {
    const on = j === i;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', tabs[i].id);
  media.forEach((m, j) => m.classList.toggle('is-active', j === i));
  if (focus) tabs[i].focus();
  if (mqMobile.matches) tabs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
  card.classList.add('is-swapping');
  setTimeout(() => {
    fillTreatment(i);
    card.classList.remove('is-swapping');
  }, reduced ? 0 : 260);
}

fillTreatment(0);
card.dataset.ready = '1';
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTreatment(i));
  t.addEventListener('keydown', (e) => {
    const next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (next) {
      e.preventDefault();
      selectTreatment((i + next + tabs.length) % tabs.length, true);
    }
  });
});
$('[data-book]', card).addEventListener('click', () => {
  const radio = $(`.choices input[value="${TREATMENTS[txIndex].value}"]`);
  if (radio) radio.checked = true;
  scrollToEl($('#book'));
});

/* ==========================================================================
   Results: before / after cases
   ========================================================================== */
const casesEl = $('[data-cases]');
$$('[data-case]').forEach((c) => {
  const buttons = $$('.switch button', c);
  const show = (which) => {
    c.classList.toggle('is-after', which === 'after');
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.show === which)));
  };
  buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.show)));
  if (reduced) return;
  // demonstrate once: flip to "after" shortly after a case comes into view
  const io = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    io.disconnect();
    setTimeout(() => show('after'), 700);
  }, { threshold: 0.65 });
  io.observe(c);
});
const step = (dir) => {
  const first = $('.case', casesEl);
  casesEl.scrollBy({ left: dir * (first.offsetWidth + 22), behavior: reduced ? 'auto' : 'smooth' });
};
$('[data-cases-prev]').addEventListener('click', () => step(-1));
$('[data-cases-next]').addEventListener('click', () => step(1));

/* ==========================================================================
   FAQ
   ========================================================================== */
let faqRefresh;
$$('.qa').forEach((qa, i) => {
  const btn = $('.qa__q', qa);
  const set = (open) => {
    qa.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  };
  if (i === 0) set(true);
  btn.addEventListener('click', () => {
    set(!qa.classList.contains('is-open'));
    clearTimeout(faqRefresh);
    faqRefresh = setTimeout(() => ScrollTrigger.refresh(), 650);
  });
});

/* ==========================================================================
   Lazy, in-view-only video playback (booking backdrop)
   ========================================================================== */
$$('video[data-src]').forEach((v) => {
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!v.src) v.src = BASE + v.dataset.src.replace(/^\//, '');
      v.play().catch(() => {});
    } else if (v.src) v.pause();
  }, { rootMargin: '200px 0px' });
  io.observe(v);
});

/* ==========================================================================
   Footer wordmark
   ========================================================================== */
if (!reduced) {
  gsap.set('.footer__mark path', { yPercent: -120 });
  ScrollTrigger.create({
    trigger: '.footer__mark',
    start: 'top 96%',
    once: true,
    onEnter: () => gsap.to('.footer__mark path', { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: 0.05 }),
  });
}

/* ==========================================================================
   Navigation
   ========================================================================== */
const nav = $('.nav');
const heroEl = $('.hero');
const syncNav = (y) => {
  const overHero = y < heroEl.offsetHeight - nav.offsetHeight;
  nav.classList.toggle('is-hero', overHero);
  nav.classList.toggle('is-solid', !overHero);
};
syncNav(0);
ScrollTrigger.create({
  start: 0,
  end: 'max',
  onRefresh: (self) => syncNav(self.scroll()),
  onUpdate: (self) => {
    const y = self.scroll();
    syncNav(y);
    const hide = self.direction === 1 && y > window.innerHeight * 0.9 && !document.body.classList.contains('menu-open');
    nav.classList.toggle('is-hidden', hide);
  },
});
$$('.nav__links a').forEach((a) => {
  const sec = $(a.getAttribute('href'));
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: (self) => a.classList.toggle('is-active', self.isActive),
  });
});

const burger = $('.nav__burger');
const menu = $('#menu');
const openMenu = () => {
  document.body.classList.add('menu-open');
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close menu');
  menu.setAttribute('aria-hidden', 'false');
  lenis?.stop();
};
const closeMenu = () => {
  if (!document.body.classList.contains('menu-open')) return;
  document.body.classList.remove('menu-open');
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open menu');
  menu.setAttribute('aria-hidden', 'true');
  lenis?.start();
};
burger.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    scrollToEl(target);
  });
});

/* ==========================================================================
   Tooth cursor (mouse and trackpad only)
   ========================================================================== */
if (finePointer && !reduced) {
  document.documentElement.classList.add('has-cursor');
  const cursor = $('.cursor');
  const ring = $('.cursor__ring');
  const tooth = $('.cursor__tooth');
  const toothSvg = $('svg', tooth);
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  const tx = gsap.quickTo(tooth, 'x', { duration: 0.08, ease: 'none' });
  const ty = gsap.quickTo(tooth, 'y', { duration: 0.08, ease: 'none' });
  // the tooth leans into the direction of travel, then settles upright
  let lastX = 0;
  let push = 0;
  let lean = 0;
  window.addEventListener('pointermove', (e) => {
    rx(e.clientX); ry(e.clientY); tx(e.clientX); ty(e.clientY);
    push += e.clientX - lastX;
    lastX = e.clientX;
  }, { passive: true });
  gsap.ticker.add(() => {
    lean += (gsap.utils.clamp(-28, 28, push * 1.6) - lean) * 0.18;
    push *= 0.6;
    gsap.set(toothSvg, { rotation: lean });
  });
  document.addEventListener('pointerover', (e) => {
    const field = e.target.closest('input:not([type="radio"]), textarea, select');
    cursor.classList.toggle('is-hidden', !!field);
    cursor.classList.toggle('is-hover', !field && !!e.target.closest('a, button, label, [role="tab"]'));
  });
  window.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
  window.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
  document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  document.documentElement.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));
}

/* ==========================================================================
   Booking form
   ========================================================================== */
const form = $('.form');
const statusEl = $('.form__status');
const doneEl = $('.form__done');
const previewEl = $('.form__preview', doneEl);
form.elements.date.min = new Date().toISOString().slice(0, 10);
$$('[data-messenger]').forEach((a) => (a.href = MESSENGER_URL));

function bookingMessage(d) {
  const date = d.date
    ? new Date(`${d.date}T00:00`).toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return [
    'Hi Dental Pro! I would like to book an appointment.',
    '',
    `Name: ${d.name.trim()}`,
    `Mobile: ${d.phone.trim()}`,
    d.email.trim() ? `Email: ${d.email.trim()}` : null,
    `Treatment: ${d.treatment}`,
    `Clinic: ${d.clinic}`,
    date ? `Preferred date: ${date}` : null,
    d.message.trim() ? `Notes: ${d.message.trim()}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older browsers / non-secure contexts
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

let lastMessage = '';
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const required = [form.elements.name, form.elements.phone];
  let ok = true;
  required.forEach((f) => {
    const bad = !f.value.trim();
    f.closest('.field').classList.toggle('is-invalid', bad);
    if (bad) ok = false;
  });
  if (!ok) {
    statusEl.textContent = 'Please add your name and mobile number.';
    return;
  }
  statusEl.textContent = '';
  lastMessage = bookingMessage(Object.fromEntries(new FormData(form)));
  copyText(lastMessage);
  previewEl.textContent = lastMessage;
  doneEl.hidden = false;
  doneEl.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });

  // open Messenger inside the click so pop-up blockers allow it; phones hand off to the Messenger app
  if (mqMobile.matches) {
    window.location.href = MESSENGER_URL;
  } else {
    const win = window.open(MESSENGER_URL, '_blank');
    if (win) win.opener = null;
  }
});
$('[data-copy]', doneEl).addEventListener('click', async (e) => {
  const ok = await copyText(lastMessage);
  e.currentTarget.textContent = ok ? 'Copied!' : 'Copy failed: select the text above';
});
form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));

$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));

window.addEventListener('load', () => ScrollTrigger.refresh());
