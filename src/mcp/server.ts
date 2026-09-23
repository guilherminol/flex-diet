import { McpServer, type McpServerFactory } from "@modelcontextprotocol/server";
import { registrarToolDefinirMetas } from "./tools/metas.js";
import { registrarToolRegistrarRefeicao } from "./tools/registrar.js";
import { registrarToolConsultarSaldo } from "./tools/saldo.js";

/**
 * Factory do McpServer — chamada POR request (stateless; Pattern 1).
 * Estado nenhum vive aqui: tudo no SQLite. Plans 02/03 registram as tools
 * seguintes no mesmo ponto (buscar_alimento, listar_registros, ...).
 */
export const buildServer: McpServerFactory = () => {
  const server = new McpServer({ name: "flex-diet", version: "0.1.0" });
  registrarToolRegistrarRefeicao(server);
  registrarToolConsultarSaldo(server);
  registrarToolDefinirMetas(server);
  return server;
};
