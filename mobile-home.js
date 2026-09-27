(() => {
  const desktopHomeHtml = homeHtml;
  const mobileQuery = window.matchMedia('(max-width: 760px)');

  const compactName = name => ({
    'TSX Composite':'TSX',
    'S&P 500':'S&P 500',
    'Nasdaq-100':'Nasdaq',
    'Bitcoin':'Bitcoin',
    'Ethereum':'Ethereum',
    'Gold':'Gold',
    'Silver':'Silver'
  }[name] || name);

  const pulseTone = regime => /bull|uptrend|risk-on|strength/i.test(regime||'')
    ? 'good'
    : /bear|downtrend|risk-off|weak/i.test(regime||'')
      ? 'bad'
      : 'flat';

  function mobileHomeHtml(){
    const d=state.daily,p=state.pulse;
    const picks=(state.v2?.integratedSurfacePicks||[]).slice(0,3);
    const allPicks=state.v2?.integratedSurfacePicks||[];
    const s=portfolioSummary();

    const groupChips=(d?.groups||[]).slice(0,3).map(g =>
      \`<span class="mh-chip"><b>\${esc(g.label)}</b><span>\${esc(g.state)}</span></span>\`
    ).join('');

    const pulse=(p?.markets||[]).map(x => {
      const tone=pulseTone(x.regime);
      return \`<article class="mh-pulse-card \${tone}">
        <div class="mh-pulse-head"><b>\${esc(compactName(x.name))}</b><span class="mh-dot"></span></div>
        <strong>\${fmt(x.price)}</strong>
        <small>\${esc(x.regime||'Neutral')}</small>
        <em>\${esc(x.condition||'')}</em>
      </article>\`;
    }).join('');

    const reviews=picks.map((x,i) => \`<article class="mh-review-row">
      <span class="mh-rank">\${i+1}</span>
      <div class="mh-symbol"><b>\${short(x.symbol)}</b><small>\${esc(x.name||x.symbol)}</small></div>
      <div class="mh-stage"><span>\${esc(x.stage)}</span><small>RSI \${Number.isFinite(x.rsi14)?x.rsi14.toFixed(0):'—'}</small></div>
      <button class="mh-chart-btn" data-chart="\${x.symbol}" aria-label="Open \${esc(short(x.symbol))} chart">↗</button>
    </article>\`).join('');

    const portfolioValue=s.currency
      ? money(s.value,s.currency)
      : s.complete.length
        ? 'Mixed currencies'
        : '—';
    const pnl=s.currency ? \`\${money(s.pnl,s.currency)} · \${pct(s.pnlPct)}\` : '—';
    const pnlTone=cls(s.pnl)==='up'?'good':cls(s.pnl)==='down'?'bad':'flat';

    const briefText=d?.summary||d?.keyDevelopments?.[0]?.text||
      'Trend regime, short-term condition and the daily shortlist are loaded from the research engine.';

    return \`<div class="mh-mobile-home">
      <section class="mh-brief-card">
        <div class="mh-card-label"><span>DAILY BRIEF</span><small>\${esc(d?.asOf?.latest||'')}</small></div>
        <h2>\${esc(d?.headline||'Market report unavailable')}</h2>
        <div class="mh-chip-row">\${groupChips}</div>
        <details class="mh-brief-more">
          <summary>Full brief</summary>
          <p>\${esc(briefText)}</p>
        </details>
      </section>

      <section class="mh-section">
        <div class="mh-section-head">
          <div><h3>Market Pulse</h3><p>Trend + short-term condition</p></div>
          <span class="mh-section-tag">\${(p?.markets||[]).length} markets</span>
        </div>
        <div class="mh-pulse-track">\${pulse||'<div class="mh-empty">Pulse unavailable.</div>'}</div>
      </section>

      <section class="mh-section">
        <div class="mh-section-head">
          <div><h3>Charts to Review</h3><p>Top three on Home · \${allPicks.length} total</p></div>
          <button class="mh-text-btn" data-open="shortlist">View all</button>
        </div>
        <div class="mh-review-list">\${reviews||'<div class="mh-empty">No current shortlist.</div>'}</div>
      </section>

      <section class="mh-portfolio-card">
        <div class="mh-section-head">
          <div><h3>Portfolio</h3><p>What you actually own</p></div>
          <button class="mh-text-btn" data-open="portfolio">Open</button>
        </div>
        <div class="mh-portfolio-main">
          <div><small>Current value</small><strong>\${portfolioValue}</strong><span class="\${pnlTone}">\${pnl}</span></div>
          <div class="mh-portfolio-stats">
            <span><small>Holdings</small><b>\${s.rows.length}</b></span>
            <span><small>Attention</small><b>\${s.attention.length}</b></span>
            <span><small>Changed</small><b>\${s.changed.length}</b></span>
          </div>
        </div>
      </section>
    </div>\`;
  }

  homeHtml=function(){
    return mobileQuery.matches ? mobileHomeHtml() : desktopHomeHtml();
  };

  mobileQuery.addEventListener?.('change', () => {
    if(state.view==='home') renderView('home');
  });

  queueMicrotask(() => {
    if(state.view==='home') renderView('home');
  });
})();