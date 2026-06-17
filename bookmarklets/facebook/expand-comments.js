// title: "Facebook Comments OSINT"
// description: "Runs on a Facebook post. Unfolds every hidden, collapsed, and 'See more' comment or reply, multi-language and recursive."
(function() {

  var existing = document.getElementById('_osint_win');
  if (existing) existing.remove();
  window._osint_abort = false;

  var COLORS = {
    bg: '#08080b',
    surface: '#101015',
    bar: '#000',
    border: '#26262e',
    borderSoft: '#181820',
    text: '#e8e8ec',
    textStrong: '#ffffff',
    textMuted: '#8e8e96',
    textDim: '#5a5a62',
    accent: '#34d399',
    accentGlow: 'rgba(52,211,153,0.45)',
    danger: '#ef4444',
    warn: '#fbbf24'
  };
  var SANS = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var MONO = '"SF Mono","JetBrains Mono","Fira Mono",Consolas,monospace';

  var win = document.createElement('div');
  win.id = '_osint_win';
  win.style.cssText = [
    'position:fixed','top:36px','right:36px','width:480px','max-height:85vh',
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
  titleEl.textContent = 'Facebook Expand Comments';
  titleEl.style.cssText = 'font-weight:600;font-size:13.5px;letter-spacing:-0.1px;color:' + COLORS.textStrong + ';line-height:1.1';
  var ctxBadge = document.createElement('div');
  ctxBadge.style.cssText = 'font-family:' + MONO + ';font-size:10.5px;color:' + COLORS.accent + ';margin-top:2px;letter-spacing:0.2px';
  ctxBadge.textContent = 'aggressive · idle';
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
  closeBtn.onclick = function() { window._osint_abort = true; win.remove(); };

  bar.appendChild(titleWrap);
  bar.appendChild(closeBtn);

  var body = document.createElement('div');
  body.style.cssText = 'overflow-y:auto;padding:18px 20px;flex:1;min-height:0;background:' + COLORS.bg;

  win.appendChild(bar);
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
      'background:' + (opts.primary ? COLORS.accent : COLORS.surface),
      'color:' + (opts.primary ? '#000' : COLORS.textStrong),
      'border:1px solid ' + (opts.primary ? COLORS.accent : COLORS.border),
      'border-radius:6px',
      'padding:9px 16px','font-family:inherit','font-size:12px','font-weight:600',
      'cursor:pointer','letter-spacing:0.2px','transition:all 0.12s'
    ].join(';'), label);
    b.onmouseover = function() {
      if (opts.primary) b.style.boxShadow = '0 0 18px ' + COLORS.accentGlow;
      else { b.style.borderColor = COLORS.textMuted; b.style.background = '#181820'; }
    };
    b.onmouseout = function() {
      if (opts.primary) b.style.boxShadow = 'none';
      else { b.style.borderColor = COLORS.border; b.style.background = COLORS.surface; }
    };
    b.onclick = onClick;
    return b;
  }

  // Repaints the title-bar status dot in the given colour.
  function setDotColor(c) { dot.style.background = c; dot.style.boxShadow = '0 0 10px ' + c; }

  // Replaces the context badge text in the title bar.
  function setBadge(text) { ctxBadge.textContent = text; }

  body.appendChild(sectionTitle('Status'));

  var statsGrid = el('div', 'display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px');
  var statComments = makeStat('Comments visible', 0);
  var statClicks = makeStat('Clicks performed', 0);
  var statRounds = makeStat('Rounds completed', 0);
  var statSeeMore = makeStat('"See more" expanded', 0);
  statsGrid.appendChild(statComments.node);
  statsGrid.appendChild(statClicks.node);
  statsGrid.appendChild(statRounds.node);
  statsGrid.appendChild(statSeeMore.node);
  body.appendChild(statsGrid);

  // Builds a stat tile with a label and initial value; returns a setter.
  function makeStat(label, initial) {
    var tile = el('div', [
      'padding:12px','background:' + COLORS.surface,'border:1px solid ' + COLORS.borderSoft,
      'border-radius:8px','position:relative','overflow:hidden'
    ].join(';'));
    var accentBar = el('div', 'position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(to bottom, ' + COLORS.accent + ', transparent)');
    var lbl = el('div', 'color:' + COLORS.textMuted + ';font-size:10px;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;margin-bottom:6px', label);
    var val = el('div', 'color:' + COLORS.textStrong + ';font-size:20px;font-weight:600;font-family:' + MONO + ';letter-spacing:-0.5px', String(initial));
    tile.appendChild(accentBar); tile.appendChild(lbl); tile.appendChild(val);
    return { node: tile, set: function(n) { val.textContent = String(n); } };
  }

  body.appendChild(sectionTitle('Controls'));

  var ctrls = el('div', 'display:flex;gap:8px;padding-bottom:12px;flex-wrap:wrap');
  var startBtn = btn('Start expansion', start, { primary: true });
  var stopBtn  = btn('Stop', stop);
  ctrls.appendChild(startBtn);
  ctrls.appendChild(stopBtn);
  body.appendChild(ctrls);

  body.appendChild(sectionTitle('Log'));

  var log = el('div', [
    'color:' + COLORS.text + ';font-size:11px;line-height:1.7;padding:12px;background:' + COLORS.surface,
    'border:1px solid ' + COLORS.borderSoft + ';border-radius:6px;font-family:' + MONO,
    'max-height:240px;overflow-y:auto'
  ].join(';'));
  body.appendChild(log);

  var loginBanner = el('div', 'display:flex;gap:10px;padding:10px 12px;margin:0 0 12px;border:1px solid ' + COLORS.borderSoft + ';background:' + COLORS.surface + ';border-radius:6px;border-left:3px solid ' + COLORS.warn);
  loginBanner.appendChild(el('div', 'font-family:' + MONO + ';font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:' + COLORS.warn + ';flex-shrink:0;padding-top:1px', 'Requires login'));
  loginBanner.appendChild(el('div', 'color:' + COLORS.text + ';font-size:11.5px;line-height:1.55;flex:1',
    'You must be logged in to facebook.com — the "All comments" sort, the hidden-comment reveal, and the reply loaders are only rendered for authenticated viewers.'));
  body.appendChild(loginBanner);

  body.appendChild(sectionTitle('Notes'));
  var notes = el('div', 'color:' + COLORS.textMuted + ';font-size:11.5px;line-height:1.55;padding:4px 0');
  notes.textContent = 'Switches to "All comments" (falling back to "Newest"), scrolls to lazy-load, then on every pass clicks: comment loaders → reply loaders → "See more" text → hidden comments → continue-thread → live-update banners → "See translation". Multi-language patterns. Reads both visible text and aria-label. Stops after two consecutive passes find nothing new.';
  body.appendChild(notes);

  var STATE = {
    running: false,
    clicks: 0,
    rounds: 0,
    seeMores: 0
  };

  // Prepends a log line in the run-log box, coloured by level.
  function log_(text, level) {
    var color = level === 'err' ? COLORS.danger :
                level === 'ok'  ? COLORS.accent :
                level === 'dim' ? COLORS.textDim : COLORS.text;
    var line = el('div', 'color:' + color, text);
    log.insertBefore(line, log.firstChild);
  }

  // Pushes the current state counts into the dashboard tiles.
  function updateStats() {
    statComments.set(commentCount());
    statClicks.set(STATE.clicks);
    statRounds.set(STATE.rounds);
    statSeeMore.set(STATE.seeMores);
  }

  // Returns the number of comment article elements visible on the page.
  function commentCount() {
    return document.querySelectorAll('div[role="article"]').length;
  }

  var COMMENT_LOADER_PATTERNS = [
    /^View more comments?$/i,
    /^View \d[\d,.]*\s*more comments?$/i,
    /^View previous comments?$/i,
    /^View \d[\d,.]*\s*previous comments?$/i,
    /^Load more comments?$/i,
    /^Show more comments?$/i,
    /^More comments?$/i,
    /^See more comments?$/i,
    /Ver más comentarios/i,
    /Mostrar más comentarios/i,
    /Voir d['’]autres commentaires/i,
    /Mehr Kommentare/i,
    /Visualizza altri commenti/i,
    /Ver mais comentários/i,
    /Pokaż więcej komentarzy/i,
    /Показать ещё/i,
    /もっとコメントを見る/i,
    /更多留言/i,
    /더 많은 댓글 보기/i
  ];

  var REPLY_LOADER_PATTERNS = [
    /^View \d[\d,.]*\s*repl(?:y|ies)$/i,
    /^View all \d[\d,.]*\s*repl(?:y|ies)$/i,
    /^View more repl(?:y|ies)$/i,
    /^View previous repl(?:y|ies)$/i,
    /^\d[\d,.]*\s*repl(?:y|ies)$/i,
    /replied.*\d+ repl/i,
    /^View \d[\d,.]*\s*more repl(?:y|ies)$/i,
    /Ver respuesta(s)?/i,
    /Voir [\d ]*répons/i,
    /Antwort(en)? anzeigen/i,
    /Visualizza altre risposte/i,
    /Ver respostas?/i,
    /Pokaż odpowiedzi/i,
    /Показать ответы/i,
    /返信を表示/i,
    /更多回覆/i,
    /답글 보기/i
  ];

  var SEE_MORE_PATTERNS = [
    /^See more$/i,
    /^Show more$/i,
    /^Read more$/i,
    /Ver más$/i,
    /Voir plus$/i,
    /Mehr anzeigen$/i,
    /Mostra altro$/i,
    /Ver mais$/i,
    /Pokaż więcej$/i,
    /Показать(ещё| ещё)/i,
    /もっと見る/i,
    /顯示更多/i,
    /더 보기/i
  ];

  var HIDDEN_COMMENT_PATTERNS = [
    /^Show hidden comments?$/i,
    /^Show \d[\d,.]*\s*hidden comments?$/i,
    /^View hidden comments?$/i,
    /^View \d[\d,.]*\s*hidden comments?$/i,
    /^\d[\d,.]*\s*hidden comments?$/i,
    /^Show comments?$/i,
    /comments? (?:are )?not displayed because/i,
    /Mostrar comentarios? ocultos/i,
    /Ver comentarios? ocultos/i,
    /Voir les commentaires masqués/i,
    /Afficher les commentaires masqués/i,
    /Versteckte Kommentare (?:anzeigen|einblenden)/i,
    /Mostra commenti nascosti/i,
    /Visualizza commenti nascosti/i,
    /Ver comentários ocultos/i,
    /Mostrar comentários ocultos/i,
    /Pokaż ukryte komentarze/i,
    /Показать скрытые комментарии/i,
    /非表示のコメントを表示/i,
    /顯示隱藏的留言/i,
    /숨겨진 댓글 보기/i
  ];

  var THREAD_CONTINUE_PATTERNS = [
    /^Continue (?:this )?thread$/i,
    /^View thread$/i,
    /^View this thread$/i,
    /^More replies$/i,
    /^See more replies$/i,
    /Continuar este hilo/i,
    /Continuer ce fil/i,
    /Diesen Thread fortsetzen/i,
    /Continua questa discussione/i,
    /Continuar este tópico/i,
    /Kontynuuj wątek/i,
    /Продолжить обсуждение/i,
    /スレッドを表示/i,
    /繼續查看討論串/i,
    /이 스레드 계속 보기/i
  ];

  var NEW_COMMENT_PATTERNS = [
    /^\d[\d,.]*\s*new comments?$/i,
    /^New comments?$/i,
    /^Show \d[\d,.]*\s*new comments?$/i,
    /^Refresh comments?$/i,
    /^\d[\d,.]*\s*nuevos? comentarios?/i,
    /^\d[\d,.]*\s*nouveaux? commentaires?/i,
    /^\d[\d,.]*\s*neue Kommentare/i,
    /^\d[\d,.]*\s*nuovi commenti/i,
    /^\d[\d,.]*\s*novos? comentários?/i,
    /^\d[\d,.]*\s*новых? коммент/i,
    /新しいコメント/i,
    /新留言/i,
    /새 댓글/i
  ];

  var SEE_TRANSLATION_PATTERNS = [
    /^See translation$/i,
    /^Translate$/i,
    /Ver traducción/i,
    /Voir la traduction/i,
    /Übersetzung anzeigen/i,
    /Mostra traduzione/i,
    /Ver tradução/i,
    /Pokaż tłumaczenie/i,
    /Посмотреть перевод/i,
    /翻訳を見る/i,
    /顯示翻譯/i,
    /번역 보기/i
  ];

  var ALL_COMMENTS_PATTERNS = [/^All comments?$/i, /Todos los comentarios/i, /Tous les commentaires/i, /Alle Kommentare/i, /Tutti i commenti/i, /Todos os comentários/i, /Wszystkie komentarze/i, /Все комментарии/i, /すべてのコメント/i, /所有留言/i, /모든 댓글/i];
  var NEWEST_PATTERNS = [/^Newest$/i, /^Most recent$/i, /Más recientes/i, /Plus récents/i, /Neueste/i, /Più recenti/i, /Mais recentes/i, /Najnowsze/i, /Сначала новые/i, /新しい順/i, /最新/i, /최신순/i];
  var SORT_TRIGGER_PATTERNS = [/^Most relevant$/i, /^Newest$/i, /^All comments$/i, /Más relevantes/i, /Pertinents/i, /Relevanteste/i, /Più pertinenti/i, /Mais relevantes/i, /Najtrafniejsze/i, /Сначала самые/i, /関連性が高い/i, /最相關/i, /가장 관련성 높은/i];

  // Returns every clickable element whose visible text or aria-label matches any pattern.
  function findClickables(patterns) {
    var els = document.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], [role="button"]');
    var found = [];
    var seen = new Set();
    for (var i = 0; i < els.length; i++) {
      var node = els[i];
      if (seen.has(node)) continue;
      if (node.closest('#_osint_win')) continue;
      if (node.getAttribute('aria-hidden') === 'true') continue;
      var txt  = (node.innerText || node.textContent || '').trim();
      var aria = (node.getAttribute('aria-label') || '').trim();
      if (!txt && !aria) continue;
      for (var p = 0; p < patterns.length; p++) {
        if ((txt && patterns[p].test(txt)) || (aria && patterns[p].test(aria))) {
          found.push(node); seen.add(node); break;
        }
      }
    }
    return found;
  }

  // Scrolls a node into view and clicks it; returns true on success.
  function clickOne(node) {
    try {
      node.scrollIntoView({ block: 'center', behavior: 'instant' });
    } catch(_) {}
    try { node.click(); STATE.clicks++; return true; }
    catch(_) { return false; }
  }

  // Clicks each node in sequence with a delay, then calls callback with the success count.
  function clickAll(nodes, label, delay, callback) {
    if (window._osint_abort || nodes.length === 0) return callback(0);
    log_('clicking ' + nodes.length + ' × ' + label);
    var i = 0, success = 0;

    // Local iteration helper.
    function next() {
      if (window._osint_abort || i >= nodes.length) {
        updateStats();
        return callback(success);
      }
      if (clickOne(nodes[i])) success++;
      i++;
      setTimeout(next, delay);
    }
    next();
  }

  // Opens the sort menu and switches to "All comments" or "Newest".
  function switchToAllComments(callback) {
    var already = findClickables(ALL_COMMENTS_PATTERNS).filter(function(n) {
      var aria = n.getAttribute('aria-pressed') || n.getAttribute('aria-selected');
      return aria === 'true';
    });
    if (already.length > 0) { log_('already on "All comments"', 'dim'); return callback(); }

    var triggers = findClickables(SORT_TRIGGER_PATTERNS);
    if (triggers.length === 0) { log_('no sort filter found, continuing', 'dim'); return callback(); }

    log_('opening sort menu…');
    triggers[0].click();
    STATE.clicks++;

    setTimeout(function() {
      var candidates = document.querySelectorAll('div[role="menuitem"], div[role="menuitemradio"], div[role="option"], [role="menu"] span, [role="listbox"] span, [role="dialog"] span');

      // Finds the first menu candidate whose text matches any pattern.
      function pickByPatterns(patterns) {
        for (var i = 0; i < candidates.length; i++) {
          var txt = (candidates[i].innerText || candidates[i].textContent || '').trim();
          for (var p = 0; p < patterns.length; p++) {
            if (patterns[p].test(txt)) return candidates[i];
          }
        }
        return null;
      }
      var pick = pickByPatterns(ALL_COMMENTS_PATTERNS);
      var picked = 'All comments';
      if (!pick) { pick = pickByPatterns(NEWEST_PATTERNS); picked = 'Newest'; }
      if (pick) {
        log_('switching to "' + picked + '"', 'ok');
        pick.click(); STATE.clicks++;
        setTimeout(callback, 1800);
      } else {
        log_('no recognised sort option in menu', 'dim');
        document.body.click();
        setTimeout(callback, 600);
      }
    }, 900);
  }

  // Finds the scrollable parent of a comment article element.
  function findCommentContainer() {
    var anyArticle = document.querySelector('div[role="article"]');
    if (!anyArticle) return null;
    var node = anyArticle.parentElement;
    while (node && node !== document.body) {
      var style = window.getComputedStyle(node);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 30) return node;
      node = node.parentElement;
    }
    return null;
  }

  // Scrolls the comment container or window to trigger lazy-load.
  function nudgeScroll(callback) {
    var container = findCommentContainer();
    if (container) {
      container.scrollTop = container.scrollHeight;
      setTimeout(function() {
        container.scrollTop = container.scrollHeight;
        callback();
      }, 400);
    } else {
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(callback, 400);
    }
  }

  // Runs one expansion pass through every button category.
  function passOnce(callback) {
    if (window._osint_abort) return callback({ clicks: 0, articles: commentCount() });

    var pressed = 0;
    var startArticles = commentCount();

    var commentBtns = findClickables(COMMENT_LOADER_PATTERNS);
    var replyBtns   = findClickables(REPLY_LOADER_PATTERNS);
    var seeMoreBtns = findClickables(SEE_MORE_PATTERNS);
    var hiddenBtns  = findClickables(HIDDEN_COMMENT_PATTERNS);
    var threadBtns  = findClickables(THREAD_CONTINUE_PATTERNS);
    var newBtns     = findClickables(NEW_COMMENT_PATTERNS);
    var transBtns   = findClickables(SEE_TRANSLATION_PATTERNS);

    // Local iteration helper.
    function step(btns, label, delay, counterKey, cb) {
      clickAll(btns, label, delay, function(n) {
        pressed += n;
        if (counterKey) STATE[counterKey] += n;
        updateStats();
        if (window._osint_abort) return callback({ clicks: pressed, articles: commentCount() });
        cb();
      });
    }

    step(commentBtns, 'comments loader',  220, null,           function() {
    step(replyBtns,   'replies loader',   220, null,           function() {
    step(hiddenBtns,  'hidden reveal',    220, 'hidden',       function() {
    step(threadBtns,  'continue thread',  220, 'threads',      function() {
    step(newBtns,     'new (live)',       220, 'newLive',      function() {
    step(seeMoreBtns, '"See more"',        80, 'seeMores',     function() {
    step(transBtns,   '"See translation"', 80, 'translations', function() {
      nudgeScroll(function() {
        setTimeout(function() {
          callback({ clicks: pressed, articles: commentCount(), startArticles: startArticles });
        }, 800);
      });
    });});});});});});});
  }

  // Keeps running expansion passes until two consecutive passes find nothing new.
  function expandLoop(callback) {
    var passNum = 0;
    var stableMisses = 0;
    var lastArticleCount = commentCount();

    // Local iteration helper.
    function next() {
      if (window._osint_abort) { log_('aborted by user', 'err'); return callback(); }
      passNum++;
      STATE.rounds = passNum;
      log_('— pass ' + passNum + ' —', 'ok');
      passOnce(function(result) {
        var deltaArticles = result.articles - lastArticleCount;
        lastArticleCount = result.articles;
        if (result.clicks === 0 && deltaArticles === 0) {
          stableMisses++;
          log_('no new buttons or articles (' + stableMisses + '/2)', 'dim');
        } else {
          stableMisses = 0;
          log_('+' + result.clicks + ' clicks · +' + deltaArticles + ' articles');
        }
        updateStats();
        if (stableMisses >= 2 || passNum >= 80) return callback();
        setTimeout(next, 350);
      });
    }
    next();
  }

  // Starts the expansion run.
  function start() {
    if (STATE.running) return;
    STATE.running = true;
    window._osint_abort = false;
    startBtn.disabled = true; startBtn.style.opacity = '0.5';
    setDotColor(COLORS.warn);
    setBadge('aggressive · running');
    STATE.clicks = 0; STATE.rounds = 0; STATE.seeMores = 0;
    clearNode(log);
    log_('starting…', 'ok');
    updateStats();

    switchToAllComments(function() {
      if (window._osint_abort) return done();
      expandLoop(done);
    });
  }

  // Aborts the expansion run.
  function stop() {
    window._osint_abort = true;
    setBadge('aggressive · stopped');
    log_('stop requested', 'err');
  }

  // Marks the run finished and updates the UI.
  function done() {
    STATE.running = false;
    startBtn.disabled = false; startBtn.style.opacity = '1';
    setDotColor(COLORS.accent);
    setBadge('aggressive · done · ' + commentCount() + ' visible');
    log_('done — ' + commentCount() + ' articles visible · ' + STATE.clicks + ' clicks · ' + STATE.rounds + ' passes', 'ok');
    updateStats();
  }

})();
