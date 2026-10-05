# Fare Radar — instrução do agente diário

Realize uma pesquisa diária de passagens para 2 adultos com os critérios de `data/config.json`.

Use o Skyscanner como fonte principal de descoberta e comparação de combinações de datas, companhias e aeroportos. O Skyscanner NÃO é uma fonte final autorizada para registrar preço no dashboard: antes de promover uma opção para `data/latest.json`, confirme a mesma oferta ou uma oferta equivalente diretamente na companhia aérea oficial, Decolar ou Booking.

Regras críticas:

- ida GRU/VCP → Londres; priorize LHR, LGW e LCY;
- volta CDG/ORY → GRU/VCP;
- saída a partir de 08/01/2027 e retorno até 14/02/2027;
- duração entre 8 e 12 dias;
- Economy e Premium Economy;
- 1 mala despachada de 23 kg por adulto já incluída no preço comparado;
- máximo de 1 conexão por sentido, com conexão entre 90 e 180 minutos;
- nunca aceitar troca de aeroporto, self-transfer ou bilhetes separados de risco do passageiro;
- excluir Ryanair, Wizz Air, TAP Air Portugal, Iberia e Air Europa, inclusive como operadoras de qualquer trecho;
- considerar somente ofertas finais verificadas em companhia aérea oficial, Decolar ou Booking;
- orçamento-alvo para o casal: R$ 12.000;
- marcação de assento deve ser informada separadamente quando tiver custo;
- considerar oportunidades verificáveis envolvendo pontos Itaú/Personnalité Black, sem presumir saldo;
- nunca comprar ou preencher dados de pagamento.

Fluxo recomendado:

1. Use o Skyscanner para identificar as combinações mais promissoras dentro da janela inteira.
2. Priorize as combinações de 8 a 12 dias com menor preço aparente.
3. Revalide cada candidata em companhia oficial, Decolar ou Booking.
4. Confirme preço final para 2 adultos, bagagem de 23 kg por adulto, companhias operadoras, aeroportos e conexão.
5. Rejeite qualquer opção que não tenha todos esses dados verificáveis.
6. Só então calcule o score e registre a opção no Fare Radar.

Para cada combinação elegível, compare o preço final para o casal e calcule score 0–100 com prioridade para preço, depois conexões, aeroportos, confiabilidade da fonte, composição da tarifa e cabine.

Compare a pesquisa atual com `data/history.json`. Classifique a recomendação como `BUY_NOW`, `WATCH` ou `WEAK`. Gere alerta quando houver novo menor preço histórico, queda de 5% ou mais, total abaixo de R$ 12.000, Premium Economy excepcional ou oportunidade relevante com pontos.

Produza somente dados verificáveis. Nunca invente disponibilidade, preço, voo ou promoção.

Ao finalizar, gere um JSON compatível com `data/run.schema.json` e aplique com:

`node scripts/apply-run.mjs <arquivo-da-pesquisa.json>`

Depois publique somente as alterações em `data/latest.json` e `data/history.json`. O HTML/CSS/JS não deve ser recriado a cada execução.
