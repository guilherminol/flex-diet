import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getDb } from "../../db/connect.js";
import {
  ErroDominio,
  editarRegistro,
  listarRegistros,
  removerRegistro,
  repetirRefeicao,
} from "../../domain/refeicoes.js";
import { resolverDataLocal } from "../../lib/datas.js";

const dataSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD")
  .optional();

const itensSchema = z
  .array(
    z.object({
      alimento_id: z.number().int().positive(),
      gramas: z.number().positive().max(5000),
    }),
  )
  .min(1);

/**
 * Erro de domínio → isError:true com corpo estruturado (padrão das tools);
 * erro que não é de domínio segue cru (bug de verdade).
 * (`as const` preserva os literais — o helper não tem o contexto do SDK.)
 */
const respostaErro = (erro: unknown) => {
  if (erro instanceof ErroDominio) {
    const corpo = {
      erro: erro.codigo,
      mensagem: erro.message,
      ...erro.extras,
    };
    const texto = JSON.stringify(corpo);
    return {
      isError: true as const,
      content: [{ type: "text" as const, text: texto }],
      structuredContent: corpo,
    };
  }
  throw erro;
};

/**
 * listar_registros — registros do dia com id_curto, itens e macros (D-06):
 * cobre o caso "usuário não citou o id" antes de editar/remover.
 */
export function registrarToolListarRegistros(server: McpServer): void {
  const inputSchema = z.object({ data: dataSchema });
  type Input = z.infer<typeof inputSchema>;
  server.registerTool(
    "listar_registros",
    {
      description:
        "Lista os registros de refeição de um dia (default: hoje em America/Sao_Paulo) com id_curto, tipo_refeicao, itens (nome, gramas, macros) e kcal_total — use para achar o id_curto do registro que o usuário quer corrigir",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args: Input) => {
      try {
        const dataLocal = resolverDataLocal(args.data);
        const listagem = listarRegistros(getDb(), dataLocal);
        const texto = JSON.stringify(listagem);
        return {
          content: [{ type: "text", text: texto }],
          structuredContent: listagem,
        };
      } catch (erro) {
        return respostaErro(erro);
      }
    },
  );
}

/**
 * editar_registro — correção por id curto com SUBSTITUIÇÃO COMPLETA dos
 * itens (T-01-12): o Hermes sempre envia a lista inteira corrigida.
 */
export function registrarToolEditarRegistro(server: McpServer): void {
  const inputSchema = z.object({
    id_curto: z.string().min(1),
    itens: itensSchema,
    data: dataSchema,
    tipo_refeicao: z.string().min(1).optional(),
  });
  type Input = z.infer<typeof inputSchema>;
  server.registerTool(
    "editar_registro",
    {
      description:
        "Edita um registro pelo id_curto com SUBSTITUIÇÃO COMPLETA dos itens — envie a lista INTEIRA corrigida (não só o item que mudou); data opcional move o registro para outro dia; retorna o eco novo e o saldo recalculado na mesma resposta",
      inputSchema,
      annotations: { readOnlyHint: false },
    },
    async (args: Input) => {
      try {
        const resultado = editarRegistro(getDb(), args.id_curto, {
          itens: args.itens,
          ...(args.data !== undefined ? { data: args.data } : {}),
          ...(args.tipo_refeicao !== undefined
            ? { tipoRefefeicao: args.tipo_refeicao }
            : {}),
        });
        const texto = JSON.stringify(resultado);
        return {
          content: [{ type: "text", text: texto }],
          structuredContent: resultado,
        };
      } catch (erro) {
        return respostaErro(erro);
      }
    },
  );
}

/** remover_registro — destrutivo por id curto (destructiveHint p/ o Hermes confirmar). */
export function registrarToolRemoverRegistro(server: McpServer): void {
  const inputSchema = z.object({ id_curto: z.string().min(1) });
  type Input = z.infer<typeof inputSchema>;
  server.registerTool(
    "remover_registro",
    {
      description:
        "Remove um registro pelo id_curto (operação destrutiva: o débito do dia desaparece); retorna a confirmação e o saldo recalculado do dia na mesma resposta",
      inputSchema,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async (args: Input) => {
      try {
        const resultado = removerRegistro(getDb(), args.id_curto);
        const texto = JSON.stringify(resultado);
        return {
          content: [{ type: "text", text: texto }],
          structuredContent: resultado,
        };
      } catch (erro) {
        return respostaErro(erro);
      }
    },
  );
}

/**
 * repetir_refeicao — relogar refeição de dia anterior (REG-04). Se o seletor
 * bater em mais de um registro, responde refeicao_ambigua com os candidatos —
 * o Hermes pergunta ao usuário em vez de escolher sozinho.
 */
export function registrarToolRepetirRefeicao(server: McpServer): void {
  const inputSchema = z.object({
    /** Dia da refeição original (YYYY-MM-DD). */
    data_origem: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD"),
    /** id_curto do registro de origem — seletor exato (vence tipo_refeicao). */
    id_curto_origem: z.string().min(1).optional(),
    /** Filtro alternativo pela tipo_refeicao; precisa bater em EXATAMENTE 1 registro. */
    tipo_refeicao: z.string().min(1).optional(),
    /** Dia do novo registro (default: hoje em America/Sao_Paulo). */
    data_destino: dataSchema,
  });
  type Input = z.infer<typeof inputSchema>;
  server.registerTool(
    "repetir_refeicao",
    {
      description:
        "Repete a refeição de um dia anterior: cria um NOVO registro (data_destino, default hoje) com os mesmos alimentos e gramas, mas macros recomputados do catálogo atual e id_curto novo; selecione a origem por id_curto_origem ou por tipo_refeicao; resposta traz o eco do novo registro + saldo do dia destino",
      inputSchema,
      annotations: { readOnlyHint: false },
    },
    async (args: Input) => {
      try {
        const resultado = repetirRefeicao(getDb(), {
          dataOrigem: args.data_origem,
          ...(args.id_curto_origem !== undefined
            ? { idCurtoOrigem: args.id_curto_origem }
            : {}),
          ...(args.tipo_refeicao !== undefined
            ? { tipoRefefeicao: args.tipo_refeicao }
            : {}),
          ...(args.data_destino !== undefined
            ? { dataDestino: args.data_destino }
            : {}),
        });
        const texto = JSON.stringify(resultado);
        return {
          content: [{ type: "text", text: texto }],
          structuredContent: resultado,
        };
      } catch (erro) {
        return respostaErro(erro);
      }
    },
  );
}
