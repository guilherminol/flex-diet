import { McpServer, type McpServerFactory } from "@modelcontextprotocol/server";
import { registrarToolBuscarAlimento } from "./tools/catalogo.js";
import { registrarToolDefinirMetas } from "./tools/metas.js";
import { registrarToolRegistrarRefeicao } from "./tools/registrar.js";
import {
  registrarToolEditarRegistro,
  registrarToolListarRegistros,
  registrarToolRemoverRegistro,
  registrarToolRepetirRefeicao,
} from "./tools/registros.js";
import { registrarToolConsultarSaldo } from "./tools/saldo.js";

/**
 * Factory do McpServer — chamada POR request (stateless; Pattern 1).
 * Estado nenhum vive aqui: tudo no SQLite. As 8 tools da fase (Pattern 5):
 * registrar_refeicao, consultar_saldo, definir_metas, buscar_alimento,
 * listar_registros, editar_registro, remover_registro e repetir_refeicao.
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
  registrarToolRepetirRefeicao(server);
  return server;
};
