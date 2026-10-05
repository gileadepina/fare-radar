const DATA_PATHS = {
  config: './data/config.json',
  latest: './data/latest.json',
  history: './data/history.json'
};

let state = { config: null, latest: null, history: null, cabin: 'all' };

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function el(id) { return document.getElementById(id); }
function money(value) { return value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? '—' : brl.format(Number(value)); }
function safeDate(value) { return value ? new Date(value) : null; }
function cabinLabel(value) { return value === 'Premium Economy' ? 'Premium' : value || '—'; }
function routeLabel(option) {
  if (!option) return 'Sem dados';
  const out = `${option.outbound?.origin || '—'} → ${option.outbound?.destination || '—'}`;
  const back = `${option.inbound?.origin || '—'} → ${option.inbound?.destination || '—'}`;
  return `${out} · ${back}`;
}
function dateRange(option) {
  if (!option?.departDate || !option?.returnDate) return '—';
  return `${shortDate.format(new Date(option.departDate + 'T12:00:00'))} → ${shortDate.format(new Date(option.returnDate + 'T12:00:00'))}`;
}
function days(option) { const value = option?.tripDays ?? option?.nights; return value ? `${value} dias` : ''; }
function referenceRoute(ref) {
  if (ref?.outbound && ref?.inbound) return `${ref.outbound.origin || '—'} → ${ref.outbound.destination || '—'} · ${ref.inbound.origin || '—'} → ${ref.inbound.destination || '—'}`;
  return '—';
}
function referenceDates(ref) {
  if (!ref?.departDate || !ref?.returnDate) return '—';
  return `${shortDate.format(new Date(ref.departDate + 'T12:00:00'))} → ${shortDate.format(new Date(ref.returnDate + 'T12:00:00'))}`;
}

async function readJson(path) {
  const sep = path.includes('?') ? '&' : '?';
  const response = await fetch(`${path}${sep}v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Falha ao carregar ${path}`);
  return response.json();
}

async function load() {
  el('refreshButton').disabled = true;
  try {
    const [config, latest, history] = await Promise.all([
      readJson(DATA_PATHS.config), readJson(DATA_PATHS.latest), readJson(DATA_PATHS.history)
    ]);
    state = { ...state, config, latest, history };
    render();
  } catch (error) {
    console.error(error);
    el('lastUpdate').textContent = 'Não foi possível ler os dados';
  } finally {
    el('refreshButton').disabled = false;
  }
}

function render() {
  renderCriteria();
  renderStatus();
  renderAlerts();
  renderMetrics();
  renderRules();
  renderOptions();
  renderHistory();
  renderChart();
  renderPoints();
}

function renderCriteria() {
  const c = state.config;
  if (!c) return;
  const chips = [
    `${c.passengers.adults} adultos`,
    `${c.stay.minDays}–${c.stay.maxDays} dias`,
    `${c.baggage.checked23kgPerAdult}× 23 kg por pessoa`,
    `Economy + Premium`,
    `até ${money(c.budgetBRL)}`
  ];
  el('criteriaRow').innerHTML = chips.map(x => `<span class="criteria-chip">${x}</span>`).join('');
  el('budgetValue').textContent = money(c.budgetBRL);
}

function renderStatus() {
  const latest = state.latest;
  const complete = latest?.status === 'complete';
  el('statusDot').classList.toggle('live', complete);
  el('lastUpdate').textContent = complete && latest.searchedAt
    ? `Atualizado em ${dateTime.format(new Date(latest.searchedAt))}`
    : 'Aguardando primeira pesquisa';

  const rec = latest?.recommendation || {};
  const type = rec.code || 'WAITING';
  const map = {
    BUY_NOW: ['COMPRAR AGORA', 'buy'],
    WATCH: ['ACOMPANHAR', 'watch'],
    WEAK: ['POUCO ATRATIVO', 'weak'],
    WAITING: ['AGUARDANDO', '']
  };
  const [label, css] = map[type] || map.WAITING;
  el('signalPill').textContent = label;
  el('signalPill').className = `signal-pill ${css}`.trim();
  el('signalTitle').textContent = rec.title || 'Primeira varredura ainda não realizada';
  el('signalReason').textContent = rec.reason || 'Assim que houver dados reais, o radar compara o preço do dia com todo o histórico e indica comprar ou acompanhar.';
}

