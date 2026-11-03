/* Receipt Detective: game flow and UI. */
(function () {
  'use strict';
  const RD = window.RD, D = window.RD_DATA;
  const MAX_GUESSES = 4, SOLVE = 2;
  const REG_NAMES = { NE: 'Northeast', MW: 'Midwest', S: 'South', W: 'West' };
  const $ = id => document.getElementById(id);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  // ---------- state ----------
  let mode, params, rc, st, lastTier = -1, realDoneShown = false;
  const todayN = RD.todayNumber();

  function loadDaily() {
    mode = 'daily';
    params = RD.dailyParams(todayN);
    rc = RD.buildReceipt(params);
    st = store.get('rd:day:' + todayN, { guesses: [], region: null });
    lastTier = -1;
  }
  function loadPractice(seed) {
    mode = 'practice';
    params = RD.practiceParams(seed);
    rc = RD.buildReceipt(params);
    st = { guesses: [], region: null };
    lastTier = -1;
  }
  function loadReal(id) {
    const R = (window.RD_REAL || []).find(x => x.id === id) || window.RD_REAL[0];
    mode = 'real';
    params = { seed: 0, real: R.id };
    rc = { real: R, year: R.year, region: R.region, state: R.state, items: [], params };
    st = store.get('rd:real:' + R.id, { guesses: [], region: null });
    lastTier = -1;
  }
  function save() {
    if (mode === 'daily') store.set('rd:day:' + todayN, st);
    if (mode === 'real') store.set('rd:real:' + rc.real.id, st);
  }

  function renderRealHTML(R, tier, newTier, done) {
    const [cx0, cy0, cx1, cy1] = R.crop || [0, 0, R.w, R.h];
    const W = cx1 - cx0, H = cy1 - cy0;
    const px = (v, of) => (100 * v / of).toFixed(3) + '%';
    const masks = R.masks.map(m => {
      const open = m.until === 'done' ? done : tier >= m.until;
      const style = `left:${px(m.x0 - cx0, W)};top:${px(m.y0 - cy0, H)};width:${px(m.x1 - m.x0, W)};height:${px(m.y1 - m.y0, H)};transform:skewY(${R.skew}deg)`;
      if (open) return m.until === newTier ? `<div class="rmask flash" style="${style}"></div>` : '';
      return `<div class="rmask ${m.kind === 'blur' ? 'blurred' : 'rbar'}" style="${style}"></div>`;
    }).join('');
    return `<figure class="real-photo"><div class="real-frame"><img src="${R.image}" alt="Photo of a real grocery receipt, with some lines hidden" width="${W}" height="${H}">${masks}</div><figcaption>A real receipt · ${esc(R.credit)}</figcaption></figure>`;
  }

  const offBy = g => Math.abs(g - rc.year);
  const solved = () => st.guesses.some(g => offBy(g) <= SOLVE);
  const yearDone = () => solved() || st.guesses.length >= MAX_GUESSES;
  const phase = () => !yearDone() ? 'year' : (st.region == null ? 'region' : 'done');
  const square = off => off <= SOLVE ? '🟩' : off <= 5 ? '🟨' : off <= 10 ? '🟧' : '🟥';
  const bestOff = () => Math.min(...st.guesses.map(offBy));
  const yearPoints = () => Math.max(0, 100 - 5 * bestOff());
  const regionRight = () => st.region === rc.region;
  const fmt = x => '$' + x.toFixed(2);

  function temp(off) {
    if (off <= SOLVE) return { icon: '🎯', word: 'Solved' };
    if (off <= 5) return { icon: '🔥', word: 'Hot' };
    if (off <= 10) return { icon: '♨️', word: 'Warm' };
    if (off <= 20) return { icon: '🌥️', word: 'Cold' };
    return { icon: '🧊', word: 'Ice cold' };
  }

  // ---------- rendering ----------
  function renderReceiptPanel() {
    const ph = phase();
    const tier = ph === 'year' ? Math.min(st.guesses.length, 3) : 3;
    const newTier = lastTier >= 0 && tier > lastTier ? tier : -1;
    if (mode === 'real') {
      const done = ph === 'done';
      $('receipt').innerHTML = renderRealHTML(rc.real, tier, done && lastTier >= 0 && lastTier < 4 && !realDoneShown ? 'done' : newTier, done);
      realDoneShown = done;
      lastTier = tier;
      return;
    }
    $('receipt').innerHTML = RD.renderReceipt(rc, tier, newTier);
    if (tier === 3 && newTier === 3) $('receipt').firstElementChild.classList.add('develop');
    lastTier = tier;
  }

  function renderYear() {
    const ph = phase();
    $('yearPhase').hidden = false;
    const n = st.guesses.length;
    const left = MAX_GUESSES - n;
    $('clueStep').textContent = ph === 'year'
      ? `Clue ${Math.min(n + 1, 4)} of 4 · ${left} guess${left === 1 ? '' : 'es'} left`
      : (solved() ? `Solved in ${st.guesses.findIndex(g => offBy(g) <= SOLVE) + 1}` : 'Out of guesses');
    const active = ph === 'year';
    ['yearSlider', 'minus', 'plus', 'guessBtn'].forEach(id => { $(id).disabled = !active; });
    $('yearPhase').classList.toggle('done', !active);

    $('guessList').innerHTML = st.guesses.map((g, i) => {
      const off = offBy(g), t = temp(off);
      let rel = '';
      if (i > 0 && off > SOLVE) {
        const prev = offBy(st.guesses[i - 1]);
        rel = off < prev ? ' · hotter' : off > prev ? ' · colder' : ' · same distance';
      }
      const dir = off <= SOLVE ? (off === 0 ? 'exact!' : `off by ${off}`) : (g < rc.year ? 'go later ↑' : 'go earlier ↓');
      return `<li class="g g-${square(off) === '🟩' ? 'ok' : square(off) === '🟨' ? 'y' : square(off) === '🟧' ? 'o' : 'r'}"><span class="gy">${g}</span><span class="gt">${t.icon} ${t.word}${rel}</span><span class="gd">${dir}</span></li>`;
    }).join('');

    const last = st.guesses[n - 1];
    let hint = '';
    if (ph === 'year' && n > 0) {
      const added = mode === 'real' ? (n === 1 ? 'Two more lines uncovered.' : n === 2 ? 'More lines, plus the subtotal and tax.' : 'The payment section is uncovered. Last guess!') : n === 1 ? 'Two more items revealed.' : n === 2 ? 'More items, plus the subtotal and tax line.' : 'The original receipt is revealed. Last guess!';
      hint = `${temp(offBy(last)).icon} ${last < rc.year ? 'Too early.' : 'Too late.'} ${added}`;
    } else if (ph !== 'year') {
      hint = solved() ? `Nice work. It's from ${rc.year}.` : `It was ${rc.year}. You were ${bestOff()} years off at best.`;
    }
    $('hint').textContent = hint;
  }

  // Tile-grid map of the US: [row, col]
  const TILES = { AK: [0, 0], ME: [0, 10], WI: [1, 5], VT: [1, 9], NH: [1, 10], WA: [2, 0], ID: [2, 1], MT: [2, 2], ND: [2, 3], MN: [2, 4], IL: [2, 5], MI: [2, 6], NY: [2, 8], MA: [2, 9], OR: [3, 0], NV: [3, 1], WY: [3, 2], SD: [3, 3], IA: [3, 4], IN: [3, 5], OH: [3, 6], PA: [3, 7], NJ: [3, 8], CT: [3, 9], RI: [3, 10], CA: [4, 0], UT: [4, 1], CO: [4, 2], NE: [4, 3], MO: [4, 4], KY: [4, 5], WV: [4, 6], VA: [4, 7], MD: [4, 8], DE: [4, 9], AZ: [5, 1], NM: [5, 2], KS: [5, 3], AR: [5, 4], TN: [5, 5], NC: [5, 6], SC: [5, 7], DC: [5, 8], OK: [6, 3], LA: [6, 4], MS: [6, 5], AL: [6, 6], GA: [6, 7], HI: [7, 0], TX: [7, 3], FL: [7, 8] };
  const REGION_OF = {};
  'CT ME MA NH RI VT NJ NY PA'.split(' ').forEach(s => REGION_OF[s] = 'NE');
  'IL IN MI OH WI IA KS MN MO NE ND SD'.split(' ').forEach(s => REGION_OF[s] = 'MW');
  'DE DC FL GA MD NC SC VA WV AL KY MS TN AR LA OK TX'.split(' ').forEach(s => REGION_OF[s] = 'S');
  Object.keys(TILES).forEach(s => { if (!REGION_OF[s]) REGION_OF[s] = 'W'; });

  let pendingRegion = null;
  function buildMap() {
    const T = 40, G = 4;
    let h = '';
    for (const [s, [r, c]] of Object.entries(TILES)) {
      h += `<g class="tile r-${REGION_OF[s]}" data-region="${REGION_OF[s]}" data-state="${s}"><rect x="${c * (T + G)}" y="${r * (T + G)}" width="${T}" height="${T}" rx="6"/><text x="${c * (T + G) + T / 2}" y="${r * (T + G) + T / 2 + 5}" text-anchor="middle">${s}</text></g>`;
    }
    const svg = $('usmap');
    svg.setAttribute('viewBox', `0 0 ${11 * (T + G) - G} ${8 * (T + G) - G}`);
    svg.innerHTML = h;
    svg.addEventListener('click', e => {
      const g = e.target.closest('.tile');
      if (g && phase() === 'region') choose(g.dataset.region);
    });
    $('regionBtns').innerHTML = Object.entries(REG_NAMES).map(([k, v]) => `<button class="rbtn r-${k}" data-region="${k}">${v}</button>`).join('');
    $('regionBtns').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (b && phase() === 'region') choose(b.dataset.region);
    });
  }
  function choose(reg) {
    pendingRegion = reg;
    $('regionLock').disabled = false;
    $('regionLock').textContent = 'Lock in ' + REG_NAMES[reg];
    paintMap();
  }
  function paintMap() {
    const ph = phase();
    const sel = ph === 'region' ? pendingRegion : st.region;
    document.querySelectorAll('#usmap .tile').forEach(g => {
      g.classList.toggle('sel', g.dataset.region === sel);
      g.classList.toggle('answer-region', ph === 'done' && g.dataset.region === rc.region);
      g.classList.toggle('answer', ph === 'done' && g.dataset.state === rc.state);
    });
    document.querySelectorAll('#regionBtns .rbtn').forEach(b => {
      b.classList.toggle('sel', b.dataset.region === sel);
      b.disabled = ph !== 'region';
    });
  }

  function renderRegion() {
    const ph = phase();
    $('regionPhase').hidden = ph === 'year';
    if (ph === 'year') return;
    $('regionPhase').classList.toggle('done', ph === 'done');
    $('regionLock').hidden = $('regionSkip').hidden = ph !== 'region';
    if (ph === 'region') {
      $('regionTitle').textContent = 'Where was it rung up?';
      $('regionHelp').textContent = 'Pick a part of the country. Regional brands, tax lines and prices are your clues.';
      if (!pendingRegion) { $('regionLock').disabled = true; $('regionLock').textContent = 'Pick a region'; }
    } else {
      const S = D.STATES[rc.state];
      $('regionTitle').textContent = `${S.n} · ${REG_NAMES[rc.region]}`;
      $('regionHelp').textContent = st.region === 'skip' ? 'You skipped the bonus round.'
        : regionRight() ? `You said ${REG_NAMES[st.region]}. Correct, +50 points.` : `You said ${REG_NAMES[st.region]}. Not this time.`;
    }
    paintMap();
  }

  function shareText() {
    const head = mode === 'daily' ? `🧾 Receipt Detective #${todayN}` : mode === 'real' ? '🧾 Receipt Detective · Real receipt' : '🧾 Receipt Detective (practice)';
    const off = bestOff();
    const yr = `📅 ${solved() ? 'Solved' : 'Missed'} · off by ${off} · ${st.guesses.map(g => square(offBy(g))).join('')}`;
    const rg = st.region === 'skip' ? '📍 Region skipped' : `📍 Region ${regionRight() ? '✅' : '❌'}`;
    const total = yearPoints() + (regionRight() ? 50 : 0);
    const url = /^https?:/.test(location.protocol) ? '\n' + location.origin + location.pathname : '';
    return `${head}\n${yr}\n${rg}\n🏅 ${total}/150${url}`;
  }

  function renderReveal() {
    const done = phase() === 'done';
    ['revealPhase', 'thenNow', 'clueCard'].forEach(id => { $(id).hidden = !done; });
    if (!done) return;
    const S = D.STATES[rc.state];
    const place = mode === 'real' ? rc.real.place : S.n;
    $('stamp').innerHTML = `<div class="stamp-year">${rc.year}</div><div class="stamp-place">${esc(place)} · ${REG_NAMES[rc.region]}</div>`;
    const yp = yearPoints(), rp = regionRight() ? 50 : 0;
    $('scoreLine').innerHTML = `<b>${yp + rp}</b>/150 &nbsp;·&nbsp; year ${yp} &nbsp;·&nbsp; region ${rp}`;
    $('sharePreview').textContent = shareText();
    $('practiceBtn').textContent = mode === 'daily' ? 'Practice receipt' : 'Another practice receipt';
    updateNext();

    if (mode === 'real') {
      const R = rc.real;
      const adj = R.total * D.CPI[RD.NOW] / D.CPI[R.year];
      $('thenNow').hidden = false;
      $('tnTable').innerHTML = '';
      $('thenNowIntro').textContent = '';
      $('tnSum').innerHTML = `This basket came to <b>${fmt(R.total)}</b> in ${R.year}. After general inflation that is about <b>${fmt(adj)}</b> in ${RD.NOW} dollars.`;
      $('clueList').innerHTML = R.clues.map(c => `<li class="clue-${c.type}"><span class="tag">${c.type === 'region' ? '📍' : '📅'}</span>${esc(c.text)}</li>`).join('');
      return;
    }
    // Then vs now
    const rows = rc.items.map(i => {
      const x = i.total > 0 ? i.nowTotal / i.total : 0;
      return `<tr><td>${esc(i.name)}${i.weight ? ` <span class="muted">(${i.weight.toFixed(2)} lb)</span>` : i.qty > 1 ? ` <span class="muted">×${i.qty}</span>` : ''}</td><td class="n">${fmt(i.total)}</td><td class="n">${fmt(i.nowTotal)}</td><td class="n x">${x.toFixed(1)}×</td></tr>`;
    }).join('');
    const thenT = rc.items.reduce((a, i) => a + i.total, 0);
    const nowT = rc.items.reduce((a, i) => a + i.nowTotal, 0);
    $('tnTable').innerHTML = `<thead><tr><th>Item</th><th class="n">${rc.year}</th><th class="n">${RD.NOW}</th><th class="n">Change</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>Whole cart</td><td class="n">${fmt(thenT)}</td><td class="n">${fmt(nowT)}</td><td class="n x">${(nowT / thenT).toFixed(1)}×</td></tr></tfoot>`;
    const adj = thenT * D.CPI[RD.NOW] / D.CPI[rc.year];
    $('thenNowIntro').textContent = `The same cart, before coupons and tax, at ${RD.NOW} prices in the same region.`;
    let verdict;
    if (rc.year >= 2020) verdict = 'Groceries have moved roughly with overall inflation over such a short span.';
    else if (nowT > adj * 1.08) verdict = 'So these groceries rose faster than prices overall.';
    else if (nowT < adj * 0.92) verdict = 'So, adjusted for inflation, this cart is actually cheaper today.';
    else verdict = 'So these groceries kept pace with inflation almost exactly.';
    $('tnSum').innerHTML = `<b>${fmt(thenT)}</b> in ${rc.year} is about <b>${fmt(adj)}</b> in ${RD.NOW} dollars after general inflation. The cart actually costs <b>${fmt(nowT)}</b> today. ${verdict}`;

    $('clueList').innerHTML = RD.cluesFor(rc).map(c => `<li class="clue-${c.type}"><span class="tag">${c.type === 'region' ? '📍' : '📅'}</span>${esc(c.text)}</li>`).join('');
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let timer = null;
  function updateNext() {
    clearInterval(timer);
    if (mode !== 'daily') {
      $('nextLine').innerHTML = `<a href="#" id="backDaily">Back to today's receipt</a>`;
      $('backDaily').onclick = e => { e.preventDefault(); switchMode('daily'); };
      return;
    }
    const tick = () => {
      const now = new Date();
      const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      let s = Math.max(0, Math.floor((mid - now) / 1000));
      const hh = String(Math.floor(s / 3600)).padStart(2, '0'); s %= 3600;
      const mm = String(Math.floor(s / 60)).padStart(2, '0'); const ss = String(s % 60).padStart(2, '0');
      $('nextLine').textContent = `Next receipt in ${hh}:${mm}:${ss}`;
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  function renderAll() {
    $('puzzleLabel').textContent = mode === 'daily'
      ? `Case #${todayN} · ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`
      : mode === 'real' ? 'Bonus case · a real receipt' : 'Practice case · not counted in stats';
    document.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    renderReceiptPanel();
    renderYear();
    renderRegion();
    renderReveal();
  }

  // ---------- actions ----------
  function setYear(y) {
    y = Math.max(RD.YMIN, Math.min(RD.YMAX, y));
    $('yearSlider').value = y;
    $('yearOut').textContent = y;
    $('guessBtn').textContent = 'Guess ' + y;
  }
  function guess() {
    if (phase() !== 'year') return;
    const y = +$('yearSlider').value;
    if (st.guesses.includes(y)) { flashHint(`You already guessed ${y}.`); return; }
    st.guesses.push(y);
    save();
    renderAll();
    if (phase() === 'region') setTimeout(() => $('regionPhase').scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
  }
  function flashHint(t) { $('hint').textContent = t; }

  function lockRegion(val) {
    if (phase() !== 'region') return;
    st.region = val;
    save();
    if (mode === 'daily') recordStats();
    pendingRegion = null;
    renderAll();
    setTimeout(() => $('revealPhase').scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  function recordStats() {
    const s = store.get('rd:stats', { played: 0, solved: 0, streak: 0, best: 0, last: 0, dist: [0, 0, 0, 0], points: 0, recorded: [] });
    if (s.recorded.includes(todayN)) return;
    s.recorded = s.recorded.concat(todayN).slice(-400);
    s.played++;
    s.points += yearPoints() + (regionRight() ? 50 : 0);
    if (solved()) {
      s.solved++;
      s.dist[st.guesses.findIndex(g => offBy(g) <= SOLVE)]++;
      s.streak = s.last === todayN - 1 ? s.streak + 1 : 1;
      s.last = todayN;
      s.best = Math.max(s.best, s.streak);
    } else s.streak = 0;
    store.set('rd:stats', s);
  }

  function showStats() {
    const s = store.get('rd:stats', { played: 0, solved: 0, streak: 0, best: 0, dist: [0, 0, 0, 0], points: 0 });
    const cell = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    $('statsGrid').innerHTML = cell(s.played, 'Played') + cell(s.played ? Math.round(100 * s.solved / s.played) + '%' : '–', 'Solved')
      + cell(s.streak, 'Streak') + cell(s.played ? Math.round(s.points / s.played) : '–', 'Avg score');
    const max = Math.max(1, ...s.dist);
    $('distGrid').innerHTML = '<h3>Solved on guess</h3>' + s.dist.map((v, i) => `<div class="dist-row"><span>${i + 1}</span><div class="dist-bar" style="width:${Math.max(6, 100 * v / max)}%">${v}</div></div>`).join('');
    $('statsDlg').showModal();
  }

  async function copyShare() {
    const t = shareText();
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove();
    }
    const el = $('toast');
    el.textContent = ok ? 'Copied! Paste it anywhere.' : 'Couldn\'t copy automatically. Select the text below.';
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }

  function switchMode(m) {
    pendingRegion = null; realDoneShown = false;
    if (m === 'real') loadReal(); else loadDaily();
    setYear(st.guesses.length ? st.guesses[st.guesses.length - 1] : 1987);
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- wire up ----------
  function init() {
    buildMap();
    $('yearSlider').addEventListener('input', e => setYear(+e.target.value));
    $('minus').onclick = () => setYear(+$('yearSlider').value - 1);
    $('plus').onclick = () => setYear(+$('yearSlider').value + 1);
    $('guessBtn').onclick = guess;
    $('regionLock').onclick = () => pendingRegion && lockRegion(pendingRegion);
    $('regionSkip').onclick = () => lockRegion('skip');
    $('shareBtn').onclick = copyShare;
    $('practiceBtn').onclick = () => { loadPractice((Math.random() * 2 ** 32) >>> 0); setYear(1987); renderAll(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    $('helpBtn').onclick = () => $('helpDlg').showModal();
    $('statsBtn').onclick = showStats;
    document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

    document.querySelectorAll('.mode-btn').forEach(b => { b.onclick = () => switchMode(b.dataset.mode); });
    const q = new URLSearchParams(location.search);
    if (q.has('practice')) loadPractice(+q.get('practice') >>> 0);
    else if (q.has('real')) loadReal(q.get('real'));
    else loadDaily();
    setYear(st.guesses.length ? st.guesses[st.guesses.length - 1] : 1987);
    renderAll();
    if (!store.get('rd:seenHelp', false)) { store.set('rd:seenHelp', true); $('helpDlg').showModal(); }
  }
  init();
})();
