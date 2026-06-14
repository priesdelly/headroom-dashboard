const nf = new Intl.NumberFormat('en-US');
const n = v => nf.format(Math.round(+v || 0));
const pct = v => (+v || 0).toFixed(1) + '%';
const usd = v => '$' + (+v || 0).toFixed(4);
const compact = v => {
  v = +v || 0;
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return n(v);
};
const uptime = s => {
  s = Math.round(+s || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s % 60}s`;
  return `${s}s`;
};
const el = (id, html) => { document.getElementById(id).innerHTML = html; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rows = obj => Object.entries(obj).map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join('');

function renderStatus(h) {
  if (!h) { el('status', '<span class="pill"><span class="dot bad"></span>unreachable</span>'); return; }
  const c = h.config || {};
  const healthy = h.status === 'healthy';
  const flag = (label, on) => `<span class="pill"><span class="dot ${on ? 'ok' : 'off'}"></span>${label}</span>`;
  el('status', `
    <span class="pill"><span class="dot ${healthy ? 'ok' : 'bad'}"></span><b>${esc(h.status || '—')}</b></span>
    ${flag('optimize', c.optimize)}
    ${flag('cache', c.cache)}
    <span class="pill">up <b>${uptime(h.uptime_seconds)}</b></span>
    <span class="pill">v${esc(h.version || '—')}</span>
  `);
}

function renderHero(s) {
  const life = s?.persistent_savings?.lifetime || {};
  const tok = s?.tokens || {};
  el('hero', `
    <div class="card"><h2>Tokens Saved</h2><div class="metric">${compact(life.tokens_saved)}</div><div class="sub">${n(life.tokens_saved)} lifetime</div></div>
    <div class="card"><h2>Savings</h2><div class="metric">${pct(tok.savings_percent)}</div><div class="sub">active rate</div></div>
    <div class="card"><h2>Cost Saved</h2><div class="metric">${usd(life.compression_savings_usd)}</div><div class="sub">compression</div></div>
    <div class="card"><h2>Requests</h2><div class="metric">${n(life.requests)}</div><div class="sub">lifetime total</div></div>
  `);
}

function renderTokens(s) {
  const t = s?.tokens || {};
  const inp = +t.input || 0, out = +t.output || 0, saved = +t.saved || 0;
  const total = inp + out + saved || 1;
  el('tokens', `
    <div class="bar">
      <div style="width:${inp / total * 100}%;background:var(--accent)" title="input"></div>
      <div style="width:${out / total * 100}%;background:var(--amber)" title="output"></div>
      <div style="width:${saved / total * 100}%;background:var(--green)" title="saved"></div>
    </div>
    <div class="legend">
      <span><i style="background:var(--accent)"></i>input ${n(inp)}</span>
      <span><i style="background:var(--amber)"></i>output ${n(out)}</span>
      <span><i style="background:var(--green)"></i>saved ${n(saved)}</span>
    </div>
    <div style="margin-top:12px">${rows({
      'Before compression': n(t.total_before_compression),
      'Proxy savings %': pct(t.proxy_savings_percent),
      'All-layers saved': n(t.all_layers_saved),
    })}</div>
  `);
}

function renderSession(s) {
  const d = s?.persistent_savings?.display_session || {};
  el('session', rows({
    'Tokens saved': n(d.tokens_saved),
    'Savings %': pct(d.savings_percent),
    'Requests': n(d.requests),
    'Cost saved': usd(d.compression_savings_usd),
    'Input tokens': n(d.total_input_tokens),
  }));
}

function renderRequests(s) {
  const r = s?.requests || {};
  el('requests', rows({
    'Total': n(r.total),
    'Cached': n(r.cached),
    'Rate-limited': n(r.rate_limited),
    'Failed': n(r.failed),
  }));
}

function renderLatency(s) {
  const l = s?.latency || {}, o = s?.overhead || {};
  el('latency', rows({
    'Avg': n(l.average_ms) + ' ms',
    'Min': n(l.min_ms) + ' ms',
    'Max': n(l.max_ms) + ' ms',
    'Proxy overhead (avg)': n(o.average_ms) + ' ms',
  }));
}

function renderTable(id, obj, col) {
  const entries = Object.entries(obj || {});
  if (!entries.length) { el(id, '<div class="empty">no data yet</div>'); return; }
  el(id, `<table><thead><tr><th>${col}</th><th class="r">requests</th></tr></thead><tbody>${
    entries.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${n(typeof v === 'object' ? v.total ?? v.requests ?? 0 : v)}</td></tr>`).join('')
  }</tbody></table>`);
}

