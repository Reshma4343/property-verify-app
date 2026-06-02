/**
 * PROPVERIFY — PREMIUM HOMEPAGE ANIMATIONS
 * animations.js  |  Drop-in enhancement layer
 *
 * Zero changes to script.js / style.css / HTML structure.
 * Runs fully independently via DOMContentLoaded.
 *
 * Sections:
 *  1. Premium Page Loader
 *  2. Scroll Progress Bar
 *  3. Hero Floating Particles
 *  4. Scroll Reveal (IntersectionObserver)
 *  5. Section Dividers (injected between sections)
 *  6. Counter Animations
 *  7. Nav Scroll-Aware
 *  8. Comparison List Stagger
 *  9. Staggered Card Reveals
 * 10. Parallax (subtle)
 * 11. Gov Grid Stagger
 */

(function () {
  'use strict';

  /* ─── UTILITY ─────────────────────────────────────────────────── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const raf = requestAnimationFrame;

  /* Run after DOM ready */
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  /* ═══════════════════════════════════════════════════════════════
     1. PREMIUM PAGE LOADER
  ═══════════════════════════════════════════════════════════════ */
  function initLoader() {
    // Don't add a second loader if the existing prestige-loader is active
    const existing = $('#prestige-loader');
    if (existing) return; // leave existing loader in place

    // Build our premium loader
    const loader = document.createElement('div');
    loader.id = 'pv-page-loader';
    loader.innerHTML = `
      <div class="pv-loader-logo">
        <div class="pv-loader-icon">
          <i class="fa-solid fa-shield-halved"></i>
        </div>
        <span class="pv-loader-brand">Prop<span>Verify</span></span>
      </div>
      <div class="pv-loader-bar-wrap">
        <div class="pv-loader-bar"></div>
      </div>
      <span class="pv-loader-text">Verifying Intelligence…</span>
    `;
    document.body.prepend(loader);

    // Dismiss after assets are ready
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('pv-loader-out');
        setTimeout(() => loader.remove(), 750);
      }, 300);
    });

    // Fallback — never block longer than 2.8s
    setTimeout(() => {
      loader.classList.add('pv-loader-out');
      setTimeout(() => loader.remove(), 750);
    }, 2800);
  }


  /* ═══════════════════════════════════════════════════════════════
     2. SCROLL PROGRESS BAR
  ═══════════════════════════════════════════════════════════════ */
  function initScrollProgress() {
    const bar = document.createElement('div');
    bar.id = 'pv-scroll-progress';
    document.body.prepend(bar);

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        raf(() => {
          const docH = document.documentElement.scrollHeight - window.innerHeight;
          const pct  = docH > 0 ? (window.scrollY / docH) * 100 : 0;
          bar.style.width = pct + '%';
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }


  /* ═══════════════════════════════════════════════════════════════
     3. HERO FLOATING PARTICLES
  ═══════════════════════════════════════════════════════════════ */
  function initParticles() {
    const hero = $('#step-1');
    if (!hero) return;

    const wrap = document.createElement('div');
    wrap.id = 'pv-particles';
    hero.prepend(wrap);

    const count = window.innerWidth < 768 ? 0 : 14;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'pv-particle';

      const size   = 4 + Math.random() * 10;
      const left   = 5  + Math.random() * 90;
      const top    = 10 + Math.random() * 80;
      const dur    = 8  + Math.random() * 12;
      const delay  = -(Math.random() * 12);

      p.style.cssText = `
        width:${size}px; height:${size}px;
        left:${left}%; top:${top}%;
        animation-duration:${dur}s;
        animation-delay:${delay}s;
        opacity:${0.3 + Math.random() * 0.4};
      `;
      wrap.appendChild(p);
    }
  }


  /* ═══════════════════════════════════════════════════════════════
     4. SCROLL REVEAL — IntersectionObserver
  ═══════════════════════════════════════════════════════════════ */
  function initScrollReveal() {
    const step1 = $('#step-1');

    /* Elements to animate on scroll */
    const targets = [
      /* Government integrations heading */
      { sel: '.gov-integrations-wrap .section-label-wrap', cls: 'pv-reveal' },
      { sel: '.gov-integrations-wrap .section-heading',    cls: 'pv-reveal', delay: '0.08s' },

      /* Comparison heading */
      { sel: '.comparison-wrap .section-heading',          cls: 'pv-reveal' },
      /* Comparison cards — left/right */
      { sel: '.compare-without',                           cls: 'pv-reveal-left' },
      { sel: '.compare-with',                              cls: 'pv-reveal-right' },

      /* Testimonials */
      { sel: '.testimonials-wrap .section-label-wrap',     cls: 'pv-reveal' },
      { sel: '.testimonials-wrap .section-heading',        cls: 'pv-reveal', delay: '0.08s' },

      /* Footer blocks */
      { sel: '.footer-trust-bar',  cls: '' }, /* handled via pv-visible only */
      { sel: '.footer-newsletter', cls: '' },
      { sel: '.footer-main',       cls: '' },
    ];

    /* Elements inside step-1 vs those in other sections */
    const step1Only = new Set([
      '.gov-integrations-wrap .section-label-wrap',
      '.gov-integrations-wrap .section-heading',
    ]);

    /* Add base classes — gov items scoped to step1, everything else document-wide */
    targets.forEach(({ sel, cls, delay }) => {
      const ctx = (step1 && step1Only.has(sel)) ? step1 : document;
      const el = $(sel, ctx);
      if (!el) return;
      if (cls) el.classList.add(cls);
      if (delay) el.style.transitionDelay = delay;
    });

    /* Also add pv-reveal to footer brand/col elements */
    $$('.footer-col').forEach((col, i) => {
      col.classList.add('pv-reveal');
      col.style.transitionDelay = (i * 0.08) + 's';
    });

    /* Shared observer */
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('pv-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    /* Observe all elements that have a pv-reveal* class OR need pv-visible */
    const revealSels = [
      '.pv-reveal', '.pv-reveal-left', '.pv-reveal-right', '.pv-reveal-scale',
      '.footer-trust-bar', '.footer-newsletter', '.footer-main',
      '.trust-item', '.pv-counter-wrap'
    ];
    $$(revealSels.join(',')).forEach(el => obs.observe(el));
  }


  /* ═══════════════════════════════════════════════════════════════
     5. SECTION DIVIDERS  (minimal gradient lines between sections)
  ═══════════════════════════════════════════════════════════════ */
  function initDividers() {
    const step1 = $('#step-1');
    if (!step1) return;

    const dividerPoints = [
      { after: '.gov-integrations-wrap' },
      { after: '.comparison-wrap'       },
      { after: '.testimonials-wrap'     },
    ];

    dividerPoints.forEach(({ after }) => {
      const target = $(after, step1);
      if (!target) return;
      const div = document.createElement('div');
      div.className = 'pv-divider-gradient';
      div.style.cssText = 'margin: 36px auto 0; width: 80%; max-width: 700px; display: block;';
      target.insertAdjacentElement('afterend', div);
    });
  }


  /* ═══════════════════════════════════════════════════════════════
     6. ANIMATED COUNTERS
     Looks for elements with data-pv-count="<number>" or auto-detects
     stat numbers in the step-2 result panel.
  ═══════════════════════════════════════════════════════════════ */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCounter(el, target, duration = 1600, prefix = '', suffix = '') {
    const startTime = performance.now();
    function step(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const value    = Math.round(easeOutCubic(progress) * target);
      el.textContent = prefix + value.toLocaleString('en-IN') + suffix;
      if (progress < 1) raf(step);
    }
    raf(step);
  }

  function initCounters() {
    /* We look for explicit data-pv-count attributes */
    const counterEls = $$('[data-pv-count]');
    if (!counterEls.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el     = entry.target;
        const target = parseInt(el.dataset.pvCount, 10);
        const prefix = el.dataset.pvPrefix || '';
        const suffix = el.dataset.pvSuffix || '';
        animateCounter(el, target, 1800, prefix, suffix);
        obs.unobserve(el);
      });
    }, { threshold: 0.5 });

    counterEls.forEach(el => obs.observe(el));
  }


  /* ═══════════════════════════════════════════════════════════════
     7. NAV — SCROLL-AWARE CLASS
  ═══════════════════════════════════════════════════════════════ */
  function initNavScroll() {
    const nav = $('.nav');
    if (!nav) return;

    let ticking = false;
    function update() {
      if (window.scrollY > 24) {
        nav.classList.add('pv-nav-scrolled');
      } else {
        nav.classList.remove('pv-nav-scrolled');
      }
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) { raf(update); ticking = true; }
    }, { passive: true });

    update(); // initialise
  }


  /* ═══════════════════════════════════════════════════════════════
     8. COMPARISON LIST ITEMS — stagger on reveal
  ═══════════════════════════════════════════════════════════════ */
  function initCompareListStagger() {
    const cards = $$('.compare-card');
    if (!cards.length) return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('pv-list-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });

    cards.forEach(c => obs.observe(c));
  }


  /* ═══════════════════════════════════════════════════════════════
     9. STAGGERED CARD REVEALS
     gov-cards, testimonial-cards
  ═══════════════════════════════════════════════════════════════ */
  function initCardStagger() {
    /* Government Integration Cards */
    const govCards = $$('.gov-card');
    if (govCards.length) {
      const govObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pv-visible');
            govObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

      govCards.forEach((card, i) => {
        card.style.transitionDelay = (i * 0.07) + 's';
        govObs.observe(card);
      });
    }

    /* Testimonial Cards */
    const testCards = $$('.testimonial-card');
    if (testCards.length) {
      const testObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pv-visible');
            testObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12 });

      testCards.forEach((card, i) => {
        card.style.transitionDelay = (i * 0.12) + 's';
        testObs.observe(card);
      });
    }

    /* Trust items in footer */
    const trustItems = $$('.trust-item');
    if (trustItems.length) {
      const trustObs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('pv-visible');
            trustObs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });

      trustItems.forEach((item, i) => {
        item.style.transitionDelay = (i * 0.09) + 's';
        trustObs.observe(item);
      });
    }
  }


  /* ═══════════════════════════════════════════════════════════════
     10. SUBTLE PARALLAX  (hero banner + background layer)
  ═══════════════════════════════════════════════════════════════ */
  function initParallax() {
    if (window.innerWidth < 768) return; // skip on mobile

    const heroBg  = $('#step-1');
    const adBanner = $('.ad-banner');

    let lastSY = 0;
    let ticking = false;

    function applyParallax() {
      const sy = window.scrollY;

      /* Hero background pulse layer */
      if (heroBg) {
        const pseudo = sy * 0.04;
        heroBg.style.setProperty('--pv-parallax-y', pseudo + 'px');
      }

      /* Ad banner subtle float */
      if (adBanner) {
        const shift = sy * 0.06;
        adBanner.style.transform = `translateY(${shift}px)`;
      }

      lastSY  = sy;
      ticking = false;
    }

    window.addEventListener('scroll', () => {
      if (!ticking) {
        raf(applyParallax);
        ticking = true;
      }
    }, { passive: true });
  }


  /* ═══════════════════════════════════════════════════════════════
     11. SMOOTH ANCHOR & CARD ENTRANCE for step-2 results
         (fires whenever step-2 becomes visible — safe hook)
  ═══════════════════════════════════════════════════════════════ */
  function initStep2Observer() {
    const step2 = $('#step-2');
    if (!step2) return;

    const obs = new MutationObserver(() => {
      if (!step2.classList.contains('hidden')) {
        /* Animate the results card in */
        const card = step2.querySelector('.glass-card');
        if (card) {
          card.style.opacity    = '0';
          card.style.transform  = 'translateY(32px) scale(0.98)';
          card.style.transition = 'opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.34,1.1,0.64,1)';
          raf(() => {
            setTimeout(() => {
              card.style.opacity   = '1';
              card.style.transform = 'none';
            }, 60);
          });
        }

        /* Stagger grid-items inside results */
        const items = $$('.grid-item', step2);
        items.forEach((item, i) => {
          item.style.opacity   = '0';
          item.style.transform = 'translateY(20px)';
          item.style.transition= `opacity 0.5s ${0.1 + i * 0.06}s ease, transform 0.5s ${0.1 + i * 0.06}s cubic-bezier(0.34,1.2,0.64,1)`;
          raf(() => {
            setTimeout(() => {
              item.style.opacity   = '1';
              item.style.transform = 'none';
            }, 80);
          });
        });
      }
    });

    obs.observe(step2, { attributes: true, attributeFilter: ['class'] });
  }


  /* ═══════════════════════════════════════════════════════════════
     12. SMOOTH HOVER FOR FOOTER LINKS
  ═══════════════════════════════════════════════════════════════ */
  function initFooterLinkHover() {
    $$('.footer-link').forEach(link => {
      link.addEventListener('mouseenter', () => {
        const icon = link.querySelector('i');
        if (icon) {
          icon.style.transition = 'opacity 0.2s, transform 0.3s cubic-bezier(0.34,1.6,0.64,1)';
        }
      });
    });
  }


  /* ═══════════════════════════════════════════════════════════════
     13. GOV BADGE  — live pulse dot
  ═══════════════════════════════════════════════════════════════ */
  function initLiveBadges() {
    $$('.gov-badge.live').forEach(badge => {
      const dot = document.createElement('span');
      dot.style.cssText = `
        display:inline-block;
        width:6px; height:6px;
        border-radius:50%;
        background:#059669;
        margin-right:5px;
        vertical-align:middle;
        animation: pvLivePulse 1.8s ease-in-out infinite;
      `;
      badge.prepend(dot);
    });

    /* Inject keyframes if not already present */
    if (!$('#pv-live-style')) {
      const style = document.createElement('style');
      style.id = 'pv-live-style';
      style.textContent = `
        @keyframes pvLivePulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.7); }
        }
      `;
      document.head.appendChild(style);
    }
  }


  /* ═══════════════════════════════════════════════════════════════
     14. PILL HOVER MICRO-INTERACTION
  ═══════════════════════════════════════════════════════════════ */
  function initPillHover() {
    const style = document.createElement('style');
    style.textContent = `
      .pill {
        transition: transform 0.25s cubic-bezier(0.34,1.5,0.64,1),
                    box-shadow 0.25s ease !important;
        cursor: default;
      }
      .pill:hover {
        transform: translateY(-2px) scale(1.04);
        box-shadow: 0 4px 16px rgba(20,30,58,0.10);
      }
      .pill-success:hover {
        box-shadow: 0 4px 16px rgba(5,150,105,0.15);
      }
    `;
    document.head.appendChild(style);
  }


  /* ═══════════════════════════════════════════════════════════════
     15. SECTION HEADING DECORATIVE UNDERLINE ANIMATION
  ═══════════════════════════════════════════════════════════════ */
  function initHeadingUnderlines() {
    const style = document.createElement('style');
    style.textContent = `
      .section-heading {
        position: relative;
        display: inline-block;
        width: 100%;
      }
      .section-heading::after {
        content: '';
        position: absolute;
        bottom: -8px; left: 50%;
        transform: translateX(-50%);
        width: 0; height: 2px;
        background: linear-gradient(90deg, transparent, rgba(20,30,58,0.18), transparent);
        border-radius: 99px;
        transition: width 0.8s 0.4s cubic-bezier(0.4,0,0.2,1);
      }
      .section-heading.pv-visible::after {
        width: 60%;
      }
    `;
    document.head.appendChild(style);
  }


  /* ═══════════════════════════════════════════════════════════════
     BOOT — run everything
  ═══════════════════════════════════════════════════════════════ */
  ready(function () {
    initLoader();
    initScrollProgress();
    initNavScroll();
    initParticles();
    initDividers();
    initScrollReveal();
    initCardStagger();
    initCompareListStagger();
    initCounters();
    initParallax();
    initStep2Observer();
    initFooterLinkHover();
    initLiveBadges();
    initPillHover();
    initHeadingUnderlines();
    /* NOTE: hpwGoToStep is owned by the inline <script> in index.html — do not redefine here */

    /* Small perf: remove will-change after animations settle */
    setTimeout(() => {
      $$('.pv-visible').forEach(el => {
        el.style.willChange = 'auto';
      });
    }, 3000);
  });

})();