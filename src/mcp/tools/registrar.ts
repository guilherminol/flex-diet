import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  ErroDominio,
  registrarRefeicaoDaTool,
} from "../../domain/refeicoes.js";

const inputSchema = z.object({
  /** Data do registro (YYYY-MM-DD). Ausente = hoje em America/Sao_Paulo. Retroativo cai no dia informado (REG-05). */
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD")
    .optional(),
  /** Itens da refeição — quantidade obrigatória em gramas por item (D-03/D-04). */
  itens: z
    .array(
      z.object({
        alimento_id: z.number().int().positive(),
        gramas: z.number().positive().max(5000),
      }),
    )
    .min(1),
  tipo_refeicao: z.string().min(1).optional(),
});

type Input = z.infer<typeof inputSchema>;

/**
 * registrar_refeicao — atômica: recebe o array completo de itens em gramas,
 * debita macros do catálogo TACO e devolve NA MESMA resposta o eco
 * (nome + gramas + fonte + macros), o id_curto e o saldo do dia (D-03..D-05).
 */
export function registrarToolRegistrarRefeicao(server: McpServer): void {
  server.registerTool(
    "registrar_refeicao",
    {
      description:
        "Registra uma refeição a partir de itens com alimento_id e gramas; retorna o eco dos itens, o id_curto do registro e o saldo restante do dia",
      inputSchema,
      annotations: { readOnlyHint: false },
    },
    async (args: Input) => {
      try {
        const resultado = registrarRefeicaoDaTool(args);
        const texto = JSON.stringify(resultado);
        return {
          content: [{ type: "text", text: texto }],
          structuredContent: resultado,
        };
      } catch (erro) {
        if (erro instanceof ErroDominio) {
          const corpo = {
            erro: erro.codigo,
            mensagem: erro.message,
            ...erro.extras,
          };
          const texto = JSON.stringify(corpo);
          return {
            isError: true,
            content: [{ type: "text", text: texto }],
            structuredContent: corpo,
          };
        }
        throw erro;
      }
    },
  );
}