function renderCcr(s) {
  const c = s?.compression || {};
  el('ccr', rows({
    'Entries': `${n(c.ccr_entries)} / ${n(c.ccr_max_entries)}`,
    'Retrievals': n(c.ccr_retrievals),
    'Original tokens cached': n(c.original_tokens_cached),
    'Compressed tokens cached': n(c.compressed_tokens_cached),
  }));
}

function renderLifetime(s) {
  const l = s?.persistent_savings?.lifetime || {};
  el('lifetime', rows({
    'Requests': n(l.requests),
    'Tokens saved': n(l.tokens_saved),
    'Input tokens': n(l.total_input_tokens),
    'Input cost': usd(l.total_input_cost_usd),
    'Cost saved': usd(l.compression_savings_usd),
  }));
}

function renderChart(hist) {
  const data = (hist?.series?.daily || []).map(d => ({ t: d.timestamp, v: +d.tokens_saved || 0 }));
  if (data.length < 1) { el('chart', '<div class="empty">no history yet — run some traffic through the proxy</div>'); return; }
  const W = 1000, H = 160, pad = 4;
  const max = Math.max(...data.map(d => d.v), 1);
  const bw = W / data.length;
  const bars = data.map((d, i) => {
    const h = (d.v / max) * (H - pad);
    const x = i * bw, w = Math.max(bw - 3, 1);
    const date = (d.t || '').slice(5, 10);
    return `<rect x="${x + 1.5}" y="${H - h}" width="${w}" height="${h}" rx="2" fill="var(--green)"><title>${date}: ${n(d.v)} tokens</title></rect>`;
  }).join('');
  el('chart', `<svg viewBox="0 0 ${W} ${H + 16}" preserveAspectRatio="none">${bars}
    <text x="0" y="${H + 12}" fill="var(--muted)" font-size="11">${data[0].t?.slice(0, 10) || ''}</text>
    <text x="${W}" y="${H + 12}" fill="var(--muted)" font-size="11" text-anchor="end">peak ${compact(max)}</text>
  </svg>`);
}

async function get(url) {
  try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
}

async function load() {
  const [health, stats, hist] = await Promise.all([
    get('/health'), get('/stats'), get('/stats-history?series=daily'),
  ]);
  renderStatus(health);
  document.querySelector('main').classList.toggle('stale', !stats);
  if (stats) {
    renderHero(stats); renderTokens(stats); renderSession(stats);
    renderRequests(stats); renderLatency(stats);
    renderTable('byprovider', stats.requests?.by_provider, 'provider');
    renderTable('bymodel', stats.requests?.by_model, 'model');
    renderCcr(stats); renderLifetime(stats);
  }
  renderChart(hist);
  el('updated', (stats ? 'updated ' : '⚠ stale · ') + new Date().toLocaleTimeString());
}

let timer = null;
function schedule(ms) {
  if (timer) clearInterval(timer);
  if (ms > 0) timer = setInterval(load, ms);
}

const intervalSel = document.getElementById('interval');
intervalSel.value = localStorage.getItem('hr_interval') ?? '10000';
intervalSel.onchange = () => {
  localStorage.setItem('hr_interval', intervalSel.value);
  schedule(+intervalSel.value);
};
document.getElementById('refresh').onclick = load;

const themeBtn = document.getElementById('theme');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === 'light' ? '☀' : '☾';
}
applyTheme(localStorage.getItem('hr_theme') || 'dark');
themeBtn.onclick = () => {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('hr_theme', t);
  applyTheme(t);
};

load();
schedule(+intervalSel.value);
