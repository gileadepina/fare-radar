# Fare Radar

Dashboard estático e orientado a dados para monitorar a viagem de 2 adultos:

- ida: GRU/VCP → Londres;
- volta: CDG/ORY → GRU/VCP;
- janela: saída a partir de 08/01/2027 e retorno até 14/02/2027;
- duração: 8 a 12 dias;
- Economy e Premium Economy;
- 1 mala de 23 kg por pessoa;
- orçamento-alvo total: R$ 12.000;
- no máximo 1 conexão, entre 1h30 e 3h;
- sem self-transfer ou troca de aeroporto;
- exclui Ryanair, Wizz Air, TAP, Iberia e Air Europa.

## Estrutura

- `index.html`, `styles.css`, `app.js`: interface fixa.
- `data/config.json`: critérios da viagem.
- `data/latest.json`: pesquisa mais recente.
- `data/history.json`: histórico acumulado.
- `data/run.schema.json`: contrato do resultado diário.
- `AGENT_PROMPT.md`: instrução pronta para o agente.
- `scripts/apply-run.mjs`: valida e incorpora uma nova pesquisa.

## Atualização diária

O agente deve gerar um payload JSON com `searchedAt`, `options`, `recommendation`, `alerts` e `points`. Depois:

```bash
node scripts/apply-run.mjs /caminho/resultado.json
```

Somente os JSONs de dados mudam. O dashboard não precisa ser recriado.

## Pré-visualização local

```bash
npm run check
npm run preview
```

Abra `http://localhost:4173`.

## Vercel

O projeto foi preparado para deploy estático na Vercel. Se conectado a um repositório Git, cada atualização dos JSONs pode disparar um deploy automático.
