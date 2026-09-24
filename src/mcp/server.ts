import { McpServer, type McpServerFactory } from "@modelcontextprotocol/server";
import { registrarToolBuscarAlimento } from "./tools/catalogo.js";
import { registrarToolDefinirMetas } from "./tools/metas.js";
import { registrarToolRegistrarRefeicao } from "./tools/registrar.js";
import {
  registrarToolEditarRegistro,
  registrarToolListarRegistros,
  registrarToolRemoverRegistro,
} from "./tools/registros.js";
import { registrarToolConsultarSaldo } from "./tools/saldo.js";

/**
 * Factory do McpServer — chamada POR request (stateless; Pattern 1).
 * Estado nenhum vive aqui: tudo no SQLite. Plan 03 registra aqui as tools de
 * correção (listar/editar/remover); repetir_refeicao entra no mesmo ponto.
 */
export const buildServer: McpServerFactory = () => {
  const server = new McpServer({ name: "flex-diet", version: "0.1.0" });
  registrarToolRegistrarRefeicao(server);
  registrarToolConsultarSaldo(server);
  registrarToolDefinirMetas(server);
  registrarToolBuscarAlimento(server);
  registrarToolListarRegistros(server);
  registrarToolEditarRegistro(server);
  registrarToolRemoverRegistro(server);
  return server;
};
