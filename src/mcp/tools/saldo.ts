import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getDb } from "../../db/connect.js";
import { calcularSaldo } from "../../domain/saldo.js";
import { resolverDataLocal } from "../../lib/datas.js";

const inputSchema = z.object({
  /** Data do saldo (YYYY-MM-DD). Ausente = hoje em America/Sao_Paulo. */
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "data deve ser YYYY-MM-DD")
    .optional(),
});

type Input = z.infer<typeof inputSchema>;

/**
 * consultar_saldo — saldo restante do dia (kcal, proteína, carbo, gordura).
 * Sem metas definidas responde status meta_nao_definida + instrução (D-09) —
 * nunca números inventados.
 */
export function registrarToolConsultarSaldo(server: McpServer): void {
  server.registerTool(
    "consultar_saldo",
    {
      description:
        "Consulta o saldo restante do dia de calorias e macros (kcal, proteina_g, carbo_g, gordura_g)",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args: Input) => {
      const dataLocal = resolverDataLocal(args.data);
      const saldo = calcularSaldo(getDb(), dataLocal);
      const texto = JSON.stringify(saldo);
      return {
        content: [{ type: "text", text: texto }],
        structuredContent: saldo,
      };
    },
  );
}
