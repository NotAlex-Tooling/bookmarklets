// title: "Telegram Profile OSINT"
// description: "Runs on a public Telegram page (t.me/<name>). Reads username, display name, bio, account type (channel/group/user), subscriber/member count and profile photo straight from the page’s Open Graph tags — fully passive — then deep-links to Telegram-specific search and analytics tools."
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

    var TITLE = 'Telegram Profile OSINT';

  var host = window.location.hostname;
  var onTg = host === 't.me' || host.endsWith('.t.me') || host === 'telegram.me' || host.endsWith('.telegram.me');
  var username = onTg ? window.location.pathname.replace(/^\//, '').replace(/^s\//, '').replace(/\/.*$/, '') : null;
  var reserved = /^(s|joinchat|addstickers|share|proxy|setlanguage|login|iv|c)$/i;
  if (username && reserved.test(username)) username = null;

  var CTX_BADGE = onTg ? (username ? '@' + username : 't.me') : 'not on t.me';
  var WRONG_PAGE = onTg ? null : 'Open a public Telegram page (t.me/<name>) to use this.';

  var TABS_DEF = [
    { id: 'about', label: 'About', render: renderAbout },
    { id: 'pivot', label: 'Pivot', render: renderPivot }
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

  // Builds a label/URL row that opens the URL in a new tab.
  function linkRow(label, url, displayText) {
    var div = el('div', 'padding:9px 0;border-bottom:1px solid ' + COLORS.borderSoft + ';display:flex;gap:12px;align-items:center');
    var lbl = el('span', 'color:' + COLORS.textMuted + ';min-width:104px;flex-shrink:0;font-size:11px;font-weight:500;letter-spacing:0.2px', label);
    var a = el('a', 'color:' + COLORS.textStrong + ';font-weight:500;word-break:break-all;text-decoration:none;flex:1;font-family:' + MONO + ';font-size:11.5px;border-bottom:1px dashed ' + COLORS.textFaint, displayText || url);
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
  function noteBanner(variant, label, bodyText) {
    var color = variant === 'anonymous' ? COLORS.accent : COLORS.amber;
    var wrap = el('div', 'display:flex;gap:10px;padding:10px 12px;margin:0 0 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px;border-left:3px solid ' + color);
    var labelEl = el('div', 'font-family:' + MONO + ';font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + color + ';flex-shrink:0;padding-top:1px', label);
    var bodyEl = el('div', 'color:' + COLORS.text + ';font-size:11.5px;line-height:1.55;flex:1', bodyText);
    wrap.appendChild(labelEl); wrap.appendChild(bodyEl);
    return wrap;
  }

  // Builds a clickable URL box that copies on click.
  function urlBox(url) {
    var box = el('div', 'margin-top:10px;padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.textDim + ';font-size:10.5px;line-height:1.5;word-break:break-all;cursor:pointer;font-family:' + MONO + ';border-radius:6px;background:' + COLORS.surface);
    box.textContent = url;
    box.title = 'Click to copy';
    box.onclick = function() { copyText(url, box); };
    return box;
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

  // Builds a centred preview image with rounded frame and shadow.
  function previewImage(src, opts) {
    opts = opts || {};
    var preview = el('div', 'padding:14px 0;text-align:center');
    var img = el('img', 'max-width:100%;' + (opts.maxHeight ? 'max-height:' + opts.maxHeight + ';' : '') + (opts.round ? 'border-radius:50%;width:200px;height:200px;object-fit:cover;' : 'border-radius:10px;') + 'border:1px solid ' + COLORS.border + ';box-shadow:0 6px 24px rgba(0,0,0,0.5);background:#000');
    img.src = src;
    img.referrerPolicy = 'no-referrer';
    img.onerror = function() { img.alt = 'image failed to load'; img.style.minHeight = '60px'; };
    preview.appendChild(img);
    return preview;
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

    // Reads an Open Graph / meta tag value by property or name.
  function metaTag(p) {
    var e = document.querySelector('meta[property="' + p + '"]') || document.querySelector('meta[name="' + p + '"]');
    return e ? e.getAttribute('content') : null;
  }

  // Pulls URLs and @handles out of a bio/description string.
  function extractLinks(text) {
    var out = [];
    if (!text) return out;
    var u, ure = /(https?:\/\/[^\s<]+)/gi;
    while ((u = ure.exec(text)) !== null) out.push(u[1]);
    var h, hre = /(^|\s)@([a-zA-Z0-9_]{4,})/g;
    while ((h = hre.exec(text)) !== null) out.push('@' + h[2]);
    return out;
  }

  // Renders the About tab.
  function renderAbout(container) {
    container.appendChild(noteBanner('anonymous', 'Passive', 'Everything here is read from the page\u2019s own Open Graph tags \u2014 no requests are sent and the account owner is not notified.'));

    var name = metaTag('og:title');
    var desc = metaTag('og:description');
    var photo = metaTag('og:image');

    var extra = document.querySelector('.tgme_page_extra');
    var extraTxt = extra ? extra.textContent : '';
    var type = 'Unknown';
    if (/subscriber/i.test(extraTxt)) type = 'Channel';
    else if (/member/i.test(extraTxt)) type = 'Group';
    else if (document.querySelector('.tgme_page_action')) type = 'User / Bot';

    var bodyTxt = document.body.innerText || '';
    var mm = bodyTxt.match(/([\d][\d\s,\.]*)\s*(subscribers?|members?)/i);
    var members = mm ? mm[1].replace(/\s/g, '').trim() : null;

    container.appendChild(sectionTitle('Identity'));
    container.appendChild(row('Username', username ? '@' + username : '\u2014', { copy: !!username }));
    if (name) container.appendChild(row('Name', name, { copy: true }));
    container.appendChild(row('Type', type));
    if (members) container.appendChild(row(/subscriber/i.test(extraTxt) ? 'Subscribers' : 'Members', members, { mono: true }));
    if (username) container.appendChild(linkRow('Direct link', 'https://t.me/' + username));
    if (username) container.appendChild(linkRow('Web preview', 'https://t.me/s/' + username));

    if (photo) {
      container.appendChild(sectionTitle('Profile photo'));
      container.appendChild(previewImage(photo, { maxHeight: '220px' }));
      container.appendChild(urlBox(photo));
      var actions = el('div', 'display:flex;gap:8px;padding-top:12px;flex-wrap:wrap');
      actions.appendChild(btn('Open full size', function() { window.open(photo, '_blank'); }, { primary: true }));
      actions.appendChild(btn('Copy URL', function() { copyText(photo); }));
      container.appendChild(actions);
    }

    container.appendChild(sectionTitle('Bio'));
    if (desc) {
      var bioBox = el('div', 'padding:10px;border:1px solid ' + COLORS.borderSoft + ';color:' + COLORS.text + ';white-space:pre-wrap;line-height:1.55;font-size:11.5px;border-radius:6px;background:' + COLORS.surface);
      bioBox.textContent = desc;
      container.appendChild(bioBox);
      var links = extractLinks(desc);
      if (links.length) {
        container.appendChild(sectionTitle('Links in bio'));
        for (var i = 0; i < links.length; i++) {
          var raw = links[i];
          var href = raw.charAt(0) === '@' ? 'https://t.me/' + raw.slice(1) : raw;
          container.appendChild(linkRow(raw.charAt(0) === '@' ? 'mention' : 'link', href, raw));
        }
      }
    } else {
      container.appendChild(statusBox('No bio/description in the page metadata.', false));
    }
  }

  // Renders the Pivot tab.
  function renderPivot(container) {
    container.appendChild(sectionTitle('Telegram search & analytics'));
    var u = username || '';
    var pivots = [
      { name: 'Lyzem', desc: 'Search messages & channels by keyword/handle', url: 'https://lyzem.com/search?query=' + encodeURIComponent(u) },
      { name: 'TGStat', desc: 'Channel stats, history, audience', url: 'https://tgstat.com/channel/@' + encodeURIComponent(u) },
      { name: 'Telemetr.io', desc: 'Channel analytics & post archive', url: 'https://telemetr.io/en/channels?q=' + encodeURIComponent(u) },
      { name: 'Telegago (Google CSE)', desc: 'Custom search across Telegram', url: 'https://cse.google.com/cse?cx=006368593537057042503:efxu7xprihg&q=' + encodeURIComponent(u) }
    ];
    pivotList(container, pivots);

    container.appendChild(sectionTitle('General pivots'));
    pivotList(container, [
      { name: 'Google site:t.me', desc: 'Mentions of this handle indexed by Google', url: 'https://www.google.com/search?q=' + encodeURIComponent('site:t.me ' + u) },
      { name: 'WhatsMyName', desc: 'Look up this handle across 700+ sites', url: 'https://whatsmyname.app/?q=' + encodeURIComponent(u) },
      { name: 'Wayback Machine', desc: 'Historical snapshots of this page', url: 'https://web.archive.org/web/*/t.me/' + encodeURIComponent(u) }
    ]);
  }


})();
