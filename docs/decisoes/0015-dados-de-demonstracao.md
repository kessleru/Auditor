# 0015 — Dados de demonstração empacotados no repositório

- **Data:** 2026-09-28
- **Fases:** 12 (entrega) e seção 8.1 do plano
- **Situação:** aceita (a infraestrutura; os dados ainda não foram gerados, ver "Pendências")

## Contexto

A seção 8.1 do plano pede que a apresentação rode local, "a partir de um banco já populado com as
coletas da pesquisa", sem depender de internet no dia. Até aqui, quem clonava o repositório via
um sistema vazio: sem coleta, a visão pública, o comparativo e a validação não tinham o que
mostrar, e montar uma coleta exige rede, tempo e um auditor.

## Decisões

1. **Coletas reais, não inventadas.** A demonstração é feita com as ferramentas do próprio
   sistema (descoberta, confirmação de rotas ou "não encontrada" com motivo, coleta e validação
   com justificativa), num banco à parte. Nada é digitado à mão no pacote.
2. **Pacote em `apps/api/demo/`.** `npm run demo:export -- --collections=<ids>` grava
   `dados.json.gz` (instituições por sigla, rotas, funções não encontradas, coletas, páginas,
   achados e subamostra) e, em `arquivos/`, o snapshot e o resultado do axe de cada página e só a
   foto do exemplo exibido de cada problema (o primeiro achado de cada `fingerprint`), para o
   repositório não inchar.
3. **Importação no seed.** O `db:seed` (que o launcher e o contêiner rodam a cada subida) importa
   o pacote se ele ainda não estiver no banco: idempotente, IDs remapeados, instituições casadas
   pela sigla (ou pelo domínio), `fingerprint` recalculado (depende do id da instituição) e datas
   originais. `DEMO_DATA=false` no `.env` deixa o banco só com as coletas do auditor.
4. **Conta "Demonstração".** As coletas e as validações importadas são assinadas por
   `demonstracao@auditoria-rf.invalid`, criada com o hash de uma senha aleatória já descartada:
   ninguém entra com ela, e ela nunca vira o contato do user-agent (fica fora da lista de
   auditores).
5. **Decisões do auditor nunca mudam.** Rota que já existe no banco fica como está; a rota
   confirmada ou a função não encontrada da demonstração só entra se a função ainda não tiver
   decisão naquela instituição.
6. **Coletas como as outras.** As importadas entram no histórico, no comparativo e no CSV. Na
   visão pública vale a coleta terminada mais recente de cada instituição (ADR 0006): a primeira
   coleta do auditor passa à frente da demonstração.

## Consequências

- O sistema abre com dados na primeira subida, também sem internet.
- O pacote segue o formato do banco na data da exportação (`version: 1`); colunas novas de
  `collection_pages` e `findings` viajam no mesmo objeto. Uma mudança incompatível pede
  `version: 2` e uma nova exportação.
- As coletas de demonstração são dados de pesquisa de verdade: a data e as versões do axe e do
  navegador aparecem como em qualquer coleta.

## Pendências

Na rodada de 28/09/2026, IFTM e IFMG bloquearam a ferramenta com o Radware Bot Manager (ADR 0016)
e ficam como ausência de dado. Falta escolher três portais que respondam, coletar, validar e
exportar; a escolha dos portais é do autor.
