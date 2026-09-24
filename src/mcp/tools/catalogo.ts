import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { getDb } from "../../db/connect.js";
import { buscarAlimentos } from "../../domain/alimentos.js";

/** Termo de 2 a 100 caracteres (T-01-08: teto de tamanho no input). */
export const inputSchema = z.object({
  termo: z.string().min(2).max(100),
});

type Input = z.infer<typeof inputSchema>;

/**
 * buscar_alimento — resolve nomes → alimento_ids (o Hermes usa para montar os
 * itens de registrar_refeicao) e expõe as equivalências de medidas caseiras em
 * gramas para declarar premissas quando a mensagem não traz quantidade (D-04).
 * Resposta estruturada no padrão D-05; zero resultados é resposta NORMAL com
 * lista vazia — não é erro.
 */
export function registrarToolBuscarAlimento(server: McpServer): void {
  server.registerTool(
    "buscar_alimento",
    {
      description:
        "Busca alimentos do catálogo TACO pelo nome; retorna até 5 candidatos com id, nome, fonte, kcal/proteina_g/carbo_g/gordura_g POR 100g e medidas caseiras em gramas (lista vazia quando não há equivalência inequívoca)",
      inputSchema,
      annotations: { readOnlyHint: true },
    },
    async (args: Input) => {
      const candidatos = buscarAlimentos(getDb(), args.termo);
      const resultado = {
        termo: args.termo,
        total: candidatos.length,
        candidatos,
      };
      const texto = JSON.stringify(resultado);
      return {
        content: [{ type: "text", text: texto }],
        structuredContent: resultado,
      };
    },
  );
}
