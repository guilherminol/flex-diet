-- 002 — coluna de busca acento-insensível para o catálogo (01-02, T-01-07).
-- O seed (que roda em todo boot após as migrations) preenche a coluna com
-- normalizarParaBusca(nome): minúsculas, sem acentos, vírgulas → espaço
-- ("Óleo, de soja" → "oleo de soja") — busca de "oleo"/"açaí" funciona.
ALTER TABLE alimento ADD COLUMN nome_busca TEXT;
