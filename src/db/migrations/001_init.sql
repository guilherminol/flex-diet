-- 001_init — schema inicial do Flex Diet (Phase 1: walking skeleton)
-- Macros do catálogo por 100g; débito gravado como snapshot no item.

CREATE TABLE alimento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fonte TEXT NOT NULL DEFAULT 'taco',
  numero_taco TEXT,
  nome TEXT NOT NULL,
  kcal_100g REAL,
  proteina_g_100g REAL,
  carbo_g_100g REAL,
  gordura_g_100g REAL,
  criado_em TEXT NOT NULL,
  UNIQUE (fonte, numero_taco)
);

CREATE TABLE medida_caseira (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alimento_id INTEGER NOT NULL REFERENCES alimento (id),
  descricao TEXT NOT NULL,
  gramas REAL NOT NULL CHECK (gramas > 0),
  UNIQUE (alimento_id, descricao)
);

CREATE TABLE refeicao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_curto TEXT NOT NULL UNIQUE,
  data_local TEXT NOT NULL,
  timestamp_utc TEXT NOT NULL,
  tipo_refeicao TEXT,
  dedupe_hash TEXT
);

CREATE TABLE refeicao_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  refeicao_id INTEGER NOT NULL REFERENCES refeicao (id) ON DELETE CASCADE,
  alimento_id INTEGER REFERENCES alimento (id),
  gramas REAL NOT NULL CHECK (gramas > 0),
  -- snapshot do débito no momento do registro (não recalculado depois)
  kcal REAL,
  proteina_g REAL,
  carbo_g REAL,
  gordura_g REAL
);

CREATE TABLE meta_diaria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_inicio TEXT NOT NULL,
  kcal REAL NOT NULL,
  proteina_g REAL NOT NULL,
  carbo_g REAL NOT NULL,
  gordura_g REAL NOT NULL,
  timestamp_utc TEXT NOT NULL
);

CREATE INDEX idx_refeicao_data_local ON refeicao (data_local);
CREATE INDEX idx_refeicao_dedupe_hash ON refeicao (dedupe_hash);
