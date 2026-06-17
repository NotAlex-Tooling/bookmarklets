// title: "Facebook Profile OSINT"
// description: "Runs on a Facebook profile. Returns IDs, unmasked photos, name search, and cross-platform pivots."
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
    accentSoft: 'rgba(52,211,153,0.12)',
    danger: '#ef4444'
  };
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Fira Mono",Consolas,monospace';

  var onFacebook = window.location.hostname.indexOf('facebook.com') !== -1;
  var pathParts = window.location.pathname.split('/').filter(Boolean);
  var first = (pathParts[0] || '').toLowerCase();
  var reserved = /^(marketplace|messages|groups|watch|gaming|events|pages|public|story\.php|posts|sharer|login|home\.php|notifications|bookmarks|friends|pages_feed|pymk|find-friends|saved|memories|recent|directory|reel|reels|stories|hashtag|search|policies|help|settings)$/i;

  var ctx = { type: 'unknown', username: null, profileIdFromUrl: null };
  if (!onFacebook) {
    ctx.type = 'offsite';
  } else if (first === 'profile.php') {
    ctx.type = 'profile';
    var m1 = window.location.search.match(/[?&]id=(\d+)/);
    if (m1) ctx.profileIdFromUrl = m1[1];
  } else if (first === 'people' && pathParts[1] && pathParts[2]) {
    ctx.type = 'profile';
    ctx.username = pathParts[1];
    if (/^\d+$/.test(pathParts[2])) ctx.profileIdFromUrl = pathParts[2];
  } else if (first && !reserved.test(first)) {
    ctx.type = 'profile';
    ctx.username = pathParts[0];
  } else {
    ctx.type = 'other';
  }

  var html = document.documentElement.outerHTML;

  var idPatterns = [
    /"userID":"(\d+)"/,
    /"profileID":"(\d+)"/,
    /"actor_id":"(\d+)"/,
    /"user":\{"id":"(\d+)"/,
    /"entity_id":"(\d+)"/,
    /"ownerVanity":"[^"]+","__isProfile":"User","id":"(\d+)"/
  ];
  var pageId = ctx.profileIdFromUrl || null;
  if (!pageId) {
    for (var pi = 0; pi < idPatterns.length; pi++) {
      var mm = html.match(idPatterns[pi]);
      if (mm) { pageId = mm[1]; break; }
    }
  }

  var displayName = null;
  var nameMatch = html.match(/__isProfile":"User","name":"((?:[^"\\]|\\.)*)"/);
  if (nameMatch) { try { displayName = JSON.parse('"' + nameMatch[1] + '"'); } catch(e) { displayName = nameMatch[1]; } }
  if (!displayName) {
    var t = document.querySelector('meta[property="og:title"]');
    if (t && t.content) displayName = t.content;
  }

  var FBCLARITY = 'https://fbclarity.notalex.sh';

  var win = document.createElement('div');
  win.id = '_osint_win';
  win.style.cssText = [
    'position:fixed','top:36px','right:36px','width:520px','max-height:85vh',
    'background:' + COLORS.bg,'border:1px solid ' + COLORS.border,
    'border-radius:12px','overflow:hidden',
    'color:' + COLORS.text,'font-family:' + SANS,'font-size:12.5px',
    'z-index:2147483647','display:flex','flex-direction:column',
    'box-shadow:0 0 0 1px rgba(0,0,0,0.5), 0 30px 80px rgba(0,0,0,0.75), 0 0 60px rgba(52,211,153,0.05)'
  ].join(';');

  var bar = document.createElement('div');
  bar.style.cssText = [
    'display:flex','align-items:center','justify-content:space-between',
    'padding:12px 16px','background:' + COLORS.bar,
    'cursor:grab','user-select:none','-webkit-user-select:none',
    'flex-shrink:0','position:relative'
  ].join(';');

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
  titleEl.textContent = 'Facebook OSINT';
  titleEl.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' + COLORS.textStrong + ';line-height:1.1';
  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = ctx.type === 'profile' ? (ctx.username ? '/' + ctx.username : 'profile.php?id=' + (ctx.profileIdFromUrl || '?')) :
                          ctx.type === 'offsite' ? 'not on facebook.com' : ctx.type;
  titleStack.appendChild(titleEl);
  titleStack.appendChild(ctxBadge);

  titleWrap.appendChild(dot);
  titleWrap.appendChild(titleStack);

  var closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
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

  win.appendChild(bar);
  win.appendChild(tabStrip);
  win.appendChild(body);

  var dx = 0, dy = 0, sx = 0, sy = 0;
  bar.onmousedown = function(e) {
    if (e.target === closeBtn) return;
    e.preventDefault();
    sx = e.clientX; sy = e.clientY;
    bar.style.cursor = 'grabbing';
    document.onmousemove = function(e) {
      dx = sx - e.clientX; dy = sy - e.clientY;
      sx = e.clientX; sy = e.clientY;
      win.style.top = (win.offsetTop - dy) + 'px';
      win.style.left = (win.offsetLeft - dx) + 'px';
      win.style.right = 'auto';
    };
    document.onmouseup = function() {
      document.onmousemove = null; document.onmouseup = null;
      bar.style.cursor = 'grab';
    };
  };

  document.body.appendChild(win);
  win.animate(
    [
      { opacity: 0, transform: 'translateY(-12px) scale(0.97)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' }
    ],
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
    var lbl = el('span', 'color:' + COLORS.textMuted + ';min-width:96px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', label);
    var val = el('span', 'color:' + COLORS.textStrong + ';font-weight:500;word-break:break-word;flex:1;font-size:12.5px' + (opts.mono ? ';font-family:' + MONO + ';font-size:12px' : ''));
    val.textContent = value == null || value === '' ? '—' : String(value);
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
    } catch(e) {}
  }

  // Builds a section heading with the accent marker and a fading rule.
  function sectionTitle(text) {
    var wrap = el('div', 'padding:18px 0 8px 0;display:flex;align-items:center;gap:8px;margin-bottom:4px;border-bottom:1px solid ' + COLORS.borderSoft);
    var marker = el('span', 'color:' + COLORS.accent + ';font-family:' + MONO + ';font-size:11px;font-weight:600', '▸');
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
      'padding:7px 14px','font-family:inherit','font-size:11.5px','font-weight:600',
      'cursor:pointer','letter-spacing:0.2px','transition:all 0.12s'
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

  // Builds a label/URL row that opens the URL in a new tab.
  function linkRow(label, url) {
    var div = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:12px;align-items:center');
    var lbl = el('span', 'color:' + COLORS.textMuted + ';min-width:96px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', label);
    var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;word-break:break-all;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:11.5px;border-bottom:1px dashed ' + COLORS.textFaint, url);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.onmouseover = function() { a.style.borderBottomColor = COLORS.textStrong; };
    a.onmouseout = function() { a.style.borderBottomColor = COLORS.textFaint; };
    div.appendChild(lbl); div.appendChild(a);
    return div;
  }

  // Builds a status box; isError turns the text red.
  function statusBox(text, isError) {
    return el('div', 'color:' + (isError ? COLORS.danger : COLORS.text) + ';font-size:11.5px;line-height:1.55;padding:11px 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px', text);
  }

  // Builds a labelled note banner with a coloured side rail; variant is 'login' (amber) or 'anonymous' (green).
  function noteBanner(variant, label, body) {
    var color = variant === 'anonymous' ? COLORS.accent : '#fbbf24';
    var wrap = el('div', 'display:flex;gap:10px;padding:10px 12px;margin:0 0 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px;border-left:3px solid ' + color);
    var labelEl = el('div', 'font-family:' + MONO + ';font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + color + ';flex-shrink:0;padding-top:1px', label);
    var bodyEl = el('div', 'color:' + COLORS.text + ';font-size:11.5px;line-height:1.55;flex:1', body);
    wrap.appendChild(labelEl); wrap.appendChild(bodyEl);
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
    } catch(_) {}
  }

  // Runs animateIn on a list of nodes, offsetting each by step ms.
  function stagger(nodes, step, baseDelay) {
    step = step || 50; baseDelay = baseDelay || 0;
    for (var i = 0; i < nodes.length; i++) animateIn(nodes[i], baseDelay + i * step);
  }

  var TABS = [];
  if (ctx.type === 'profile') {
    TABS.push({ id: 'about',   label: 'About',   render: renderAbout });
    TABS.push({ id: 'picture', label: 'Picture', render: renderPicture });
    TABS.push({ id: 'search',  label: 'Search',  render: renderSearch });
    TABS.push({ id: 'pivot',   label: 'Pivot',   render: renderPivot });
  } else {
    TABS.push({ id: 'help',    label: 'Help',    render: renderHelp });
  }

  var activeTab = TABS[0].id;
  var tabButtons = {};

  var tabIndicator = el('div', 'position:absolute;bottom:0;height:2px;background:' + COLORS.accent + ';box-shadow:0 0 10px ' + COLORS.accentGlow + ';transition:left 0.22s cubic-bezier(0.4,0,0.2,1),width 0.22s cubic-bezier(0.4,0,0.2,1);pointer-events:none;border-radius:2px');
  tabStrip.appendChild(tabIndicator);

  for (var i = 0; i < TABS.length; i++) {
    (function(tab) {
      var b = el('button', [
        'background:none','border:none',
        'color:' + COLORS.textMuted,'padding:12px 14px','font-family:inherit',
        'font-size:11.5px','font-weight:600','cursor:pointer','letter-spacing:0.3px',
        'white-space:nowrap','transition:color 0.15s','position:relative'
      ].join(';'), tab.label);
      b.onmouseover = function() { if (activeTab !== tab.id) b.style.color = COLORS.text; };
      b.onmouseout  = function() { if (activeTab !== tab.id) b.style.color = COLORS.textMuted; };
      b.onclick = function() { switchTab(tab.id); };
      tabButtons[tab.id] = b;
      tabStrip.appendChild(b);
    })(TABS[i]);
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
      var b = tabButtons[k];
      if (k === id) b.style.color = COLORS.textStrong;
      else b.style.color = COLORS.textMuted;
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

  // Renders the About tab into the container.
  function renderAbout(container) {
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to facebook.com — the profile ID and og: meta tags are only embedded in the DOM for authenticated viewers.'));
    if (!pageId) {
      container.appendChild(statusBox('Facebook ID not found in DOM. Log in to facebook.com in this tab and refresh — the ID is only rendered for authenticated viewers.', true));
    }
    container.appendChild(sectionTitle('Identity'));
    if (ctx.username) container.appendChild(row('Username', ctx.username, { copy: true }));
    if (displayName) container.appendChild(row('Name', displayName, { copy: true }));
    container.appendChild(row('ID', pageId || '— log in and refresh', { copy: !!pageId, mono: true }));
    if (ctx.profileIdFromUrl && ctx.profileIdFromUrl !== pageId) container.appendChild(row('URL ID', ctx.profileIdFromUrl, { copy: true, mono: true }));

    container.appendChild(sectionTitle('Links'));
    container.appendChild(linkRow('Profile', window.location.origin + window.location.pathname));
    if (pageId) container.appendChild(linkRow('Canonical', 'https://www.facebook.com/profile.php?id=' + pageId));
  }

  // Reads og: meta tags and the cover photo from the current DOM.
  function scrapeOgFromDom() {
    var out = {};
    var mTitle = document.querySelector('meta[property="og:title"]');
    var mDesc  = document.querySelector('meta[property="og:description"]');
    var mImg   = document.querySelector('meta[property="og:image"]');
    var mUrl   = document.querySelector('meta[property="og:url"]');
    if (mTitle && mTitle.content) out.title = mTitle.content;
    if (mDesc && mDesc.content)   out.description = mDesc.content;
    if (mImg && mImg.content) {
      out.image = mImg.content;
      out.imageFullRes = upgradeFullRes(mImg.content);
    }
    if (mUrl && mUrl.content) out.url = mUrl.content;
    var cover = document.querySelector('img[data-imgperflogname="profileCoverPhoto"]');
    if (cover) out.banner = cover.src;
    if (out.image) {
      var idMatch = out.image.match(/\/(?:\d+)_(\d{10,})_\d+/);
      if (idMatch) out.userId = idMatch[1];
    }
    return out;
  }

  // Swaps the cstp param into ctp so a Facebook CDN URL serves full resolution.
  function upgradeFullRes(url) {
    try {
      var u = new URL(url);
      var cstp = u.searchParams.get('cstp');
      if (cstp) { u.searchParams.set('ctp', cstp); return u.toString(); }
    } catch(e) {}
    return url;
  }

  // Renders the Picture tab into the container.
  function renderPicture(container) {
    container.appendChild(sectionTitle('Open Graph preview'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to facebook.com — Facebook only embeds the og: meta tags in the DOM for authenticated viewers. For an anonymous server-side fetch use fbclarity below.'));

    var og = scrapeOgFromDom();
    if (!og.image && !og.title && !og.banner) {
      container.appendChild(statusBox('No Open Graph data in this page. Log in to facebook.com and refresh, or open fbclarity for an anonymous server-side fetch.', true));
      var fallback = el('div', 'display:flex;gap:8px;padding-top:12px;flex-wrap:wrap');
      fallback.appendChild(btn('Open fbclarity', function() { window.open(FBCLARITY, '_blank'); }, { primary: true }));
      if (pageId) fallback.appendChild(btn('Open Marketplace', function() { window.open('https://www.facebook.com/marketplace/?seller_profile=' + pageId, '_blank'); }));
      container.appendChild(fallback);
      return;
    }
    if (!og.image && !og.title && og.banner) {
      container.appendChild(statusBox('Profile photo not exposed in og: tags. Banner still available below — open fbclarity for the unmasked profile photo.', false));
      var partial = el('div', 'display:flex;gap:8px;padding-top:10px;padding-bottom:6px;flex-wrap:wrap');
      partial.appendChild(btn('Open fbclarity', function() { window.open(FBCLARITY, '_blank'); }, { primary: true }));
      if (pageId) partial.appendChild(btn('Open Marketplace', function() { window.open('https://www.facebook.com/marketplace/?seller_profile=' + pageId, '_blank'); }));
      container.appendChild(partial);
    }

    var imgSrc = og.imageFullRes || og.image;
    if (imgSrc || og.title || og.description || og.userId || og.url) {
      var card = el('div', 'border:1px solid ' + COLORS.border + ';border-radius:10px;overflow:hidden;background:' + COLORS.surface + ';margin-top:4px');
      if (imgSrc) {
        var imgWrap = el('div', 'position:relative;background:#000;text-align:center;padding:18px');
        var img = el('img', 'max-width:240px;max-height:240px;object-fit:cover;border-radius:50%;border:2px solid ' + COLORS.border + ';box-shadow:0 6px 24px rgba(0,0,0,0.5)');
        img.src = imgSrc;
        img.onerror = function() { img.style.borderRadius = '0'; img.alt = 'image failed to load'; };
        imgWrap.appendChild(img);
        card.appendChild(imgWrap);
      }
      var meta = el('div', 'padding:14px 16px');
      if (og.title) {
        meta.appendChild(el('div', 'font-size:15px;font-weight:600;color:' + COLORS.textStrong + ';letter-spacing:-0.1px;line-height:1.3', og.title));
      }
      if (og.description) {
        meta.appendChild(el('div', 'font-size:11.5px;color:' + COLORS.textMuted + ';line-height:1.5;margin-top:6px;white-space:pre-wrap', og.description));
      }
      var badges = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px');
      if (og.userId) {
        var idChip = el('span', 'background:' + COLORS.accentSoft + ';color:' + COLORS.accent + ';font-family:' + MONO + ';font-size:10.5px;padding:3px 8px;border-radius:99px;font-weight:600;cursor:pointer', 'id ' + og.userId);
        idChip.title = 'Click to copy';
        idChip.onclick = function() { copyText(og.userId, idChip); };
        badges.appendChild(idChip);
      }
      if (og.url) {
        var urlChip = el('a', 'background:' + COLORS.surfaceHi + ';color:' + COLORS.text + ';font-family:' + MONO + ';font-size:10.5px;padding:3px 8px;border-radius:99px;font-weight:500;text-decoration:none;border:1px solid ' + COLORS.border, og.url.replace(/^https?:\/\/(www\.)?facebook\.com/, ''));
        urlChip.href = og.url; urlChip.target = '_blank'; urlChip.rel = 'noopener noreferrer';
        badges.appendChild(urlChip);
      }
      if (badges.children.length > 0) meta.appendChild(badges);
      card.appendChild(meta);
      container.appendChild(card);
    }

    if (imgSrc) {
      var actions = el('div', 'display:flex;gap:8px;padding-top:14px;flex-wrap:wrap');
      actions.appendChild(btn('Open full size', function() { window.open(imgSrc, '_blank'); }, { primary: true }));
      actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(imgSrc); }));
      actions.appendChild(btn('Download', function() {
        var a = el('a'); a.href = imgSrc;
        a.download = (ctx.username || pageId || og.userId || 'fb') + '_photo.jpg';
        document.body.appendChild(a); a.click(); a.remove();
      }));
      actions.appendChild(btn('Open fbclarity', function() { window.open(FBCLARITY, '_blank'); }));
      container.appendChild(actions);

      container.appendChild(sectionTitle('Image URL'));
      var urlBox = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;word-break:break-all;cursor:pointer;font-family:' + MONO + ';border-radius:6px;background:' + COLORS.surface);
      urlBox.textContent = imgSrc;
      urlBox.title = 'Click to copy';
      urlBox.onclick = function() { copyText(imgSrc, urlBox); };
      container.appendChild(urlBox);
    }

    if (og.banner) {
      container.appendChild(sectionTitle('Cover photo'));
      var bWrap = el('div', 'padding:12px 0;text-align:center');
      var bImg = el('img', 'max-width:100%;max-height:200px;border-radius:8px;border:1px solid ' + COLORS.border);
      bImg.src = og.banner;
      bImg.onerror = function() { bImg.alt = 'cover failed to load'; };
      bWrap.appendChild(bImg);
      container.appendChild(bWrap);

      var bActions = el('div', 'display:flex;gap:8px;flex-wrap:wrap');
      bActions.appendChild(btn('Open full size', function() { window.open(og.banner, '_blank'); }, { primary: true }));
      bActions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(og.banner); }));
      bActions.appendChild(btn('Download', function() {
        var a = el('a'); a.href = og.banner;
        a.download = (ctx.username || pageId || og.userId || 'fb') + '_cover.jpg';
        document.body.appendChild(a); a.click(); a.remove();
      }));
      container.appendChild(bActions);
    }
  }

  // Renders the Search tab into the container.
  function renderSearch(container) {
    container.appendChild(sectionTitle('Profile search'));
    container.appendChild(el('div', 'color:' + COLORS.textMuted + ';font-size:11.5px;line-height:1.55;padding:4px 0 8px',
      'Facebook lets you search posts on a specific profile. We default to their first name; edit the term before opening.'));

    if (!pageId) {
      container.appendChild(statusBox('Facebook ID not found in DOM. Log in to facebook.com in this tab and refresh — the ID is only rendered for authenticated viewers.', true));
      return;
    }

    var defaultTerm = displayName ? displayName.split(' ')[0] : '';
    container.appendChild(row('ID', pageId, { copy: true, mono: true }));
    if (displayName) container.appendChild(row('Name', displayName));

    var inputWrap = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:12px;align-items:center');
    var lbl = el('span', 'color:' + COLORS.textMuted + ';min-width:96px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', 'Search term');
    var input = el('input', 'flex:1;background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';color:' + COLORS.textStrong + ';font-family:' + MONO + ';font-size:12px;padding:7px 10px;border-radius:6px;outline:none');
    input.type = 'text'; input.value = defaultTerm;
    input.onfocus = function() { input.style.borderColor = COLORS.accent; };
    input.onblur  = function() { input.style.borderColor = COLORS.border; };
    inputWrap.appendChild(lbl); inputWrap.appendChild(input);
    container.appendChild(inputWrap);

    // Returns the search URL built from the current input value.
    function buildUrl() {
      return 'https://www.facebook.com/profile/' + pageId + '/search/?q=' + encodeURIComponent(input.value || '');
    }

    var urlPreview = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:12px;align-items:center');
    var ulbl = el('span', 'color:' + COLORS.textMuted + ';min-width:96px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', 'URL');
    var urlLink = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;word-break:break-all;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:11.5px;border-bottom:1px dashed ' + COLORS.textFaint, buildUrl());
    urlLink.target = '_blank'; urlLink.rel = 'noopener noreferrer'; urlLink.href = buildUrl();
    urlPreview.appendChild(ulbl); urlPreview.appendChild(urlLink);
    container.appendChild(urlPreview);

    input.oninput = function() {
      var u = buildUrl();
      urlLink.textContent = u; urlLink.href = u;
    };

    var actions = el('div', 'display:flex;gap:8px;padding-top:14px');
    actions.appendChild(btn('Open search', function() { window.open(buildUrl(), '_blank'); }, { primary: true }));
    actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(buildUrl()); }));
    container.appendChild(actions);
  }

  // Renders the Pivot tab into the container.
  function renderPivot(container) {
    container.appendChild(sectionTitle('Cross-platform pivot'));

    var handleForPivots = ctx.username || (displayName ? displayName.toLowerCase().replace(/[^a-z0-9._]/g, '') : null);
    var subject = handleForPivots ? '@' + handleForPivots : (displayName || (pageId ? 'ID ' + pageId : 'this profile'));
    container.appendChild(el('div', 'color:' + COLORS.text + ';font-size:11.5px;padding:4px 0 10px 0;line-height:1.5',
      'Open ' + subject + ' on:'));

    var pivots = [];
    pivots.push({ name: 'fbclarity', desc: 'Anonymous server-side fetch of the og preview and full-res photo',
      url: FBCLARITY });
    if (pageId) {
      pivots.push({ name: 'Marketplace seller', desc: 'This account\'s Marketplace listings page',
        url: 'https://www.facebook.com/marketplace/?seller_profile=' + pageId });
    }
    pivots.push({ name: 'Wayback Machine', desc: 'Historical snapshots of this Facebook URL',
      url: 'https://web.archive.org/web/*/' + window.location.href.replace(/^https?:\/\//, '') });
    if (handleForPivots) {
      pivots.push({ name: 'WhatsMyName', desc: 'Look up this handle across 640+ sites',
        url: 'https://whatsmyname.app/?q=' + encodeURIComponent(handleForPivots) });
    }
    if (displayName) {
      pivots.push({ name: 'Google name search',
        desc: 'Full-name Google search ("' + displayName + '")',
        url: 'https://www.google.com/search?q=' + encodeURIComponent('"' + displayName + '" facebook') });
    }

    var pivotCards = [];
    for (var i = 0; i < pivots.length; i++) {
      (function(p) {
        var card = el('a', [
          'display:flex','align-items:center','justify-content:space-between','gap:10px',
          'padding:14px 16px','margin-top:8px','border:1px solid ' + COLORS.border,
          'background:' + COLORS.surface,'border-radius:8px',
          'color:' + COLORS.textStrong,'text-decoration:none',
          'transition:transform 0.16s ease-out, border-color 0.16s, background 0.16s, box-shadow 0.16s'
        ].join(';'));
        card.href = p.url; card.target = '_blank'; card.rel = 'noopener noreferrer';

        var info = el('div', 'flex:1;min-width:0');
        info.appendChild(el('div', 'font-size:13px;font-weight:600;letter-spacing:0.1px', p.name));
        info.appendChild(el('div', 'font-size:11px;color:' + COLORS.textMuted + ';margin-top:4px;line-height:1.4', p.desc));
        card.appendChild(info);

        var arrow = el('span', 'color:' + COLORS.textDim + ';font-size:16px;flex-shrink:0;transition:transform 0.16s, color 0.16s', '→');
        card.appendChild(arrow);

        card.onmouseover = function() {
          card.style.borderColor = COLORS.accent;
          card.style.background = COLORS.surfaceHi;
          card.style.transform = 'translateY(-2px)';
          card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4), 0 0 24px ' + COLORS.accentGlow;
          arrow.style.color = COLORS.accent;
          arrow.style.transform = 'translateX(4px)';
        };
        card.onmouseout  = function() {
          card.style.borderColor = COLORS.border;
          card.style.background = COLORS.surface;
          card.style.transform = 'translateY(0)';
          card.style.boxShadow = 'none';
          arrow.style.color = COLORS.textDim;
          arrow.style.transform = 'translateX(0)';
        };
        container.appendChild(card);
        pivotCards.push(card);
      })(pivots[i]);
    }
    stagger(pivotCards, 70, 60);
  }

  // Renders the wrong-page message into the container.
  function renderHelp(container) {
    container.appendChild(sectionTitle('Wrong page'));
    container.appendChild(statusBox('You must be on a Facebook profile to use this.', true));
  }

})();
