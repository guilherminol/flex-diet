import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getDb } from "../../db/connect.js";
import { definirMetas } from "../../domain/metas.js";
import { ErroDominio } from "../../domain/refeicoes.js";
import { calcularSaldo } from "../../domain/saldo.js";
import { hojeLocalSp } from "../../lib/datas.js";

/**
 * OS 4 CAMPOS são required (D-10 — sem atualização parcial): "meta 1800kcal"
 * sozinho NÃO é chamada válida — o Hermes coleta os 4 valores antes de chamar.
 */
export const definirMetasInputSchema = z.object({
  kcal: z.number().positive(),
  proteina_g: z.number().positive(),
  carbo_g: z.number().positive(),
  gordura_g: z.number().positive(),
});

type Input = z.infer<typeof definirMetasInputSchema>;

/**
 * definir_metas — grava as metas com vigência por data_inicio e devolve o
 * saldo do dia JÁ recalculado na mesma resposta (D-05, META-01).
 */
export function registrarToolDefinirMetas(server: McpServer): void {
  server.registerTool(
    "definir_metas",
    {
      description:
        "Define as metas diárias do usuário; exige os 4 valores (kcal, proteina_g, carbo_g, gordura_g) e retorna o saldo do dia recalculado",
      inputSchema: definirMetasInputSchema,
      annotations: { readOnlyHint: false },
    },
    async (args: Input) => {
      try {
        const metas = definirMetas(getDb(), args);
        const saldo = calcularSaldo(getDb(), hojeLocalSp());
        const resultado = { metas, saldo };
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
