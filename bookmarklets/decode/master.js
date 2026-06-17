// title: "ID & Timestamp Decoder"
// description: "Universal Snowflake / social-media ID decoder. Recovers the exact creation time encoded in an X tweet ID, Discord snowflake, Instagram media ID or shortcode, and TikTok video ID. 100% client-side math — no requests, notifies no one, never goes stale."
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

    var TITLE = 'ID & Timestamp Decoder';

  var host = window.location.hostname.replace(/^www\./, '');
  var path = window.location.pathname;

  var auto = { x: null, tiktok: null, ig: null };
  if (/(?:^|\.)(x|twitter)\.com$/i.test(host)) {
    var xm = path.match(/\/status\/(\d+)/);
    if (xm) auto.x = xm[1];
  }
  if (/(?:^|\.)tiktok\.com$/i.test(host)) {
    var tm = path.match(/\/(?:video|photo)\/(\d+)/) || path.match(/\/(\d{17,})(?:\/|$)/);
    if (tm) auto.tiktok = tm[1];
  }
  if (/(?:^|\.)instagram\.com$/i.test(host)) {
    var im = path.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (im) auto.ig = im[1];
  }

  var CTX_BADGE = auto.x ? 'tweet id on this page' :
                  auto.tiktok ? 'video id on this page' :
                  auto.ig ? 'shortcode on this page' :
                  'universal \u00b7 paste any id';

  var WRONG_PAGE = null;

  var TABS_DEF = [
    { id: 'x',       label: 'X Tweet',    render: renderX },
    { id: 'discord', label: 'Discord',    render: renderDiscord },
    { id: 'ig',      label: 'Instagram',  render: renderInstagram },
    { id: 'tiktok',  label: 'TikTok',     render: renderTikTok }
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

  // Appends a full UTC / Local / Age / ISO / Unix timestamp block for a date.
  function timestampRows(container, d, opts) {
    opts = opts || {};
    container.appendChild(row('UTC', fmtDateShort(d), { copy: true, mono: true }));
    container.appendChild(row('Local', fmtLocal(d)));
    container.appendChild(row('Age', timeAgo(d)));
    if (opts.iso !== false) container.appendChild(row('ISO', d.toISOString(), { copy: true, mono: true }));
    if (opts.unix !== false) container.appendChild(row('Unix', String(Math.floor(d.getTime() / 1000)), { copy: true, mono: true }));
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

    // Converts an Instagram shortcode (base64 variant) into its numeric media ID.
  function igShortcodeToId(code) {
    var ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    var id = 0n;
    for (var i = 0; i < code.length; i++) {
      var v = ALPH.indexOf(code.charAt(i));
      if (v < 0) throw new Error('Invalid shortcode character: ' + code.charAt(i));
      id = id * 64n + BigInt(v);
    }
    return id;
  }

  // Builds a generic decode panel: input + button + live result block.
  function buildDecoder(container, cfg) {
    container.appendChild(sectionTitle(cfg.title));
    container.appendChild(noteBanner('anonymous', 'Passive', cfg.note));

    var inWrap = el('div', 'display:flex;gap:8px;padding:6px 0 4px 0');
    var input = el('input');
    input.type = 'text';
    input.placeholder = cfg.placeholder;
    input.spellcheck = false;
    input.style.cssText = 'flex:1;min-width:0;background:' + COLORS.surface + ';border:1px solid ' + COLORS.border + ';color:' + COLORS.textStrong + ';padding:9px 11px;font-family:' + MONO + ';font-size:12.5px;border-radius:6px;outline:none';
    input.onfocus = function() { input.style.borderColor = COLORS.accent; };
    input.onblur = function() { input.style.borderColor = COLORS.border; };
    var go = btn('Decode', function() { runDecode(); }, { primary: true });
    inWrap.appendChild(input);
    inWrap.appendChild(go);
    container.appendChild(inWrap);

    if (cfg.autoValue) {
      input.value = cfg.autoValue;
      container.appendChild(el('div', 'color:' + COLORS.accent + ';font-size:10.5px;font-family:' + MONO + ';padding:2px 0 0 1px', '\u2713 auto-filled from this page'));
    }

    var result = el('div', 'margin-top:6px');
    container.appendChild(result);

    // Decodes the entered ID and renders the timestamp result, or an error.
    function runDecode() {
      clearNode(result);
      var raw = (input.value || '').trim();
      if (!raw) { result.appendChild(statusBox('Enter an ID first.', true)); return; }
      var out;
      try { out = cfg.decode(raw); } catch (e) { result.appendChild(statusBox((e && e.message) || 'Could not decode.', true)); return; }
      if (!out || !out.date || isNaN(out.date.getTime())) {
        result.appendChild(statusBox((out && out.msg) || 'No valid timestamp in that ID.', true));
        return;
      }
      var rows = [];
      if (out.rows) {
        for (var i = 0; i < out.rows.length; i++) {
          result.appendChild(row(out.rows[i][0], out.rows[i][1], out.rows[i][2] || {}));
          rows.push(result.lastChild);
        }
      }
      result.appendChild(sectionTitle('Decoded time'));
      timestampRows(result, out.date);
      if (out.warn) result.appendChild(statusBox(out.warn, false));
      result.appendChild(el('div', 'padding:12px 0 2px 0;color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;font-family:' + MONO, cfg.method));
      stagger(rows, 35, 30);
    }

    input.onkeydown = function(e) { if (e.key === 'Enter') runDecode(); };
    if (cfg.autoValue) runDecode();
  }

  // Renders the X / Twitter tweet-ID tab.
  function renderX(container) {
    buildDecoder(container, {
      title: 'X / Twitter tweet ID',
      note: 'Recovers the creation time baked into a tweet/status ID. Works for deleted tweets and notifies no one. Legacy numeric USER IDs predate Snowflake and will not decode \u2014 use a tweet ID.',
      placeholder: 'e.g. 1234567890123456789',
      autoValue: auto.x,
      method: '(ID >> 22) + 1288834974657 ms  \u00b7  Twitter epoch 2010-11-04T01:42:54Z',
      decode: function(s) {
        if (!/^\d+$/.test(s)) throw new Error('Tweet IDs are all digits \u2014 paste the number after /status/.');
        var bi = BigInt(s);
        var d = new Date(Number(bi >> 22n) + 1288834974657);
        if (d.getUTCFullYear() < 2006 || d.getTime() > Date.now() + 86400000) {
          return { date: d, msg: 'Decoded date is implausible \u2014 is this really a tweet ID (not a user ID)?', rows: [['Tweet ID', s, { mono: true, copy: true }]] };
        }
        return { date: d, rows: [['Tweet ID', s, { mono: true, copy: true }]] };
      }
    });
  }

  // Renders the Discord snowflake tab.
  function renderDiscord(container) {
    buildDecoder(container, {
      title: 'Discord snowflake',
      note: 'Decodes any Discord snowflake \u2014 user, message, channel, server (guild), or role ID. All Discord IDs embed their creation time.',
      placeholder: 'e.g. 175928847299117063',
      autoValue: null,
      method: '(ID >> 22) + 1420070400000 ms  \u00b7  Discord epoch 2015-01-01T00:00:00Z',
      decode: function(s) {
        if (!/^\d+$/.test(s)) throw new Error('Discord IDs are all digits. Enable Developer Mode to copy IDs.');
        var bi = BigInt(s);
        var d = new Date(Number(bi >> 22n) + 1420070400000);
        if (d.getUTCFullYear() < 2015 || d.getTime() > Date.now() + 86400000) {
          return { date: d, msg: 'Decoded date is implausible \u2014 is this really a Discord snowflake?', rows: [['Snowflake', s, { mono: true, copy: true }]] };
        }
        return { date: d, rows: [['Snowflake', s, { mono: true, copy: true }]] };
      }
    });
  }

  // Renders the Instagram media-ID / shortcode tab.
  function renderInstagram(container) {
    buildDecoder(container, {
      title: 'Instagram media ID / shortcode',
      note: 'Paste the shortcode from a post URL (/p/<code>/, /reel/<code>/) or a raw numeric media ID. The shortcode is base64-decoded to the media ID, whose high bits carry the timestamp.',
      placeholder: 'shortcode e.g. CyX1a2bCdef  \u2014 or numeric media ID',
      autoValue: auto.ig,
      method: '(media_id >> 23) + 1314220021721 ms  \u00b7  IG epoch 2011-08-24  \u00b7  approximate (\u00b1minutes)',
      decode: function(s) {
        var mediaId, shortcode = null;
        if (/^\d+$/.test(s)) { mediaId = BigInt(s); }
        else if (/^[A-Za-z0-9_-]+$/.test(s)) { shortcode = s; mediaId = igShortcodeToId(s); }
        else throw new Error('Enter an Instagram shortcode (from /p/<code>/) or a numeric media ID.');
        var IG_EPOCH = 1314220021721n;
        var d = new Date(Number((mediaId >> 23n) + IG_EPOCH));
        var rows = [];
        if (shortcode) rows.push(['Shortcode', shortcode, { mono: true, copy: true }]);
        rows.push(['Media ID', mediaId.toString(), { mono: true, copy: true }]);
        if (d.getUTCFullYear() < 2010 || d.getTime() > Date.now() + 86400000) {
          var alt = new Date(Number((mediaId >> 22n) + IG_EPOCH));
          return { date: d, rows: rows, warn: 'Primary decode looks off. >>22 candidate: ' + (isNaN(alt.getTime()) ? 'n/a' : alt.toISOString()) };
        }
        return { date: d, rows: rows, warn: 'Instagram timestamps are approximate (epoch/shift method), good to the minute.' };
      }
    });
  }

  // Renders the TikTok video-ID tab.
  function renderTikTok(container) {
    buildDecoder(container, {
      title: 'TikTok video ID',
      note: 'Recovers the upload time from a numeric video ID \u2014 works even for deleted videos. The first 32 bits of the ID are the Unix timestamp (Benson / Bellingcat method).',
      placeholder: 'e.g. 7212312345678901234',
      autoValue: auto.tiktok,
      method: 'first 32 bits of the ID = Unix seconds  \u00b7  within ~5s of the true createTime',
      decode: function(s) {
        if (!/^\d+$/.test(s)) throw new Error('Paste the numeric video ID from the URL (/video/<id>).');
        var bi = BigInt(s);
        var d = new Date(Number(bi >> 32n) * 1000);
        if (d.getUTCFullYear() < 2016 || d.getTime() > Date.now() + 86400000) {
          return { date: d, msg: 'Decoded date is implausible for a TikTok video ID.', rows: [['Video ID', s, { mono: true, copy: true }]] };
        }
        return { date: d, rows: [['Video ID', s, { mono: true, copy: true }]] };
      }
    });
  }


})();
