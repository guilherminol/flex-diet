/**
 * Dobra texto: minúsculas + remove acentos (NFD + strip de combining marks).
 * "Óleo" → "oleo" · "Açaí" → "acai" — igualdade exata pós-fold, não é fuzzy.
 */
export function dobrarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Normaliza um nome de alimento/termo de busca para comparação: dobra acentos,
 * troca vírgulas por espaço e colapsa espaços ("Óleo, de soja" → "oleo de
 * soja"). ÚNICA implementação — o seed grava `alimento.nome_busca` com ela e a
 * busca (`buscarAlimentos`) normaliza o termo do usuário com a mesma função.
 */
export function normalizarParaBusca(texto: string): string {
  return dobrarTexto(texto.replace(/,/g, " ").replace(/\s+/g, " ").trim());
}
