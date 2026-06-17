// title: "Meta Blur"
// description: "Runs on Facebook or Instagram. Blurs your profile photo, name, and identity-exposing UI regions so you can capture evidence without revealing your account."
(function () {

  var existing = document.getElementById('_mb_win');
  if (existing) { existing.remove(); return; }

  var COLORS = {
    bg:          '#08080b',
    surface:     '#101015',
    surfaceHi:   '#16161d',
    bar:         '#000',
    border:      '#26262e',
    borderSoft:  '#181820',
    text:        '#e8e8ec',
    textStrong:  '#ffffff',
    textMuted:   '#8e8e96',
    textDim:     '#5a5a62',
    textFaint:   '#2a2a32',
    accent:      '#34d399',
    accentGlow:  'rgba(52,211,153,0.45)',
    accentSoft:  'rgba(52,211,153,0.12)',
    danger:      '#ef4444',
    warn:        '#fbbf24'
  };
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Fira Mono",Consolas,monospace';

  var SITE = location.hostname.indexOf('instagram') !== -1 ? 'ig'
           : location.hostname.indexOf('facebook')  !== -1 ? 'fb' : null;

  var SF = 'data-mb-f';
  var SD = 'data-mb-d';

  var CFG = {
    blurPx:       30,
    blurName:     true,
    ticMode:      'blur',
    rescanMs:     2000,
    igThreadList: true,
    igSuggested:  true,
    igAccount:    true
  };

  var eng = window.__mbEng = window.__mbEng || {
    active:     false,
    obs:        null,
    timer:      null,
    profileKey: null,
    igUsername: null,
    igName:     null,
    userName:   null,
    onRun:      null
  };

  // Applies a CSS blur to an element, saving its original filter so it can be restored.
  function blurEl(target) {
    if (!target || target.hasAttribute(SF)) return;
    var w   = target.getBoundingClientRect().width || 0;
    var amt = Math.max(CFG.blurPx, Math.round(w / 6));
    target.setAttribute(SF, target.style.filter || '');
    target.style.filter = (target.style.filter ? target.style.filter + ' ' : '') +
                          'blur(' + amt + 'px)';
  }
  // Hides an element via display:none, saving its original display value for restore.
  function hideEl(target) {
    if (!target || target.hasAttribute(SD)) return;
    target.setAttribute(SD, target.style.display || '');
    target.style.display = 'none';
  }
  // Returns a single string joining every src-like attribute of an image element.
  function imgSrcs(im) {
    return (im.currentSrc || '') + ' ' + (im.getAttribute('src') || '') + ' ' +
           (im.getAttribute('srcset') || '') + ' ' +
           (im.getAttribute('xlink:href') || '') + ' ' + (im.getAttribute('href') || '');
  }

  // Resolves the logged-in user's profile-photo key (filename) from the page chrome.
  function resolveKey() {
    if (eng.profileKey) return eng.profileKey;
    var href = null;
    if (SITE === 'fb') {
      var profBtns = document.querySelectorAll('[aria-label="Your profile"]');
      for (var bi = 0; bi < profBtns.length; bi++) {
        var svgImg = profBtns[bi].querySelector('image');
        if (!svgImg) continue;
        href = svgImg.getAttribute('xlink:href') || svgImg.getAttribute('href') ||
               (svgImg.href && svgImg.href.baseVal) || '';
        if (href) break;
      }
    } else if (SITE === 'ig') {
      var navLinks = document.querySelectorAll('a[href]');
      for (var li = 0; li < navLinks.length; li++) {
        if (navLinks[li].textContent.trim() !== 'Profile') continue;
        var pimg = navLinks[li].querySelector('img');
        if (!pimg) continue;
        href = pimg.currentSrc || pimg.getAttribute('src') || '';
        eng.igUsername = (navLinks[li].getAttribute('href') || '').replace(/\//g, '').trim() || null;
        if (href) break;
      }
    }
    if (!href) return null;
    try {
      eng.profileKey = new URL(href, location.href).pathname.split('/').pop()
                           .replace(/\.[a-z0-9]+$/i, '');
    } catch (_) {}
    return eng.profileKey;
  }

  // Resolves the logged-in user's display name by matching their avatar key to a nearby link.
  function resolveName() {
    if (eng.userName) return eng.userName;
    var key = resolveKey();
    if (!key) return null;
    var anchors = document.querySelectorAll('a[role="link"], a[href]');
    for (var ai = 0; ai < anchors.length; ai++) {
      var imgs = anchors[ai].querySelectorAll('img,image');
      var mine = false;
      for (var ii = 0; ii < imgs.length; ii++) {
        if (imgSrcs(imgs[ii]).indexOf(key) !== -1) { mine = true; break; }
      }
      if (!mine) continue;
      var t = anchors[ai].textContent.trim();
      if (t && t.length > 1 && t.length < 60) { eng.userName = t; return eng.userName; }
    }
    return null;
  }

  // Returns the set of name/handle strings to blur for the current site.
  function getNames() {
    var out = [];
    if (SITE === 'fb') { var n = resolveName(); if (n) out.push(n); }
    if (eng.igUsername) out.push(eng.igUsername);
    if (eng.igName)     out.push(eng.igName);
    return out;
  }

  // Blurs every image, SVG image, and CSS background whose source matches the user's photo key.
  function scanPhotos() {
    var key = resolveKey();
    if (!key) return;
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      if (imgSrcs(imgs[i]).indexOf(key) !== -1) blurEl(imgs[i]);
    }
    var svgImgs = document.querySelectorAll('image');
    for (var j = 0; j < svgImgs.length; j++) {
      if (imgSrcs(svgImgs[j]).indexOf(key) !== -1) blurEl(svgImgs[j].closest('svg') || svgImgs[j]);
    }
    var bgEls = document.querySelectorAll('[style*="background-image"]');
    for (var k = 0; k < bgEls.length; k++) {
      if ((bgEls[k].getAttribute('style') || '').indexOf(key) !== -1) blurEl(bgEls[k]);
    }
  }

  // Blurs text nodes that match the user's display name or handle.
  function scanName() {
    if (!CFG.blurName) return;
    var names = getNames();
    if (!names.length) return;
    var nodes = document.querySelectorAll('span,a,strong,h1,h2,h3,h4');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].hasAttribute(SF)) continue;
      var t = nodes[i].textContent.trim();
      if (!t) continue;
      for (var ni = 0; ni < names.length; ni++) {
        if (t === names[ni] || (t.indexOf(names[ni]) !== -1 && nodes[i].querySelectorAll('*').length <= 3)) {
          blurEl(nodes[i]); break;
        }
      }
    }
  }

  var ARIA_BLUR = ['Create a post', 'Create post', "What's on your mind"];
  // Blurs elements whose aria-label matches the post-composer prompts.
  function scanAria() {
    for (var i = 0; i < ARIA_BLUR.length; i++) {
      var hits = document.querySelectorAll('[aria-label*="' + ARIA_BLUR[i].replace(/"/g, '') + '" i]');
      for (var j = 0; j < hits.length; j++) blurEl(hits[j]);
    }
  }

  // Blurs the name-linked first item of the Facebook navigation sidebar.
  function scanSidebar() {
    var hs = document.querySelectorAll('h1,h2,h3');
    for (var i = 0; i < hs.length; i++) {
      if (hs[i].textContent.trim().toLowerCase() !== 'facebook menu') continue;
      var p = hs[i];
      while (p && !p.querySelector('ul > li')) p = p.parentElement;
      if (p) blurEl(p.querySelector('ul > li'));
    }
  }

  // Blurs or removes Facebook's 'Things in common' card.
  function scanTIC() {
    var nodes = document.querySelectorAll('h1,h2,h3,h4,span');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].textContent.trim().toLowerCase() !== 'things in common') continue;
      var base = nodes[i].textContent.trim();
      var cur = nodes[i];
      while (cur.parentElement && cur.parentElement.textContent.trim() === base) cur = cur.parentElement;
      var card = cur.parentElement || cur;
      if (CFG.ticMode === 'remove') hideEl(card); else blurEl(card);
    }
  }

  // Blurs the Instagram Direct Messages thread list.
  function scanIGThreadList() {
    var nodes = document.querySelectorAll('[aria-label="Thread list"]');
    for (var i = 0; i < nodes.length; i++) blurEl(nodes[i]);
  }

  // Blurs the Instagram 'Suggested for you' section.
  function scanIGSuggested() {
    var links = document.querySelectorAll('a[href*="/explore/people"]');
    for (var i = 0; i < links.length; i++) {
      var cur = links[i];
      while (cur.parentElement && cur.querySelectorAll('button').length === 0) cur = cur.parentElement;
      blurEl(cur);
    }
  }

  // Blurs the Instagram account-switcher card and captures the display name from it.
  function scanIGAccount() {
    var btns = document.querySelectorAll('div[role="button"], button');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].textContent.trim() !== 'Switch') continue;
      var card = btns[i], found = false;
      for (var ci = 0; ci < 8 && card.parentElement; ci++) {
        card = card.parentElement;
        if (card.querySelector('img')) { found = true; break; }
      }
      if (!found) continue;
      if (!eng.igName) {
        var titleEl = card.querySelector('[title]');
        if (titleEl) eng.igName = (titleEl.getAttribute('title') || '').trim() || null;
      }
      blurEl(card);
    }
  }

  // Runs every enabled scan pass for the current site and refreshes the status.
  function run() {
    if (!eng.active) return;
    scanPhotos();
    if (SITE === 'fb') { scanAria(); scanSidebar(); scanTIC(); }
    if (SITE === 'ig') {
      if (CFG.igThreadList) scanIGThreadList();
      if (CFG.igSuggested)  scanIGSuggested();
      if (CFG.igAccount)    scanIGAccount();
    }
    scanName();
    if (typeof eng.onRun === 'function') eng.onRun();
  }

  // Activates blur: runs the scans, then watches the DOM and rescans on a timer.
  function startBlur() {
    if (eng.active) return;
    eng.active = true;
    var pending = false;
    eng.obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; run(); }, 250);
    });
    eng.obs.observe(document.body, { childList: true, subtree: true });
    eng.timer = setInterval(run, CFG.rescanMs);
    run();
  }

  // Deactivates blur, restores every modified element, and clears cached identity.
  function stopBlur() {
    eng.active = false;
    if (eng.obs)   { eng.obs.disconnect();        eng.obs   = null; }
    if (eng.timer) { clearInterval(eng.timer);    eng.timer = null; }
    eng.onRun = null;
    document.querySelectorAll('[' + SF + ']').forEach(function (e) {
      e.style.filter  = e.getAttribute(SF); e.removeAttribute(SF);
    });
    document.querySelectorAll('[' + SD + ']').forEach(function (e) {
      e.style.display = e.getAttribute(SD); e.removeAttribute(SD);
    });
    eng.profileKey = null; eng.userName = null;
    eng.igUsername = null; eng.igName   = null;
    window.__mbEng = null;
  }

  // Creates an element with optional inline style and text content.
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css)      e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  // Removes every child of the given node.
  function clearNode(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  var win = document.createElement('div');
  win.id = '_mb_win';
  win.style.cssText = [
    'position:fixed', 'top:36px', 'right:36px', 'width:400px', 'max-height:85vh',
    'background:' + COLORS.bg, 'border:1px solid ' + COLORS.border,
    'border-radius:12px', 'overflow:hidden',
    'color:' + COLORS.text, 'font-family:' + SANS, 'font-size:12.5px',
    'z-index:2147483647', 'display:flex', 'flex-direction:column',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 30px 80px rgba(0,0,0,0.75),0 0 60px rgba(52,211,153,0.05)'
  ].join(';');

  var bar = document.createElement('div');
  bar.style.cssText = [
    'display:flex', 'align-items:center', 'justify-content:space-between',
    'padding:12px 16px', 'background:' + COLORS.bar,
    'cursor:grab', 'user-select:none', '-webkit-user-select:none',
    'flex-shrink:0', 'position:relative'
  ].join(';');

  var barAccent = document.createElement('div');
  barAccent.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:1px;overflow:hidden;' +
    'background:linear-gradient(to right,transparent,' + COLORS.accent + '55,transparent)';
  var shimmer = document.createElement('div');
  shimmer.style.cssText = 'position:absolute;top:0;left:-30%;width:30%;height:100%;' +
    'background:linear-gradient(to right,transparent,' + COLORS.accent + 'ff,transparent)';
  shimmer.animate([{ left: '-30%' }, { left: '100%' }],
    { duration: 3200, iterations: Infinity, easing: 'ease-in-out' });
  barAccent.appendChild(shimmer);
  bar.appendChild(barAccent);

  var titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'display:flex;align-items:center;gap:11px;min-width:0;flex:1';

  var dot = document.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + COLORS.accent +
    ';flex-shrink:0;box-shadow:0 0 10px ' + COLORS.accentGlow;
  var dotAnim = dot.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.45, transform: 'scale(0.78)' }],
    { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
  );

  var titleStack = document.createElement('div');
  titleStack.style.cssText = 'display:flex;flex-direction:column;min-width:0';

  var titleLabel = document.createElement('div');
  titleLabel.textContent = 'Meta Blur';
  titleLabel.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' +
    COLORS.textStrong + ';line-height:1.1';

  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent +
    ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = SITE === 'fb' ? 'facebook.com'
                       : SITE === 'ig' ? 'instagram.com'
                       : location.hostname;

  titleStack.appendChild(titleLabel);
  titleStack.appendChild(ctxBadge);
  titleWrap.appendChild(dot);
  titleWrap.appendChild(titleStack);

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.title = 'Close panel — blur stays active';
  closeBtn.style.cssText = 'background:none;border:none;color:' + COLORS.textMuted +
    ';font-size:22px;cursor:pointer;padding:2px 8px;line-height:1;font-family:inherit;' +
    'transition:all 0.12s;border-radius:5px';
  closeBtn.onmouseover = function () {
    closeBtn.style.color = COLORS.textStrong; closeBtn.style.background = 'rgba(255,255,255,0.05)';
  };
  closeBtn.onmouseout = function () {
    closeBtn.style.color = COLORS.textMuted; closeBtn.style.background = 'none';
  };
  closeBtn.onclick = function () { eng.onRun = null; win.remove(); };

  bar.appendChild(titleWrap);
  bar.appendChild(closeBtn);

  var tabStrip = document.createElement('div');
  tabStrip.style.cssText = 'display:flex;background:' + COLORS.bar + ';border-bottom:1px solid ' +
    COLORS.border + ';overflow-x:auto;scrollbar-width:none;flex-shrink:0;position:relative;padding:0 8px';

  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;padding:18px 20px;flex:1;min-height:0;background:' + COLORS.bg;

  win.appendChild(bar);
  win.appendChild(tabStrip);
  win.appendChild(body);

  var dx = 0, dy = 0, sx = 0, sy = 0;
  bar.onmousedown = function (e) {
    if (e.target === closeBtn) return;
    e.preventDefault();
    sx = e.clientX; sy = e.clientY;
    bar.style.cursor = 'grabbing';
    document.onmousemove = function (e) {
      dx = sx - e.clientX; dy = sy - e.clientY;
      sx = e.clientX; sy = e.clientY;
      win.style.top  = (win.offsetTop  - dy) + 'px';
      win.style.left = (win.offsetLeft - dx) + 'px';
      win.style.right = 'auto';
    };
    document.onmouseup = function () {
      document.onmousemove = null; document.onmouseup = null;
      bar.style.cursor = 'grab';
    };
  };

  document.body.appendChild(win);
  win.animate(
    [{ opacity: 0, transform: 'translateY(-12px) scale(0.97)' },
     { opacity: 1, transform: 'translateY(0) scale(1)' }],
    { duration: 260, easing: 'cubic-bezier(0.34,1.4,0.55,1)', fill: 'backwards' }
  );

  // Builds a section heading with the accent marker and a fading rule.
  function sectionTitle(text) {
    var wrap = el('div', 'padding:18px 0 8px 0;display:flex;align-items:center;gap:8px;' +
      'margin-bottom:4px;border-bottom:1px solid ' + COLORS.borderSoft);
    var marker = el('span', 'color:' + COLORS.accent + ';font-family:' + MONO +
      ';font-size:11px;font-weight:600', '▸');
    var label  = el('span', 'color:' + COLORS.text +
      ';font-size:11px;text-transform:uppercase;letter-spacing:1.4px;font-weight:600', text);
    var rule   = el('div', 'flex:1;height:1px;background:linear-gradient(to right,' +
      COLORS.borderSoft + ',transparent)');
    wrap.appendChild(marker); wrap.appendChild(label); wrap.appendChild(rule);
    return wrap;
  }

  // Builds a styled button; opts.primary inverts the colours.
  function btn(label, onClick, opts) {
    opts = opts || {};
    var b = el('button', [
      'background:'  + (opts.primary ? COLORS.textStrong : COLORS.surface),
      'color:'       + (opts.primary ? '#000' : COLORS.textStrong),
      'border:1px solid ' + (opts.primary ? COLORS.textStrong : COLORS.border),
      'border-radius:6px', 'padding:7px 14px', 'font-family:inherit',
      'font-size:11.5px', 'font-weight:600', 'cursor:pointer',
      'letter-spacing:0.2px', 'transition:all 0.12s'
    ].join(';'), label);
    b.onmouseover = function () {
      if (opts.primary) b.style.opacity = '0.85';
      else { b.style.borderColor = COLORS.textMuted; b.style.background = '#181820'; }
    };
    b.onmouseout = function () {
      if (opts.primary) b.style.opacity = '1';
      else { b.style.borderColor = COLORS.border; b.style.background = COLORS.surface; }
    };
    b.onclick = onClick;
    return b;
  }

  // Builds a labelled note banner with a coloured side rail.
  function noteBanner(variant, label, text) {
    var color = variant === 'anonymous' ? COLORS.accent : COLORS.warn;
    var wrap   = el('div', 'display:flex;gap:10px;padding:10px 12px;margin:0 0 12px;' +
      'border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface +
      ';border-radius:6px;border-left:3px solid ' + color);
    var lbl    = el('div', 'font-family:' + MONO + ';font-size:9.5px;font-weight:700;' +
      'letter-spacing:1.2px;text-transform:uppercase;color:' + color + ';flex-shrink:0;padding-top:1px', label);
    var bdy    = el('div', 'color:' + COLORS.text + ';font-size:11.5px;line-height:1.55;flex:1', text);
    wrap.appendChild(lbl); wrap.appendChild(bdy);
    return wrap;
  }

  var statusBadge = null;
  var blurCountEl = null;
  var toggleBtn   = null;

  // Syncs the status dot, badge, blurred-element count, and toggle label to the engine state.
  function refreshStatus() {
    var on = eng.active;
    dot.style.background  = on ? COLORS.accent  : COLORS.textDim;
    dot.style.boxShadow   = on ? '0 0 10px ' + COLORS.accentGlow : 'none';
    if (on) dotAnim.play(); else dotAnim.pause();

    if (statusBadge) {
      statusBadge.textContent  = on ? 'BLUR ACTIVE' : 'BLUR PAUSED';
      statusBadge.style.color  = on ? COLORS.accent : COLORS.textMuted;
      statusBadge.style.borderColor = on ? COLORS.accent : COLORS.border;
      statusBadge.style.background  = on ? COLORS.accentSoft : COLORS.surface;
    }
    if (blurCountEl) {
      var n = document.querySelectorAll('[' + SF + ']').length;
      blurCountEl.textContent = n + ' element' + (n !== 1 ? 's' : '') + ' currently blurred';
    }
    if (toggleBtn) {
      toggleBtn.textContent = on ? 'Pause blur' : 'Resume blur';
    }
  }

  var TABS = [
    { id: 'blur',   label: 'Blur',   render: renderBlur   },
    { id: 'config', label: 'Config', render: renderConfig  }
  ];
  var activeTab  = TABS[0].id;
  var tabButtons = {};

  var tabIndicator = el('div',
    'position:absolute;bottom:0;height:2px;background:' + COLORS.accent +
    ';box-shadow:0 0 10px ' + COLORS.accentGlow +
    ';transition:left 0.22s cubic-bezier(0.4,0,0.2,1),width 0.22s cubic-bezier(0.4,0,0.2,1)' +
    ';pointer-events:none;border-radius:2px');
  tabStrip.appendChild(tabIndicator);

  for (var ti = 0; ti < TABS.length; ti++) {
    (function (tab) {
      var b = el('button', [
        'background:none', 'border:none', 'color:' + COLORS.textMuted,
        'padding:12px 14px', 'font-family:inherit', 'font-size:11.5px', 'font-weight:600',
        'cursor:pointer', 'letter-spacing:0.3px', 'white-space:nowrap',
        'transition:color 0.15s', 'position:relative'
      ].join(';'), tab.label);
      b.onmouseover = function () { if (activeTab !== tab.id) b.style.color = COLORS.text; };
      b.onmouseout  = function () { if (activeTab !== tab.id) b.style.color = COLORS.textMuted; };
      b.onclick = function () { switchTab(tab.id); };
      tabButtons[tab.id] = b;
      tabStrip.appendChild(b);
    })(TABS[ti]);
  }

  // Slides the tab underline to align with the given tab button.
  function moveIndicator(toBtn) {
    if (!toBtn) return;
    tabIndicator.style.left  = toBtn.offsetLeft  + 'px';
    tabIndicator.style.width = toBtn.offsetWidth + 'px';
  }

  // Activates a tab, re-renders the body, and animates the indicator.
  function switchTab(id) {
    activeTab = id;
    for (var k in tabButtons) {
      tabButtons[k].style.color = k === id ? COLORS.textStrong : COLORS.textMuted;
    }
    clearNode(body);
    body.scrollTop = 0;
    for (var j = 0; j < TABS.length; j++) if (TABS[j].id === id) { TABS[j].render(body); break; }
    requestAnimationFrame(function () { moveIndicator(tabButtons[id]); });
    body.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, easing: 'cubic-bezier(0.2,0,0,1)', fill: 'backwards' }
    );
  }

  // Renders the Blur tab: status, controls, and the active-protections list.
  function renderBlur(container) {

    if (!SITE) {
      container.appendChild(noteBanner('warn', 'Unsupported site',
        'Meta Blur works on facebook.com and instagram.com. Navigate to one of those sites and click the bookmarklet again.'));
      return;
    }

    statusBadge = el('div', [
      'display:inline-flex', 'align-items:center', 'gap:8px',
      'padding:5px 14px', 'border-radius:99px', 'margin-bottom:16px',
      'font-family:' + MONO, 'font-size:11px', 'font-weight:700', 'letter-spacing:1.4px',
      'border:1px solid', 'transition:all 0.25s'
    ].join(';'));

    container.appendChild(statusBadge);

    var ctrlRow = el('div', 'display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap');

    toggleBtn = btn('', function () {
      if (eng.active) stopBlur(); else startBlur();
      refreshStatus();
    }, { primary: true });

    var stopClose = btn('Turn off & close', function () {
      stopBlur();
      win.remove();
    });

    ctrlRow.appendChild(toggleBtn);
    ctrlRow.appendChild(stopClose);
    container.appendChild(ctrlRow);

    blurCountEl = el('div',
      'color:' + COLORS.textMuted + ';font-size:11px;font-family:' + MONO +
      ';margin-bottom:18px;letter-spacing:0.2px');
    container.appendChild(blurCountEl);

    refreshStatus();

    container.appendChild(sectionTitle('Active protections'));

    var protections = [
      { label: 'Profile photo',
        desc:  'Blurs your avatar in every img, SVG image, and CSS background on the page.' }
    ];

    if (CFG.blurName) {
      protections.push({ label: 'Name / username',
        desc: 'Blurs text nodes that exactly match your display name or handle.' });
    }

    if (SITE === 'fb') {
      protections.push(
        { label: 'Post composer',
          desc: 'Blurs the "What\'s on your mind?" input so your name in the placeholder is hidden.' },
        { label: 'Nav sidebar (first item)',
          desc: 'Blurs the name-linked first entry in the Facebook left-hand navigation.' },
        { label: '"Things in Common"',
          desc: 'Blurs (or hides) the social-graph card that exposes mutual connections.' }
      );
    }

    if (SITE === 'ig') {
      if (CFG.igThreadList) protections.push(
        { label: 'DM thread list',
          desc: 'Blurs the entire Direct Messages sidebar.' });
      if (CFG.igSuggested) protections.push(
        { label: 'Suggested accounts',
          desc: 'Blurs the "Suggested for you" section.' });
      if (CFG.igAccount) protections.push(
        { label: 'Account switcher',
          desc: 'Blurs the account-switcher card that shows your avatar and handle.' });
    }

    for (var i = 0; i < protections.length; i++) {
      var pRow = el('div',
        'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft +
        ';display:flex;gap:10px;align-items:flex-start');
      var tick = el('span',
        'color:' + COLORS.accent + ';font-family:' + MONO + ';font-size:12px;flex-shrink:0;margin-top:1px',
        '✓');
      var info = el('div', 'flex:1;min-width:0');
      info.appendChild(el('div',
        'font-size:12px;font-weight:600;color:' + COLORS.textStrong, protections[i].label));
      info.appendChild(el('div',
        'font-size:10.5px;color:' + COLORS.textMuted + ';margin-top:2px;line-height:1.45',
        protections[i].desc));
      pRow.appendChild(tick); pRow.appendChild(info);
      container.appendChild(pRow);
    }

    container.appendChild(sectionTitle('Evidence capture'));
    container.appendChild(noteBanner('anonymous', 'Clean screenshots',
      'Closing this panel keeps blur running — take screenshots freely with your identity hidden. ' +
      'Click the bookmarklet again to reopen the panel. Use "Turn off & close" to restore the page.'));
  }

  // Renders the Config tab: blur strength, rescan interval, and region toggles.
  function renderConfig(container) {
    container.appendChild(sectionTitle('Blur options'));

    var bsRow = el('div',
      'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft +
      ';display:flex;gap:12px;align-items:center');
    var bsLbl = el('span',
      'color:' + COLORS.textMuted + ';min-width:130px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px',
      'Min blur (px)');
    var bsInput = el('input',
      'width:64px;background:' + COLORS.surface + ';border:1px solid ' + COLORS.border +
      ';color:' + COLORS.textStrong + ';font-family:' + MONO + ';font-size:12px;' +
      'padding:5px 8px;border-radius:6px;outline:none');
    bsInput.type = 'number'; bsInput.min = '4'; bsInput.max = '120';
    bsInput.value = String(CFG.blurPx);
    bsInput.onfocus = function () { bsInput.style.borderColor = COLORS.accent; };
    bsInput.onblur  = function () { bsInput.style.borderColor = COLORS.border; };
    bsInput.oninput = function () {
      var v = parseInt(bsInput.value, 10);
      if (isFinite(v) && v >= 4) CFG.blurPx = v;
    };
    bsRow.appendChild(bsLbl); bsRow.appendChild(bsInput);
    container.appendChild(bsRow);

    var riRow = el('div',
      'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft +
      ';display:flex;gap:12px;align-items:center');
    var riLbl = el('span',
      'color:' + COLORS.textMuted + ';min-width:130px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px',
      'Rescan interval (ms)');
    var riInput = el('input',
      'width:80px;background:' + COLORS.surface + ';border:1px solid ' + COLORS.border +
      ';color:' + COLORS.textStrong + ';font-family:' + MONO + ';font-size:12px;' +
      'padding:5px 8px;border-radius:6px;outline:none');
    riInput.type = 'number'; riInput.min = '500'; riInput.max = '10000';
    riInput.value = String(CFG.rescanMs);
    riInput.onfocus = function () { riInput.style.borderColor = COLORS.accent; };
    riInput.onblur  = function () { riInput.style.borderColor = COLORS.border; };
    riInput.oninput = function () {
      var v = parseInt(riInput.value, 10);
      if (isFinite(v) && v >= 500) {
        CFG.rescanMs = v;
        if (eng.timer) { clearInterval(eng.timer); eng.timer = setInterval(run, CFG.rescanMs); }
      }
    };
    riRow.appendChild(riLbl); riRow.appendChild(riInput);
    container.appendChild(riRow);

    container.appendChild(sectionTitle('Regions'));

    var toggleDefs = [
      { key: 'blurName',     label: 'Name / username',
        desc: 'Blur text nodes matching your display name or handle.' }
    ];
    if (SITE === 'ig') {
      toggleDefs.push(
        { key: 'igThreadList', label: 'IG — DM thread list',
          desc: 'Blur the entire Direct Messages sidebar.' },
        { key: 'igSuggested',  label: 'IG — Suggested accounts',
          desc: 'Blur the "Suggested for you" section.' },
        { key: 'igAccount',    label: 'IG — Account switcher',
          desc: 'Blur the account-switcher card.' }
      );
    }

    for (var i = 0; i < toggleDefs.length; i++) {
      (function (def) {
        var tRow = el('div',
          'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft +
          ';display:flex;gap:10px;align-items:center');
        var tLbl = el('div', 'flex:1;min-width:0');
        tLbl.appendChild(el('div', 'font-size:12px;font-weight:600;color:' + COLORS.textStrong, def.label));
        tLbl.appendChild(el('div',
          'font-size:10.5px;color:' + COLORS.textMuted + ';margin-top:2px;line-height:1.4', def.desc));
        var ck = el('input');
        ck.type = 'checkbox'; ck.checked = !!CFG[def.key];
        ck.style.cssText = 'width:16px;height:16px;flex-shrink:0;cursor:pointer;accent-color:' + COLORS.accent;
        ck.onchange = function () {
          CFG[def.key] = ck.checked;
          if (eng.active) run();
        };
        tRow.appendChild(tLbl); tRow.appendChild(ck);
        container.appendChild(tRow);
      })(toggleDefs[i]);
    }

    if (SITE === 'fb') {
      container.appendChild(sectionTitle('Facebook'));
      var ticRow = el('div',
        'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft +
        ';display:flex;gap:12px;align-items:center');
      var ticLbl = el('div', 'flex:1;min-width:0');
      ticLbl.appendChild(el('div', 'font-size:12px;font-weight:600;color:' + COLORS.textStrong,
        '"Things in Common"'));
      ticLbl.appendChild(el('div',
        'font-size:10.5px;color:' + COLORS.textMuted + ';margin-top:2px;line-height:1.4',
        'Blur the card or remove it from the DOM entirely.'));
      var ticSel = el('select',
        'background:' + COLORS.surface + ';border:1px solid ' + COLORS.border +
        ';color:' + COLORS.textStrong + ';font-family:' + MONO +
        ';font-size:11px;padding:4px 8px;border-radius:6px;outline:none;cursor:pointer;flex-shrink:0');
      var optBlur = el('option', null, 'Blur');  optBlur.value  = 'blur';
      var optHide = el('option', null, 'Remove'); optHide.value = 'remove';
      if (CFG.ticMode === 'remove') optHide.selected = true; else optBlur.selected = true;
      ticSel.appendChild(optBlur); ticSel.appendChild(optHide);
      ticSel.onchange = function () { CFG.ticMode = ticSel.value; if (eng.active) run(); };
      ticRow.appendChild(ticLbl); ticRow.appendChild(ticSel);
      container.appendChild(ticRow);
    }
  }

  eng.onRun = refreshStatus;

  switchTab(activeTab);
  startBlur();

})();
