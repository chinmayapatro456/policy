document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const TOPICS = [
    'history', 'geography', 'polity', 'diplomacy', 'philosophy',
    'culture', 'society', 'ethics', 'governance', 'books', 'literature', 'misc'
  ];

  // Fail loudly if data.js did not load, instead of dying silently.
  if (typeof articles === 'undefined' || !Array.isArray(articles)) {
    console.error('data.js did not load. Check that js/data.js exists and is linked before js/app.js.');
    return;
  }

  const topicsSection    = document.getElementById('topics');
  const searchInput      = document.getElementById('search-box');
  const essayCount       = document.getElementById('essay-count');
  const globalEmptyState = document.getElementById('global-empty-state');
  const topicNavLinks    = document.querySelectorAll('.topic-nav .topic-btn');
  const progressBar      = document.getElementById('scroll-progress');
  const siteNav          = document.getElementById('site-nav');
  const navToggle        = document.getElementById('nav-toggle');
  const navLinksWrap     = document.querySelector('.nav-links');
  const yearEl           = document.getElementById('year');

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Cache each topic's group element + grid container up front.
  const topicRefs = {};
  TOPICS.forEach(topic => {
    const groupEl = document.getElementById(`topic-${topic}`);
    if (!groupEl) return;
    topicRefs[topic] = { groupEl, grid: groupEl.querySelector('.article-grid') };
  });

  let searchQuery  = '';
  let activeTopic  = 'all';

  /* ---------------- Rendering ---------------- */

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }

  function cardTemplate(item, indexInTopic) {
    const href = `article.html?id=${encodeURIComponent(item.id)}`;
    return `
      <article class="article-card" style="--delay:${Math.min(indexInTopic * 70, 420)}ms">
        <div class="article-index">${String(indexInTopic + 1).padStart(2, '0')}</div>
       <div class="article-card-main${item.image ? ' has-thumb' : ''}">
          ${item.image ? `<img class="article-thumb" src="${escapeAttr(item.image)}" alt="${escapeAttr(item.imageAlt)}" loading="lazy">` : ''}
          <div class="meta-header">
            <span class="meta-topic">${item.topicLabel}</span>
            <span class="meta-dot">•</span>
            <span>${item.date}</span>
            <span class="meta-dot">•</span>
            <span>${item.readingTime}</span>
          </div>
          <h4 class="article-title"><a href="${href}">${item.title}</a></h4>
          <p class="article-summary">${item.summary}</p>
          <a class="read-link" href="${href}">Read essay <span>↗</span></a>
        </div>
      </article>`;
  }

  function matchesSearch(item) {
    if (!searchQuery) return true;
    const haystack = [
      item.title,
      item.summary,
      item.topicLabel,
      String(item.content || '').replace(/<[^>]*>/g, '')
    ].join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  }

  function matchesTopic(item) {
    return activeTopic === 'all' || item.topic === activeTopic;
  }

  function renderArticles() {
    const filtered = articles.filter(item => matchesSearch(item) && matchesTopic(item));

    const byTopic = {};
    TOPICS.forEach(t => { byTopic[t] = []; });
    filtered.forEach(item => { if (byTopic[item.topic]) byTopic[item.topic].push(item); });

    if (essayCount) {
      essayCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'essay' : 'essays'}`;
    }

    let anyVisible = false;

    TOPICS.forEach(topic => {
      const ref = topicRefs[topic];
      if (!ref) return;
      const items = byTopic[topic];

      if (!items.length) {
        ref.groupEl.hidden = true;
        ref.grid.innerHTML = '';
        return;
      }

      anyVisible = true;
      ref.groupEl.hidden = false;
      ref.groupEl.classList.add('is-visible');
      ref.grid.innerHTML = items.map((item, i) => cardTemplate(item, i)).join('');
    });

    if (globalEmptyState) globalEmptyState.hidden = anyVisible;
    attachTilt();
  }

  /* ---------------- Search ---------------- */

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderArticles();
    });
  }

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement.tagName || '').toLowerCase();
    if (e.key === '/' && tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      if (searchInput) { searchInput.focus(); searchInput.scrollIntoView({ block: 'center' }); }
    }
    if (e.key === 'Escape' && searchInput && document.activeElement === searchInput) {
      searchInput.value = '';
      searchQuery = '';
      searchInput.blur();
      renderArticles();
    }
  });

  /* ---------------- Topic filter pills ---------------- */

  topicNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const topic = link.dataset.topic;
      if (!topic) return;
      e.preventDefault();

      activeTopic = topic;
      topicNavLinks.forEach(l => l.classList.toggle('active', l === link));
      renderArticles();

      const target = topic === 'all'
        ? document.getElementById('topics')
        : document.getElementById(`topic-${topic}`);
     if (target) {
  const y = target.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: y, behavior: 'smooth' });
}
    });
  });

  /* ---------------- 3D tilt on cards + photo ---------------- */

  const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function tiltHandler(el, maxDeg, inner) {
    const surface = inner || el;
    function onMove(e) {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      const rotY = (px - 0.5) * maxDeg * 2;
      const rotX = (0.5 - py) * maxDeg * 2;
      surface.style.transform =
        `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-6px)`;
      el.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    }
    function onLeave() { surface.style.transform = ''; }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  }

  function attachTilt() {
    if (!supportsHover || reduceMotion) return;
    document.querySelectorAll('.article-card:not(.tilt-on)').forEach(card => {
      card.classList.add('tilt-on');
      tiltHandler(card, 5);
    });
  }

  const photoFrame = document.querySelector('.photo-frame[data-tilt]');
  if (photoFrame && supportsHover && !reduceMotion) {
    tiltHandler(photoFrame, 7, photoFrame.querySelector('.photo-inner'));
  }

  /* ---------------- Reveal on scroll ---------------- */

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
}, { threshold: 0, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.section, .topic-group').forEach(el => revealObserver.observe(el));
  if (!('IntersectionObserver' in window)) {
  document.querySelectorAll('.section, .topic-group').forEach(el => el.classList.add('is-visible'));
}

  /* ---------------- Animated stat counters ---------------- */

 const essayStat = document.querySelector('.hero-stats [data-count]');
if (essayStat) essayStat.dataset.count = articles.length;
const counters = document.querySelectorAll('[data-count]');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10) || 0;
      const duration = 1100;
      const start = performance.now();
      function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased);
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => counterObserver.observe(c));

  /* ---------------- Scroll progress + nav state ---------------- */

  function onScroll() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    if (progressBar) progressBar.style.width = pct + '%';
    if (siteNav) siteNav.classList.toggle('scrolled', doc.scrollTop > 30);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------------- Section scrollspy (main nav) ---------------- */

  const spySections = ['about', 'essays', 'topics']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if (spySections.length) {
    const spyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll('.nav-links a').forEach(l => {
          l.classList.toggle('active', l.dataset.nav === entry.target.id);
        });
      });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
    spySections.forEach(s => spyObserver.observe(s));
  }

  /* ---------------- Mobile menu ---------------- */

  if (navToggle && navLinksWrap) {
    navToggle.addEventListener('click', () => {
      const open = navLinksWrap.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    navLinksWrap.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinksWrap.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* ---------------- Keep new cards observed ---------------- */

  if (topicsSection) {
    new MutationObserver(attachTilt).observe(topicsSection, { childList: true, subtree: true });
  }

  renderArticles();
});
