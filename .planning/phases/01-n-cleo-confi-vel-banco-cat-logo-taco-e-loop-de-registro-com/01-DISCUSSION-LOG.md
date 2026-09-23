# Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-23
**Phase:** 1-Núcleo confiável — banco, catálogo TACO e loop de registro com saldo
**Areas discussed:** Stack do servidor, Contrato das tools MCP, Idempotência (REG-06), Metas do dia

---

## Stack do servidor

| Option | Description | Selected |
|--------|-------------|----------|
| TypeScript/Node | SDK oficial MCP maduro, um único ecossistema pra servidor + dashboard (Fase 5), imagem Docker pequena | ✓ |
| Python | FastMCP/SDK oficial Python — ecossistema forte em dados | |
| O que eu já uso na VPS | Alinhar com o que os outros projetos da VPS já usam | |

**User's choice:** TypeScript/Node
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Backup diário simples | Cópia diária do .db com retenção curta (~7 dias) no volume da VPS | ✓ |
| Só pré-migration | Apenas o backup automático antes de cada migration (INFRA-02) | |
| Você decide | Decidir com base no research de boas práticas SQLite | |

**User's choice:** Backup diário simples
**Notes:** —

## Contrato das tools MCP

| Option | Description | Selected |
|--------|-------------|----------|
| 1 tool, vários itens | Hermes resolve todos os alimentos e faz UMA chamada atômica com o array de itens | ✓ |
| Chamada por item | Uma chamada por alimento — saldo intermediário, risco de refeição meio registrada | |

**User's choice:** 1 tool, vários itens
**Notes:** Usuário complementou: "mas tem que ter quantidade" — cada item precisa vir com quantidade obrigatória na chamada

| Option | Description | Selected |
|--------|-------------|----------|
| Hermes resolve em gramas | Busca devolve equivalências TACO; Hermes converte/estima e declara a premissa; servidor recebe gramas sempre | ✓ |
| Servidor converte medida | Item chega como {medida, qtd} e o servidor multiplica pela equivalência TACO | |

**User's choice:** Hermes resolve em gramas
**Notes:** Mensagem sem quantidade → Hermes estima e declara a premissa; servidor mínimo e determinístico

| Option | Description | Selected |
|--------|-------------|----------|
| JSON estruturado | Tool devolve JSON (itens + gramas + fonte + saldo); Hermes formata a mensagem do WhatsApp | ✓ |
| Texto pronto pra repassar | Servidor devolve a string formatada; Hermes repassa quase intacta | |

**User's choice:** JSON estruturado
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| ID curto no eco | Eco traz id curto por registro; editar/remover recebem o id; tool de listar do dia cobre o caso sem id | ✓ |
| Busca descritiva | Tool recebe busca (data + termo); candidato único aplica direto; múltiplos devolve pra confirmar | |
| Híbrido | id OU busca descritiva com confirmação | |

**User's choice:** ID curto no eco
**Notes:** —

## Idempotência (REG-06)

| Option | Description | Selected |
|--------|-------------|----------|
| ID da mensagem do Hermes | Dedupe por id_mensagem estável tratado como único | |
| Conteúdo + janela de tempo | Hash do payload (itens + data) idêntico dentro de janela → retorna o registro original | ✓ |
| Híbrido | id quando houver; fallback conteúdo + janela | |

**User's choice:** Conteúdo + janela de tempo
**Notes:** Não depender de id de mensagem do Hermes (não assumir que o Hermes manda id estável por retry)

| Option | Description | Selected |
|--------|-------------|----------|
| 10 minutos | Cobre retries do canal sem bloquear refeições legítimas repetidas | ✓ |
| 30 minutos | Mais proteção, mais risco de engolir registro legítimo | |
| 5 minutos | Quase só retries imediatos | |

**User's choice:** 10 minutos
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Retorna original + saldo | Resposta idempotente: registro original + saldo + flag de duplicado | ✓ |
| Erro de duplicado | Erro "registro duplicado" pro Hermes repassar, sem saldo | |

**User's choice:** Retorna original + saldo
**Notes:** —

## Metas do dia

| Option | Description | Selected |
|--------|-------------|----------|
| Sem meta até você definir | Registro funciona; saldo responde "meta não definida" com instrução — nenhum default escondido | ✓ |
| Seed com default | Banco nasce com valores default (ex.: 1800/150p/180c/60g) já vigentes | |
| Onboarding guiado | Hermes conduz a definição na 1ª interação antes do loop começar | |

**User's choice:** Sem meta até você definir
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Só o que foi citado | "meta 1800kcal" muda só calorias; macros ficam como estão | |
| kcal + macros proporcionais | Macros recalculadas pela distribuição atual | |
| Sempre 4 valores | Definir meta exige kcal + proteína + carbo + gordura explícitos — zero ambiguidade | ✓ |

**User's choice:** Sempre 4 valores
**Notes:** "meta 1800kcal" sozinho não é chamada válida — o Hermes coleta os 4 valores (perguntando de volta se faltar) antes de chamar definir_metas

## Claude's Discretion

- Framework HTTP, acesso a dados/migrações, estrutura de pastas, versão do Node
- Formato exato do hash de dedupe e mecanismo do backup diário (cron no compose vs job interno)
- Porta do serviço e conjunto/nomes exatos das demais tools da fase (respeitando o contrato D-03..D-06 e nomes em português)

## Deferred Ideas

- Nenhuma — a discussão permaneceu dentro do escopo da fase
