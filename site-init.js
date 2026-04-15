/**
 * AdPanel Frontend Integration — site-init.js
 * ─────────────────────────────────────────────
 * Fetches live settings & ads from AdPanel backend and applies them to the page:
 *   • Maintenance mode overlay
 *   • Announcement banner
 *   • Hero headline / subheadline / CTA text
 *   • Social links in footer
 *   • Google Analytics & Facebook Pixel injection
 *   • Custom <head> / <body> HTML injection
 *   • Ad injection into [data-ad-placement="..."] containers
 *   • Impression & click tracking
 *
 * Requires site-config.js to be loaded first (sets window.ADS_BACKEND_URL).
 */
(function () {
  'use strict';

  const BASE = (window.ADS_BACKEND_URL || '').replace(/\/$/, '');

  // ── Helpers ──────────────────────────────────────────────────────────────
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  function post(url) {
    try { fetch(url, { method: 'POST' }); } catch (_) {}
  }

  // ── Main entry ───────────────────────────────────────────────────────────
  async function init() {
    try {
      const device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
      const [settings, ads] = await Promise.all([
        getJSON(BASE + '/api/settings/public'),
        getJSON(BASE + '/api/ads?device=' + device),
      ]);
      applySettings(settings);
      if (settings.features?.showAds !== false) injectAds(ads);
    } catch (e) {
      console.info('[AdPanel] Backend not reachable:', e.message);
    }
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  function applySettings(s) {
    // 1. Maintenance mode — full-page overlay, nothing else loads
    if (s.features?.maintenanceMode) {
      showMaintenance(s.general?.siteName || 'Site');
      return;
    }

    // 2. Announcement banner
    if (s.announcement?.enabled && s.announcement?.text) {
      showAnnouncement(s.announcement);
    }

    // 3. Hero section text
    applyHero(s.hero);

    // 4. Social footer links — show/hide based on what's set
    ['twitter', 'instagram', 'youtube', 'discord', 'tiktok'].forEach(function (k) {
      var el = document.getElementById('footer-' + k);
      if (!el) return;
      if (s.social && s.social[k]) { el.href = s.social[k]; el.style.display = ''; }
      else el.style.display = 'none';
    });

    // 5. Site name placeholders
    document.querySelectorAll('[data-site-name]').forEach(function (el) {
      if (s.general?.siteName) el.textContent = s.general.siteName;
    });

    // 6. Google Analytics
    if (s.analytics?.googleAnalyticsId) injectGA(s.analytics.googleAnalyticsId);

    // 7. Facebook Pixel
    if (s.analytics?.facebookPixelId) injectFBPixel(s.analytics.facebookPixelId);

    // 8. Custom <head> HTML (runs scripts correctly)
    if (s.analytics?.customHeadHtml) injectRawHTML(s.analytics.customHeadHtml, document.head);

    // 9. Custom <body> HTML
    if (s.analytics?.customBodyHtml) injectRawHTML(s.analytics.customBodyHtml, document.body);
  }

  function applyHero(hero) {
    if (!hero) return;
    var map = {
      'hero-headline': hero.headline,
      'hero-accent':   hero.accent,
      'hero-sub':      hero.sub,
      'hero-cta':      hero.ctaText,
      'hero-badge':    hero.badge,
    };
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && map[id]) el.textContent = map[id];
    });
  }

  // ── Ads ───────────────────────────────────────────────────────────────────
  function injectAds(ads) {
    if (!ads || !ads.length) return;

    // Group by placement, highest priority first (API already sorted)
    var byPlacement = {};
    ads.forEach(function (ad) {
      if (!byPlacement[ad.placement]) byPlacement[ad.placement] = [];
      byPlacement[ad.placement].push(ad);
    });

    document.querySelectorAll('[data-ad-placement]').forEach(function (container) {
      var placement = container.dataset.adPlacement;
      var list = byPlacement[placement];
      if (!list || !list.length) return;

      var ad = list[0];
      var html = '';

      if (ad.html) {
        html = ad.html;
      } else if (ad.imageUrl) {
        var linkOpen  = ad.linkUrl ? '<a href="' + ad.linkUrl + '" target="_blank" rel="noopener sponsored" onclick="window.__adClick&&window.__adClick(\'' + ad.id + '\')">' : '<span>';
        var linkClose = ad.linkUrl ? '</a>' : '</span>';
        html = linkOpen + '<img src="' + ad.imageUrl + '" alt="' + ad.title + '" loading="lazy" style="max-width:100%;display:block;border-radius:8px">' + linkClose;
      }

      if (html) {
        // Use injectRawHTML so <script> tags (e.g. AdSense push) actually execute
        container.innerHTML = '';
        container.style.display = 'block'; // override the CSS display:none
        injectRawHTML(html, container);
        post(BASE + '/api/ads/' + ad.id + '/impression');
      }
    });

    // Global click tracker (called by inline onclick)
    window.__adClick = function (id) { post(BASE + '/api/ads/' + id + '/click'); };
  }

  // ── Announcement Banner ───────────────────────────────────────────────────
  function showAnnouncement(ann) {
    var bar = document.getElementById('announcement-bar');
    if (!bar) return;

    var styleMap = {
      info:    'background:rgba(37,99,235,.12);color:#93c5fd;border-color:rgba(37,99,235,.3)',
      success: 'background:rgba(16,185,129,.12);color:#6ee7b7;border-color:rgba(16,185,129,.3)',
      warning: 'background:rgba(245,158,11,.12);color:#fcd34d;border-color:rgba(245,158,11,.3)',
      danger:  'background:rgba(239,68,68,.12);color:#fca5a5;border-color:rgba(239,68,68,.3)',
    };
    var s = styleMap[ann.style] || styleMap.info;
    bar.setAttribute('style', s + ';display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 48px 10px 20px;font-size:.875rem;font-weight:500;border-bottom:1px solid;position:relative;z-index:1001');

    var txt = document.getElementById('ann-text');
    if (txt) txt.textContent = ann.text;

    var lnk = document.getElementById('ann-link');
    if (lnk && ann.linkUrl) {
      lnk.href = ann.linkUrl;
      lnk.textContent = ann.linkText || 'Learn more →';
      lnk.style.display = '';
    }
  }

  // ── Maintenance overlay ───────────────────────────────────────────────────
  function showMaintenance(siteName) {
    document.body.innerHTML =
      '<div style="min-height:100vh;background:#070b14;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;color:#e2e8f0;text-align:center;padding:2rem">' +
      '<div style="font-size:3.5rem;margin-bottom:1.25rem">🔧</div>' +
      '<h1 style="font-size:2rem;font-weight:800;margin-bottom:.5rem">' + siteName + '</h1>' +
      '<p style="font-size:1.1rem;color:#64748b;margin-bottom:.75rem">Scheduled maintenance in progress</p>' +
      '<p style="color:#475569;font-size:.9rem">We\'ll be back shortly. Thank you for your patience.</p>' +
      '</div>';
  }

  // ── Analytics injectors ───────────────────────────────────────────────────
  function injectGA(id) {
    var s = document.createElement('script');
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    s.async = true;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', id);
  }

  function injectFBPixel(id) {
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', id);
    window.fbq('track', 'PageView');
  }

  // Inject arbitrary HTML, handling <script> tags correctly (innerHTML doesn't run scripts)
  function injectRawHTML(html, parent) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    Array.from(tmp.childNodes).forEach(function (node) {
      if (node.nodeName === 'SCRIPT') {
        var s = document.createElement('script');
        if (node.src) { s.src = node.src; s.async = node.async; }
        else s.textContent = node.textContent;
        parent.appendChild(s);
      } else {
        parent.appendChild(node.cloneNode(true));
      }
    });
  }

  ready(init);
})();
