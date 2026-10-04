import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: node scripts/apply-run.mjs <payload.json>');
  process.exit(1);
}

const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const config = await read(path.join(root, 'data/config.json'));
const history = await read(path.join(root, 'data/history.json'));
const payload = await read(path.resolve(inputPath));

if (!payload.searchedAt || Number.isNaN(Date.parse(payload.searchedAt))) throw new Error('searchedAt inválido');
if (!Array.isArray(payload.options)) throw new Error('options precisa ser um array');

const excluded = config.excludedCarriers.map(x => x.toLowerCase());
const allowedSources = new Set(config.allowedSources);
const allowedCabins = new Set(config.cabins);
const reasons = [];

for (const [index, o] of payload.options.entries()) {
  const carriers = [o.marketingCarrier, ...(o.operatingCarriers || [])].filter(Boolean).map(x => x.toLowerCase());
  if (carriers.some(c => excluded.some(x => c.includes(x)))) reasons.push(`#${index + 1}: companhia excluída`);
  if (!allowedSources.has(o.source)) reasons.push(`#${index + 1}: fonte não autorizada`);
  if (!allowedCabins.has(o.cabin)) reasons.push(`#${index + 1}: cabine inválida`);
  if ((o.outbound?.stops ?? 0) > config.connection.maxStopsPerDirection || (o.inbound?.stops ?? 0) > config.connection.maxStopsPerDirection) reasons.push(`#${index + 1}: excesso de conexões`);
  if (o.selfTransfer === true) reasons.push(`#${index + 1}: self-transfer`);
  if (o.airportChange === true) reasons.push(`#${index + 1}: troca de aeroporto`);
  if (o.bag23kgPerAdultIncluded !== true) reasons.push(`#${index + 1}: bagagem de 23 kg não confirmada`);
  if (o.verified !== true) reasons.push(`#${index + 1}: preço não verificado`);
  for (const side of ['outbound', 'inbound']) {
    const leg = o[side] || {};
    if ((leg.stops ?? 0) === 1) {
      const mins = Number(leg.connectionMinutes);
      if (!Number.isFinite(mins) || mins < config.connection.minMinutes || mins > config.connection.maxMinutes) reasons.push(`#${index + 1}: conexão ${side} fora de ${config.connection.minMinutes}-${config.connection.maxMinutes} min`);
    }
  }
}
if (reasons.length) throw new Error(`Payload incompatível com os filtros rígidos:\n- ${reasons.join('\n- ')}`);

const sorted = [...payload.options].sort((a,b) => (b.score ?? 0) - (a.score ?? 0));
const byPrice = [...payload.options].sort((a,b) => Number(a.totalBRL) - Number(b.totalBRL));
const premium = sorted.find(o => o.cabin === 'Premium Economy') || null;
const best = sorted.find(o => Number(o.totalBRL) <= config.budgetBRL) || sorted[0] || null;
const low = byPrice[0] || null;

const latest = {
  status: 'complete',
  searchedAt: payload.searchedAt,
  recommendation: payload.recommendation || { code: 'WATCH', title: 'Acompanhar', reason: 'Pesquisa concluída sem recomendação explícita.' },
  summary: { bestPurchase: best, lowestPrice: low, bestPremium: premium },
  alerts: payload.alerts || [],
  options: sorted.slice(0, 20),
  points: payload.points || []
};

history.runs.push({
  searchedAt: payload.searchedAt,
  bestTotalBRL: best?.totalBRL ?? null,
  lowestTotalBRL: low?.totalBRL ?? null,
  bestScore: best?.score ?? null,
  recommendationCode: latest.recommendation.code,
  recommendationLabel: latest.recommendation.title,
  topOptions: sorted.slice(0, 10)
});

await fs.writeFile(path.join(root, 'data/latest.json'), JSON.stringify(latest, null, 2) + '\n');
await fs.writeFile(path.join(root, 'data/history.json'), JSON.stringify(history, null, 2) + '\n');
console.log(`Pesquisa de ${payload.searchedAt} aplicada. ${payload.options.length} opções recebidas.`);
