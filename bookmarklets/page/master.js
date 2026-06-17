// title: "Page Forensics Console"
// description: "Works on any page. One console for the general-purpose utilities: every image (including CSS backgrounds and srcset), a full meta/OpenGraph/JSON-LD dump, cookies + local/session storage, word-frequency and non-destructive find-on-page highlighting, plus document.lastModified and one-click Wayback save/lookup."
(function() {

  var existing = document.getElementById('_osint_win');
  if (existing) existing.remove();

  var COLORS = {
    bg: '#08080b',
    surface: '#101015',
    surfaceHi: '#16161d',
    bar: '#000',
    border: '#26262e',
    borderSoft: '#181820',
    text: '#e8e8ec',
    textStrong: '#ffffff',
    textMuted: '#8e8e96',
    textDim: '#5a5a62',
    textFaint: '#2a2a32',
    accent: '#34d399',
    accentGlow: 'rgba(52,211,153,0.45)',
    amber: '#fbbf24',
    danger: '#ef4444'
  };
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Fira Mono",Consolas,monospace';

    var TITLE = 'Page Forensics Console';
  var CTX_BADGE = window.location.hostname || 'local page';
  var WRONG_PAGE = null;

  var TABS_DEF = [
    { id: 'images',  label: 'Images',  render: renderImages },
    { id: 'meta',    label: 'Meta',    render: renderMeta },
    { id: 'storage', label: 'Storage', render: renderStorage },
    { id: 'text',    label: 'Text',    render: renderText },
    { id: 'page',    label: 'Page',    render: renderPage }
  ];


  var win = document.createElement('div');
  win.id = '_osint_win';
  win.style.cssText = [
    'position:fixed', 'top:36px', 'right:36px', 'width:520px', 'max-height:85vh',
    'background:' + COLORS.bg, 'border:1px solid ' + COLORS.border,
    'border-radius:12px', 'overflow:hidden',
    'color:' + COLORS.text, 'font-family:' + SANS, 'font-size:12.5px',
    'z-index:2147483647', 'display:flex', 'flex-direction:column',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.5), 0 30px 80px rgba(0,0,0,0.75), 0 0 60px rgba(52,211,153,0.05)'
  ].join(';');

  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:' + COLORS.bar + ';cursor:grab;user-select:none;-webkit-user-select:none;flex-shrink:0;position:relative';

  var barAccent = document.createElement('div');
  barAccent.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:1px;overflow:hidden;background:linear-gradient(to right, transparent, ' + COLORS.accent + '55, transparent)';
  var shimmer = document.createElement('div');
  shimmer.style.cssText = 'position:absolute;top:0;left:-30%;width:30%;height:100%;background:linear-gradient(to right, transparent, ' + COLORS.accent + 'ff, transparent)';
  shimmer.animate([{ left: '-30%' }, { left: '100%' }], { duration: 3200, iterations: Infinity, easing: 'ease-in-out' });
  barAccent.appendChild(shimmer);
  bar.appendChild(barAccent);

  var titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'display:flex;align-items:center;gap:11px;min-width:0;flex:1';
  var dot = document.createElement('span');
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + COLORS.accent + ';flex-shrink:0;box-shadow:0 0 10px ' + COLORS.accentGlow;
  dot.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.45, transform: 'scale(0.78)' }],
    { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
  );
  var titleStack = document.createElement('div');
  titleStack.style.cssText = 'display:flex;flex-direction:column;min-width:0';
  var titleEl = document.createElement('div');
  titleEl.textContent = TITLE;
  titleEl.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' + COLORS.textStrong + ';line-height:1.1';
  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = CTX_BADGE;
  titleStack.appendChild(titleEl);
  titleStack.appendChild(ctxBadge);
  titleWrap.appendChild(dot); titleWrap.appendChild(titleStack);

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '\u00d7';
  closeBtn.title = 'Close';
  closeBtn.style.cssText = 'background:none;border:none;color:' + COLORS.textMuted + ';font-size:22px;cursor:pointer;padding:2px 8px;line-height:1;font-family:inherit;transition:all 0.12s;border-radius:5px';
  closeBtn.onmouseover = function() { closeBtn.style.color = COLORS.textStrong; closeBtn.style.background = 'rgba(255,255,255,0.05)'; };
  closeBtn.onmouseout = function() { closeBtn.style.color = COLORS.textMuted; closeBtn.style.background = 'none'; };
  closeBtn.onclick = function() { win.remove(); };

  bar.appendChild(titleWrap);
  bar.appendChild(closeBtn);

  var tabStrip = document.createElement('div');
  tabStrip.style.cssText = 'display:flex;background:' + COLORS.bar + ';border-bottom:1px solid ' + COLORS.border + ';overflow-x:auto;scrollbar-width:none;flex-shrink:0;position:relative;padding:0 8px';

  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;padding:18px 20px;flex:1;min-height:0;background:' + COLORS.bg;

  win.appendChild(bar); win.appendChild(tabStrip); win.appendChild(body);

  var dragDX = 0, dragDY = 0, dragSX = 0, dragSY = 0;
  bar.onmousedown = function(e) {
    if (e.target === closeBtn) return;
    e.preventDefault();
    dragSX = e.clientX; dragSY = e.clientY;
    bar.style.cursor = 'grabbing';
    document.onmousemove = function(e) {
      dragDX = dragSX - e.clientX; dragDY = dragSY - e.clientY;
      dragSX = e.clientX; dragSY = e.clientY;
      win.style.top = (win.offsetTop - dragDY) + 'px';
      win.style.left = (win.offsetLeft - dragDX) + 'px';
      win.style.right = 'auto';
    };
    document.onmouseup = function() {
      document.onmousemove = null; document.onmouseup = null;
      bar.style.cursor = 'grab';
    };
  };

  document.body.appendChild(win);
  win.animate(
    [{ opacity: 0, transform: 'translateY(-12px) scale(0.97)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }],
    { duration: 260, easing: 'cubic-bezier(0.34, 1.4, 0.55, 1)', fill: 'backwards' }
  );

  // Creates an element with optional inline style and text content.
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  // Removes every child of the given node.
  function clearNode(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  // Builds a label/value row, with optional copy-on-click and mono font.
  function row(label, value, opts) {
    opts = opts || {};
    var div = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:12px;align-items:baseline');
    var lbl = el('span', 'color:' + COLORS.textMuted + ';min-width:104px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', label);
    var val = el('span', 'color:' + COLORS.textStrong + ';font-weight:500;word-break:break-word;flex:1;font-size:12.5px' + (opts.mono ? ';font-family:' + MONO + ';font-size:12px' : ''));
    val.textContent = value == null || value === '' ? '\u2014' : String(value);
    if (opts.copy && value) {
      val.style.cursor = 'pointer';
      val.title = 'Click to copy';
      val.onclick = function() { copyText(String(value), val); };
    }
    div.appendChild(lbl); div.appendChild(val);
    return div;
  }

  // Writes text to the clipboard, briefly flashing "copied" on the hint element.
  function copyText(text, hint) {
    try {
      navigator.clipboard.writeText(text);
      if (hint) {
        var orig = hint.textContent;
        hint.textContent = 'copied';
        hint.style.color = COLORS.accent;
        setTimeout(function() { hint.textContent = orig; hint.style.color = COLORS.textStrong; }, 900);
      }
    } catch (e) {}
  }

  // Builds a section heading with the accent marker and a fading rule.
  function sectionTitle(text) {
    var wrap = el('div', 'padding:18px 0 8px 0;display:flex;align-items:center;gap:8px;margin-bottom:4px;border-bottom:1px solid ' + COLORS.borderSoft);
    var marker = el('span', 'color:' + COLORS.accent + ';font-family:' + MONO + ';font-size:11px;font-weight:600', '\u25b8');
    var label = el('span', 'color:' + COLORS.text + ';font-size:11px;text-transform:uppercase;letter-spacing:1.4px;font-weight:600', text);
    var rule = el('div', 'flex:1;height:1px;background:linear-gradient(to right, ' + COLORS.borderSoft + ', transparent)');
    wrap.appendChild(marker); wrap.appendChild(label); wrap.appendChild(rule);
    return wrap;
  }

  // Builds a styled button; opts.primary inverts the colours.
  function btn(label, onClick, opts) {
    opts = opts || {};
    var b = el('button', [
      'background:' + (opts.primary ? COLORS.textStrong : COLORS.surface),
      'color:' + (opts.primary ? '#000' : COLORS.textStrong),
      'border:1px solid ' + (opts.primary ? COLORS.textStrong : COLORS.border),
      'border-radius:6px',
      'padding:7px 14px', 'font-family:inherit', 'font-size:11.5px', 'font-weight:600',
      'cursor:pointer', 'letter-spacing:0.2px', 'transition:all 0.12s'
    ].join(';'), label);
    b.onmouseover = function() {
      if (opts.primary) b.style.opacity = '0.85';
      else { b.style.borderColor = COLORS.textMuted; b.style.background = '#181820'; }
    };
    b.onmouseout = function() {
      if (opts.primary) b.style.opacity = '1';
      else { b.style.borderColor = COLORS.border; b.style.background = COLORS.surface; }
    };
    b.onclick = onClick;
    return b;
  }

  // Builds a status box; isError turns the text red.
  function statusBox(text, isError) {
    return el('div', 'color:' + (isError ? COLORS.danger : COLORS.text) + ';font-size:11.5px;line-height:1.55;padding:11px 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px', text);
  }

  // Builds a labelled note banner with a coloured side rail; variant is 'login' (amber) or 'anonymous' (green).
  function noteBanner(variant, label, bodyText) {
    var color = variant === 'anonymous' ? COLORS.accent : COLORS.amber;
    var wrap = el('div', 'display:flex;gap:10px;padding:10px 12px;margin:0 0 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px;border-left:3px solid ' + color);
    var labelEl = el('div', 'font-family:' + MONO + ';font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + color + ';flex-shrink:0;padding-top:1px', label);
    var bodyEl = el('div', 'color:' + COLORS.text + ';font-size:11.5px;line-height:1.55;flex:1', bodyText);
    wrap.appendChild(labelEl); wrap.appendChild(bodyEl);
    return wrap;
  }

  // Builds a hover-lift pivot card linking out to another tool/site.
  function pivotCard(name, desc, url) {
    var card = el('a', [
      'display:flex', 'align-items:center', 'justify-content:space-between', 'gap:10px',
      'padding:14px 16px', 'margin-top:8px', 'border:1px solid ' + COLORS.border,
      'background:' + COLORS.surface, 'border-radius:8px',
      'color:' + COLORS.textStrong, 'text-decoration:none',
      'transition:transform 0.16s ease-out, border-color 0.16s, background 0.16s, box-shadow 0.16s'
    ].join(';'));
    card.href = url; card.target = '_blank'; card.rel = 'noopener noreferrer';
    var info = el('div', 'flex:1;min-width:0');
    info.appendChild(el('div', 'font-size:13px;font-weight:600;letter-spacing:0.1px', name));
    if (desc) info.appendChild(el('div', 'font-size:11px;color:' + COLORS.textMuted + ';margin-top:4px;line-height:1.4', desc));
    card.appendChild(info);
    var arrow = el('span', 'color:' + COLORS.textDim + ';font-size:16px;flex-shrink:0;transition:transform 0.16s, color 0.16s', '\u2192');
    card.appendChild(arrow);
    card.onmouseover = function() {
      card.style.borderColor = COLORS.accent;
      card.style.background = COLORS.surfaceHi;
      card.style.transform = 'translateY(-2px)';
      card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4), 0 0 24px ' + COLORS.accentGlow;
      arrow.style.color = COLORS.accent;
      arrow.style.transform = 'translateX(4px)';
    };
    card.onmouseout = function() {
      card.style.borderColor = COLORS.border;
      card.style.background = COLORS.surface;
      card.style.transform = 'translateY(0)';
      card.style.boxShadow = 'none';
      arrow.style.color = COLORS.textDim;
      arrow.style.transform = 'translateX(0)';
    };
    return card;
  }

  // Appends a list of {name,desc,url} pivots as staggered hover-lift cards.
  function pivotList(container, pivots) {
    var cards = [];
    for (var i = 0; i < pivots.length; i++) {
      var c = pivotCard(pivots[i].name, pivots[i].desc, pivots[i].url);
      container.appendChild(c); cards.push(c);
    }
    stagger(cards, 55, 60);
    return cards;
  }

  // Builds an animated mint spinner with an optional caption.
  function spinner(caption) {
    var wrap = el('div', 'padding:34px 0;display:flex;flex-direction:column;align-items:center;gap:14px');
    var ring = el('div', 'width:30px;height:30px;border:2.5px solid ' + COLORS.border + ';border-top-color:' + COLORS.accent + ';border-radius:50%');
    ring.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 800, iterations: Infinity, easing: 'linear' });
    wrap.appendChild(ring);
    if (caption) wrap.appendChild(el('div', 'color:' + COLORS.textMuted + ';font-size:11.5px;text-align:center', caption));
    return wrap;
  }

  // Fades and slides a node into view after the given delay.
  function animateIn(node, delay) {
    if (!node || !node.animate) return;
    try {
      node.animate(
        [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 280, delay: delay || 0, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' }
      );
    } catch (_) {}
  }

  // Runs animateIn on a list of nodes, offsetting each by step ms.
  function stagger(nodes, step, baseDelay) {
    step = step || 50; baseDelay = baseDelay || 0;
    for (var i = 0; i < nodes.length; i++) animateIn(nodes[i], baseDelay + i * step);
  }

  // Formats a date as YYYY-MM-DD HH:MM:SS Z (UTC).
  function fmtDateShort(d) {
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var day = String(d.getUTCDate()).padStart(2, '0');
    var hh = String(d.getUTCHours()).padStart(2, '0');
    var mm = String(d.getUTCMinutes()).padStart(2, '0');
    var ss = String(d.getUTCSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm + ':' + ss + 'Z';
  }

  // Formats a date in the user's local timezone with the abbreviation.
  function fmtLocal(d) {
    return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
  }

  // Returns a human-friendly relative time string for the given date.
  function timeAgo(d) {
    var diff = Date.now() - d.getTime();
    var future = diff < 0;
    diff = Math.abs(diff);
    var days = Math.floor(diff / 86400000);
    var hrs = Math.floor(diff / 3600000);
    var mins = Math.floor(diff / 60000);
    var s;
    if (days > 730) s = Math.floor(days / 365) + 'y';
    else if (days > 60) s = Math.floor(days / 30) + 'mo';
    else if (days > 0) s = days + 'd';
    else if (hrs > 0) s = hrs + 'h';
    else s = mins + 'm';
    return future ? 'in ' + s : s + ' ago';
  }

  var TABS = TABS_DEF;

  if (typeof WRONG_PAGE !== 'undefined' && WRONG_PAGE) {
    body.appendChild(sectionTitle('Wrong page'));
    body.appendChild(statusBox(WRONG_PAGE, true));
    return;
  }

  var activeTab = TABS[0].id;
  var tabButtons = {};

  var tabIndicator = el('div', 'position:absolute;bottom:0;height:2px;background:' + COLORS.accent + ';box-shadow:0 0 10px ' + COLORS.accentGlow + ';transition:left 0.22s cubic-bezier(0.4,0,0.2,1),width 0.22s cubic-bezier(0.4,0,0.2,1);pointer-events:none;border-radius:2px');
  tabStrip.appendChild(tabIndicator);

  for (var ti = 0; ti < TABS.length; ti++) {
    (function(tab) {
      var b = el('button', [
        'background:none', 'border:none',
        'color:' + COLORS.textMuted, 'padding:12px 14px', 'font-family:inherit',
        'font-size:11.5px', 'font-weight:600', 'cursor:pointer', 'letter-spacing:0.3px',
        'white-space:nowrap', 'transition:color 0.15s', 'position:relative'
      ].join(';'), tab.label);
      b.onmouseover = function() { if (activeTab !== tab.id) b.style.color = COLORS.text; };
      b.onmouseout = function() { if (activeTab !== tab.id) b.style.color = COLORS.textMuted; };
      b.onclick = function() { switchTab(tab.id); };
      tabButtons[tab.id] = b;
      tabStrip.appendChild(b);
    })(TABS[ti]);
  }

  // Slides the tab underline to align with the given tab button.
  function moveIndicator(toBtn) {
    if (!toBtn) return;
    tabIndicator.style.left = toBtn.offsetLeft + 'px';
    tabIndicator.style.width = toBtn.offsetWidth + 'px';
  }

  // Activates the tab with the given id, re-renders the body, and animates the indicator.
  function switchTab(id) {
    activeTab = id;
    for (var k in tabButtons) {
      tabButtons[k].style.color = (k === id) ? COLORS.textStrong : COLORS.textMuted;
    }
    clearNode(body);
    body.scrollTop = 0;
    for (var j = 0; j < TABS.length; j++) if (TABS[j].id === id) { TABS[j].render(body); break; }
    requestAnimationFrame(function() { moveIndicator(tabButtons[id]); });
    body.animate(
      [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
      { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' }
    );
  }
  switchTab(activeTab);

  // Gathers unique image URLs from img/srcset/source and CSS background-image.
  function collectImages() {
    var set = {}, out = [];
    // Normalizes a URL and adds it to the dedup set.
    function add(u) {
      if (!u) return;
      u = ('' + u).trim();
      if (!u || u.indexOf('data:') === 0) return;
      try { u = new URL(u, location.href).href; } catch (e) {}
      if (!set[u]) { set[u] = 1; out.push(u); }
    }
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      add(imgs[i].currentSrc || imgs[i].src);
      var ss = imgs[i].getAttribute('srcset');
      if (ss) ss.split(',').forEach(function(p) { add(p.trim().split(/\s+/)[0]); });
    }
    var srcEls = document.querySelectorAll('source[srcset]');
    for (var j = 0; j < srcEls.length; j++) {
      (srcEls[j].getAttribute('srcset') || '').split(',').forEach(function(p) { add(p.trim().split(/\s+/)[0]); });
    }
    var all = document.querySelectorAll('*');
    for (var k = 0; k < all.length && k < 4000; k++) {
      var bg = getComputedStyle(all[k]).backgroundImage;
      if (bg && bg !== 'none') {
        var matches = bg.match(/url\((['"]?)(.*?)\1\)/g);
        if (matches) matches.forEach(function(x) { var mm = x.match(/url\((['"]?)(.*?)\1\)/); if (mm) add(mm[2]); });
      }
    }
    return out;
  }

  // Renders the Images tab.
  function renderImages(container) {
    var imgs = collectImages();
    container.appendChild(sectionTitle('Images on page'));
    container.appendChild(row('Found', String(imgs.length), { mono: true }));
    if (!imgs.length) { container.appendChild(statusBox('No images detected.', false)); return; }
    var actions = el('div', 'display:flex;gap:8px;flex-wrap:wrap;padding:4px 0 8px 0');
    actions.appendChild(btn('Copy all URLs', function() { copyText(imgs.join('\n')); }, { primary: true }));
    container.appendChild(actions);
    var nodes = [];
    for (var i = 0; i < imgs.length && i < 80; i++) {
      (function(u) {
        var r = el('div', 'display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid ' + COLORS.borderSoft);
        var t = el('img', 'width:52px;height:52px;object-fit:cover;border-radius:5px;border:1px solid ' + COLORS.border + ';background:#000;flex-shrink:0;cursor:pointer');
        t.referrerPolicy = 'no-referrer'; t.src = u;
        t.onclick = function() { window.open(u, '_blank'); };
        t.onerror = function() { t.style.visibility = 'hidden'; };
        var info = el('div', 'flex:1;min-width:0');
        info.appendChild(el('div', 'font-family:' + MONO + ';font-size:10px;color:' + COLORS.textMuted + ';word-break:break-all', u));
        var bb = el('div', 'display:flex;gap:6px;margin-top:5px');
        bb.appendChild(btn('Open', function() { window.open(u, '_blank'); }));
        bb.appendChild(btn('Copy', function() { copyText(u); }));
        info.appendChild(bb);
        r.appendChild(t); r.appendChild(info);
        container.appendChild(r); nodes.push(r);
      })(imgs[i]);
    }
    if (imgs.length > 80) container.appendChild(el('div', 'padding:8px 0;color:' + COLORS.textDim + ';font-size:11px', 'Showing first 80 of ' + imgs.length + '. Use "Copy all URLs" for the full set.'));
    stagger(nodes, 12, 30);
  }

  // Collects meta tags as [key, value] pairs.
  function collectMeta() {
    var out = [];
    var metas = document.querySelectorAll('meta');
    for (var i = 0; i < metas.length; i++) {
      var m = metas[i];
      var key = m.getAttribute('property') || m.getAttribute('name') || m.getAttribute('http-equiv') || (m.getAttribute('charset') ? 'charset' : null);
      var val = m.getAttribute('content') || m.getAttribute('charset') || '';
      if (key) out.push([key, val]);
    }
    return out;
  }

  // Renders the Meta tab.
  function renderMeta(container) {
    container.appendChild(sectionTitle('Document'));
    container.appendChild(row('Title', document.title || '\u2014', { copy: !!document.title }));
    var can = document.querySelector('link[rel="canonical"]');
    if (can) container.appendChild(row('Canonical', can.href, { copy: true, mono: true }));
    var desc = document.querySelector('meta[name="description"]');
    if (desc) container.appendChild(row('Description', desc.getAttribute('content') || '\u2014', { copy: true }));

    container.appendChild(sectionTitle('Meta tags'));
    var metas = collectMeta();
    if (metas.length) { for (var i = 0; i < metas.length; i++) container.appendChild(row(metas[i][0], metas[i][1] || '\u2014', { copy: !!metas[i][1] })); }
    else container.appendChild(statusBox('No meta tags found.', false));

    var ld = document.querySelectorAll('script[type="application/ld+json"]');
    if (ld.length) {
      container.appendChild(sectionTitle('JSON-LD (' + ld.length + ')'));
      for (var k = 0; k < ld.length; k++) {
        (function(node, idx) {
          var bb = el('div', 'display:flex;gap:8px;padding:6px 0;align-items:center');
          bb.appendChild(el('span', 'color:' + COLORS.textMuted + ';font-size:11px;flex:1', 'Block #' + (idx + 1)));
          bb.appendChild(btn('Copy', function() { copyText(node.textContent || ''); }));
          bb.appendChild(btn('Log', function() { try { console.log('JSON-LD #' + (idx + 1), JSON.parse(node.textContent)); } catch (e) { console.log(node.textContent); } }));
          container.appendChild(bb);
        })(ld[k], k);
      }
    }
  }

  // Parses document.cookie into [name, value] pairs.
  function getCookies() {
    return (document.cookie || '').split(';').map(function(s) { return s.trim(); }).filter(Boolean).map(function(s) { var i = s.indexOf('='); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)]; });
  }

  // Dumps a Storage object into [key, value] pairs.
  function dumpStorage(store) {
    var out = [];
    try { for (var i = 0; i < store.length; i++) { var k = store.key(i); out.push([k, store.getItem(k)]); } } catch (e) {}
    return out;
  }

  // Builds a truncating key/value row with copy-full.
  function kvRow(k, v) {
    var div = el('div', 'padding:8px 0;border-bottom:1px solid ' + COLORS.borderSoft);
    var top = el('div', 'display:flex;justify-content:space-between;gap:10px;align-items:baseline');
    top.appendChild(el('span', 'color:' + COLORS.accent + ';font-family:' + MONO + ';font-size:11px;word-break:break-all', k));
    var cp = el('span', 'color:' + COLORS.textDim + ';font-size:10px;cursor:pointer;font-family:' + MONO + ';flex-shrink:0', 'copy');
    cp.onclick = function() { copyText(v == null ? '' : String(v), cp); };
    top.appendChild(cp);
    div.appendChild(top);
    var val = (v == null) ? '' : String(v);
    div.appendChild(el('div', 'color:' + COLORS.textMuted + ';font-family:' + MONO + ';font-size:10.5px;word-break:break-all;margin-top:3px', val.length > 160 ? val.slice(0, 160) + '\u2026' : val));
    return div;
  }

  // Renders a storage section with a heading and rows.
  function storageSection(container, title, pairs) {
    container.appendChild(sectionTitle(title + ' (' + pairs.length + ')'));
    if (!pairs.length) { container.appendChild(el('div', 'padding:6px 0;color:' + COLORS.textDim + ';font-size:11px', 'empty')); return; }
    for (var i = 0; i < pairs.length; i++) container.appendChild(kvRow(pairs[i][0], pairs[i][1]));
  }

  // Renders the Storage tab.
  function renderStorage(container) {
    container.appendChild(noteBanner('login', 'Local only', 'Reads cookies and web storage already set in your browser for this origin. Nothing is sent anywhere.'));
    storageSection(container, 'Cookies', getCookies());
    storageSection(container, 'localStorage', dumpStorage(window.localStorage));
    storageSection(container, 'sessionStorage', dumpStorage(window.sessionStorage));
  }

  var _hlStyleAdded = false;
  // Injects the highlight style once (style textContent is Trusted-Types-safe).
  function ensureHlStyle() {
    if (_hlStyleAdded) return;
    var st = document.createElement('style');
    st.textContent = '::highlight(osint-find){background:' + COLORS.accent + '55;color:inherit;}';
    document.head.appendChild(st);
    _hlStyleAdded = true;
  }

  // Highlights all occurrences of a term using the Custom Highlight API (non-destructive).
  function runFind(term, out) {
    clearNode(out);
    if (!term) { out.appendChild(statusBox('Enter a search term.', true)); return; }
    if (!(window.CSS && CSS.highlights && window.Highlight)) {
      var txt = document.body.innerText || '';
      var n = (txt.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
      out.appendChild(row('Matches (text)', String(n), { mono: true }));
      out.appendChild(statusBox('This browser lacks the Highlight API, so in-page highlighting is unavailable \u2014 showing a text count only.', false));
      return;
    }
    ensureHlStyle();
    CSS.highlights.delete('osint-find');
    var ranges = [], tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), node, lc = term.toLowerCase(), count = 0;
    while ((node = tw.nextNode())) {
      var data = node.nodeValue;
      if (!data) continue;
      var ld = data.toLowerCase(), idx = ld.indexOf(lc);
      while (idx !== -1) {
        var r = document.createRange();
        r.setStart(node, idx); r.setEnd(node, idx + term.length);
        ranges.push(r); count++;
        idx = ld.indexOf(lc, idx + term.length);
        if (count > 5000) break;
      }
      if (count > 5000) break;
    }
    var hl = new Highlight();
    for (var i = 0; i < ranges.length; i++) hl.add(ranges[i]);
    CSS.highlights.set('osint-find', hl);
    out.appendChild(row('Matches highlighted', String(count), { mono: true }));
    if (ranges.length) {
      var host = ranges[0].startContainer.parentElement;
      if (host) host.scrollIntoView({ behavior: 'smooth', block: 'center' });
      out.appendChild(statusBox('Highlighted ' + count + ' match' + (count === 1 ? '' : 'es') + ' on the page (mint). Use Clear to remove.', false));
    } else {
      out.appendChild(statusBox('No matches found on the page.', false));
    }
  }

  // Computes the top word frequencies on the page.
  function wordFreq() {
    var txt = (document.body.innerText || '').toLowerCase();
    var words = txt.match(/[a-z0-9']{3,}/g) || [];
    var stop = { the: 1, and: 1, for: 1, are: 1, but: 1, not: 1, you: 1, all: 1, any: 1, can: 1, has: 1, had: 1, was: 1, with: 1, that: 1, this: 1, from: 1, your: 1, have: 1, will: 1, what: 1, when: 1, they: 1, them: 1, then: 1, there: 1, their: 1, would: 1, about: 1, which: 1, were: 1, been: 1, into: 1, more: 1, also: 1, than: 1, our: 1, out: 1, his: 1, her: 1, its: 1 };
    var freq = {};
    for (var i = 0; i < words.length; i++) { var w = words[i]; if (stop[w]) continue; freq[w] = (freq[w] || 0) + 1; }
    var arr = Object.keys(freq).map(function(k) { return [k, freq[k]]; });
    arr.sort(function(a, b) { return b[1] - a[1]; });
    return arr.slice(0, 40);
  }

  // Renders the Text tab (find-on-page + word frequency).
  function renderText(container) {
    container.appendChild(sectionTitle('Find on page'));
    var wrap = el('div', 'display:flex;gap:8px;padding:4px 0 4px 0');
    var input = el('input');
    input.type = 'text'; input.placeholder = 'term to highlight'; input.spellcheck = false;
    input.style.cssText = 'flex:1;min-width:0;background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';color:' + COLORS.textStrong + ';padding:8px 10px;font-family:' + MONO + ';font-size:12px;border-radius:6px;outline:none';
    input.onfocus = function() { input.style.borderColor = COLORS.accent; };
    input.onblur = function() { input.style.borderColor = COLORS.border; };
    var findOut = el('div', 'margin:4px 0 2px 0');
    var go = btn('Find', function() { runFind(input.value.trim(), findOut); }, { primary: true });
    var clr = btn('Clear', function() { if (window.CSS && CSS.highlights) CSS.highlights.delete('osint-find'); clearNode(findOut); input.value = ''; });
    wrap.appendChild(input); wrap.appendChild(go); wrap.appendChild(clr);
    container.appendChild(wrap);
    input.onkeydown = function(e) { if (e.key === 'Enter') runFind(input.value.trim(), findOut); };
    container.appendChild(findOut);

    container.appendChild(sectionTitle('Word frequency (top 40)'));
    var arr = wordFreq();
    if (!arr.length) { container.appendChild(statusBox('No readable text on the page.', false)); return; }
    var max = arr[0][1];
    var nodes = [];
    for (var i = 0; i < arr.length; i++) {
      var rr = el('div', 'display:flex;align-items:center;gap:10px;padding:5px 0');
      rr.appendChild(el('span', 'min-width:104px;font-family:' + MONO + ';font-size:11px;color:' + COLORS.textStrong + ';flex-shrink:0', arr[i][0]));
      var barWrap = el('div', 'flex:1;height:7px;background:' + COLORS.surface + ';border-radius:4px;overflow:hidden');
      barWrap.appendChild(el('div', 'height:100%;width:' + Math.max(4, Math.round(arr[i][1] / max * 100)) + '%;background:' + COLORS.accent));
      rr.appendChild(barWrap);
      rr.appendChild(el('span', 'min-width:34px;text-align:right;font-family:' + MONO + ';font-size:11px;color:' + COLORS.textMuted, String(arr[i][1])));
      container.appendChild(rr); nodes.push(rr);
    }
    stagger(nodes, 14, 30);
  }

  // Renders the Page tab (last-modified, page info, Wayback).
  function renderPage(container) {
    container.appendChild(sectionTitle('Last modified'));
    var lm = document.lastModified ? new Date(document.lastModified) : null;
    if (lm && !isNaN(lm.getTime()) && lm.getFullYear() > 1990) {
      container.appendChild(row('Server value', document.lastModified, { mono: true }));
      container.appendChild(row('UTC', fmtDateShort(lm), { mono: true }));
      container.appendChild(row('Local', fmtLocal(lm)));
      container.appendChild(row('Age', timeAgo(lm)));
    } else {
      container.appendChild(statusBox('No usable Last-Modified value (many dynamic sites report the current time).', false));
    }

    container.appendChild(sectionTitle('Page'));
    container.appendChild(row('URL', location.href, { copy: true, mono: true }));
    if (document.referrer) container.appendChild(row('Referrer', document.referrer, { copy: true, mono: true }));
    container.appendChild(row('Charset', document.characterSet || '\u2014', { mono: true }));
    container.appendChild(row('Language', document.documentElement.lang || '\u2014', { mono: true }));

    container.appendChild(sectionTitle('Wayback Machine'));
    var u = location.href;
    pivotList(container, [
      { name: 'Save now', desc: 'Capture this exact page to the archive', url: 'https://web.archive.org/save/' + u },
      { name: 'Latest snapshot', desc: 'Most recent archived copy', url: 'https://web.archive.org/web/2/' + u },
      { name: 'All snapshots', desc: 'Full history of this URL', url: 'https://web.archive.org/web/*/' + u }
    ]);
  }


})();
