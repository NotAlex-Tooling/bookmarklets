// title: "YouTube Channel OSINT"
// description: "Runs on a YouTube channel or video. Returns IDs, max-res banner and avatar, exact upload times, plus Filmot, Geofind, and Socialblade deep links."
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

  var onYouTube = /(?:^|\.)youtube\.com$/i.test(window.location.hostname);
  var pathParts = window.location.pathname.split('/').filter(Boolean);
  var first = (pathParts[0] || '').toLowerCase();

  var ctx = { type: 'unknown', videoId: null, channelKind: null, channelInput: null };
  if (!onYouTube) ctx.type = 'offsite';
  else if (first === 'watch') {
    ctx.type = 'video';
    var qp = new URLSearchParams(window.location.search);
    ctx.videoId = qp.get('v');
  } else if (first === 'shorts' && pathParts[1]) {
    ctx.type = 'video';
    ctx.videoId = pathParts[1];
  } else if (first === 'live' && pathParts[1]) {
    ctx.type = 'video';
    ctx.videoId = pathParts[1];
  } else if (first === 'channel' && pathParts[1]) {
    ctx.type = 'channel'; ctx.channelKind = 'channel'; ctx.channelInput = pathParts[1];
  } else if (first.charAt(0) === '@') {
    ctx.type = 'channel'; ctx.channelKind = 'handle'; ctx.channelInput = first.slice(1);
  } else if (first === 'c' && pathParts[1]) {
    ctx.type = 'channel'; ctx.channelKind = 'c'; ctx.channelInput = pathParts[1];
  } else if (first === 'user' && pathParts[1]) {
    ctx.type = 'channel'; ctx.channelKind = 'user'; ctx.channelInput = pathParts[1];
  } else ctx.type = 'other';

  var pageHtml = document.documentElement.innerHTML;

  // Returns the first capture-group match across the page HTML for any of the patterns.
  function findFirst(patterns) {
    for (var i = 0; i < patterns.length; i++) {
      var m = pageHtml.match(patterns[i]);
      if (m) return m[1];
    }
    return null;
  }

  // Decodes a JSON-encoded string fragment back to plain text.
  function decodeJsonString(s) {
    if (!s) return s;
    try { return JSON.parse('"' + s + '"'); } catch(e) { return s; }
  }

  var channelId = null;
  var canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    var c1 = canonical.href.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (c1) channelId = c1[1];
  }
  if (!channelId && ctx.channelKind === 'channel') channelId = ctx.channelInput;
  if (!channelId) {
    var pm = window.location.pathname.match(/\/channel\/(UC[a-zA-Z0-9_-]+)/);
    if (pm) channelId = pm[1];
  }
  if (!channelId) channelId = findFirst([
    /"channelId":"(UC[a-zA-Z0-9_-]+)"/,
    /"externalId":"(UC[a-zA-Z0-9_-]+)"/,
    /"externalChannelId":"(UC[a-zA-Z0-9_-]+)"/,
    /"browseId":"(UC[a-zA-Z0-9_-]+)"/
  ]);

  var handle = null;
  if (ctx.channelKind === 'handle') handle = ctx.channelInput;
  if (!handle) {
    var hm = pageHtml.match(/"vanityChannelUrl":"https?:\\?\/\\?\/www\.youtube\.com\\?\/@([^"]+)"/);
    if (hm) handle = hm[1];
  }
  if (!handle) {
    var hm2 = pageHtml.match(/"canonicalBaseUrl":"\\?\/@([^"]+)"/);
    if (hm2) handle = hm2[1];
  }

  var channelName = null;
  var ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle && ogTitle.content && ctx.type === 'channel') channelName = ogTitle.content;
  if (!channelName) {
    var nm = findFirst([/"ownerChannelName":"((?:[^"\\]|\\.)*)"/, /"author":"((?:[^"\\]|\\.)*)"/, /"title":"((?:[^"\\]|\\.)*)","navigationEndpoint"/]);
    if (nm) channelName = decodeJsonString(nm);
  }

  var subscriberCount = findFirst([
    /"subscriberCountText":\{"simpleText":"((?:[^"\\]|\\.)*)"\}/,
    /"subscriberCountText":\{"content":"((?:[^"\\]|\\.)*)"/,
    /"subscriberCountText":"((?:[^"\\]|\\.)*)"/,
    /"metadataParts":\[\{"text":\{"content":"((?:[^"\\]|\\.)*subscribers?(?:[^"\\]|\\.)*)"/i
  ]);
  if (subscriberCount) subscriberCount = decodeJsonString(subscriberCount);

  var joinedRaw = findFirst([
    /"joinedDateText":\{"simpleText":"Joined ([^"]+)"\}/,
    /"joinedDateText":\{"content":"Joined ([^"]+?)"/
  ]);

  var country = findFirst([
    /"country":"((?:[^"\\]|\\.)*)"/,
    /"contentValue":"([^"]+)"\}.*"title":"Country"/i
  ]);

  var videoCount = findFirst([
    /"videosCountText":\{"runs":\[\{"text":"([\d,]+)"/,
    /"videoCountText":\{"runs":\[\{"text":"([\d,]+)"/
  ]);
  var viewCount = findFirst([
    /"viewCountText":\{"simpleText":"([\d,]+ views?)"\}/i
  ]);

  var description = null;
  var descMatch = pageHtml.match(/"description":\{"simpleText":"((?:[^"\\]|\\.)*)"/) ||
                  pageHtml.match(/"description":"((?:[^"\\]|\\.)*)"/);
  if (descMatch) description = decodeJsonString(descMatch[1]);

  // Locates the channel avatar URL from the DOM and falls back to ytInitialData.
  function findAvatar() {
    var a = document.querySelector('yt-img-shadow #img[src*="yt3.googleusercontent.com"], yt-img-shadow #img[src*="yt3.ggpht.com"]');
    if (a && a.src) return a.src;
    var b = document.querySelector('img.yt-spec-avatar-shape__image, img[id^="avatar"]');
    if (b && b.src && /yt3\./.test(b.src)) return b.src;
    var og = document.querySelector('meta[property="og:image"]');
    if (og && og.content && /yt3\./.test(og.content)) return og.content;
    var rm = pageHtml.match(/"avatar":\{"thumbnails":\[\{"url":"((?:[^"\\]|\\.)*)"/);
    if (rm) return decodeJsonString(rm[1]);
    return null;
  }

  // Locates the channel banner URL across DOM, srcset, background-image, raw HTML, and ytInitialData.
  function findBanner() {
    var imgs = document.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var u = imgs[i].src || imgs[i].getAttribute('src') || '';
      if (!u || !/yt3\.(googleusercontent|ggpht)\.com/.test(u)) continue;
      if (/fcrop64=/.test(u)) return u;
    }
    var srcsets = document.querySelectorAll('img[srcset], source[srcset], picture source');
    for (var j = 0; j < srcsets.length; j++) {
      var ss = srcsets[j].getAttribute('srcset') || '';
      var sm = ss.match(/https?:\/\/yt3\.(?:googleusercontent|ggpht)\.com\/[^=\s,]+=w\d+-fcrop64=[^,\s]+/i);
      if (sm) return sm[0];
    }
    var bgEls = document.querySelectorAll('[style*="background"]');
    for (var k = 0; k < bgEls.length; k++) {
      var st = bgEls[k].getAttribute('style') || '';
      var bgm = st.match(/url\(["']?(https?:\/\/yt3\.[^"')]+=w\d+-fcrop64=[^"')]+)/i);
      if (bgm) return bgm[1];
    }
    var phm = pageHtml.match(/https?:\\?\/\\?\/yt3\.(?:googleusercontent|ggpht)\.com\\?\/[A-Za-z0-9_-]+=w\d+-fcrop64=[A-Za-z0-9,_-]+(?:-k-c0x[0-9a-fA-F]+)?(?:-no-nd-rj|-no-rj|-no-nd|-rj)?/i);
    if (phm) return phm[0].replace(/\\\//g, '/');
    var paths = [
      /"imageBannerViewModel":\{[^{}]*"image":\{"sources":\[\{"url":"((?:[^"\\]|\\.)*)"/,
      /"banner":\{"imageBannerViewModel":\{[^{}]*"image":\{"sources":\[\{"url":"((?:[^"\\]|\\.)*)"/,
      /"banner":\{"thumbnails":\[\{"url":"((?:[^"\\]|\\.)*)"/,
      /"tvBanner":\{"thumbnails":\[\{"url":"((?:[^"\\]|\\.)*)"/,
      /"mobileBanner":\{"thumbnails":\[\{"url":"((?:[^"\\]|\\.)*)"/,
      /"bannerExternalUrl":"((?:[^"\\]|\\.)*)"/
    ];
    for (var p = 0; p < paths.length; p++) {
      var m = pageHtml.match(paths[p]);
      if (m) return decodeJsonString(m[1]);
    }
    return null;
  }
  var avatarUrl = findAvatar();
  var bannerUrl = findBanner();

  // Builds every common size variant of the YouTube avatar URL.
  function avatarSizes(u) {
    if (!u) return null;
    var base = u.replace(/=.*$/, '');
    var tail = '-c-k-c0x00ffffff-no-rj';
    return {
      original: base + '=s0',
      s900: base + '=s900' + tail,
      s720: base + '=s720' + tail,
      s400: base + '=s400' + tail,
      s200: base + '=s200' + tail,
      s88:  base + '=s88'  + tail,
      s48:  base + '=s48'  + tail
    };
  }

  // Builds every common size variant of the YouTube banner URL.
  function bannerSizes(u) {
    if (!u) return null;
    var base = u.replace(/=.*$/, '');
    var cropMatch = u.match(/fcrop64=1,([0-9a-fA-F]+)/);
    var token = cropMatch ? cropMatch[1] : '00005a57ffffa5a8';
    var crop = '-fcrop64=1,' + token + '-k-c0xffffffff-no-nd-rj';
    return {
      original: base + '=s0',
      w2560: base + '=w2560' + crop,
      w2120: base + '=w2120' + crop,
      w1707: base + '=w1707' + crop,
      w1138: base + '=w1138' + crop,
      w1060: base + '=w1060' + crop,
      w320:  base + '=w320'  + crop
    };
  }

  var avatar = avatarSizes(avatarUrl);
  var banner = bannerSizes(bannerUrl);

  var videoInfo = null;
  if (ctx.type === 'video' && ctx.videoId) {
    videoInfo = { id: ctx.videoId };
    var ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < ldScripts.length; i++) {
      try {
        var ld = JSON.parse(ldScripts[i].textContent);
        if (ld.uploadDate) videoInfo.uploadDate = ld.uploadDate;
        if (ld.datePublished) videoInfo.publishDate = ld.datePublished;
        if (ld.name) videoInfo.title = ld.name;
      } catch(e) {}
    }
    if (!videoInfo.uploadDate) {
      var um = pageHtml.match(/"uploadDate":"([^"]+)"/);
      if (um) videoInfo.uploadDate = um[1];
    }
    if (!videoInfo.publishDate) {
      var pmd = pageHtml.match(/"publishDate":"([^"]+)"/);
      if (pmd) videoInfo.publishDate = pmd[1];
    }
    if (!videoInfo.title) {
      var tm = pageHtml.match(/"title":\{"text":"((?:[^"\\]|\\.)*)"\}/);
      if (tm) videoInfo.title = decodeJsonString(tm[1]);
    }
    var dtm = pageHtml.match(/"dateText":\{"simpleText":"([^"]+)"\}/);
    if (dtm) videoInfo.dateText = dtm[1];
  }

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
  titleEl.textContent = 'YouTube OSINT';
  titleEl.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' + COLORS.textStrong + ';line-height:1.1';
  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = ctx.type === 'channel' ? (handle ? '@' + handle : (channelId || '?')) :
                          ctx.type === 'video' ? 'watch?v=' + (ctx.videoId || '?') :
                          ctx.type === 'offsite' ? 'not on youtube.com' : ctx.type;
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
      val.style.cursor = 'pointer'; val.title = 'Click to copy';
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
    wrap.appendChild(el('span', 'color:' + COLORS.accent + ';font-family:' + MONO + ';font-size:11px;font-weight:600', '▸'));
    wrap.appendChild(el('span', 'color:' + COLORS.text + ';font-size:11px;text-transform:uppercase;letter-spacing:1.4px;font-weight:600', text));
    wrap.appendChild(el('div', 'flex:1;height:1px;background:linear-gradient(to right, ' + COLORS.borderSoft + ', transparent)'));
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
    div.appendChild(el('span', 'color:' + COLORS.textMuted + ';min-width:104px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', label));
    var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;word-break:break-all;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:11.5px;border-bottom:1px dashed ' + COLORS.textFaint, url);
    a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.onmouseover = function() { a.style.borderBottomColor = COLORS.textStrong; };
    a.onmouseout = function() { a.style.borderBottomColor = COLORS.textFaint; };
    div.appendChild(a);
    return div;
  }

  // Builds a status box; isError turns the text red.
  function statusBox(text, isError) {
    return el('div', 'color:' + (isError ? COLORS.danger : COLORS.text) + ';font-size:11.5px;line-height:1.55;padding:11px 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px', text);
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

  // Returns the uploads playlist ID for a UC… channel ID.
  function uploadsPlaylist(chId) { return chId && /^UC/.test(chId) ? 'UU' + chId.slice(2) : null; }

  if (ctx.type !== 'channel' && ctx.type !== 'video') {
    body.appendChild(sectionTitle('Wrong page'));
    body.appendChild(statusBox('You must be on a YouTube channel or video to use this.', true));
    return;
  }

  var TABS = [{ id: 'about', label: 'About', render: renderAbout }];
  if (ctx.type === 'video') TABS.push({ id: 'video', label: 'Video', render: renderVideo });
  TABS.push({ id: 'picture', label: 'Picture', render: renderPicture });
  TABS.push({ id: 'banner',  label: 'Banner',  render: renderBanner });
  TABS.push({ id: 'tools',   label: 'Tools',   render: renderTools });

  var activeTab = TABS[0].id;
  var tabButtons = {};
  var tabIndicator = el('div', 'position:absolute;bottom:0;height:2px;background:' + COLORS.accent + ';box-shadow:0 0 10px ' + COLORS.accentGlow + ';transition:left 0.22s cubic-bezier(0.4,0,0.2,1),width 0.22s cubic-bezier(0.4,0,0.2,1);pointer-events:none;border-radius:2px');
  tabStrip.appendChild(tabIndicator);

  for (var t = 0; t < TABS.length; t++) {
    (function(tab) {
      var b = el('button', 'background:none;border:none;color:' + COLORS.textMuted + ';padding:12px 14px;font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer;letter-spacing:0.3px;white-space:nowrap;transition:color 0.15s;position:relative', tab.label);
      b.onmouseover = function() { if (activeTab !== tab.id) b.style.color = COLORS.text; };
      b.onmouseout  = function() { if (activeTab !== tab.id) b.style.color = COLORS.textMuted; };
      b.onclick = function() { switchTab(tab.id); };
      tabButtons[tab.id] = b;
      tabStrip.appendChild(b);
    })(TABS[t]);
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
    for (var k in tabButtons) tabButtons[k].style.color = (k === id) ? COLORS.textStrong : COLORS.textMuted;
    clearNode(body); body.scrollTop = 0;
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
    container.appendChild(sectionTitle('Identity'));
    if (channelName) container.appendChild(row('Name', channelName, { copy: true }));
    if (handle)      container.appendChild(row('Handle', '@' + handle, { copy: true }));
    container.appendChild(row('Channel ID', channelId || '—', { copy: !!channelId, mono: true }));
    if (channelId)   container.appendChild(linkRow('Channel URL', 'https://www.youtube.com/channel/' + channelId));

    if (subscriberCount || videoCount || viewCount) {
      container.appendChild(sectionTitle('Stats'));
      if (subscriberCount) container.appendChild(row('Subscribers', subscriberCount));
      if (videoCount)      container.appendChild(row('Videos', videoCount));
      if (viewCount)       container.appendChild(row('Total views', viewCount));
    }

    if (joinedRaw || country) {
      container.appendChild(sectionTitle('Profile'));
      if (joinedRaw) {
        container.appendChild(row('Joined (display)', joinedRaw));
        var jm = joinedRaw.match(/([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
        if (jm) {
          var d = new Date(jm[1] + ' ' + jm[2] + ', ' + jm[3] + ' 00:00:00Z');
          if (!isNaN(d)) {
            container.appendChild(row('UTC', fmtDateShort(d), { copy: true, mono: true }));
            container.appendChild(row('Age', timeAgo(d)));
          }
        }
      }
      if (country) container.appendChild(row('Country', country, { copy: true }));
    }

    if (channelId) {
      var up = uploadsPlaylist(channelId);
      container.appendChild(sectionTitle('Uploads playlist'));
      container.appendChild(row('Playlist ID', up, { copy: true, mono: true }));
      container.appendChild(linkRow('Playlist URL', 'https://www.youtube.com/playlist?list=' + up));
      container.appendChild(el('div', 'padding:8px 0;color:' + COLORS.textMuted + ';font-size:11px;line-height:1.55',
        'Every channel ID UC… has a matching uploads playlist UU…. Hit that URL to see all uploads, sometimes including videos missing from the channel grid.'));
    }

    if (description) {
      container.appendChild(sectionTitle('Description'));
      var bx = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.text + ';white-space:pre-wrap;line-height:1.55;font-size:11.5px;border-radius:6px;background:' + COLORS.surface + ';max-height:200px;overflow-y:auto');
      bx.textContent = description;
      container.appendChild(bx);
    }
  }

  // Renders the Video tab into the container.
  function renderVideo(container) {
    container.appendChild(sectionTitle('Video'));
    container.appendChild(row('Video ID', videoInfo.id, { copy: true, mono: true }));
    if (videoInfo.title)   container.appendChild(row('Title', videoInfo.title, { copy: true }));
    if (channelName)       container.appendChild(row('Channel', channelName));
    if (videoInfo.dateText) container.appendChild(row('Display', videoInfo.dateText));

    var dateStr = videoInfo.uploadDate || videoInfo.publishDate;
    container.appendChild(sectionTitle('Timestamp'));
    if (!dateStr) {
      container.appendChild(statusBox('Upload date not found on this page. Refresh and try again.', true));
    } else {
      var d = new Date(dateStr);
      if (isNaN(d)) {
        container.appendChild(row('Date string', dateStr));
      } else {
        container.appendChild(row('UTC',   fmtDateShort(d), { copy: true, mono: true }));
        container.appendChild(row('Local', fmtLocal(d)));
        container.appendChild(row('Age',   timeAgo(d)));
        container.appendChild(row('ISO',   d.toISOString(), { copy: true, mono: true }));
        container.appendChild(row('Unix',  String(Math.floor(d.getTime() / 1000)), { copy: true, mono: true }));
      }
    }

    container.appendChild(sectionTitle('Video links'));
    container.appendChild(linkRow('Watch', 'https://www.youtube.com/watch?v=' + videoInfo.id));
    container.appendChild(linkRow('Embed', 'https://www.youtube.com/embed/' + videoInfo.id));
    container.appendChild(linkRow('Thumbnail', 'https://i.ytimg.com/vi/' + videoInfo.id + '/maxresdefault.jpg'));
    container.appendChild(linkRow('Wayback', 'https://web.archive.org/web/*/youtube.com/watch?v=' + videoInfo.id));
  }

  // Renders the Picture tab into the container.
  function renderPicture(container) {
    container.appendChild(sectionTitle('Profile picture'));
    if (!avatar) {
      container.appendChild(statusBox('Avatar not found on this page. Refresh and try again.', true));
      return;
    }

    var orig = avatar.original;
    var preview = el('div', 'padding:14px 0;text-align:center');
    var img = el('img', 'max-width:240px;max-height:240px;object-fit:cover;border-radius:50%;border:2px solid ' + COLORS.border + ';box-shadow:0 6px 24px rgba(0,0,0,0.5);background:#000');
    img.src = orig;
    img.onerror = function() { img.style.borderRadius = '0'; img.alt = 'failed to load'; };
    preview.appendChild(img);
    container.appendChild(preview);

    var urlBox = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;word-break:break-all;cursor:pointer;font-family:' + MONO + ';border-radius:6px;background:' + COLORS.surface);
    urlBox.textContent = orig; urlBox.title = 'Click to copy';
    urlBox.onclick = function() { copyText(orig, urlBox); };
    container.appendChild(urlBox);

    var actions = el('div', 'display:flex;gap:8px;padding-top:14px;flex-wrap:wrap');
    actions.appendChild(btn('Open original', function() { window.open(orig, '_blank'); }, { primary: true }));
    actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(orig); }));
    actions.appendChild(btn('Download', function() {
      var a = el('a'); a.href = orig; a.download = (handle || channelId || 'yt') + '_avatar.jpg';
      document.body.appendChild(a); a.click(); a.remove();
    }));
    container.appendChild(actions);

    container.appendChild(sectionTitle('All sizes'));
    var sizes = [
      ['original','=s0 (no crop · max)'],
      ['s900',    '900 × 900'],
      ['s720',    '720 × 720'],
      ['s400',    '400 × 400'],
      ['s200',    '200 × 200'],
      ['s88',     '88 × 88'],
      ['s48',     '48 × 48']
    ];
    var rows = [];
    for (var i = 0; i < sizes.length; i++) {
      (function(key, label) {
        var u = avatar[key];
        var sr = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:10px;align-items:center');
        sr.appendChild(el('span', 'color:' + COLORS.textMuted + ';min-width:110px;flex-shrink:0;font-size:11px;font-weight:500', label));
        var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:10.5px;border-bottom:1px dashed ' + COLORS.textFaint + ';word-break:break-all', u);
        a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.onmouseover = function() { a.style.borderBottomColor = COLORS.textStrong; };
        a.onmouseout = function() { a.style.borderBottomColor = COLORS.textFaint; };
        sr.appendChild(a);
        container.appendChild(sr); rows.push(sr);
      })(sizes[i][0], sizes[i][1]);
    }
    stagger(rows, 35, 60);
  }

  // Renders the Banner tab into the container.
  function renderBanner(container) {
    container.appendChild(sectionTitle('Channel banner'));
    if (!banner) {
      container.appendChild(statusBox('Banner not found on this page. This channel may not have one.', true));
      return;
    }

    var full = banner.w2560;
    var preview = el('div', 'padding:14px 0;text-align:center');
    var img = el('img', 'max-width:100%;border-radius:10px;border:1px solid ' + COLORS.border + ';box-shadow:0 6px 24px rgba(0,0,0,0.5)');
    img.src = full;
    img.onerror = function() { img.alt = 'banner failed to load'; };
    preview.appendChild(img);
    container.appendChild(preview);

    var urlBox = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;word-break:break-all;cursor:pointer;font-family:' + MONO + ';border-radius:6px;background:' + COLORS.surface);
    urlBox.textContent = full; urlBox.title = 'Click to copy';
    urlBox.onclick = function() { copyText(full, urlBox); };
    container.appendChild(urlBox);

    var actions = el('div', 'display:flex;gap:8px;padding-top:14px;flex-wrap:wrap');
    actions.appendChild(btn('Open w2560', function() { window.open(full, '_blank'); }, { primary: true }));
    actions.appendChild(btn('Open original (=s0)', function() { window.open(banner.original, '_blank'); }));
    actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(full); }));
    actions.appendChild(btn('Download', function() {
      var a = el('a'); a.href = full; a.download = (handle || channelId || 'yt') + '_banner.jpg';
      document.body.appendChild(a); a.click(); a.remove();
    }));
    container.appendChild(actions);

    container.appendChild(sectionTitle('All sizes'));
    container.appendChild(el('div', 'padding:6px 0 10px 0;color:' + COLORS.textMuted + ';font-size:11px;line-height:1.55',
      '=s0 strips the crop and gives the full uploaded image. The =wXXXX-fcrop64=… variants keep the channel-banner crop at the given width.'));
    var sizes = [
      ['original', '=s0 (uncropped · max)'],
      ['w2560',    'w2560 (desktop max)'],
      ['w2120',    'w2120'],
      ['w1707',    'w1707'],
      ['w1138',    'w1138'],
      ['w1060',    'w1060'],
      ['w320',     'w320 (mobile)']
    ];
    var rows = [];
    for (var i = 0; i < sizes.length; i++) {
      (function(key, label) {
        var u = banner[key];
        var sr = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:10px;align-items:center');
        sr.appendChild(el('span', 'color:' + COLORS.textMuted + ';min-width:110px;flex-shrink:0;font-size:11px;font-weight:500', label));
        var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:10.5px;border-bottom:1px dashed ' + COLORS.textFaint + ';word-break:break-all', u);
        a.href = u; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.onmouseover = function() { a.style.borderBottomColor = COLORS.textStrong; };
        a.onmouseout = function() { a.style.borderBottomColor = COLORS.textFaint; };
        sr.appendChild(a);
        container.appendChild(sr); rows.push(sr);
      })(sizes[i][0], sizes[i][1]);
    }
    stagger(rows, 35, 60);
  }

  // Renders the Tools tab into the container.
  function renderTools(container) {
    container.appendChild(sectionTitle('External pivots'));
    container.appendChild(el('div', 'color:' + COLORS.textMuted + ';font-size:11.5px;padding:4px 0 10px 0;line-height:1.5',
      channelId
        ? 'Deep-linked with channel ID ' + channelId + '.'
        : 'No channel ID detected — links default to homepages so you can paste manually.'));

    var tools = [];

    if (channelId) {
      tools.push({
        name:  'Filmot · unlisted lookup',
        desc:  'Filmot indexes unlisted YouTube videos. Channel page shows known unlisted/removed uploads tied to this channel.',
        url:   'https://filmot.com/channel/' + channelId
      });
    } else {
      tools.push({
        name:  'Filmot',
        desc:  'Search for unlisted YouTube videos by title / channel.',
        url:   'https://filmot.com'
      });
    }

    if (ctx.type === 'video' && videoInfo && videoInfo.id) {
      tools.push({
        name:  'Filmot · video lookup',
        desc:  'Look up this specific video ID on Filmot.',
        url:   'https://filmot.com/video/' + videoInfo.id
      });
    }

    if (channelId) {
      tools.push({
        name:  'Mattw · Geofind',
        desc:  'Find videos by geo-tagged location, including this channel’s uploads. Paste the channel ID/handle on load.',
        url:   'https://mattw.io/youtube-geofind/location?doSearch=true&channels=' + channelId
      });
      tools.push({
        name:  'Mattw · YouTube Metadata',
        desc:  'Detailed metadata viewer (channel + videos), with thumbnails, captions, geolocation.',
        url:   'https://mattw.io/youtube-metadata/?url=' + encodeURIComponent('https://www.youtube.com/channel/' + channelId) + '&submit=true'
      });
      tools.push({
        name:  'Mattw · YouTube Tools',
        desc:  'Catch-all hub for channel-aware utilities (Geofind, Metadata, Tags, etc).',
        url:   'https://mattw.io/youtube-tools/'
      });
      tools.push({
        name:  'Socialblade',
        desc:  'Subscriber and view-count history (long-term).',
        url:   'https://socialblade.com/youtube/channel/' + channelId
      });
      tools.push({
        name:  'Wayback Machine',
        desc:  'Historical snapshots of the channel page.',
        url:   'https://web.archive.org/web/*/youtube.com/channel/' + channelId
      });
      tools.push({
        name:  'Google site search',
        desc:  'Find pages mentioning this channel ID.',
        url:   'https://www.google.com/search?q=' + encodeURIComponent('"' + channelId + '"')
      });
    } else {
      tools.push({
        name:  'Mattw · Geofind',
        desc:  'Find YouTube videos by geo-tagged location.',
        url:   'https://mattw.io/youtube-geofind/'
      });
      tools.push({
        name:  'Mattw · YouTube Tools',
        desc:  'Hub of channel-aware utilities.',
        url:   'https://mattw.io/youtube-tools/'
      });
    }

    var cards = [];
    for (var i = 0; i < tools.length; i++) {
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
      })(tools[i]);
    }
    stagger(cards, 55, 60);

    if (handle) {
      container.appendChild(sectionTitle('Username pivots'));
      container.appendChild(linkRow('WhatsMyName', 'https://whatsmyname.app/?q=' + encodeURIComponent(handle)));
      container.appendChild(linkRow('Google',      'https://www.google.com/search?q=' + encodeURIComponent('"@' + handle + '"')));
    }
  }

})();
