/*
 * Receipt Detective: receipt generator and renderer.
 * Everything is deterministic from a seed, so every player gets the same
 * receipt on the same day without a server.
 */
(function () {
  'use strict';
  const D = window.RD_DATA;
  const YMIN = 1950, YMAX = 2025, NOW = 2025;

  // ---------- utilities ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const round2 = x => Math.round(x * 100) / 100;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function interp(p, y) {
    const ys = Object.keys(p).map(Number).sort((a, b) => a - b);
    if (y <= ys[0]) return p[ys[0]];
    if (y >= ys[ys.length - 1]) return p[ys[ys.length - 1]];
    for (let i = 0; i < ys.length - 1; i++) {
      const a = ys[i], b = ys[i + 1];
      if (y >= a && y <= b) {
        const t = (y - a) / (b - a);
        return Math.exp(Math.log(p[a]) * (1 - t) + Math.log(p[b]) * t);
      }
    }
    return p[ys[0]];
  }
  function sizeFor(sizes, y) {
    if (!sizes) return null;
    let s = sizes[0];
    for (const z of sizes) if (y >= z[0]) s = z;
    return s;
  }
  // Price the way a store would: mostly ending in 9, sometimes 5.
  function storeRound(x, r) {
    let c = Math.max(1, Math.round(x * 100));
    if (c < 10) return c / 100;
    const roll = r();
    const base = Math.floor(c / 10) * 10;
    const tol = Math.max(2, Math.round(c * 0.06));
    const near = list => list.filter(v => v > 0 && Math.abs(v - c) <= tol).sort((a, b) => Math.abs(a - c) - Math.abs(b - c));
    const nine = near([base - 1, base + 9]), five = near([base - 5, base + 5]);
    if (roll < 0.92) {
      const opts = roll < 0.72 ? nine.concat(five) : five.concat(nine);
      if (opts.length) c = opts[0];
    }
    return c / 100;
  }
  // Deterministic "today's price" rounding for the then-vs-now panel.
  function endIn9(x) {
    let c = Math.round(x * 100);
    let cand = Math.floor(c / 10) * 10 + 9;
    if (cand - c > 5) cand -= 10;
    return Math.max(9, cand) / 100;
  }

  function styleFor(year) {
    if (year <= 1961) return 'hand';
    if (year <= 1979) return 'tape';
    if (year <= 1996) return 'dot';
    return 'thermal';
  }

  function taxRates(code, year) {
    const S = D.STATES[code];
    if (!S.since) return { none: true, never: true, gen: 0, food: 0 };
    if (year < S.since) return { none: true, notYet: true, gen: 0, food: 0 };
    const ramp = year >= 1995 ? 1 : Math.min(1, 0.45 + (year - 1950) * 0.55 / 45);
    let food = S.food;
    if (S.fh) for (const [y, v] of S.fh) if (year >= y) food = v;
    const adj = v => {
      if (!v) return 0;
      if (year >= 1995) return v;
      return Math.max(1, Math.round(v * ramp * 2) / 2);
    };
    const gen = adj(S.rate);
    return { none: false, gen, food: Math.min(adj(food), gen) };
  }

  // ---------- puzzle selection ----------
  const LAUNCH = Date.UTC(2026, 10, 2); // puzzle #1 = Nov 2, 2026
  function todayNumber(d) {
    d = d || new Date();
    const u = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.max(1, Math.floor((u - LAUNCH) / 86400000) + 1);
  }
  const YEARS = []; for (let y = YMIN; y <= YMAX; y++) YEARS.push(y);
  const REGIONS = ['NE', 'MW', 'S', 'W'];

  // Daily puzzles cycle through every year in a shuffled order so all
  // decades get even coverage; regions rotate in blocks of four days.
  function dailyParams(n) {
    const cyc = Math.floor((n - 1) / YEARS.length);
    const deck = shuffle(mulberry32(cyc * 7919 + 101), YEARS);
    const year = deck[(n - 1) % YEARS.length];
    const blk = Math.floor((n - 1) / 4);
    const rdeck = shuffle(mulberry32(blk * 104729 + 7), REGIONS);
    const region = rdeck[(n - 1) % 4];
    return { n, seed: (Math.imul(n, 2654435761) >>> 0) ^ 0x5bd1e995, year, region };
  }
  function practiceParams(seed) {
    const r = mulberry32(seed);
    return { n: null, seed: seed >>> 0, year: YMIN + Math.floor(r() * YEARS.length), region: pick(r, REGIONS) };
  }

  // ---------- receipt building ----------
  function makeStaple(s, year, region, r, tier) {
    const size = sizeFor(s.sizes, year);
    const fac = (s.reg && s.reg[region]) || D.REGION_FACTOR[region];
    const sizeFac = size ? size[2] : 1;
    const base = interp(s.p, year) * sizeFac * fac * (0.95 + r() * 0.1);
    const nowBase = interp(s.p, NOW) * sizeFac * fac;
    const it = {
      kind: 'staple', id: s.id, tier, dept: s.dept, nonfood: false,
      name: s.n + (size && size[1] ? ', ' + size[1] : ''),
      abbr: s.a + (size && size[3] ? ' ' + size[3] : ''),
      clue: null, clueType: null, sizeClue: size && size[4] ? size[4] : null,
      events: (s.events || []).filter(e => year >= e[0] && year <= e[1]).map(e => e[2]),
      qty: 1
    };
    if (s.w) {
      it.weight = round2(s.w[0] + r() * (s.w[1] - s.w[0]));
      it.unit = storeRound(base, r);
      it.total = round2(it.weight * it.unit);
      it.nowTotal = round2(it.weight * endIn9(nowBase));
    } else {
      it.unit = storeRound(base, r);
      it.total = it.unit;
      it.nowTotal = endIn9(nowBase);
    }
    return it;
  }

  function makeSpecial(s, year, region, r, tier) {
    const fac = D.REGION_FACTOR[region];
    const iceSmall = year >= 2008;
    const sz = iceSmall ? ['1.5 qt', '1.5QT'] : ['½ gal', '1/2GAL'];
    const name = s.n.replace('{s}', sz[0]);
    const abbr = s.a.replace('{S}', sz[1]);
    let unit, now;
    if (s.fixed) { unit = s.fixed; now = s.fixed; }
    else {
      unit = storeRound(s.p * D.CPI[year] / D.CPI[NOW] * fac * (0.94 + r() * 0.12), r);
      now = endIn9(s.p * fac);
    }
    const it = {
      kind: 'special', tier, name, abbr, nonfood: s.nonfood,
      dept: ({ soda: 'GR', chips: 'GR', cereal: 'GR', mayo: 'GR', icecream: 'FZ', cheese: 'DY', bakery: 'BK', snack: 'GR', frozen: 'FZ', pantry: 'GR', coffeebrand: 'GR', dairy: 'DY', drink: 'GR', paper: 'NF', clean: 'NF' })[s.slot] || 'GR',
      clue: s.c, clueType: s.r ? 'region' : (s.c ? 'year' : null), regions: s.r,
      sizeClue: s.slot === 'icecream' && iceSmall ? 'Ice cream "half gallons" shrank to 1.5 quarts around 2008.' : null,
      events: [], qty: 1, unit
    };
    if (!s.fixed && unit < 3 && r() < 0.2) it.qty = 2;
    it.total = round2(it.unit * it.qty);
    it.nowTotal = round2(now * it.qty);
    return it;
  }

  function buildReceipt(params) {
    const { seed, year, region } = params;
    const r = mulberry32(seed);
    const states = Object.keys(D.STATES).filter(k => D.STATES[k].region === region);
    const state = pick(r, states);
    const style = styleFor(year);
    const items = [];

    // Staples: eggs, milk, bread first; then five random staples.
    const core = ['eggs', 'milk', 'bread'];
    const others = shuffle(r, D.STAPLES.map(s => s.id).filter(id => !core.includes(id))).slice(0, 5);
    const tiers = [0, 0, 0, 1, 1, 2, 3, 3];
    core.concat(others).forEach((id, i) => items.push(makeStaple(D.STAPLES.find(s => s.id === id), year, region, r, tiers[i])));

    // Specials: dated brands, regional brands, a non-food item, filler.
    const elig = D.SPECIALS.filter(s => year >= s.f && year <= s.t && (!s.r || s.r.includes(region)));
    const used = new Set();
    const take = (list, count, tier) => {
      for (const s of shuffle(r, list)) {
        if (count <= 0) break;
        if (used.has(s.slot)) continue;
        used.add(s.slot);
        items.push(makeSpecial(s, year, region, r, tier));
        count--;
      }
    };
    take(elig.filter(s => !s.r && s.c && !s.nonfood && !s.fixed), 1, 2);
    take(elig.filter(s => s.r && s.r.length === 1), 3, 3);
    take(elig.filter(s => !s.r && s.c && !s.nonfood), 1, 3);
    take(elig.filter(s => s.nonfood), 1, 3);
    take(elig.filter(s => s.r && s.r.length > 1), 1, 3);
    const nSpecial = items.filter(i => i.kind === 'special').length;
    take(elig.filter(s => !s.r && !s.c && !s.nonfood), Math.max(0, 7 - nSpecial), 3);

    const order = shuffle(r, items);

    // Discounts by era.
    if (year >= 1998) {
      shuffle(r, order.filter(i => !i.weight)).slice(0, 2 + Math.floor(r() * 2)).forEach(i => {
        i.save = Math.max(0.1, Math.round(i.total * (0.1 + r() * 0.2) * 10) / 10);
      });
    } else if (year >= 1980 && r() < 0.75) {
      shuffle(r, order.filter(i => i.kind === 'special' && i.total > 0.8)).slice(0, 1 + Math.floor(r() * 2)).forEach(i => {
        const amt = pick(r, [0.15, 0.20, 0.25, 0.25, 0.30, 0.50]);
        i.coupon = Math.min(round2(i.total - 0.05), r() < 0.5 ? amt * 2 : amt);
        i.dbl = i.coupon > amt;
      });
    }

    const R = taxRates(state, year);
    let gross = 0, disc = 0, taxBase = 0;
    for (const i of order) {
      gross += i.total;
      disc += (i.save || 0) + (i.coupon || 0);
      i.taxRate = R.none ? 0 : (i.nonfood ? R.gen : R.food);
      taxBase += i.total * i.taxRate / 100;
    }
    gross = round2(gross); disc = round2(disc);
    const tax = round2(taxBase);
    const S = D.STATES[state];
    const bag = S.bag && year >= S.bag[0] ? S.bag[1] : 0;
    const subtotal = round2(gross - disc);
    const total = round2(subtotal + tax + bag);

    // Payment.
    let pay;
    const cash = () => {
      const step = pick(r, [1, 5, 10, 20, 20]);
      let tend = Math.ceil(total / step) * step;
      if (tend <= total) tend += step;
      return { type: 'cash', tend, change: round2(tend - total) };
    };
    if (style === 'thermal' && r() < 0.68) {
      pay = { type: 'card', brand: pick(r, ['VISA', 'VISA', 'MASTERCARD', 'DEBIT', 'AMEX']), last4: String(1000 + Math.floor(r() * 9000)), tap: year >= 2019 && r() < 0.7 };
    } else if (style === 'dot' && r() < 0.4) {
      pay = { type: 'check' };
    } else pay = cash();

    const stamps = year <= 1979 && r() < 0.6 ? Math.floor(total * 10) : 0;
    const fake = () => String(Math.floor(r() * 90) + 10);

    return {
      params, year, region, state, style, items: order, R, gross, disc, subtotal, tax, bag, total, pay, stamps,
      store: pick(r, D.STORE_NAMES), fakeDate: `${fake()}/${fake()}/${fake()}`, storeNo: String(100 + Math.floor(r() * 900)),
      reg: 1 + Math.floor(r() * 8), cashier: String(100 + Math.floor(r() * 900)),
      barcode: Array.from({ length: 46 }, () => 1 + Math.floor(r() * 3))
    };
  }

  // ---------- clues for the reveal ----------
  function cluesFor(rc) {
    const out = [];
    const S = D.STATES[rc.state];
    const styleClue = {
      hand: 'A handwritten tally slip: small grocers wrote up orders by hand into the early \'60s.',
      tape: 'Register tape with department codes and purple ink points to the \'60s and \'70s.',
      dot: 'Dot-matrix printing with a red total line is classic \'80s to mid-\'90s.',
      thermal: 'Thermal paper, savings lines and a barcode mean the late \'90s or later.'
    }[rc.style];
    out.push({ type: 'year', text: styleClue });
    const seen = new Set();
    for (const i of rc.items) {
      for (const t of [i.clue, i.sizeClue].concat(i.events || [])) {
        if (!t || seen.has(t)) continue;
        seen.add(t);
        out.push({ type: t === i.clue && i.clueType === 'region' ? 'region' : 'year', text: t });
      }
    }
    if (rc.stamps) out.push({ type: 'year', text: 'S&H Green Stamps were a supermarket fixture from the \'50s through the \'70s.' });
    if (rc.items.some(i => i.save)) out.push({ type: 'year', text: 'Loyalty-card savings lines spread in the late 1990s.' });
    if (rc.items.some(i => i.dbl)) out.push({ type: 'year', text: '"Double coupon" days were an \'80s and \'90s supermarket war.' });
    if (rc.bag) out.push({ type: 'region', text: `${S.n}'s bag fee began in ${S.bag[0]}.` });
    if (rc.R.never) out.push({ type: 'region', text: `No sales tax at all: ${S.n} is one of only five states without one.` });
    else if (rc.R.notYet) out.push({ type: 'region', text: `No tax line: ${S.n} didn't have a sales tax until ${S.since}.` });
    else if (rc.R.food > 0) out.push({ type: 'region', text: `${S.n} taxed groceries (${rc.R.food}%), while most states exempt food.` });
    else out.push({ type: 'region', text: `Groceries were tax-free in ${S.n}; only non-food items were taxed (${rc.R.gen}%).` });
    return out;
  }

  // ---------- rendering ----------
  const money = x => x.toFixed(2);
  const cents = x => (x < 1 ? '.' + String(Math.round(x * 100)).padStart(2, '0') : x.toFixed(2));
  const handMoney = x => (x < 1 ? Math.round(x * 100) + '¢' : '$' + x.toFixed(2));
  const bar = n => `<span class="bar" style="width:${Math.max(3, Math.min(22, n))}ch"></span>`;
  const ln = (l, rt, cls) => `<div class="ln ${cls || ''}"><span class="l">${l}</span><span class="r">${rt}</span></div>`;
  const center = (t, cls) => `<div class="c ${cls || ''}">${t}</div>`;
  const blur = t => `<span class="blur" aria-hidden="true">${esc(t)}</span>`;

  function detail(i, fmt, upper) {
    if (i.weight) return `${i.weight.toFixed(2)} ${upper ? 'LB' : 'lb'} @ ${fmt(i.unit)}/${upper ? 'LB' : 'lb'}`;
    if (i.qty > 1) return `${i.qty} @ ${fmt(i.unit)}`;
    return '';
  }

  function renderNeutral(rc, tier, newTier) {
    let h = `<div class="rc-head">
      <div class="lab">Evidence transcript</div>
      <div class="meta-row"><span>Store</span>${bar(12)}</div>
      <div class="meta-row"><span>Date</span>${bar(8)}</div>
    </div><div class="rule"></div>`;
    for (const i of rc.items) {
      if (i.tier <= tier) {
        const d = detail(i, x => '$' + money(x));
        h += `<div class="item ${i.tier === newTier ? 'new' : ''}">${ln(esc(i.name), '$' + money(i.total))}${d ? `<div class="sub">${d}</div>` : ''}</div>`;
      } else {
        h += `<div class="item hidden-line">${ln(bar(i.name.length * 0.8), bar(4))}</div>`;
      }
    }
    h += '<div class="rule"></div>';
    const show = tier >= 2;
    const cls = tier === 2 && newTier === 2 ? 'new' : '';
    if (show && rc.disc > 0) h += ln('Coupons &amp; savings', '−$' + money(rc.disc), cls);
    h += ln('Subtotal', show ? '$' + money(rc.subtotal) : bar(5), cls);
    h += ln(rc.R.none ? 'Tax' : `Tax${show ? ' (' + (rc.R.food > 0 ? rc.R.food + '% food / ' : '') + rc.R.gen + '%)' : ''}`, show ? (rc.R.none ? 'none' : '$' + money(rc.tax)) : bar(4), cls);
    if (show && rc.bag) h += ln('Bag fee', '$' + money(rc.bag), cls);
    h += ln('<b>Total</b>', bar(5), 'tot');
    h += `<div class="foot">The original printing is revealed with clue 4.</div>`;
    return `<div class="receipt style-neutral">${h}</div>`;
  }

  function renderHand(rc) {
    let h = `<div class="hd">${center(blur(rc.store), 'store')}${center('Date ' + blur(rc.fakeDate) + '&nbsp;&nbsp; No. ' + rc.cashier, 'small')}</div>`;
    for (const i of rc.items) {
      const d = detail(i, handMoney);
      h += ln(esc(i.name) + (d ? ` <span class="sub-i">${d}</span>` : ''), handMoney(i.total));
    }
    if (!rc.R.none) h += ln('Tax', handMoney(rc.tax));
    h += ln('<u>Total</u>', `<u>$${money(rc.total)}</u>`, 'tot');
    if (rc.pay.type === 'cash') h += ln('Rec\'d', '$' + money(rc.pay.tend)) + ln('Change', handMoney(rc.pay.change));
    if (rc.stamps) h += ln('S&amp;H stamps', rc.stamps);
    h += center('Paid — thank you!', 'thanks');
    return `<div class="receipt style-hand">${h}</div>`;
  }

  function renderTape(rc) {
    let h = `${center(blur(rc.store.toUpperCase()), 'store')}${center(blur(rc.fakeDate) + ' &nbsp;' + rc.reg, 'small')}<div class="gap"></div>`;
    for (const i of rc.items) {
      const d = detail(i, cents, true);
      h += ln(`${i.dept} ${esc(i.abbr)}`, cents(i.total));
      if (d) h += `<div class="sub">${d}</div>`;
    }
    h += '<div class="gap"></div>';
    if (!rc.R.none) h += ln('TX', cents(rc.tax));
    h += ln('TL', money(rc.total), 'tot');
    if (rc.pay.type === 'cash') h += ln('CA', money(rc.pay.tend)) + ln('CG', cents(rc.pay.change));
    if (rc.stamps) h += ln('S&amp;H STAMPS', rc.stamps);
    h += center('THANK YOU — CALL AGAIN', 'thanks');
    return `<div class="receipt style-tape">${h}</div>`;
  }

  function renderDot(rc) {
    let h = `${center(blur(rc.store.toUpperCase()), 'store')}${center(blur('1234 MAIN ST  ANYTOWN'), 'small')}${center(`STORE ${rc.storeNo}  REG ${rc.reg}  CSH ${rc.cashier}`, 'small')}<div class="gap"></div>`;
    let count = 0;
    for (const i of rc.items) {
      count += i.qty;
      const d = detail(i, cents, true);
      h += ln(esc(i.abbr), cents(i.total) + ' ' + (i.nonfood ? (i.taxRate ? 'T' : ' ') : (i.taxRate ? 'FT' : 'F')));
      if (d) h += `<div class="sub">${d}</div>`;
      if (i.coupon) h += ln(`&nbsp;&nbsp;${i.dbl ? 'DBL' : 'MFR'} COUPON`, cents(i.coupon) + '-&nbsp;&nbsp;');
    }
    h += '<div class="gap"></div>';
    h += ln('SUBTOTAL', money(rc.subtotal) + '&nbsp;&nbsp;');
    if (!rc.R.none) h += ln('TAX', cents(rc.tax) + '&nbsp;&nbsp;');
    h += ln('**** BALANCE', money(rc.total) + '&nbsp;&nbsp;', 'tot red');
    if (rc.pay.type === 'check') h += ln('CHECK', money(rc.total) + '&nbsp;&nbsp;') + ln('CHANGE', '.00&nbsp;&nbsp;');
    else h += ln('CASH', money(rc.pay.tend) + '&nbsp;&nbsp;') + ln('CHANGE', cents(rc.pay.change) + '&nbsp;&nbsp;');
    h += `<div class="gap"></div>${center('ITEMS ' + count)}${center(blur(rc.fakeDate + ' 14:' + rc.cashier.slice(0, 2)), 'small')}${center('THANK YOU FOR SHOPPING', 'thanks')}`;
    return `<div class="receipt style-dot">${h}</div>`;
  }

  function renderThermal(rc) {
    let h = `${center(blur(rc.store.toUpperCase()), 'store big')}${center(blur('1234 Main St, Anytown'), 'small')}${center(blur('(555) 010-2244'), 'small')}<div class="gap"></div>`;
    let count = 0;
    for (const i of rc.items) {
      count += i.qty;
      const d = detail(i, money, true);
      h += ln(esc(i.abbr), money(i.total) + ' ' + (i.nonfood ? (i.taxRate ? 'T' : 'N') : (i.taxRate ? 'FT' : 'F')));
      if (d) h += `<div class="sub">${d}</div>`;
      if (i.save) h += ln('&nbsp;&nbsp;SC CARD SAVINGS', money(i.save) + '-&nbsp;&nbsp;', 'save');
    }
    if (rc.bag) h += ln('BAG FEE', money(rc.bag) + ' N');
    h += '<div class="gap"></div>';
    h += ln('SUBTOTAL', money(round2(rc.subtotal + rc.bag)) + '&nbsp;&nbsp;');
    if (!rc.R.none) h += ln(`TAX ${rc.R.gen.toFixed(3)}%`, money(rc.tax) + '&nbsp;&nbsp;');
    h += ln('**** TOTAL', money(rc.total) + '&nbsp;&nbsp;', 'tot');
    if (rc.pay.type === 'card') {
      h += ln(`${rc.pay.brand} TEND`, money(rc.total) + '&nbsp;&nbsp;');
      h += `<div class="small">${rc.pay.brand} ************${rc.pay.last4}${rc.pay.tap ? ' CONTACTLESS' : ''}</div>`;
      h += ln('CHANGE DUE', '0.00&nbsp;&nbsp;');
    } else {
      h += ln('CASH TEND', money(rc.pay.tend) + '&nbsp;&nbsp;') + ln('CHANGE DUE', money(rc.pay.change) + '&nbsp;&nbsp;');
    }
    if (rc.disc > 0) h += `<div class="gap"></div>${center(`YOUR CARD SAVINGS TODAY $${money(rc.disc)}`, 'boxed')}`;
    h += `<div class="gap"></div>${center('# ITEMS SOLD ' + count)}${center(blur(rc.fakeDate + ' 18:' + rc.cashier.slice(0, 2) + '  ST# ' + rc.storeNo + ' TR# 0' + rc.cashier), 'small')}`;
    let x = 0, bars = '';
    rc.barcode.forEach((w, k) => { if (k % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="34"/>`; x += w; });
    h += `<svg class="barcode" viewBox="0 0 ${x} 34" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
    if (rc.year >= 2005) h += center('Tell us how we did! Take our survey for a chance to win $500.', 'small');
    return `<div class="receipt style-thermal">${h}</div>`;
  }

  // Wrap an original-style receipt in a "photo": tabletop, lighting,
  // crumpled-paper shading, fold creases, aging and a camera angle.
  // All randomness comes from the receipt's seed so it looks the same for everyone.
  function photoWrap(rc, html) {
    const r = mulberry32((rc.params.seed ^ 0x2545F491) >>> 0);
    const age = RD_AGE(rc.year);
    const tilt = (r() * 5 - 2.5).toFixed(2);
    const rx = (4 + r() * 6).toFixed(1);
    const ry = (r() * 6 - 3).toFixed(1);
    const folds = 1 + Math.floor(r() * 3);
    const creases = [];
    for (let k = 1; k <= folds; k++) creases.push(((k / (folds + 1)) * 100 + (r() * 8 - 4)).toFixed(1));
    const creaseBg = creases.map(y => `linear-gradient(180deg, transparent calc(${y}% - 3px), rgba(0,0,0,.10) calc(${y}% - 1px), rgba(255,255,255,.55) ${y}%, rgba(0,0,0,.06) calc(${y}% + 2px), transparent calc(${y}% + 6px))`).join(',');
    const vfold = r() < 0.35 ? `,linear-gradient(90deg, transparent calc(50% - 2px), rgba(0,0,0,.07) 50%, rgba(255,255,255,.4) calc(50% + 1px), transparent calc(50% + 4px))` : '';
    const stain = r() < 0.3 ? `<div class="stain" style="left:${(10 + r() * 55).toFixed(0)}%;top:${(15 + r() * 60).toFixed(0)}%;transform:scale(${(0.8 + r() * 0.5).toFixed(2)})"></div>` : '';
    const lightX = (20 + r() * 50).toFixed(0), lightY = (5 + r() * 25).toFixed(0);
    const turbSeed = Math.floor(r() * 1000);
    const vars = `--tilt:${tilt}deg;--rx:${rx}deg;--ry:${ry}deg;--age:${age.toFixed(2)};--lx:${lightX}%;--ly:${lightY}%;--creases:${creaseBg}${vfold}`;
    const filterId = 'crumple-' + turbSeed;
    const filt = `<svg class="fx-defs" width="0" height="0" aria-hidden="true"><filter id="${filterId}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.03" numOctaves="2" seed="${turbSeed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${(3 + r() * 4).toFixed(1)}" xChannelSelector="R" yChannelSelector="G"/></filter></svg>`;
    const photo = html.replace('class="receipt ', `style="filter:url(#${filterId})" class="receipt photo `)
      .replace(/<\/div>$/, `<div class="paper-shade"></div><div class="paper-creases"></div>${stain}</div>`);
    return `<div class="photo-scene table-${rc.style}" style="${vars}">${filt}<div class="photo-tilt">${photo}</div><div class="photo-light"></div></div>`;
  }
  // How yellowed/faded the paper looks: older = more.
  function RD_AGE(year) { return Math.max(0, Math.min(1, (NOW - year) / 70)); }

  function renderReceipt(rc, tier, newTier) {
    if (tier < 3) return renderNeutral(rc, tier, newTier);
    return photoWrap(rc, { hand: renderHand, tape: renderTape, dot: renderDot, thermal: renderThermal }[rc.style](rc));
  }

  window.RD = { buildReceipt, renderReceipt, cluesFor, dailyParams, practiceParams, todayNumber, mulberry32, YMIN, YMAX, NOW };
})();
