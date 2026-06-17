// title: "X Profile OSINT"
// description: "Runs on an X profile. Returns banner-derived user ID, snowflake-decoded profile-pic upload time, max-res banner and avatar, and pivot links."
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
    danger: '#ef4444'
  };
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Fira Mono",Consolas,monospace';

  var onX = /(?:^|\.)(x|twitter)\.com$/i.test(window.location.hostname);
  var pathParts = window.location.pathname.split('/').filter(Boolean);
  var reserved = /^(home|explore|notifications|messages|i|settings|search|compose|tos|privacy|about|hashtag|jobs|verified-followers|verified-mentions|verified-orgs|topics|lists|bookmarks|moments|account|login|signup|share|intent|follower_requests)$/i;

  var ctx = { type: 'unknown', username: null };
  if (!onX) ctx.type = 'offsite';
  else if (pathParts[0] && !reserved.test(pathParts[0])) {
    ctx.username = pathParts[0];
    ctx.type = pathParts[1] === 'status' ? 'tweet' : 'profile';
  } else ctx.type = 'other';

  var pageHtml = document.documentElement.innerHTML;

  var displayName = null;
  var nameSpans = document.querySelectorAll('div[data-testid="UserName"] span, div[data-testid="User-Name"] span');
  for (var i = 0; i < nameSpans.length; i++) {
    var txt = nameSpans[i].textContent.trim();
    if (txt && txt.charAt(0) !== '@') { displayName = txt; break; }
  }
  if (!displayName) {
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      var nm = ogTitle.content.match(/^(.*?)\s*\(@/);
      if (nm) displayName = nm[1].trim();
    }
  }

  var bio = null;
  var bioEl = document.querySelector('div[data-testid="UserDescription"]');
  if (bioEl) bio = bioEl.textContent.trim();

  var bannerImg = null;
  var bannerEl = document.querySelector('img[src*="pbs.twimg.com/profile_banners/"]');
  if (bannerEl) bannerImg = bannerEl.src;
  if (!bannerImg) {
    var bm = pageHtml.match(/"profile_banner_url":"([^"]+)"/) ||
             pageHtml.match(/https?:\\?\/\\?\/pbs\.twimg\.com\\?\/profile_banners\\?\/\d+\\?\/\d+(?:\\?\/\w+)?/);
    if (bm) bannerImg = (bm[1] || bm[0]).replace(/\\\//g, '/');
  }

  var profileImg = null;
  if (ctx.username) {
    var a = document.querySelector('div[data-testid="primaryColumn"] a[href="/' + ctx.username + '/photo"]') ||
            document.querySelector('a[href="/' + ctx.username + '/photo"]');
    if (a) {
      var im = a.querySelector('img[src*="pbs.twimg.com/profile_images/"]');
      if (im) profileImg = im.src;
    }
  }
  if (!profileImg) {
    var og = document.querySelector('meta[property="og:image"]');
    if (og && og.content && /pbs\.twimg\.com\/profile_images\//i.test(og.content)) profileImg = og.content;
  }
  if (!profileImg) {
    var any = document.querySelector('div[data-testid="primaryColumn"] img[src*="pbs.twimg.com/profile_images/"]');
    if (any) profileImg = any.src;
  }

  // Parses an X profile-banner URL into user ID, upload time, and per-size variants.
  function parseBanner(src) {
    if (!src) return null;
    var clean = src.split('?')[0];
    var m = clean.match(/\/profile_banners\/(\d+)\/(\d+)(?:\/([\dx]+))?/);
    if (!m) return null;
    var userId = m[1];
    var tokenStr = m[2];
    var token = parseInt(tokenStr, 10);
    var uploadDate = null;
    if (/^\d{10}$/.test(tokenStr)) uploadDate = new Date(token * 1000);
    else if (/^\d{13}$/.test(tokenStr)) uploadDate = new Date(token);
    return {
      userId: userId,
      uploadUnix: token,
      uploadStr: tokenStr,
      uploadDate: uploadDate,
      size: m[3] || null,
      sizes: {
        full:    'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/1500x500',
        md:      'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/600x200',
        sm:      'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/300x100',
        web:     'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/web',
        webRet:  'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/web_retina',
        mobile:  'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/mobile',
        mobRet:  'https://pbs.twimg.com/profile_banners/' + userId + '/' + tokenStr + '/mobile_retina'
      }
    };
  }

  // Parses an X profile-image URL into media ID and per-size variants.
  function parseProfileImage(src) {
    if (!src) return null;
    var clean = src.split('?')[0];
    var m = clean.match(/\/profile_images\/(\d+)\/([^_./]+)(?:_(\w+))?(\.\w+)?$/);
    if (!m) return null;
    var mediaId = m[1];
    var base = m[2];
    var size = m[3] || '';
    var ext = m[4] || '.jpg';
    var u = 'https://pbs.twimg.com/profile_images/' + mediaId + '/' + base;
    return {
      mediaId: mediaId,
      base: base,
      ext: ext,
      currentSize: size,
      sizes: {
        original: u + ext,
        x400: u + '_400x400' + ext,
        x200: u + '_200x200' + ext,
        bigger: u + '_bigger' + ext,
        normal: u + '_normal' + ext,
        mini: u + '_mini' + ext
      }
    };
  }

  var TWITTER_EPOCH = 1288834974657;

  // Decodes a Twitter Snowflake ID into a UTC upload date.
  function snowflakeToDate(idStr) {
    if (!idStr || !/^\d+$/.test(idStr)) return null;
    try {
      if (typeof BigInt === 'function') {
        var bi = BigInt(idStr);
        var ms = Number((bi >> 22n)) + TWITTER_EPOCH;
        if (!isFinite(ms)) return null;
        var d = new Date(ms);
        if (isNaN(d.getTime())) return null;
        if (d.getTime() < TWITTER_EPOCH) return null;
        return d;
      } else {
        var n = Number(idStr);
        if (!isFinite(n)) return null;
        var ms2 = Math.floor(n / 4194304) + TWITTER_EPOCH;
        var d2 = new Date(ms2);
        if (isNaN(d2.getTime())) return null;
        return d2;
      }
    } catch(_) { return null; }
  }

  var bannerInfo = parseBanner(bannerImg);
  var profileImgInfo = parseProfileImage(profileImg);

  var userId = null, userIdSource = null;
  if (bannerInfo && bannerInfo.userId) {
    userId = bannerInfo.userId;
    userIdSource = 'banner URL';
  }
  if (!userId) {
    var hn = (ctx.username || '').toLowerCase();
    var esc = function(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    var rx = [
      new RegExp('"screen_name":"' + esc(hn) + '"[\\s\\S]{0,3000}"id_str":"(\\d+)"', 'i'),
      new RegExp('"id_str":"(\\d+)"[\\s\\S]{0,3000}"screen_name":"' + esc(hn) + '"', 'i'),
      new RegExp('"screen_name":"' + esc(hn) + '"[\\s\\S]{0,3000}"rest_id":"(\\d+)"', 'i'),
      new RegExp('"rest_id":"(\\d+)"[\\s\\S]{0,3000}"screen_name":"' + esc(hn) + '"', 'i')
    ];
    for (var rxi = 0; rxi < rx.length; rxi++) {
      var mm = pageHtml.match(rx[rxi]);
      if (mm) { userId = mm[1]; userIdSource = 'page source'; break; }
    }
  }

  // Finds the account creation date in scripts or the "Joined" element.
  function findCreateISO() {
    var scripts = document.querySelectorAll('script');
    for (var s = 0; s < scripts.length; s++) {
      var x = scripts[s].textContent || '';
      var m = x.match(/"dateCreated":"([^"]+)"/) || x.match(/"created_at":"([^"]+)"/) || x.match(/"createdAt":"([^"]+)"/);
      if (m) {
        var d = new Date(m[1]);
        if (!isNaN(d)) return d.toISOString();
      }
    }
    var joinedEl = document.querySelector('[data-testid="UserJoinDate"] span');
    var joined = joinedEl ? joinedEl.textContent : '';
    var jm = joined.match(/Joined\s+([A-Za-z]+)\s+(\d{4})/);
    if (jm) {
      var d2 = new Date(jm[1] + ' 1, ' + jm[2] + ' 00:00:00Z');
      if (!isNaN(d2)) return d2.toISOString();
    }
    return null;
  }

  var createdISO = findCreateISO();
  var createdDate = createdISO ? new Date(createdISO) : null;

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
  titleEl.textContent = 'X OSINT';
  titleEl.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' + COLORS.textStrong + ';line-height:1.1';
  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = ctx.type === 'profile' ? '@' + ctx.username :
                          ctx.type === 'tweet' ? '@' + ctx.username + '/status/…' :
                          ctx.type === 'offsite' ? 'not on x.com' : ctx.type;
  titleStack.appendChild(titleEl);
  titleStack.appendChild(ctxBadge);
  titleWrap.appendChild(dot); titleWrap.appendChild(titleStack);

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

  win.appendChild(bar); win.appendChild(tabStrip); win.appendChild(body);

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
    var lbl = el('span', 'color:' + COLORS.textMuted + ';min-width:104px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', label);
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

  // Formats a date as YYYY-MM-DD HH:MM Z (UTC).
  function fmtDateShort(d) {
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1).padStart(2, '0');
    var day = String(d.getUTCDate()).padStart(2, '0');
    var hh = String(d.getUTCHours()).padStart(2, '0');
    var mm = String(d.getUTCMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm + 'Z';
  }

  // Formats a date in the user's local timezone with the abbreviation.
  function fmtLocal(d) {
    return d.toLocaleString('en-US', { year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',timeZoneName:'short' });
  }

  // Returns a human-friendly relative time string for the given date.
  function timeAgo(d) {
    var diff = Date.now() - d.getTime();
    var days = Math.floor(diff / 86400000);
    var hrs = Math.floor(diff / 3600000);
    var mins = Math.floor(diff / 60000);
    if (days > 730) return Math.floor(days/365) + 'y ago';
    if (days > 60)  return Math.floor(days/30) + 'mo ago';
    if (days > 0)   return days + 'd ago';
    if (hrs > 0)    return hrs + 'h ago';
    return mins + 'm ago';
  }

  if (ctx.type !== 'profile' && ctx.type !== 'tweet') {
    body.appendChild(sectionTitle('Wrong page'));
    body.appendChild(statusBox('You must be on an X profile to use this.', true));
    return;
  }

  var TABS = [
    { id: 'about',   label: 'About',   render: renderAbout },
    { id: 'picture', label: 'Picture', render: renderPicture },
    { id: 'banner',  label: 'Banner',  render: renderBanner },
    { id: 'pivot',   label: 'Pivot',   render: renderPivot }
  ];

  var activeTab = TABS[0].id;
  var tabButtons = {};

  var tabIndicator = el('div', 'position:absolute;bottom:0;height:2px;background:' + COLORS.accent + ';box-shadow:0 0 10px ' + COLORS.accentGlow + ';transition:left 0.22s cubic-bezier(0.4,0,0.2,1),width 0.22s cubic-bezier(0.4,0,0.2,1);pointer-events:none;border-radius:2px');
  tabStrip.appendChild(tabIndicator);

  for (var ti = 0; ti < TABS.length; ti++) {
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

  // Renders the About tab into the container.
  function renderAbout(container) {
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to x.com — the banner, avatar, and profile-header metadata are only rendered for authenticated viewers on most profiles.'));
    container.appendChild(sectionTitle('Identity'));
    if (ctx.username)  container.appendChild(row('Handle', '@' + ctx.username, { copy: true }));
    if (displayName)   container.appendChild(row('Name', displayName, { copy: true }));
    container.appendChild(row('User ID', userId || '—', { copy: !!userId, mono: true }));
    if (userIdSource)  container.appendChild(row('ID source', userIdSource));
    if (userId)        container.appendChild(linkRow('UID URL', 'https://x.com/i/user/' + userId));
    if (userId)        container.appendChild(linkRow('Resolve ID', 'https://x.com/intent/user?user_id=' + userId));

    container.appendChild(sectionTitle('Account created'));
    if (createdDate) {
      container.appendChild(row('UTC',   fmtDateShort(createdDate), { copy: true, mono: true }));
      container.appendChild(row('Local', fmtLocal(createdDate)));
      container.appendChild(row('Age',   timeAgo(createdDate)));
      container.appendChild(row('ISO',   createdDate.toISOString(), { copy: true, mono: true }));
    } else {
      container.appendChild(statusBox('Creation date not found in DOM. Log in to x.com in this tab and refresh — the profile header is only rendered for authenticated viewers.', true));
    }

    if (bannerInfo) {
      container.appendChild(sectionTitle('Banner upload'));
      container.appendChild(row('Unix', String(bannerInfo.uploadUnix), { copy: true, mono: true }));
      if (bannerInfo.uploadDate) {
        container.appendChild(row('UTC',   fmtDateShort(bannerInfo.uploadDate), { copy: true, mono: true }));
        container.appendChild(row('Local', fmtLocal(bannerInfo.uploadDate)));
        container.appendChild(row('Age',   timeAgo(bannerInfo.uploadDate)));
      }
    } else {
      container.appendChild(sectionTitle('Banner upload'));
      container.appendChild(statusBox('No banner on this profile. User ID derived from page source instead.'));
    }

    if (profileImgInfo) {
      var pUp = snowflakeToDate(profileImgInfo.mediaId);
      container.appendChild(sectionTitle('Profile photo upload (snowflake)'));
      container.appendChild(row('Media ID', profileImgInfo.mediaId, { copy: true, mono: true }));
      if (pUp) {
        container.appendChild(row('UTC',   fmtDateShort(pUp), { copy: true, mono: true }));
        container.appendChild(row('Local', fmtLocal(pUp)));
        container.appendChild(row('Age',   timeAgo(pUp)));
      } else {
        container.appendChild(row('Decoded', '— (pre-snowflake / invalid id)'));
      }
    }

    if (bio) {
      container.appendChild(sectionTitle('Bio'));
      var bioBox = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.text + ';white-space:pre-wrap;line-height:1.55;font-size:11.5px;border-radius:6px;background:' + COLORS.surface);
      bioBox.textContent = bio;
      container.appendChild(bioBox);
    }
  }

  // Renders the Picture tab into the container.
  function renderPicture(container) {
    container.appendChild(sectionTitle('Profile photo'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to x.com — the avatar URL is only rendered for authenticated viewers on most profiles.'));
    if (!profileImgInfo) {
      container.appendChild(statusBox('Profile photo not found in DOM. Log in to x.com in this tab and refresh.', true));
      return;
    }

    var origUrl = profileImgInfo.sizes.original;
    var preview = el('div', 'padding:14px 0;text-align:center');
    var img = el('img', 'max-width:240px;max-height:240px;object-fit:cover;border-radius:50%;border:2px solid ' + COLORS.border + ';box-shadow:0 6px 24px rgba(0,0,0,0.5);background:#000');
    img.src = origUrl;
    img.onerror = function() { img.style.borderRadius = '0'; img.alt = 'failed to load — may not exist at this size'; };
    preview.appendChild(img);
    container.appendChild(preview);

    container.appendChild(row('Media ID', profileImgInfo.mediaId, { copy: true, mono: true }));
    var pUp = snowflakeToDate(profileImgInfo.mediaId);
    if (pUp) container.appendChild(row('Uploaded', fmtDateShort(pUp) + '  ·  ' + timeAgo(pUp)));

    var urlBox = el('div', 'margin-top:10px;padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;word-break:break-all;cursor:pointer;font-family:' + MONO + ';border-radius:6px;background:' + COLORS.surface);
    urlBox.textContent = origUrl;
    urlBox.title = 'Click to copy';
    urlBox.onclick = function() { copyText(origUrl, urlBox); };
    container.appendChild(urlBox);

    var actions = el('div', 'display:flex;gap:8px;padding-top:14px;flex-wrap:wrap');
    actions.appendChild(btn('Open original', function() { window.open(origUrl, '_blank'); }, { primary: true }));
    actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(origUrl); }));
    actions.appendChild(btn('Download', function() {
      var a = el('a'); a.href = origUrl; a.download = (ctx.username || 'x') + '_photo' + profileImgInfo.ext;
      document.body.appendChild(a); a.click(); a.remove();
    }));
    container.appendChild(actions);

    container.appendChild(sectionTitle('All sizes'));
    var sizeMeta = [
      ['original', 'original (no suffix · max res)'],
      ['x400',     '400 × 400'],
      ['x200',     '200 × 200'],
      ['bigger',   '73 × 73 (bigger)'],
      ['normal',   '48 × 48 (normal)'],
      ['mini',     '24 × 24 (mini)']
    ];
    var sizeRows = [];
    for (var s = 0; s < sizeMeta.length; s++) {
      (function(key, label) {
        var u = profileImgInfo.sizes[key];
        var sr = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:10px;align-items:center');
        var lblEl = el('span', 'color:' + COLORS.textMuted + ';min-width:104px;flex-shrink:0;font-size:11px;font-weight:500', label);
        var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:11px;border-bottom:1px dashed ' + COLORS.textFaint + ';word-break:break-all', u);
        a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.onmouseover = function() { a.style.borderBottomColor = COLORS.textStrong; };
        a.onmouseout = function() { a.style.borderBottomColor = COLORS.textFaint; };
        sr.appendChild(lblEl); sr.appendChild(a);
        container.appendChild(sr); sizeRows.push(sr);
      })(sizeMeta[s][0], sizeMeta[s][1]);
    }
    stagger(sizeRows, 35, 60);
  }

  // Renders the Banner tab into the container.
  function renderBanner(container) {
    container.appendChild(sectionTitle('Profile banner'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to x.com — the banner URL is only rendered for authenticated viewers on most profiles.'));
    if (!bannerInfo) {
      container.appendChild(statusBox('Banner not found in DOM. Log in to x.com in this tab and refresh, or the account simply has no banner.', true));
      return;
    }

    var fullUrl = bannerInfo.sizes.full;
    var preview = el('div', 'padding:14px 0;text-align:center');
    var img = el('img', 'max-width:100%;border-radius:10px;border:1px solid ' + COLORS.border + ';box-shadow:0 6px 24px rgba(0,0,0,0.5)');
    img.src = fullUrl;
    img.onerror = function() { img.alt = 'banner failed to load'; };
    preview.appendChild(img);
    container.appendChild(preview);

    container.appendChild(row('User ID',   bannerInfo.userId, { copy: true, mono: true }));
    container.appendChild(row('Upload unix', String(bannerInfo.uploadUnix), { copy: true, mono: true }));
    if (bannerInfo.uploadDate) {
      container.appendChild(row('UTC',   fmtDateShort(bannerInfo.uploadDate), { copy: true, mono: true }));
      container.appendChild(row('Local', fmtLocal(bannerInfo.uploadDate)));
      container.appendChild(row('Age',   timeAgo(bannerInfo.uploadDate)));
    }
    if (bannerInfo.size) container.appendChild(row('On-page size', bannerInfo.size, { mono: true }));

    var urlBox = el('div', 'margin-top:10px;padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;word-break:break-all;cursor:pointer;font-family:' + MONO + ';border-radius:6px;background:' + COLORS.surface);
    urlBox.textContent = fullUrl;
    urlBox.title = 'Click to copy';
    urlBox.onclick = function() { copyText(fullUrl, urlBox); };
    container.appendChild(urlBox);

    var actions = el('div', 'display:flex;gap:8px;padding-top:14px;flex-wrap:wrap');
    actions.appendChild(btn('Open 1500×500', function() { window.open(fullUrl, '_blank'); }, { primary: true }));
    actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(fullUrl); }));
    actions.appendChild(btn('Download', function() {
      var a = el('a'); a.href = fullUrl; a.download = (ctx.username || 'x') + '_banner.jpg';
      document.body.appendChild(a); a.click(); a.remove();
    }));
    container.appendChild(actions);

    container.appendChild(sectionTitle('All sizes'));
    var bs = [
      ['full',    '1500 × 500 (max)'],
      ['md',      '600 × 200'],
      ['sm',      '300 × 100'],
      ['web',     'web'],
      ['webRet',  'web_retina'],
      ['mobile',  'mobile'],
      ['mobRet',  'mobile_retina']
    ];
    var sizeRows = [];
    for (var s = 0; s < bs.length; s++) {
      (function(key, label) {
        var u = bannerInfo.sizes[key];
        var sr = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:10px;align-items:center');
        var lblEl = el('span', 'color:' + COLORS.textMuted + ';min-width:104px;flex-shrink:0;font-size:11px;font-weight:500', label);
        var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:11px;border-bottom:1px dashed ' + COLORS.textFaint + ';word-break:break-all', u);
        a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.onmouseover = function() { a.style.borderBottomColor = COLORS.textStrong; };
        a.onmouseout = function() { a.style.borderBottomColor = COLORS.textFaint; };
        sr.appendChild(lblEl); sr.appendChild(a);
        container.appendChild(sr); sizeRows.push(sr);
      })(bs[s][0], bs[s][1]);
    }
    stagger(sizeRows, 35, 60);
  }

  // Renders the Pivot tab into the container.
  function renderPivot(container) {
    container.appendChild(sectionTitle('Cross-platform pivot'));
    container.appendChild(el('div', 'color:' + COLORS.text + ';font-size:11.5px;padding:4px 0 10px 0;line-height:1.5',
      'Open @' + ctx.username + ' on:'));

    var pivots = [
      { name: 'WhatsMyName', desc: 'Look up this handle across 640+ sites', url: 'https://whatsmyname.app/?q=' + encodeURIComponent(ctx.username) },
      { name: 'Wayback',     desc: 'Historical snapshots of this profile',  url: 'https://web.archive.org/web/*/x.com/' + ctx.username }
    ];
    if (userId) pivots.push({ name: 'Wayback (UID)', desc: 'Snapshots via the numeric user ID URL',
      url: 'https://web.archive.org/web/*/x.com/i/user/' + userId });
    pivots.push({ name: 'Nitter (alt frontend)', desc: 'View the timeline without an account',
      url: 'https://nitter.net/' + ctx.username });

    var cards = [];
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
        card.onmouseout = function() {
          card.style.borderColor = COLORS.border;
          card.style.background = COLORS.surface;
          card.style.transform = 'translateY(0)';
          card.style.boxShadow = 'none';
          arrow.style.color = COLORS.textDim;
          arrow.style.transform = 'translateX(0)';
        };
        container.appendChild(card);
        cards.push(card);
      })(pivots[i]);
    }
    stagger(cards, 55, 60);
  }

})();
