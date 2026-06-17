// title: "Instagram Profile OSINT"
// description: "Runs on an Instagram profile. Returns IDs, location, HD pic, post-grid timestamps, collab links, and cross-platform pivots."
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
    foreign: '#34d399',
    foreignSoft: 'rgba(52,211,153,0.08)',
    danger: '#ef4444',
    warn: '#fbbf24'
  };
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Fira Mono",Consolas,monospace';
  var IG_APP_ID = '936619743392459';

  var pathParts = window.location.pathname.split('/').filter(Boolean);
  var first = pathParts[0] || '';
  var reserved = /^(p|reel|reels|stories|explore|direct|accounts|tv|s)$/i;

  var onInstagram = window.location.hostname.indexOf('instagram.com') !== -1;
  var isProfile = onInstagram && first && !reserved.test(first) && pathParts.length <= 2;
  var username = isProfile ? first : null;

  var pageHtml = document.documentElement.innerHTML;
  var inlineId = null;
  var m = pageHtml.match(/"profilePage_(\d+)"/) || pageHtml.match(/"user_id":"(\d+)"/) || pageHtml.match(/"id":"(\d+)","username"/);
  if (m) inlineId = m[1];

  var state = {
    profile: null,
    profileLoading: false,
    profileError: null,
    profileWaiters: [],
    hdUrl: null,
    posts: [],
    postsByShortcode: {},
    postsInitialDone: false,
    postsInitialLoading: false,
    postsInitialWaiters: [],
    feedMaxId: null,
    feedExhausted: false,
    feedAuthBlocked: false,
    about: null,
    aboutLoading: false,
    aboutError: null,
    aboutWaiters: [],
    stories: null,
    storiesLoading: false,
    storiesError: null,
    storiesWaiters: [],
    profileDocId: null
  };

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
    'cursor:grab',
    'user-select:none','-webkit-user-select:none',
    'flex-shrink:0','position:relative'
  ].join(';');

  var barAccent = document.createElement('div');
  barAccent.style.cssText = [
    'position:absolute','left:0','right:0','bottom:0','height:1px','overflow:hidden',
    'background:linear-gradient(to right, transparent, ' + COLORS.accent + '55, transparent)'
  ].join(';');
  var shimmer = document.createElement('div');
  shimmer.style.cssText = [
    'position:absolute','top:0','left:-30%','width:30%','height:100%',
    'background:linear-gradient(to right, transparent, ' + COLORS.accent + 'ff, transparent)'
  ].join(';');
  shimmer.animate(
    [{ left: '-30%' }, { left: '100%' }],
    { duration: 3200, iterations: Infinity, easing: 'ease-in-out' }
  );
  barAccent.appendChild(shimmer);
  bar.appendChild(barAccent);

  var titleWrap = document.createElement('div');
  titleWrap.style.cssText = 'display:flex;align-items:center;gap:11px;min-width:0;flex:1';

  var dot = document.createElement('span');
  dot.id = '_osint_status_dot';
  dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:' + COLORS.accent + ';flex-shrink:0;box-shadow:0 0 10px ' + COLORS.accentGlow;
  dot.animate(
    [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.45, transform: 'scale(0.78)' }],
    { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' }
  );

  var titleStack = document.createElement('div');
  titleStack.style.cssText = 'display:flex;flex-direction:column;min-width:0';
  var titleEl = document.createElement('div');
  titleEl.textContent = 'Instagram OSINT';
  titleEl.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' + COLORS.textStrong + ';line-height:1.1';
  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = isProfile ? '@' + username : 'not a profile';
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
  tabStrip.style.cssText = [
    'display:flex','background:' + COLORS.bar,
    'border-bottom:1px solid ' + COLORS.border,
    'overflow-x:auto','scrollbar-width:none',
    'flex-shrink:0','position:relative','padding:0 8px'
  ].join(';');

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
    wrap.appendChild(marker);
    wrap.appendChild(label);
    wrap.appendChild(rule);
    return wrap;
  }

  // Repaints the title-bar status dot in the given colour.
  function setStatusDot(color) {
    dot.style.background = color;
    dot.style.boxShadow = '0 0 8px ' + color;
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

  // Builds a stat tile that counts the value up from zero.
  function statTile(label, value) {
    var tile = el('div', [
      'padding:12px','background:' + COLORS.surface,'border:1px solid ' + COLORS.borderSoft,
      'border-radius:8px','position:relative','overflow:hidden',
      'transition:transform 0.16s ease-out, border-color 0.16s'
    ].join(';'));
    var accentBar = el('div', 'position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(to bottom, ' + COLORS.accent + ', transparent)');
    var lbl = el('div', 'color:' + COLORS.textMuted + ';font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;margin-bottom:6px', label);
    var val = el('div', 'color:' + COLORS.textStrong + ';font-size:20px;font-weight:600;font-family:' + MONO + ';letter-spacing:-0.5px', '0');
    tile.appendChild(accentBar);
    tile.appendChild(lbl);
    tile.appendChild(val);
    tile.onmouseover = function() { tile.style.borderColor = COLORS.accent; tile.style.transform = 'translateY(-1px)'; };
    tile.onmouseout = function() { tile.style.borderColor = COLORS.borderSoft; tile.style.transform = 'translateY(0)'; };
    countUp(val, value);
    return tile;
  }

  // Animates the node's text from 0 up to the target number.
  function countUp(node, target) {
    var n = Number(target);
    if (!isFinite(n) || target == null) { node.textContent = target == null ? '—' : String(target); return; }
    var duration = 700;
    var start = performance.now();

    // Local iteration helper.
    function step(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = fmtNum(Math.round(n * eased));
      if (t < 1) requestAnimationFrame(step);
      else node.textContent = fmtNum(n);
    }
    requestAnimationFrame(step);
  }

  // Builds a status box; isError turns the text red.
  function statusBox(text, isError) {
    return el('div', 'color:' + (isError ? COLORS.danger : COLORS.text) + ';font-size:11.5px;line-height:1.55;padding:11px 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px', text);
  }

  // Builds a labelled note banner with a coloured side rail; variant is 'anonymous' (green) or 'login' (amber).
  function noteBanner(variant, label, body) {
    var color = variant === 'anonymous' ? COLORS.accent : COLORS.warn;
    var wrap = el('div', 'display:flex;gap:10px;padding:10px 12px;margin:0 0 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px;border-left:3px solid ' + color);
    var labelEl = el('div', 'font-family:' + MONO + ';font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + color + ';flex-shrink:0;padding-top:1px', label);
    var bodyEl = el('div', 'color:' + COLORS.text + ';font-size:11.5px;line-height:1.55;flex:1', body);
    wrap.appendChild(labelEl); wrap.appendChild(bodyEl);
    return wrap;
  }

  // Builds a spinning loader element with an optional caption.
  function spinner(text) {
    var wrap = el('div', 'padding:24px 0;text-align:center;color:' + COLORS.textMuted + ';font-size:12px');
    var s = el('div', 'display:inline-block;width:13px;height:13px;border:2px solid ' + COLORS.border + ';border-top-color:' + COLORS.textStrong + ';border-radius:50%;margin-right:10px;vertical-align:middle');
    s.animate([{transform:'rotate(0)'},{transform:'rotate(360deg)'}], { duration:700, iterations:Infinity });
    wrap.appendChild(s);
    wrap.appendChild(document.createTextNode(text || 'Loading…'));
    return wrap;
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
    return d.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short'
    });
  }

  // Returns the number formatted with grouping separators.
  function fmtNum(n) {
    if (n == null) return '—';
    try { return Number(n).toLocaleString(); } catch(e) { return String(n); }
  }

  // Returns a human-friendly relative time string for the given date.
  function timeAgo(date) {
    var diffMs = Date.now() - date.getTime();
    var days = Math.floor(diffMs / 86400000);
    var hours = Math.floor(diffMs / 3600000);
    var mins = Math.floor(diffMs / 60000);
    if (days > 730) return Math.floor(days/365) + 'y ago';
    if (days > 60) return Math.floor(days/30) + 'mo ago';
    if (days > 0) return days + 'd ago';
    if (hours > 0) return hours + 'h ago';
    return mins + 'm ago';
  }

  // Estimates an Instagram account creation date by interpolating between known ID anchors.
  function estimateAccountAge(idStr) {
    if (!idStr) return null;
    var id = Number(idStr);
    if (!isFinite(id) || id <= 0) return null;
    var anchors = [
      [10,            new Date(Date.UTC(2010, 9,  6))],
      [1000,          new Date(Date.UTC(2010, 10, 1))],
      [100000,        new Date(Date.UTC(2010, 11, 1))],
      [1000000,       new Date(Date.UTC(2011, 1,  1))],
      [10000000,      new Date(Date.UTC(2011, 8,  1))],
      [100000000,     new Date(Date.UTC(2012, 8,  1))],
      [1000000000,    new Date(Date.UTC(2014, 3,  1))],
      [2000000000,    new Date(Date.UTC(2015, 5,  1))],
      [5000000000,    new Date(Date.UTC(2017, 8,  1))],
      [10000000000,   new Date(Date.UTC(2019, 3,  1))],
      [25000000000,   new Date(Date.UTC(2020, 9,  1))],
      [50000000000,   new Date(Date.UTC(2022, 4,  1))],
      [60000000000,   new Date(Date.UTC(2023, 1,  1))],
      [70000000000,   new Date(Date.UTC(2024, 1,  1))]
    ];
    for (var i = 0; i < anchors.length - 1; i++) {
      if (id >= anchors[i][0] && id < anchors[i+1][0]) {
        var lo = anchors[i], hi = anchors[i+1];
        var frac = (Math.log(id) - Math.log(lo[0])) / (Math.log(hi[0]) - Math.log(lo[0]));
        return new Date(lo[1].getTime() + frac * (hi[1].getTime() - lo[1].getTime()));
      }
    }
    if (id >= anchors[anchors.length-1][0]) return anchors[anchors.length-1][1];
    return anchors[0][1];
  }

  // Returns a single location string from any address fields the user object exposes.
  function locationFrom(user) {
    if (!user) return null;
    if (user.business_address_json) {
      try {
        var a = JSON.parse(user.business_address_json);
        var parts = [];
        ['street_address','city_name','region_name','zip_code'].forEach(function(k){ if(a[k]) parts.push(a[k]); });
        if (parts.length) return parts.join(', ');
      } catch(e) {}
    }
    if (user.address_street) {
      var bits = [user.address_street, user.city_name, user.zip].filter(Boolean);
      if (bits.length) return bits.join(', ');
    }
    if (user.city_name) return user.city_name;
    return null;
  }

  // Fetches and caches /api/v1/users/web_profile_info/, calling callback with the user object.
  function fetchProfile(callback) {
    if (state.profile) return callback(null, state.profile);
    if (state.profileError) return callback(state.profileError);
    state.profileWaiters.push(callback);
    if (state.profileLoading) return;
    if (!username) return callback(new Error('No username in URL.'));
    state.profileLoading = true;

    fetch('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username), {
      method: 'GET',
      headers: { 'X-IG-App-ID': IG_APP_ID },
      credentials: 'omit'
    })
    .then(function(res) {
      if (res.status === 404) throw new Error('User not found.');
      if (res.status === 429) throw new Error('Rate limited. Wait a few minutes.');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(json) {
      var user = (json.data && json.data.user) || json.user || (json.graphql && json.graphql.user);
      if (!user) throw new Error('Empty response.');
      state.profile = user;
      state.profileLoading = false;
      flushProfileWaiters(null, user);
    })
    .catch(function(err) {
      state.profileError = err;
      state.profileLoading = false;
      flushProfileWaiters(err);
    });
  }

  // Calls every pending profile waiter with err or data.
  function flushProfileWaiters(err, data) {
    var w = state.profileWaiters.slice();
    state.profileWaiters = [];
    for (var i = 0; i < w.length; i++) { try { w[i](err, data); } catch(e) {} }
  }

  // Adds new post nodes to state, deduplicated by shortcode.
  function addPosts(items) {
    var added = 0;
    for (var i = 0; i < items.length; i++) {
      var n = items[i];
      if (!n) continue;
      var sc = nodeShortcode(n);
      var key = sc || n.id || n.pk;
      if (!key || state.postsByShortcode[key]) continue;
      state.postsByShortcode[key] = n;
      state.posts.push(n);
      added++;
    }
    return added;
  }

  // Loads the first batch of posts from the page and inline scripts.
  function loadInitialPosts(callback) {
    if (state.postsInitialDone) return callback(null);
    state.postsInitialWaiters.push(callback);
    if (state.postsInitialLoading) return;
    state.postsInitialLoading = true;

    fetchProfile(function(err, user) {
      if (err) {
        state.postsInitialLoading = false;
        flushInitial(err);
        return;
      }
      addPosts(extractEdges(user));
      if (state.posts.length === 0) addPosts(scrapeAllInlinePosts());
      state.postsInitialDone = true;
      state.postsInitialLoading = false;
      flushInitial(null);
    });

    // Calls every pending initial-load waiter with err.
    function flushInitial(err) {
      var w = state.postsInitialWaiters.slice();
      state.postsInitialWaiters = [];
      for (var i = 0; i < w.length; i++) { try { w[i](err); } catch(_) {} }
    }
  }

  // Fetches one more page from /api/v1/feed/user/<uid>/ and merges items into state.
  function fetchNextFeedPage(callback) {
    if (state.feedExhausted) return callback(null, 0, true);
    if (state.feedAuthBlocked) return callback(new Error('Instagram requires login for the feed pagination endpoint. Log in to instagram.com in this tab and try again.'), 0, false);

    fetchProfile(function(err, user) {
      if (err) return callback(err, 0, false);
      var uid = user && (user.id || inlineId);
      if (!uid) return callback(new Error('No user ID — cannot paginate.'), 0, false);

      var url = '/api/v1/feed/user/' + encodeURIComponent(uid) + '/?count=33';
      if (state.feedMaxId) url += '&max_id=' + encodeURIComponent(state.feedMaxId);

      fetch(url, {
        method: 'GET',
        headers: { 'X-IG-App-ID': IG_APP_ID },
        credentials: 'include'
      }).then(function(res) {
        if (res.status === 401 || res.status === 403) {
          state.feedAuthBlocked = true;
          throw new Error('Feed endpoint requires login (HTTP ' + res.status + ').');
        }
        if (res.status === 429) throw new Error('Rate limited by Instagram. Wait a few minutes.');
        if (!res.ok) throw new Error('feed HTTP ' + res.status);
        return res.json();
      }).then(function(json) {
        var items = json.items || (json.feed_items && json.feed_items.map(function(it){ return it.media_or_ad; })) || [];
        items = items.filter(Boolean);
        var added = addPosts(items);
        state.feedMaxId = json.next_max_id || null;
        var exhausted = !json.more_available || !state.feedMaxId || items.length === 0;
        if (exhausted) state.feedExhausted = true;
        callback(null, added, exhausted);
      }).catch(function(e) {
        callback(e, 0, false);
      });
    });
  }

  // Keeps fetching feed pages until predicate is true, maxPages reached, or feed exhausted.
  function paginateUntil(predicate, maxPages, progressCb, callback) {
    var page = 0;

    // Local iteration helper.
    function next() {
      if (page >= maxPages || state.feedExhausted) return callback(null);
      if (predicate(state.posts)) return callback(null);
      page++;
      fetchNextFeedPage(function(err, added, exhausted) {
        if (err) return callback(err);
        if (progressCb) try { progressCb({ page: page, total: state.posts.length, addedThisPage: added }); } catch(_) {}
        if (exhausted) return callback(null);
        setTimeout(next, 220);
      });
    }
    next();
  }

  // Extracts post nodes from any known edges path on the user object.
  function extractEdges(user) {
    var nodes = [];
    var paths = [
      function() { return user.edge_owner_to_timeline_media && user.edge_owner_to_timeline_media.edges; },
      function() { return user.edge_felix_combined_post_uploads && user.edge_felix_combined_post_uploads.edges; },
      function() { return user.timeline_feed && user.timeline_feed.edges; },
      function() { return user.timeline && user.timeline.edges; }
    ];
    for (var p = 0; p < paths.length; p++) {
      try {
        var edges = paths[p]();
        if (edges && edges.length) {
          for (var e = 0; e < edges.length; e++) if (edges[e].node) nodes.push(edges[e].node);
          break;
        }
      } catch(_) {}
    }
    if (!nodes.length) {
      var arrays = [user.media && user.media.items, user.feed_items, user.items];
      for (var ai = 0; ai < arrays.length; ai++) {
        if (arrays[ai] && arrays[ai].length) {
          for (var bi = 0; bi < arrays[ai].length; bi++) nodes.push(arrays[ai][bi]);
          break;
        }
      }
    }
    return nodes;
  }

  // Fetches and caches /api/v1/users/<uid>/about_this_account/ data.
  function fetchAbout(callback) {
    if (state.about) return callback(null, state.about);
    if (state.aboutError) return callback(state.aboutError);
    state.aboutWaiters.push(callback);
    if (state.aboutLoading) return;
    state.aboutLoading = true;

    fetchProfile(function(err, user) {
      if (err) { state.aboutLoading = false; state.aboutError = err; return flushAbout(err); }
      var uid = user && (user.id || inlineId);
      if (!uid) { state.aboutLoading = false; state.aboutError = new Error('No user ID for about lookup.'); return flushAbout(state.aboutError); }

      fetch('/api/v1/users/' + encodeURIComponent(uid) + '/about_this_account/', {
        method: 'GET',
        headers: { 'X-IG-App-ID': IG_APP_ID },
        credentials: 'include'
      }).then(function(res) {
        if (res.status === 401 || res.status === 403) throw new Error('About endpoint requires login (HTTP ' + res.status + '). Log in to instagram.com in this tab.');
        if (res.status === 404) throw new Error('About this account not available for this user.');
        if (res.status === 429) throw new Error('Rate limited. Wait a few minutes.');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function(json) {
        state.about = json;
        state.aboutLoading = false;
        flushAbout(null, json);
      }).catch(function(e) {
        state.aboutError = e;
        state.aboutLoading = false;
        flushAbout(e);
      });
    });

    // Calls every pending about waiter with err or data.
    function flushAbout(err, data) {
      var w = state.aboutWaiters.slice();
      state.aboutWaiters = [];
      for (var i = 0; i < w.length; i++) { try { w[i](err, data); } catch(_) {} }
    }
  }

  // Reads one cookie value by name, decoded.
  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + '=([^;]+)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  // Computes the jazoest checksum that the gateway pairs with fb_dtsg.
  function computeJazoest(s) {
    var sum = 0;
    for (var i = 0; i < s.length; i++) sum += s.charCodeAt(i);
    return '2' + sum;
  }

  // Returns the per-page-load tokens needed to call /graphql/query.
  function getStoryTokens() {
    var html = document.documentElement.innerHTML;
    var dtsg = html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/);
    var lsd  = html.match(/"LSD",\[\],\{"token":"([^"]+)"/);
    return {
      fb_dtsg: dtsg ? dtsg[1] : null,
      lsd:     lsd  ? lsd[1]  : null,
      csrftoken: getCookie('csrftoken'),
      ds_user_id: getCookie('ds_user_id')
    };
  }

  // Live-scrapes the current GraphQL doc_id from the page's own JS bundles, caches it per name, and falls back to a known id only if the scan finds nothing.
  function findDocIdFor(friendlyName, fallback, callback) {
    state.docIds = state.docIds || {};
    if (state.docIds[friendlyName]) return callback(state.docIds[friendlyName]);
    var re = new RegExp(friendlyName + '_[A-Za-z]+RelayOperation[\\s\\S]{0,400}?a\\.exports\\s*=\\s*"(\\d{14,20})"');
    // Searches one script body for the friendly-name's doc_id, returning it or null.
    function scan(text) { if (!text || text.indexOf(friendlyName + '_') === -1) return null; var m = text.match(re); return m ? m[1] : null; }
    var scripts = document.querySelectorAll('script');
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src) continue;
      var hit = scan(scripts[i].textContent);
      if (hit) { state.docIds[friendlyName] = hit; return callback(hit); }
    }
    var externals = [];
    for (var j = 0; j < scripts.length; j++) if (scripts[j].src) externals.push(scripts[j].src);
    if (externals.length === 0) { state.docIds[friendlyName] = fallback; return callback(fallback); }
    var pending = externals.length, done = false;
    externals.forEach(function(src) {
      if (done) return;
      fetch(src, { credentials: 'omit' }).then(function(r) { return r.text(); }).then(function(txt) {
        if (done) return;
        var hx = scan(txt);
        if (hx) { done = true; state.docIds[friendlyName] = hx; return callback(hx); }
        if (--pending === 0 && !done) { done = true; state.docIds[friendlyName] = fallback; callback(fallback); }
      }).catch(function() {
        if (--pending === 0 && !done) { done = true; state.docIds[friendlyName] = fallback; callback(fallback); }
      });
    });
  }

  // Fetches and caches the active-stories reel for the current profile (read-only, no seen-mutation fired).
  function fetchStories(callback) {
    if (state.stories) return callback(null, state.stories);
    if (state.storiesError) return callback(state.storiesError);
    state.storiesWaiters.push(callback);
    if (state.storiesLoading) return;
    state.storiesLoading = true;

    fetchProfile(function(err, user) {
      if (err) { state.storiesLoading = false; state.storiesError = err; return flushStories(err); }
      var uid = user && (user.id || inlineId);
      if (!uid) { state.storiesLoading = false; state.storiesError = new Error('User ID not found on this page. Refresh and try again.'); return flushStories(state.storiesError); }

      var t = getStoryTokens();
      if (!t.fb_dtsg || !t.lsd || !t.csrftoken) {
        state.storiesLoading = false;
        state.storiesError = new Error('Page tokens (fb_dtsg / lsd / csrftoken) not found. Refresh the page and try again.');
        return flushStories(state.storiesError);
      }

      findDocIdFor('PolarisStoriesV3ReelPageStandaloneQuery', '27252946567650102', function(storiesDocId) {
        var body = new URLSearchParams({
          av: t.ds_user_id || '0',
          fb_dtsg: t.fb_dtsg,
          lsd: t.lsd,
          jazoest: computeJazoest(t.fb_dtsg),
          doc_id: storiesDocId,
          fb_api_req_friendly_name: 'PolarisStoriesV3ReelPageStandaloneQuery',
          variables: JSON.stringify({ reel_ids_arr: [String(uid)] }),
          server_timestamps: 'true'
        });

        fetch('/graphql/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-IG-App-ID': IG_APP_ID,
            'X-CSRFToken': t.csrftoken,
            'X-FB-LSD': t.lsd,
            'X-FB-Friendly-Name': 'PolarisStoriesV3ReelPageStandaloneQuery',
            'X-Root-Field-Name': 'xdt_api__v1__feed__reels_media'
          },
          body: body.toString(),
          credentials: 'include'
        }).then(function(res) {
          if (res.status === 401 || res.status === 403) throw new Error('Stories endpoint requires login (HTTP ' + res.status + '). Log in to instagram.com and try again.');
          if (res.status === 429) throw new Error('Rate limited. Wait a few minutes.');
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        }).then(function(json) {
          var reels = json && json.data && json.data.xdt_api__v1__feed__reels_media && json.data.xdt_api__v1__feed__reels_media.reels_media;
          var reel = (reels && reels[0]) || null;
          state.stories = reel || { items: [] };
          state.storiesLoading = false;
          flushStories(null, state.stories);
        }).catch(function(e) {
          state.storiesError = e;
          state.storiesLoading = false;
          flushStories(e);
        });
      });
    });

    // Calls every pending stories waiter with err or data.
    function flushStories(err, data) {
      var w = state.storiesWaiters.slice();
      state.storiesWaiters = [];
      for (var i = 0; i < w.length; i++) { try { w[i](err, data); } catch(_) {} }
    }
  }

  // Scrapes inline script tags for post objects matching shortcodes on the page.
  function scrapeAllInlinePosts() {
    var anchors = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
    var wanted = {};
    for (var i = 0; i < anchors.length; i++) {
      var h = anchors[i].getAttribute('href') || '';
      var m2 = h.match(/\/(p|reel)\/([^\/?#]+)/);
      if (m2) wanted[m2[2]] = true;
    }
    if (!Object.keys(wanted).length) return [];

    var found = {};
    var scripts = document.querySelectorAll('script');
    for (var s = 0; s < scripts.length; s++) {
      var txt = scripts[s].textContent;
      if (!txt) continue;
      if (txt.indexOf('"shortcode"') === -1 && txt.indexOf('"code"') === -1) continue;
      for (var sc in wanted) {
        if (found[sc]) continue;
        var slice = sliceObjectAround(txt, sc);
        if (slice) {
          try {
            var parsed = JSON.parse(slice);
            if (parsed.shortcode === sc || parsed.code === sc) found[sc] = parsed;
          } catch(_) {}
        }
      }
    }
    var out = [];
    for (var k in found) out.push(found[k]);
    return out;
  }

  // Returns the smallest JSON object substring in text that contains the given shortcode.
  function sliceObjectAround(text, shortcode) {
    var markers = ['"shortcode":"' + shortcode + '"', '"code":"' + shortcode + '"'];
    var pos = -1;
    for (var mi = 0; mi < markers.length && pos < 0; mi++) pos = text.indexOf(markers[mi]);
    if (pos < 0) return null;

    var start = pos;
    var depth = 0;
    while (start > 0) {
      var c = text.charAt(start);
      if (c === '{') { if (depth === 0) break; depth--; }
      else if (c === '}') depth++;
      start--;
    }
    if (text.charAt(start) !== '{') return null;

    depth = 0;
    var end = start, inStr = false, esc = false;
    while (end < text.length) {
      var ch = text.charAt(end);
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = !inStr;
      else if (!inStr) {
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end++; break; } }
      }
      end++;
    }
    return text.substring(start, end);
  }

  // Returns tagged users and coauthors on a post, plus an owner flag if the post is owned by another account.
  function extractCollabs(node, ownUsername) {
    var tagged = [], coauthors = [];
    try {
      var tags = node.edge_media_to_tagged_user && node.edge_media_to_tagged_user.edges || [];
      for (var t = 0; t < tags.length; t++) tagged.push(tags[t].node.user.username);
    } catch(_) {}
    try {
      if (node.usertags && node.usertags.in) {
        for (var ut = 0; ut < node.usertags.in.length; ut++) {
          var uname = node.usertags.in[ut].user.username;
          if (tagged.indexOf(uname) === -1) tagged.push(uname);
        }
      }
    } catch(_) {}
    try {
      if (node.coauthor_producers) {
        for (var c = 0; c < node.coauthor_producers.length; c++) coauthors.push(node.coauthor_producers[c].username);
      }
    } catch(_) {}
    try {
      if (node.invited_coauthor_producers) {
        for (var ic = 0; ic < node.invited_coauthor_producers.length; ic++) coauthors.push(node.invited_coauthor_producers[ic].username);
      }
    } catch(_) {}

    var owner = null, ownerIsPrivate = false;
    try {
      if (node.owner && node.owner.username) {
        owner = node.owner.username;
        ownerIsPrivate = !!node.owner.is_private;
      }
    } catch(_) {}
    var ownerForeign = owner && owner !== ownUsername;

    var seen = {};
    var all = [];

    // Local helper for building a result set.
    function add(name, kind) {
      if (!name || name === ownUsername || seen[name]) return;
      seen[name] = true;
      all.push({ username: name, kind: kind });
    }
    if (ownerForeign) add(owner, 'owner');
    for (var i = 0; i < coauthors.length; i++) add(coauthors[i], 'coauthor');
    for (var j = 0; j < tagged.length; j++) add(tagged[j], 'tagged');

    return {
      all: all,
      coauthors: coauthors,
      tagged: tagged,
      owner: owner,
      ownerForeign: ownerForeign,
      ownerIsPrivate: ownerIsPrivate
    };
  }

  // Returns the post's shortcode (or empty string).
  function nodeShortcode(node) { return node.shortcode || node.code || ''; }

  // Returns true if the post is a reel/video.
  function nodeIsVideo(node)  { return node.is_video || node.media_type === 2; }

  // Returns true if the post is a multi-media carousel.
  function nodeIsCarousel(node) {
    return node.media_type === 8 || node.__typename === 'GraphSidecar' ||
      (node.edge_sidecar_to_children && node.edge_sidecar_to_children.edges && node.edge_sidecar_to_children.edges.length) ||
      (node.carousel_media && node.carousel_media.length);
  }

  // Returns the post's thumbnail URL from any known field.
  function nodeThumb(node) {
    return node.thumbnail_src || node.display_url ||
      (node.image_versions2 && node.image_versions2.candidates && node.image_versions2.candidates[0] && node.image_versions2.candidates[0].url);
  }

  // Returns the post's upload time as a Date, or null.
  function nodeTime(node) {
    var ts = node.taken_at_timestamp || node.taken_at;
    return ts ? new Date(ts * 1000) : null;
  }

  if (!isProfile) {
    body.appendChild(sectionTitle('Wrong page'));
    body.appendChild(statusBox('You must be on an Instagram profile to use this.', true));
    return;
  }

  var TABS = [
    { id: 'about',   label: 'About',   render: renderAbout },
    { id: 'picture', label: 'Picture', render: renderPicture },
    { id: 'stories', label: 'Stories', render: renderStories },
    { id: 'posts',   label: 'Posts',   render: renderPosts },
    { id: 'collabs', label: 'Collabs', render: renderCollabs },
    { id: 'pivot',   label: 'Pivot',   render: renderPivot }
  ];

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

  // Fades and slides a node into view after the given delay.
  function animateIn(node, delay) {
    if (!node || !node.animate) return;
    try {
      node.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ],
        { duration: 280, delay: delay || 0, easing: 'cubic-bezier(0.2, 0, 0, 1)', fill: 'backwards' }
      );
    } catch(_) {}
  }

  // Runs animateIn on a list of nodes, offsetting each by step ms.
  function stagger(nodes, step, baseDelay) {
    step = step || 50;
    baseDelay = baseDelay || 0;
    for (var i = 0; i < nodes.length; i++) animateIn(nodes[i], baseDelay + i * step);
  }

  // Renders the About tab into the container.
  function renderAbout(container) {
    container.appendChild(spinner('Fetching @' + username + ' …'));

    fetchProfile(function(err, user) {
      clearNode(container);
      if (err) {
        container.appendChild(statusBox(err.message, true));
        if (inlineId) {
          container.appendChild(sectionTitle('Fallback (from page source)'));
          container.appendChild(row('Username', '@' + username, { copy: true }));
          container.appendChild(row('ID', inlineId, { copy: true }));
          var est0 = estimateAccountAge(inlineId);
          if (est0) container.appendChild(row('Created', '~' + est0.toLocaleDateString('en-US', { year:'numeric', month:'short' }) + '  (' + timeAgo(est0) + ', estimated)'));
        }
        return;
      }

      container.appendChild(sectionTitle('Identity'));
      container.appendChild(row('Username', '@' + (user.username || username), { copy: true }));
      if (user.full_name) container.appendChild(row('Name', user.full_name, { copy: true }));
      if (user.pronouns && user.pronouns.length) container.appendChild(row('Pronouns', user.pronouns.join('/')));
      container.appendChild(row('ID', user.id || inlineId || '—', { copy: true }));
      if (user.fbid_v2) container.appendChild(row('FBID', user.fbid_v2, { copy: true }));

      var flags = [];
      if (user.is_verified) flags.push('verified');
      flags.push(user.is_private ? 'private' : 'public');
      if (user.is_business_account) flags.push('business');
      if (user.is_professional_account) flags.push('professional');
      if (user.has_clips) flags.push('reels');
      if (user.has_channel) flags.push('channel');
      if (user.hide_like_and_view_counts) flags.push('counts-hidden');
      container.appendChild(row('Flags', flags.join(' · ')));

      var createdRow = row('Created', 'Loading from About this account…');
      container.appendChild(createdRow);
      var locRow = null;
      var loc = locationFrom(user);
      if (loc) { locRow = row('Location', loc, { copy: true }); container.appendChild(locRow); }
      var formerRow = null;

      fetchAbout(function(aboutErr, about) {
        var valEl = createdRow.querySelector('span:last-child');
        if (about) {
          var lines = [];
          if (about.date_joined) lines.push(about.date_joined);
          if (about.date_joined_as_timestamp) {
            var d = new Date(about.date_joined_as_timestamp * 1000);
            lines.push('(' + timeAgo(d) + ')');
          }
          if (lines.length) {
            valEl.textContent = lines.join('  ');
            valEl.title = 'From About this account';
          } else {
            useEstimate(valEl);
          }
          if (!locRow && about.country) {
            locRow = row('Country', about.country, { copy: true });
            createdRow.parentNode.insertBefore(locRow, createdRow.nextSibling);
          }
          if (about.former_usernames && about.former_usernames.length) {
            var formerList = about.former_usernames.map(function(f) {
              return typeof f === 'string' ? f : (f.username || JSON.stringify(f));
            }).join(', ');
            formerRow = row('Former handles', formerList, { copy: true });
            createdRow.parentNode.insertBefore(formerRow, (locRow || createdRow).nextSibling);
          }
        } else {
          useEstimate(valEl, aboutErr && aboutErr.message);
        }
      });

      // Fills the row with the logarithmic ID-based estimate.
      function useEstimate(valEl, errMsg) {
        var est = estimateAccountAge(user.id || inlineId);
        if (est) {
          valEl.textContent = '~' + est.toLocaleDateString('en-US', { year:'numeric', month:'short' }) + '  (' + timeAgo(est) + ', estimated)';
          valEl.title = (errMsg ? 'About endpoint: ' + errMsg + '. ' : '') + 'Estimated from numeric ID — accurate to within a few months.';
        } else {
          valEl.textContent = '—';
          valEl.title = errMsg || '';
        }
      }

      container.appendChild(sectionTitle('Stats'));
      var followers = user.edge_followed_by ? user.edge_followed_by.count : user.follower_count;
      var following = user.edge_follow ? user.edge_follow.count : user.following_count;
      var postsN   = user.edge_owner_to_timeline_media ? user.edge_owner_to_timeline_media.count : user.media_count;

      var statRow = el('div', 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:4px 0 4px 0');
      var t1 = statTile('Followers', followers); statRow.appendChild(t1);
      var t2 = statTile('Following', following); statRow.appendChild(t2);
      var t3 = statTile('Posts',     postsN);    statRow.appendChild(t3);
      container.appendChild(statRow);
      stagger([t1, t2, t3], 60, 80);

      if (user.highlight_reel_count != null) {
        var extra = el('div', 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px');
        var ex1 = statTile('Highlights', user.highlight_reel_count); extra.appendChild(ex1);
        var ex2 = null;
        if (user.mutual_followers_count != null) { ex2 = statTile('Mutuals', user.mutual_followers_count); extra.appendChild(ex2); }
        container.appendChild(extra);
        stagger(ex2 ? [ex1, ex2] : [ex1], 60, 260);
      }

      if (user.category_name || user.business_category_name || user.category || user.business_email || user.business_phone_number) {
        container.appendChild(sectionTitle('Business / category'));
        if (user.category_name) container.appendChild(row('Category', user.category_name));
        else if (user.category) container.appendChild(row('Category', user.category));
        if (user.business_category_name) container.appendChild(row('Business cat', user.business_category_name));
        if (user.business_email) container.appendChild(row('Email', user.business_email, { copy: true }));
        if (user.business_phone_number) container.appendChild(row('Phone', user.business_phone_number, { copy: true }));
        if (user.business_contact_method) container.appendChild(row('Contact', user.business_contact_method));
      }

      if (user.biography) {
        container.appendChild(sectionTitle('Bio'));
        var bioBox = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.text + ';white-space:pre-wrap;line-height:1.55;font-size:11.5px');
        bioBox.textContent = user.biography;
        container.appendChild(bioBox);
      }

      var links = [];
      if (user.bio_links && user.bio_links.length) {
        for (var l = 0; l < user.bio_links.length; l++) {
          var bl = user.bio_links[l];
          var u = bl.url || bl.lynx_url;
          if (u) links.push({ url: u, title: bl.title || '' });
        }
      }
      if (user.external_url && !links.some(function(L){ return L.url === user.external_url; })) {
        links.push({ url: user.external_url, title: '' });
      }
      if (links.length) {
        container.appendChild(sectionTitle('Links (' + links.length + ')'));
        for (var li = 0; li < links.length; li++) {
          var label = links[li].title ? links[li].title : 'Link ' + (li + 1);
          container.appendChild(linkRow(label, links[li].url));
        }
      }

      if (user.connected_fb_page) {
        container.appendChild(sectionTitle('Connected Facebook'));
        container.appendChild(linkRow('FB Page', 'https://facebook.com/' + user.connected_fb_page));
      }
    });
  }

  // Renders the Picture tab into the container.
  function renderPicture(container) {
    container.appendChild(sectionTitle('HD profile picture'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to instagram.com — the GraphQL profile endpoint rejects anonymous requests.'));

    // Renders the loaded URL as a preview with open / copy / download actions.
    function show(url) {
      clearNode(container);
      container.appendChild(sectionTitle('HD profile picture'));
      container.appendChild(noteBanner('login', 'Requires login',
        'You must be logged in to instagram.com — the GraphQL profile endpoint rejects anonymous requests.'));

      var preview = el('div', 'padding:14px 0;text-align:center');
      var img = el('img', 'max-width:240px;max-height:240px;border-radius:50%;border:2px solid ' + COLORS.border + ';box-shadow:0 4px 18px rgba(0,0,0,0.45)');
      img.src = url;
      img.onerror = function() { img.style.borderRadius = '0'; img.alt = 'Failed to load'; };
      preview.appendChild(img);
      container.appendChild(preview);

      var urlBox = el('div', 'padding:8px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10px;line-height:1.5;word-break:break-all;cursor:pointer');
      urlBox.textContent = url;
      urlBox.title = 'Click to copy';
      urlBox.onclick = function() { copyText(url, urlBox); };
      container.appendChild(urlBox);

      var actions = el('div', 'display:flex;gap:8px;padding-top:14px;flex-wrap:wrap');
      actions.appendChild(btn('Open full size', function() { window.open(url, '_blank'); }, { primary: true }));
      actions.appendChild(btn('Copy URL', function() { navigator.clipboard.writeText(url); }));
      actions.appendChild(btn('Download', function() {
        var a = el('a');
        a.href = url; a.download = (username || 'profile') + '_hd.jpg';
        document.body.appendChild(a); a.click(); a.remove();
      }));
      container.appendChild(actions);
    }

    // Matches the relay-operation module pattern `__d("PolarisProfilePageContentQuery_<vendor>RelayOperation",...{a.exports="<docId>"}` in any script text.
    function extractDocId(text) {
      if (!text || text.indexOf('PolarisProfilePageContentQuery_') === -1) return null;
      var m = text.match(/PolarisProfilePageContentQuery_[A-Za-z]+RelayOperation[\s\S]{0,400}?a\.exports\s*=\s*"(\d{14,20})"/);
      return m ? m[1] : null;
    }

    // Scrapes inline + external scripts in parallel to locate the live PolarisProfilePageContentQuery doc_id and caches it on state.
    function findDocId(callback) {
      if (state.profileDocId) return callback(null, state.profileDocId);
      var scripts = document.querySelectorAll('script');
      for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src) continue;
        var hit = extractDocId(scripts[i].textContent);
        if (hit) { state.profileDocId = hit; return callback(null, hit); }
      }
      var externals = [];
      for (var j = 0; j < scripts.length; j++) if (scripts[j].src) externals.push(scripts[j].src);
      if (externals.length === 0) return callback(new Error('PolarisProfilePageContentQuery doc_id not in any script. Refresh and try again.'));
      var pending = externals.length;
      var done = false;
      externals.forEach(function(src) {
        if (done) return;
        fetch(src, { credentials: 'omit' })
          .then(function(r) { return r.text(); })
          .then(function(txt) {
            if (done) return;
            var hitX = extractDocId(txt);
            if (hitX) { done = true; state.profileDocId = hitX; return callback(null, hitX); }
            if (--pending === 0 && !done) { done = true; callback(new Error('PolarisProfilePageContentQuery doc_id not in any loaded script.')); }
          })
          .catch(function() {
            if (--pending === 0 && !done) { done = true; callback(new Error('PolarisProfilePageContentQuery doc_id not in any loaded script.')); }
          });
      });
    }

    // POSTs PolarisProfilePageContentQuery to /api/graphql with the live doc_id and renders hd_profile_pic_url_info.url; reports the raw response on failure.
    function callGraphQL(uid, loadingEl) {
      var t = getStoryTokens();
      if (!t.fb_dtsg || !t.lsd || !t.csrftoken) {
        loadingEl.remove();
        return container.appendChild(statusBox('Page tokens (fb_dtsg / lsd / csrftoken) not found. Refresh instagram.com and try again.', true));
      }
      findDocId(function(docErr, docId) {
        if (docErr) {
          loadingEl.remove();
          return container.appendChild(statusBox(docErr.message, true));
        }
        var body = new URLSearchParams({
          av: t.ds_user_id || '0',
          fb_dtsg: t.fb_dtsg,
          jazoest: computeJazoest(t.fb_dtsg),
          lsd: t.lsd,
          fb_api_caller_class: 'RelayModern',
          fb_api_req_friendly_name: 'PolarisProfilePageContentQuery',
          variables: JSON.stringify({
            enable_integrity_filters: true,
            id: uid,
            __relay_internal__pv__PolarisCannesGuardianExperienceEnabledrelayprovider: true,
            __relay_internal__pv__PolarisCASB976ProfileEnabledrelayprovider: false,
            __relay_internal__pv__PolarisWebSchoolsEnabledrelayprovider: false,
            __relay_internal__pv__PolarisRepostsConsumptionEnabledrelayprovider: true
          }),
          server_timestamps: 'true',
          doc_id: docId
        });
        fetch('/api/graphql', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-ASBD-ID': '359341',
            'X-CSRFToken': t.csrftoken,
            'X-FB-LSD': t.lsd,
            'X-FB-Friendly-Name': 'PolarisProfilePageContentQuery',
            'X-IG-App-ID': IG_APP_ID,
            'X-IG-Max-Touch-Points': '0'
          },
          body: body.toString(),
          credentials: 'include'
        }).then(function(r) { return r.json(); })
          .then(function(d) {
            loadingEl.remove();
            if (d && d.data && d.data.user && d.data.user.hd_profile_pic_url_info && d.data.user.hd_profile_pic_url_info.url) {
              state.hdUrl = d.data.user.hd_profile_pic_url_info.url;
              return show(state.hdUrl);
            }
            container.appendChild(statusBox('GraphQL returned no profile picture (doc_id ' + docId + '). Response: ' + JSON.stringify(d).substring(0, 240), true));
          }).catch(function(e) {
            loadingEl.remove();
            container.appendChild(statusBox('Could not fetch HD profile picture: ' + e.message, true));
          });
      });
    }

    if (state.hdUrl) return show(state.hdUrl);

    var loading = spinner('Fetching HD profile picture…');
    container.appendChild(loading);

    if (inlineId) return callGraphQL(inlineId, loading);

    fetchProfile(function(err, user) {
      var uid = user && (user.id || inlineId);
      if (uid) return callGraphQL(uid, loading);
      loading.remove();
      if (err) return container.appendChild(statusBox(err.message, true));
      container.appendChild(statusBox('User ID not found on this page. Refresh and try again.', true));
    });
  }

  // Renders the Stories tab into the container.
  function renderStories(container) {
    container.appendChild(sectionTitle('Active stories'));
    container.appendChild(noteBanner('anonymous', 'Anonymous',
      'Reads the active story reel without firing the seen-mutation, so the account owner never sees you in their viewer list.'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to instagram.com in this tab — the stories endpoint rejects anonymous requests.'));

    var loading = spinner('Fetching stories…');
    container.appendChild(loading);

    fetchStories(function(err, reel) {
      loading.remove();
      if (err) return container.appendChild(statusBox(err.message, true));
      var items = (reel && reel.items) || [];
      if (!items.length) {
        container.appendChild(statusBox('No active stories for @' + username + '. The story window is 24 hours.'));
        return;
      }

      var summary = el('div', 'color:' + COLORS.text + ';font-size:11.5px;padding:0 0 10px;line-height:1.5',
        items.length + ' active slide' + (items.length === 1 ? '' : 's'));
      container.appendChild(summary);

      var cards = [];
      for (var i = 0; i < items.length; i++) {
        var card = buildStoryCard(items[i], i + 1);
        if (card) { container.appendChild(card); cards.push(card); }
      }
      stagger(cards, 60, 40);
    });
  }

  // Builds one story-slide card with preview, timestamp, and download links.
  function buildStoryCard(item, n) {
    if (!item) return null;
    var isVideo = item.media_type === 2 || (item.video_versions && item.video_versions.length);
    var imgCandidates = (item.image_versions2 && item.image_versions2.candidates) || [];
    var imgUrl = imgCandidates.length ? imgCandidates[0].url : null;
    var videoUrl = isVideo && item.video_versions && item.video_versions.length ? item.video_versions[0].url : null;
    var taken = item.taken_at ? new Date(item.taken_at * 1000) : null;
    var expiring = item.expiring_at ? new Date(item.expiring_at * 1000) : null;

    var card = el('div', 'padding:12px;margin-bottom:10px;border:1px solid ' + COLORS.borderSoft + ';border-radius:8px;display:flex;gap:12px;background:' + COLORS.surface);

    if (imgUrl) {
      var thumb = el('img', 'width:90px;height:160px;object-fit:cover;border:1px solid ' + COLORS.border + ';border-radius:6px;flex-shrink:0;background:#000');
      thumb.src = imgUrl;
      thumb.referrerPolicy = 'no-referrer';
      card.appendChild(thumb);
    }

    var info = el('div', 'flex:1;min-width:0;display:flex;flex-direction:column;gap:6px');
    info.appendChild(el('div', 'font-size:11.5px;font-weight:700;color:' + COLORS.textStrong, '#' + n + (isVideo ? ' · video' : ' · photo')));

    if (taken) info.appendChild(el('div', 'font-size:10.5px;color:' + COLORS.textMuted + ';font-family:' + MONO, 'taken ' + fmtDateShort(taken) + '  ·  ' + timeAgo(taken)));
    if (expiring) info.appendChild(el('div', 'font-size:10.5px;color:' + COLORS.textMuted + ';font-family:' + MONO, 'expires ' + fmtDateShort(expiring)));
    if (item.id) info.appendChild(el('div', 'font-size:10.5px;color:' + COLORS.textDim + ';font-family:' + MONO + ';word-break:break-all', 'id ' + item.id));

    var actions = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px');
    if (videoUrl) {
      actions.appendChild(btn('Open video', function() { window.open(videoUrl, '_blank'); }, { primary: true }));
      actions.appendChild(btn('Download video', function() {
        var a = el('a'); a.href = videoUrl; a.download = (username || 'ig') + '_story_' + n + '.mp4';
        document.body.appendChild(a); a.click(); a.remove();
      }));
    }
    if (imgUrl) {
      actions.appendChild(btn(videoUrl ? 'Open frame' : 'Open photo', function() { window.open(imgUrl, '_blank'); }, videoUrl ? {} : { primary: true }));
      actions.appendChild(btn('Download photo', function() {
        var a = el('a'); a.href = imgUrl; a.download = (username || 'ig') + '_story_' + n + '.jpg';
        document.body.appendChild(a); a.click(); a.remove();
      }));
    }
    info.appendChild(actions);

    card.appendChild(info);
    return card;
  }

  // Renders the Posts tab into the container.
  function renderPosts(container) {
    container.appendChild(sectionTitle('Post grid annotations'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to instagram.com — pagination beyond the first 12 posts hits the user-feed endpoint which rejects anonymous requests.'));
    container.appendChild(el('div', 'color:' + COLORS.textMuted + ';font-size:12px;line-height:1.55;padding-bottom:12px',
      'Walks every tile in the profile grid and overlays the actual upload date (in UTC, "Z" suffix) + kind + tagged / collab users. Paginates the user feed automatically until all visible tiles are matched. Hover any date chip to see the local-time equivalent.'));

    var ctrls = el('div', 'display:flex;gap:8px;padding-bottom:12px;flex-wrap:wrap');
    var runBtn = btn('Annotate grid', run, { primary: true });
    var moreBtn = btn('Fetch more pages', fetchMore);
    var clearBtn = btn('Clear', clearAnnotations);
    moreBtn.style.display = 'none';
    ctrls.appendChild(runBtn);
    ctrls.appendChild(moreBtn);
    ctrls.appendChild(clearBtn);
    container.appendChild(ctrls);

    var summary = statusBox('Idle. Click "Annotate grid" to begin.');
    container.appendChild(summary);

    // Updates the status box text and colour.
    function setStatus(text, isError) {
      summary.style.color = isError ? COLORS.danger : COLORS.text;
      summary.textContent = text;
    }

    // Removes every tile annotation overlay.
    function clearAnnotations() {
      var nodes = document.querySelectorAll('._osint_tile_overlay');
      for (var i = 0; i < nodes.length; i++) nodes[i].remove();
      setStatus('Annotations cleared.');
    }

    // Returns the set of shortcodes for tiles currently in the grid.
    function collectGridShortcodes() {
      var anchors = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      var list = [];
      var seen = {};
      for (var a = 0; a < anchors.length; a++) {
        if (anchors[a].closest('#_osint_win')) continue;
        var h = anchors[a].getAttribute('href') || '';
        var m2 = h.match(/\/(p|reel)\/([^\/?#]+)/);
        if (m2 && !seen[m2[2]]) { seen[m2[2]] = true; list.push(m2[2]); }
      }
      return list;
    }

    // Walks the grid and paints an overlay on each tile we have data for.
    function annotateAllTiles(ownUser) {
      var anchors = document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]');
      var annotated = 0, withTags = 0, tilesSeen = 0;
      for (var a = 0; a < anchors.length; a++) {
        var anchor = anchors[a];
        if (anchor.closest('#_osint_win')) continue;
        var href = anchor.getAttribute('href') || '';
        var match = href.match(/\/(p|reel)\/([^\/?#]+)/);
        if (!match) continue;
        tilesSeen++;
        var node = state.postsByShortcode[match[2]];
        if (!node) continue;
        if (anchor.querySelector('._osint_tile_overlay')) continue;
        var overlay = buildOverlay(node, ownUser);
        if (!overlay) continue;
        if (window.getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
        anchor.appendChild(overlay);
        annotated++;
        if (overlay.dataset.hasTags === '1') withTags++;
      }
      return { annotated: annotated, withTags: withTags, tilesSeen: tilesSeen };
    }

    // Starts the run.
    function run() {
      runBtn.disabled = true; runBtn.style.opacity = '0.5';
      setStatusDot(COLORS.warn);
      clearAnnotations();
      setStatus('Loading initial posts for @' + username + ' …');

      loadInitialPosts(function(initErr) {
        if (initErr) {
          runBtn.disabled = false; runBtn.style.opacity = '1';
          setStatusDot(COLORS.danger);
          return setStatus(initErr.message, true);
        }

        var ownUser = (state.profile && state.profile.username) || username;
        var wanted = collectGridShortcodes();
        if (wanted.length === 0) {
          runBtn.disabled = false; runBtn.style.opacity = '1';
          return setStatus('No post tiles found on the page. Scroll to the profile grid first.', true);
        }

        var stats0 = annotateAllTiles(ownUser);
        setStatus('Initial pass: ' + stats0.annotated + '/' + stats0.tilesSeen + ' tiles · paginating user feed …');

        var unmatched = function(posts) {
          for (var i = 0; i < wanted.length; i++) if (!state.postsByShortcode[wanted[i]]) return false;
          return true;
        };

        paginateUntil(unmatched, 25, function(p) {
          var stats = annotateAllTiles(ownUser);
          setStatus('Page ' + p.page + ' · ' + state.posts.length + ' posts loaded · ' + stats.annotated + '/' + stats.tilesSeen + ' tiles annotated …');
        }, function(err) {
          runBtn.disabled = false; runBtn.style.opacity = '1';
          finalReport(ownUser, err);
        });
      });
    }

    // Writes the final summary to the status box.
    function finalReport(ownUser, err) {
      var stats = annotateAllTiles(ownUser);
      var unmatchedCount = stats.tilesSeen - stats.annotated;
      moreBtn.style.display = (state.feedExhausted || unmatchedCount === 0) ? 'none' : 'inline-block';
      if (err) {
        setStatusDot(COLORS.danger);
        setStatus(err.message + ' · annotated ' + stats.annotated + '/' + stats.tilesSeen + ' tiles.', true);
        return;
      }
      setStatusDot(COLORS.accent);
      var srcLabel = state.feedExhausted ? 'feed exhausted' : 'paginated';
      var msg = 'Annotated ' + stats.annotated + '/' + stats.tilesSeen + ' tiles · ' + stats.withTags + ' with collabs · ' + state.posts.length + ' posts cached (' + srcLabel + ')';
      if (unmatchedCount > 0) msg += ' · ' + unmatchedCount + ' tiles older than current cache — click "Fetch more pages".';
      setStatus(msg, false);
    }

    // Fetches more feed pages and re-annotates.
    function fetchMore() {
      moreBtn.disabled = true; moreBtn.style.opacity = '0.5';
      setStatusDot(COLORS.warn);
      var ownUser = (state.profile && state.profile.username) || username;
      setStatus('Fetching more pages …');
      paginateUntil(function(){ return false; }, 10, function(p) {
        var stats = annotateAllTiles(ownUser);
        setStatus('Page ' + p.page + ' · ' + state.posts.length + ' posts loaded · ' + stats.annotated + '/' + stats.tilesSeen + ' tiles annotated …');
      }, function(err) {
        moreBtn.disabled = false; moreBtn.style.opacity = '1';
        finalReport(ownUser, err);
      });
    }

    // Builds the tile-overlay element shown on top of a grid post.
    function buildOverlay(node, ownUsername) {
      var collabs = extractCollabs(node, ownUsername);
      var uniq = collabs.all.map(function(c){ return c.username; });

      var overlay = el('div', [
        'position:absolute','inset:0','pointer-events:none',
        'display:flex','flex-direction:column','justify-content:space-between','z-index:5'
      ].join(';'));
      overlay.className = '_osint_tile_overlay';

      var topBar = el('div', [
        'pointer-events:auto','display:flex','justify-content:space-between','gap:4px',
        'padding:6px','background:linear-gradient(to bottom, rgba(0,0,0,0.85), rgba(0,0,0,0))',
        'font-family:' + SANS,'font-size:10px','color:#fff','letter-spacing:0.3px'
      ].join(';'));

      var dateChip = el('span', 'background:rgba(0,0,0,0.88);padding:3px 7px;border:1px solid rgba(255,255,255,0.18);white-space:nowrap;font-family:' + MONO + ';font-size:10px;border-radius:4px;color:#fff');
      var d = nodeTime(node);
      if (d) {
        dateChip.textContent = fmtDateShort(d);
        dateChip.title = 'UTC: ' + fmtDateShort(d) + '\nLocal: ' + fmtLocal(d) + '\n' + timeAgo(d);
      } else dateChip.textContent = '—';
      topBar.appendChild(dateChip);

      var kindChip = el('span', 'background:rgba(0,0,0,0.75);padding:2px 6px;border:1px solid rgba(255,255,255,0.2);white-space:nowrap');
      var isCarousel = nodeIsCarousel(node);
      var isVideo = nodeIsVideo(node);
      kindChip.textContent = isCarousel ? '◫' : isVideo ? '▶' : '◾';
      kindChip.title = isCarousel ? 'Carousel' : isVideo ? 'Reel/Video' : 'Photo';
      topBar.appendChild(kindChip);
      overlay.appendChild(topBar);

      if (uniq.length > 0) {
        overlay.dataset.hasTags = '1';
        var bottomBar = el('div', [
          'pointer-events:auto','padding:6px',
          'background:linear-gradient(to top, rgba(0,0,0,0.92), rgba(0,0,0,0))',
          'display:flex','flex-wrap:wrap','gap:3px','font-family:' + SANS
        ].join(';'));
        for (var k = 0; k < Math.min(uniq.length, 6); k++) {
          (function(name) {
            var chip = el('a', [
              'background:rgba(255,255,255,0.9)','color:#000','font-weight:700',
              'font-size:9.5px','padding:2px 5px','text-decoration:none',
              'border:1px solid rgba(0,0,0,0.4)','white-space:nowrap'
            ].join(';'), '@' + name);
            chip.href = 'https://www.instagram.com/' + name + '/';
            chip.target = '_blank';
            chip.onclick = function(e) { e.stopPropagation(); };
            bottomBar.appendChild(chip);
          })(uniq[k]);
        }
        if (uniq.length > 6) {
          bottomBar.appendChild(el('span', 'color:#fff;font-size:9.5px;padding:2px 4px;background:rgba(0,0,0,0.6)', '+' + (uniq.length - 6)));
        }
        overlay.appendChild(bottomBar);
      } else {
        overlay.dataset.hasTags = '0';
        overlay.appendChild(el('div', ''));
      }
      return overlay;
    }
  }

  // Renders the Collabs tab into the container.
  function renderCollabs(container) {
    container.appendChild(sectionTitle('Collaborator posts'));
    container.appendChild(noteBanner('login', 'Requires login',
      'You must be logged in to instagram.com — feed pagination needs an authenticated session.'));
    container.appendChild(el('div', 'color:' + COLORS.textMuted + ';font-size:11px;line-height:1.6;padding-bottom:10px',
      'Recent posts where the post owner is a different account, or the post has tagged users / coauthors. Foreign-owned posts can reveal links into otherwise private accounts that collaborated with @' + username + '.'));

    var status = statusBox('Loading initial posts…');
    status.style.marginBottom = '10px';
    container.appendChild(status);

    var list = el('div', null);
    container.appendChild(list);

    var moreWrap = el('div', 'padding:10px 0;text-align:center');
    var moreBtn = btn('Load more posts', loadMore);
    moreWrap.appendChild(moreBtn);
    container.appendChild(moreWrap);
    moreBtn.style.display = 'none';

    var rendered = {};

    // Renders the current list into the container.
    function render() {
      var ownUser = (state.profile && state.profile.username) || username;
      var hits = 0, foreign = 0;
      var newCards = [];
      for (var i = 0; i < state.posts.length; i++) {
        var node = state.posts[i];
        var key = nodeShortcode(node) || node.id || node.pk;
        var c = extractCollabs(node, ownUser);
        var isHit = c.all.length > 0 || c.ownerForeign;
        if (!isHit) continue;
        hits++;
        if (c.ownerForeign) foreign++;
        if (rendered[key]) continue;
        rendered[key] = true;
        var card = buildCollabCard({ node: node, collabs: c });
        list.appendChild(card);
        newCards.push(card);
      }
      stagger(newCards, 45);
      var srcLabel = state.feedExhausted ? 'feed exhausted' : (state.feedMaxId ? 'paged' : 'initial');
      clearNode(status);
      var summary = el('div', 'display:flex;gap:12px;flex-wrap:wrap');
      summary.appendChild(el('span', 'color:' + COLORS.textStrong + ';font-weight:700', hits + ''));
      summary.appendChild(el('span', 'color:' + COLORS.textMuted, 'collab posts in ' + state.posts.length + ' cached'));
      if (foreign > 0) {
        summary.appendChild(el('span', 'color:#22c55e;font-weight:700', '· ' + foreign));
        summary.appendChild(el('span', 'color:' + COLORS.textMuted, 'foreign-owned'));
      }
      summary.appendChild(el('span', 'color:' + COLORS.textDim + ';margin-left:auto', srcLabel));
      status.appendChild(summary);
      moreBtn.style.display = state.feedExhausted ? 'none' : 'inline-block';
    }

    loadInitialPosts(function(err) {
      if (err) { status.style.color = COLORS.danger; status.textContent = err.message; return; }
      if (state.posts.length === 0) { status.textContent = 'No posts visible. The account may be private or the API returned nothing.'; return; }
      render();
      paginateUntil(function(){ return state.posts.length >= 60; }, 3, function() { render(); }, function() { render(); });
    });

    // Fetches more pages and re-renders.
    function loadMore() {
      moreBtn.disabled = true; moreBtn.style.opacity = '0.5';
      paginateUntil(function(){ return false; }, 3, function() { render(); }, function(err) {
        moreBtn.disabled = false; moreBtn.style.opacity = '1';
        if (err) { status.style.color = COLORS.danger; status.textContent = err.message; return; }
        render();
      });
    }
  }

  // Builds the collaborator card shown in the Collabs tab.
  function buildCollabCard(hit) {
    var node = hit.node;
    var sc = nodeShortcode(node);
    var d = nodeTime(node);
    var thumb = nodeThumb(node);
    var isVideo = nodeIsVideo(node);
    var isCarousel = nodeIsCarousel(node);
    var owner = hit.collabs.owner;
    var ownerForeign = hit.collabs.ownerForeign;

    var postUrl = 'https://www.instagram.com/' +
      (owner ? owner + '/' : '') +
      (isVideo ? 'reel' : 'p') + '/' + sc + '/';

    var card = el('div', 'padding:12px;margin-bottom:8px;border:1px solid ' + (ownerForeign ? COLORS.foreign : COLORS.borderSoft) + ';border-radius:8px;display:flex;gap:12px;background:' + (ownerForeign ? COLORS.foreignSoft : COLORS.surface) + ';transition:transform 0.16s ease-out, border-color 0.16s, box-shadow 0.16s');
    card.onmouseover = function() {
      card.style.transform = 'translateY(-2px)';
      card.style.borderColor = ownerForeign ? COLORS.foreign : COLORS.textMuted;
      card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)' + (ownerForeign ? ', 0 0 18px ' + COLORS.accentGlow : '');
    };
    card.onmouseout = function() {
      card.style.transform = 'translateY(0)';
      card.style.borderColor = ownerForeign ? COLORS.foreign : COLORS.borderSoft;
      card.style.boxShadow = 'none';
    };

    if (thumb) {
      var img = el('img', 'width:68px;height:68px;object-fit:cover;border-radius:6px;border:1px solid ' + COLORS.border + ';flex-shrink:0;background:#000');
      img.src = thumb;
      img.referrerPolicy = 'no-referrer';
      card.appendChild(img);
    }

    var info = el('div', 'flex:1;min-width:0');

    var header = el('div', 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap');
    var link = el('a', 'color:' + COLORS.textStrong + ';font-weight:600;text-decoration:none;font-size:12px;word-break:break-all;font-family:' + MONO,
      (isCarousel ? '◫ ' : isVideo ? '▶ ' : '◾ ') + (owner ? '/' + owner : '') + '/' + (isVideo ? 'reel' : 'p') + '/' + sc);
    link.href = postUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    header.appendChild(link);
    if (d) {
      var when = el('span', 'color:' + COLORS.textMuted + ';font-size:10.5px;font-family:' + MONO);
      when.textContent = fmtDateShort(d);
      when.title = 'UTC: ' + fmtDateShort(d) + '\nLocal: ' + fmtLocal(d) + '\n' + timeAgo(d);
      header.appendChild(when);
    }
    info.appendChild(header);

    if (ownerForeign) {
      var ownerRow = el('div', 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center');
      ownerRow.appendChild(el('span', 'color:' + COLORS.foreign + ';font-size:10px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700', 'owner' + (hit.collabs.ownerIsPrivate ? ' · private' : '')));
      (function(name) {
        var chip = el('a', 'background:' + COLORS.foreign + ';color:#000;font-weight:600;font-size:11px;padding:3px 8px;text-decoration:none;border:1px solid ' + COLORS.foreign + ';border-radius:99px;font-family:' + MONO, '@' + name);
        chip.href = 'https://www.instagram.com/' + name + '/';
        chip.target = '_blank';
        ownerRow.appendChild(chip);
      })(owner);
      info.appendChild(ownerRow);
    }

    if (hit.collabs.coauthors.length > 0) {
      var coRow = el('div', 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center');
      coRow.appendChild(el('span', 'color:' + COLORS.textMuted + ';font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-right:2px;font-weight:600', 'coauthor'));
      for (var ci = 0; ci < hit.collabs.coauthors.length; ci++) {
        (function(name) {
          var chip = el('a', 'background:' + COLORS.textStrong + ';color:#000;font-weight:600;font-size:11px;padding:3px 8px;text-decoration:none;border:1px solid ' + COLORS.textStrong + ';border-radius:99px;font-family:' + MONO, '@' + name);
          chip.href = 'https://www.instagram.com/' + name + '/';
          chip.target = '_blank';
          coRow.appendChild(chip);
        })(hit.collabs.coauthors[ci]);
      }
      info.appendChild(coRow);
    }

    if (hit.collabs.tagged.length > 0) {
      var tgRow = el('div', 'margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center');
      tgRow.appendChild(el('span', 'color:' + COLORS.textMuted + ';font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-right:2px;font-weight:600', 'tagged'));
      for (var ti = 0; ti < hit.collabs.tagged.length; ti++) {
        (function(name) {
          var chip = el('a', 'background:transparent;color:' + COLORS.text + ';font-size:11px;padding:3px 8px;text-decoration:none;border:1px solid ' + COLORS.border + ';border-radius:99px;font-family:' + MONO + ';transition:all 0.12s', '@' + name);
          chip.href = 'https://www.instagram.com/' + name + '/';
          chip.target = '_blank';
          chip.onmouseover = function() { chip.style.borderColor = COLORS.textStrong; chip.style.color = COLORS.textStrong; };
          chip.onmouseout  = function() { chip.style.borderColor = COLORS.border; chip.style.color = COLORS.text; };
          tgRow.appendChild(chip);
        })(hit.collabs.tagged[ti]);
      }
      info.appendChild(tgRow);
    }

    card.appendChild(info);
    return card;
  }

  // Renders the Pivot tab into the container.
  function renderPivot(container) {
    container.appendChild(sectionTitle('Cross-platform pivot'));
    container.appendChild(el('div', 'color:' + COLORS.text + ';font-size:11.5px;padding:4px 0 10px 0;line-height:1.5',
      'Open @' + username + ' on:'));

    var pivots = [
      {
        name: 'Threads',
        desc: 'Same handle on threads.net',
        url:  'https://www.threads.net/@' + username
      },
      {
        name: 'Wayback Machine',
        desc: 'Historical snapshots of this profile',
        url:  'https://web.archive.org/web/*/instagram.com/' + username
      },
      {
        name: 'WhatsMyName',
        desc: 'Look up this username across 640+ sites',
        url:  'https://whatsmyname.app/?q=' + encodeURIComponent(username)
      }
    ];

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

})();
