# Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Servidor MCP em TypeScript/Node (Streamable HTTP na VPS, protegido por token) + SQLite em WAL com catálogo semeado da TACO, entregando o circuito central "registrei o que comi → recebi o saldo restante de macros" com: correção trivial (editar/remover por id curto), repetir refeição de dia anterior, registro retroativo, idempotência de reenvio, metas diárias ajustáveis por mensagem — publicado por deploy contínuo (Docker Compose na VPS via workflow já existente).

Fora desta fase: Open Food Facts, cache automático e estimativa LLM salvável (Phase 2); fases de cutting/bulk, treinos e presets (Phase 3); peso/medidas/fotos (Phase 4); suplementação, relatório semanal e dashboard (Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Stack
- **D-01:** Núcleo escrito em **TypeScript/Node** — SDK oficial MCP maduro, um único ecossistema pra servidor + dashboard futuro (Phase 5), Docker pequeno — **Reversibility:** one-way — mudar de linguagem depois do Phase 1 significa reescrever o núcleo inteiro e revalidar todas as fases seguintes que herdam o stack
- **D-02:** **Backup diário simples** do arquivo .db (retenção curta, ~7 dias) no volume da VPS, além do backup automático pré-migration já exigido pelo INFRA-02

### Contrato das tools MCP
- **D-03:** `registrar_refeicao` é **atômica**: uma única chamada recebe o array completo de itens da refeição, e **cada item vem com quantidade obrigatória em gramas** (reforço explícito do usuário) — **Reversibility:** costly — o contrato das tools é publicado e consumido pelo Hermes; mudar o shape depois quebra o cliente
- **D-04:** **Hermes resolve medidas caseiras em gramas** usando as equivalências TACO que a tool de busca retorna (ALIM-06); quando a mensagem não traz quantidade, o Hermes estima e declara a premissa (ex.: "~150g de arroz"). O servidor recebe **gramas sempre** — mínimo e determinístico, sem conhecer unidades — **Reversibility:** costly — faz parte do contrato semântico das tools
- **D-05:** Tools devolvem **JSON estruturado** (itens + gramas + fonte + saldo); o Hermes escreve a mensagem do WhatsApp em cima disso. Nada de texto pronto pra repassar — o servidor não prende apresentação — **Reversibility:** costly — contrato publicado com o cliente Hermes
- **D-06:** **Correção por id curto** exibido no eco de cada registro (ex.: "#a3f2"); tools de editar/remover recebem esse id; uma tool de listar registros do dia cobre o caso "usuário não citou o id" — **Reversibility:** costly — altera o contrato do eco consumido pelo Hermes
- Nomes das tools em português e semânticos (`registrar_refeicao`, `consultar_saldo`, ...), já decidido no PROJECT.md — servidor 100% determinístico, zero parsing de linguagem natural

### Idempotência (REG-06)
- **D-07:** Dedupe por **hash do payload (itens + gramas + data local) com janela de 10 minutos** — escolha do usuário por NÃO depender de id de mensagem do Hermes (não assumir que o Hermes manda id estável por retry). Payload idêntico dentro da janela não duplica
- **D-08:** Retry detectado responde com o **registro original + saldo atual + flag de duplicado** — idempotência transparente: o Hermes pode avisar "já tinha registrado isso" e o saldo vem junto na mesma resposta

### Metas do dia
- **D-09:** Sistema **nasce sem metas**: registro funciona desde a 1ª mensagem, mas o saldo responde "meta não definida" com instrução de como definir — nenhum default escondido que vire verdade errada
- **D-10:** `definir_metas` **exige os 4 valores explícitos** (kcal, proteína, carbo, gordura) — sem atualização parcial — **Reversibility:** costly — semântica do contrato da tool. Nota de interpretação: "meta 1800kcal" sozinho não é chamada válida; o Hermes coleta os 4 valores (perguntando de volta se faltar) antes de chamar a tool. O critério de sucesso 4 do ROADMAP ("ajustar as metas do dia muda o saldo imediatamente") continua valendo — o que muda é que o ajuste acontece sempre com os 4 valores completos

### Claude's Discretion
- Framework HTTP, acesso a dados/migrações, estrutura de pastas, versão do Node, formato exato do hash de dedupe, mecanismo do backup diário (cron no compose vs job interno), porta do serviço
- Conjunto exato e nomes das demais tools da fase (consultar_saldo, buscar_alimento, listar_registros, repetir_refeicao, etc.) — desde que respeitem D-03..D-06 e nomes em português

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planejamento do projeto
- `.planning/ROADMAP.md` §Phase 1 — goal + 5 success criteria desta fase
- `.planning/REQUIREMENTS.md` — requisitos da Phase 1: REG-01..06, ALIM-01, ALIM-06, META-01, INFRA-01..05 (seção Traceability mapeia todos)
- `.planning/PROJECT.md` — Key Decisions + Context (contratos de confiança; Hermes como cliente MCP; servidor determinístico)
- `.planning/STATE.md` — Blockers/Concerns: validação do dataset TACO (`brolesi/taco`) e era do SDK MCP (v2 vs v1) no primeiro contato

### Infra / Deploy
- `.github/workflows/deploy.yml` — contrato de deploy já commitado: espera `docker-compose.yml` (ou `compose.yaml`) em `VPS_PATH`; roda `git pull --ff-only` + `docker compose up -d --build`; secrets `VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY`; pula silenciosamente se secrets não configurados

### Fontes externas (a validar no research)
- Dataset TACO — validar o repositório `brolesi/taco`: colunas kcal vs kJ, encoding, medidas caseiras em gramas (ALIM-01 exige teste de sanidade: banana ≈ 89 kcal/100g; ~372 indica kJ)
- Spec MCP / SDK TypeScript oficial — confirmar a era do SDK que o Hermes negocia (v2 vs v1) no primeiro contato, com fallback documentado pra v1 (INFRA-01)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/deploy.yml`: deploy contínuo já funcionando no repositório — a Phase 1 só precisa entregar o `docker-compose.yml` + Dockerfile que o workflow espera

### Established Patterns
- Repositório greenfield (sem código-fonte) — os padrões de projeto nascem nesta fase e viram referência pras fases 2–5

### Integration Points
- Hermes (cliente MCP, mantido fora do repositório) consome o servidor por URL com token — o contrato das tools é a fronteira do sistema
- VPS pessoal do usuário (já roda outros projetos em Docker) — volume persistente pro SQLite + diretório de backups
- Dados 100% na VPS (INFRA-04) — nada de nuvem de terceiros

</code_context>

<specifics>
## Specific Ideas

- Usuário foi enfático: a chamada de registro **tem que ter quantidade** por item — mensagem sem quantidade é resolvida pelo Hermes (estimativa declarada como premissa), nunca pelo servidor
- Saldo sem meta definida = instrução pra definir as metas, nunca números inventados

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Núcleo confiável — banco, catálogo TACO e loop de registro com saldo*
*Context gathered: 2026-09-23*
