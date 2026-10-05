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
const outOrigins = new Set(config.outbound.origins);
const outDestinations = new Set(config.outbound.destinations);
const inOrigins = new Set(config.inbound.origins);
const inDestinations = new Set(config.inbound.destinations);
const reasons = [];

function validateOpenJaw(item, label) {
  if (!outOrigins.has(item.outbound?.origin)) reasons.push(`${label}: origem da ida inválida`);
  if (!outDestinations.has(item.outbound?.destination)) reasons.push(`${label}: destino da ida precisa ser Londres`);
  if (!inOrigins.has(item.inbound?.origin)) reasons.push(`${label}: origem da volta precisa ser Paris (CDG/ORY)`);
  if (!inDestinations.has(item.inbound?.destination)) reasons.push(`${label}: destino da volta inválido`);
}

function validateConnections(item, label) {
  if ((item.outbound?.stops ?? 0) > config.connection.maxStopsPerDirection || (item.inbound?.stops ?? 0) > config.connection.maxStopsPerDirection) {
    reasons.push(`${label}: excesso de conexões`);
  }
  for (const side of ['outbound', 'inbound']) {
    const leg = item[side] || {};
    if ((leg.stops ?? 0) === 1) {
      const mins = Number(leg.connectionMinutes);
      if (!Number.isFinite(mins) || mins < config.connection.minMinutes || mins > config.connection.maxMinutes) {
        reasons.push(`${label}: conexão ${side} fora de ${config.connection.minMinutes}-${config.connection.maxMinutes} min`);
      }
    }
  }
}

for (const [index, o] of payload.options.entries()) {
  const label = `#${index + 1}`;
  validateOpenJaw(o, label);
  validateConnections(o, label);
  const carriers = [o.marketingCarrier, ...(o.operatingCarriers || [])].filter(Boolean).map(x => x.toLowerCase());
  if (carriers.some(c => excluded.some(x => c.includes(x)))) reasons.push(`${label}: companhia excluída`);
  if (!allowedSources.has(o.source)) reasons.push(`${label}: fonte não autorizada`);
  if (!allowedCabins.has(o.cabin)) reasons.push(`${label}: cabine inválida`);
  if (o.selfTransfer === true) reasons.push(`${label}: self-transfer`);
  if (o.airportChange === true) reasons.push(`${label}: troca de aeroporto`);
  if (o.bag23kgPerAdultIncluded !== true) reasons.push(`${label}: bagagem de 23 kg não confirmada`);
  if (o.verified !== true) reasons.push(`${label}: preço não verificado`);
}

const marketReferences = Array.isArray(payload.marketReferences) ? payload.marketReferences : [];
for (const [index, ref] of marketReferences.entries()) {
  const label = `referência #${index + 1}`;
  validateOpenJaw(ref, label);
  validateConnections(ref, label);
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
  points: payload.points || [],
  marketReferences: marketReferences.slice(0, 10)
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
console.log(`Pesquisa de ${payload.searchedAt} aplicada. ${payload.options.length} opções e ${marketReferences.length} referências open-jaw recebidas.`);