function renderAlerts() {
  const alerts = state.latest?.alerts || [];
  const box = el('alertStrip');
  if (!alerts.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  const first = typeof alerts[0] === 'string' ? alerts[0] : (alerts[0]?.message || alerts[0]?.title || 'Nova oportunidade detectada');
  box.innerHTML = `<strong>ALERTA</strong>${first}`;
}

function renderMetrics() {
  const s = state.latest?.summary || {};
  const historyRuns = state.history?.runs || [];
  const best = s.bestPurchase;
  const low = s.lowestPrice;
  const premium = s.bestPremium;

  el('bestPurchasePrice').textContent = money(best?.totalBRL);
  el('bestPurchaseRoute').textContent = best ? `${routeLabel(best)} · ${dateRange(best)}` : 'Aguardando pesquisa';
  el('bestPurchaseMeta').textContent = best ? `Score ${best.score ?? '—'}/100 · ${cabinLabel(best.cabin)}` : 'Score —';

  el('lowestPrice').textContent = money(low?.totalBRL);
  el('lowestPriceRoute').textContent = low ? `${routeLabel(low)} · ${dateRange(low)}` : 'Sem dados ainda';
  el('lowestPriceMeta').textContent = low ? `${low.marketingCarrier || 'Companhia'} · ${low.source || 'fonte'}` : 'Histórico começa na 1ª busca';

  el('premiumPrice').textContent = money(premium?.totalBRL);
  el('premiumRoute').textContent = premium ? `${routeLabel(premium)} · ${dateRange(premium)}` : 'Sem dados ainda';
  el('premiumMeta').textContent = premium ? `Score ${premium.score ?? '—'}/100` : 'Comparação Economy × Premium';

  const pricedRuns = historyRuns.filter(r => r.bestTotalBRL !== null && r.bestTotalBRL !== undefined && Number.isFinite(Number(r.bestTotalBRL)));
  const historic = pricedRuns.length ? pricedRuns.reduce((a,b) => Number(a.bestTotalBRL) < Number(b.bestTotalBRL) ? a : b) : null;
  el('historicLow').textContent = money(historic?.bestTotalBRL);
  el('historicLowDate').textContent = historic?.searchedAt ? `Registrado em ${dateTime.format(new Date(historic.searchedAt))}` : 'O histórico ainda está vazio';
  el('historicLowMeta').textContent = `${historyRuns.length} ${historyRuns.length === 1 ? 'pesquisa registrada' : 'pesquisas registradas'}`;
}

function renderRules() {
  const c = state.config;
  if (!c) return;
  const excluded = c.excludedCarriers.join(', ');
  const items = [
    ['↔', 'Máximo de 1 conexão', `${c.connection.minMinutes}–${c.connection.maxMinutes} min por conexão`],
    ['⊘', 'Sem self-transfer', 'Sem troca de aeroporto e sem bilhetes separados'],
    ['▣', 'Bagagem já contabilizada', '1 mala de 23 kg para cada passageiro'],
    ['⌁', 'Londres priorizado', c.london.preferred.join(', ')],
    ['×', 'Companhias excluídas', excluded],
    ['✓', 'Fontes controladas', c.allowedSources.join(' · ')]
  ];
  el('ruleList').innerHTML = items.map(([icon, title, detail]) => `
    <div class="rule-item"><span class="rule-icon">${icon}</span><div><strong>${title}</strong><span>${detail}</span></div></div>`
  ).join('');
}

function renderOptions() {
  const all = state.latest?.options || [];
  const options = state.cabin === 'all' ? all : all.filter(x => x.cabin === state.cabin);
  const empty = el('tableEmpty');
  empty.style.display = options.length ? 'none' : 'block';

  if (!options.length) {
    const complete = state.latest?.status === 'complete';
    const references = state.latest?.marketReferences || [];
    const referenceCards = references.length ? `
      <div class="reference-block">
        <div class="reference-heading">
          <span>REFERÊNCIAS ENCONTRADAS</span>
          <small>Não são ofertas elegíveis; servem para contexto de mercado.</small>
        </div>
        <div class="reference-grid">
          ${references.map(ref => `
            <article class="reference-card">
              <div class="reference-top">
                <strong>${ref.provider || ref.source || 'Referência'}</strong>
                <span>${ref.cabin || '—'}</span>
              </div>
              <div class="reference-price">${ref.totalBRL ? money(ref.totalBRL) + ' <small>casal</small>' : money(ref.pricePerAdultBRL) + ' <small>por adulto</small>'}</div>
              <p>${referenceRoute(ref)} · ${referenceDates(ref)}</p>
              <div class="reference-note">${ref.note || 'Referência de mercado não elegível.'}</div>
            </article>
          `).join('')}
        </div>
      </div>` : '';

    empty.innerHTML = complete
      ? `<span class="plane">✈</span>
         <strong>Pesquisa concluída — nenhuma oferta passou todos os filtros</strong>
         <p>O radar encontrou referências reais, mas não confirmou uma tarifa multidestino com bagagem, conexões e companhias dentro de todas as regras.</p>
         ${referenceCards}`
      : `<span class="plane">✈</span>
         <strong>Pronto para a primeira busca</strong>
         <p>O ranking aparecerá aqui já filtrado pelos seus critérios.</p>`;
  }

  el('optionsBody').innerHTML = options.map((o, index) => `
    <tr>
      <td><strong>${index + 1}</strong></td>
      <td><strong>${dateRange(o)}</strong><br><span class="muted">${days(o)}</span></td>
      <td><strong>${routeLabel(o)}</strong><br><span class="muted">${o.marketingCarrier || '—'}</span></td>
      <td>${cabinLabel(o.cabin)}</td>
      <td>${connectionLabel(o)}</td>
      <td>${o.sourceUrl ? `<a class="source-link" href="${o.sourceUrl}" target="_blank" rel="noreferrer">${o.source || 'Abrir'}</a>` : (o.source || '—')}</td>
      <td><strong>${money(o.totalBRL)}</strong><br><span class="muted">2 adultos + malas</span></td>
      <td><span class="score">${o.score ?? '—'}</span></td>
    </tr>
  `).join('');
}

function connectionLabel(o) {
  const out = o.outbound?.stops ?? 0;
  const back = o.inbound?.stops ?? 0;
  if (out === 0 && back === 0) return 'Direto';
  return `${out} ida · ${back} volta`;
}

function renderHistory() {
  const runs = [...(state.history?.runs || [])].reverse().slice(0, 7);
  if (!runs.length) {
    el('historyList').innerHTML = '<div class="timeline-empty"><div><strong>Sem pesquisas anteriores</strong><br>A primeira execução inaugura o histórico.</div></div>';
    return;
  }
  el('historyList').innerHTML = runs.map(r => `
    <div class="timeline-item">
      <span class="timeline-dot"></span>
      <div><strong>${r.searchedAt ? dateTime.format(new Date(r.searchedAt)) : '—'}</strong><span>${r.recommendationLabel || 'Pesquisa registrada'}</span></div>
      <span class="timeline-price">${money(r.bestTotalBRL)}</span>
    </div>
  `).join('');
}

function renderChart() {
  const runs = (state.history?.runs || []).filter(r => r.bestTotalBRL !== null && r.bestTotalBRL !== undefined && Number.isFinite(Number(r.bestTotalBRL)));
  el('runCount').textContent = String(runs.length);
  if (!runs.length) {
    el('averagePrice').textContent = '—';
    el('lastVariation').textContent = '—';
    return;
  }

  const prices = runs.map(r => Number(r.bestTotalBRL));
  const avg = prices.reduce((a,b) => a + b, 0) / prices.length;
  el('averagePrice').textContent = money(avg);
  const lastVar = runs.length > 1 ? (prices.at(-1) - prices.at(-2)) / prices.at(-2) * 100 : 0;
  el('lastVariation').textContent = runs.length > 1 ? `${lastVar > 0 ? '+' : ''}${lastVar.toFixed(1)}%` : '—';
  el('trendBadge').textContent = runs.length > 1 ? (lastVar < -1 ? 'QUEDA' : lastVar > 1 ? 'ALTA' : 'ESTÁVEL') : '1º REGISTRO';
  el('trendBadge').className = `trend-badge ${lastVar < -1 ? 'down' : lastVar > 1 ? 'up' : ''}`.trim();

  const width = 760, height = 280, padX = 44, padY = 34;
  const min = Math.min(...prices), max = Math.max(...prices);
  const spread = Math.max(500, max - min);
  const floor = min - spread * .18, ceil = max + spread * .18;
  const x = i => padX + (runs.length === 1 ? (width - 2 * padX) / 2 : i * ((width - 2 * padX) / (runs.length - 1)));
  const y = p => padY + (ceil - p) / (ceil - floor) * (height - 2 * padY);
  const points = runs.map((r,i) => `${x(i)},${y(Number(r.bestTotalBRL))}`).join(' ');
  const area = `${padX},${height-padY} ${points} ${x(runs.length-1)},${height-padY}`;
  const labels = runs.map((r,i) => `<text x="${x(i)}" y="${height-11}" text-anchor="middle" class="chart-label">${shortDate.format(new Date(r.searchedAt))}</text>`).join('');
  const dots = runs.map((r,i) => `<circle cx="${x(i)}" cy="${y(Number(r.bestTotalBRL))}" r="4" class="chart-dot"><title>${money(r.bestTotalBRL)} · ${dateTime.format(new Date(r.searchedAt))}</title></circle>`).join('');
  const grid = [0,.25,.5,.75,1].map(t => `<line x1="${padX}" y1="${padY+t*(height-2*padY)}" x2="${width-padX}" y2="${padY+t*(height-2*padY)}" class="chart-grid" />`).join('');
  el('chartWrap').innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#70e7bf" stop-opacity=".26"/><stop offset="100%" stop-color="#70e7bf" stop-opacity="0"/></linearGradient></defs>
      ${grid}
      <polygon points="${area}" class="chart-area" />
      <polyline points="${points}" class="chart-line" />
      ${dots}${labels}
    </svg>`;
}

function renderPoints() {
  const points = state.latest?.points || [];
  if (!points.length) return;
  el('pointsArea').className = '';
  el('pointsArea').innerHTML = points.map(p => `
    <div class="point-item"><div><strong>${p.title || 'Oportunidade em pontos'}</strong><p>${p.program || 'Programa'} · ${p.notes || ''}</p></div><div class="point-value">${p.points ? Number(p.points).toLocaleString('pt-BR') + ' pts' : '—'}<br>${money(p.cashBRL)}</div></div>
  `).join('');
}

for (const button of document.querySelectorAll('.segment')) {
  button.addEventListener('click', () => {
    state.cabin = button.dataset.cabin;
    document.querySelectorAll('.segment').forEach(b => b.classList.toggle('active', b === button));
    renderOptions();
  });
}

el('refreshButton').addEventListener('click', load);
load();
