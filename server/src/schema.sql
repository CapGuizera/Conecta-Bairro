-- Schema do ConectaBairro (PostgreSQL + PostGIS). Idempotente: roda a cada inicialização.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  phone         text NOT NULL UNIQUE,
  name          text NOT NULL,
  role          text NOT NULL DEFAULT 'usuario'
                CHECK (role IN ('usuario', 'agente', 'moderador', 'instituicao')),
  is_provider   boolean NOT NULL DEFAULT false,
  bio           text NOT NULL DEFAULT '',
  assisted_by   integer REFERENCES users(id),      -- RF03: quem fez o cadastro assistido
  blocked       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- RF01: códigos de verificação do telefone (guardados como hash)
CREATE TABLE IF NOT EXISTS otp_codes (
  id          serial PRIMARY KEY,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  used        boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_phone_idx ON otp_codes (phone, created_at DESC);

-- RF04: a posição exata do prestador fica só aqui e nunca é enviada ao cliente.
-- "anchor" é a posição exata deslocada aleatoriamente (100 a 300 m); as distâncias
-- exibidas são calculadas a partir dela, o que impede triangular o endereço.
CREATE TABLE IF NOT EXISTS provider_locations (
  user_id            integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  exact              geography(Point, 4326) NOT NULL,
  anchor             geography(Point, 4326) NOT NULL,
  service_radius_km  numeric(5, 1) NOT NULL DEFAULT 3,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS provider_anchor_gix ON provider_locations USING gist (anchor);

-- RF02
CREATE TABLE IF NOT EXISTS offers (
  id               serial PRIMARY KEY,
  provider_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             text NOT NULL DEFAULT 'servico' CHECK (kind IN ('servico', 'produto')),
  title            text NOT NULL,
  description      text NOT NULL DEFAULT '',
  category         text NOT NULL,
  price_min_cents  integer,
  price_max_cents  integer,
  price_unit       text NOT NULL DEFAULT 'a combinar',
  images           jsonb NOT NULL DEFAULT '[]',
  status           text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'removida')),
  search_text      text NOT NULL DEFAULT '',
  confirmed_at     timestamptz NOT NULL DEFAULT now(),   -- RF16
  confirm_notified_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS offers_provider_idx ON offers (provider_id);
CREATE INDEX IF NOT EXISTS offers_category_idx ON offers (category);

-- RF14: visualizações (uma por visitante por dia)
CREATE TABLE IF NOT EXISTS offer_views (
  offer_id    integer NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  viewer_key  text NOT NULL,
  day         date NOT NULL DEFAULT current_date,
  PRIMARY KEY (offer_id, viewer_key, day)
);

-- RF07
CREATE TABLE IF NOT EXISTS conversations (
  id               serial PRIMARY KEY,
  offer_id         integer NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  client_id        integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id      integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_message_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (offer_id, client_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id               serial PRIMARY KEY,
  conversation_id  integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        integer REFERENCES users(id),
  kind             text NOT NULL DEFAULT 'texto' CHECK (kind IN ('texto', 'proposta', 'sistema')),
  body             text NOT NULL,
  masked           boolean NOT NULL DEFAULT false,
  proposal_id      integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages (conversation_id, id);

CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id  integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);

-- RF09: contratação e seus estados
CREATE TABLE IF NOT EXISTS contracts (
  id               serial PRIMARY KEY,
  conversation_id  integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  offer_id         integer NOT NULL REFERENCES offers(id),
  client_id        integer NOT NULL REFERENCES users(id),
  provider_id      integer NOT NULL REFERENCES users(id),
  status           text NOT NULL DEFAULT 'solicitada'
                   CHECK (status IN ('solicitada', 'proposta_enviada', 'aceita', 'em_andamento', 'concluida', 'cancelada')),
  request_note     text NOT NULL DEFAULT '',
  amount_cents     integer,
  deadline         date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  concluded_at     timestamptz
);
CREATE INDEX IF NOT EXISTS contracts_client_idx ON contracts (client_id);
CREATE INDEX IF NOT EXISTS contracts_provider_idx ON contracts (provider_id);

-- RF08
CREATE TABLE IF NOT EXISTS proposals (
  id            serial PRIMARY KEY,
  contract_id   integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  deadline      date NOT NULL,
  notes         text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceita', 'recusada', 'substituida')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contract_events (
  id           serial PRIMARY KEY,
  contract_id  integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  actor_id     integer REFERENCES users(id),
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- RF10: comissão apurada e comprovante
CREATE TABLE IF NOT EXISTS commissions (
  contract_id       integer PRIMARY KEY REFERENCES contracts(id) ON DELETE CASCADE,
  gross_cents       integer NOT NULL,
  rate              numeric(5, 4) NOT NULL,
  commission_cents  integer NOT NULL,
  net_cents         integer NOT NULL,
  receipt_code      text NOT NULL UNIQUE,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- RF11
CREATE TABLE IF NOT EXISTS reviews (
  id           serial PRIMARY KEY,
  contract_id  integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  reviewer_id  integer NOT NULL REFERENCES users(id),
  reviewee_id  integer NOT NULL REFERENCES users(id),
  rating       integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS reviews_reviewee_idx ON reviews (reviewee_id);

-- RF13
CREATE TABLE IF NOT EXISTS highlights (
  id            serial PRIMARY KEY,
  provider_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id      integer NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  category      text NOT NULL,
  plan          text NOT NULL,
  starts_at     timestamptz NOT NULL DEFAULT now(),
  ends_at       timestamptz NOT NULL,
  price_cents   integer NOT NULL,
  payment_code  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS highlights_active_idx ON highlights (offer_id, ends_at);

-- RF17
CREATE TABLE IF NOT EXISTS notifications (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  title       text NOT NULL,
  body        text NOT NULL DEFAULT '',
  link        text NOT NULL DEFAULT '',
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, id DESC);

-- RF15
CREATE TABLE IF NOT EXISTS reports (
  id           serial PRIMARY KEY,
  reporter_id  integer REFERENCES users(id),           -- nulo quando gerada automaticamente
  target_type  text NOT NULL CHECK (target_type IN ('oferta', 'usuario', 'mensagem')),
  target_id    integer NOT NULL,
  reason       text NOT NULL CHECK (reason IN ('conteudo_improprio', 'informacao_incorreta', 'negociacao_externa', 'outro')),
  details      text NOT NULL DEFAULT '',
  status       text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'procedente', 'improcedente')),
  resolution   text NOT NULL DEFAULT '',
  resolved_by  integer REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

-- Plano de aplicação, etapa 1: levantamento de campo (RF03 e RF18)
CREATE TABLE IF NOT EXISTS field_surveys (
  id               serial PRIMARY KEY,
  client_uuid      text NOT NULL UNIQUE,     -- evita duplicar quando a fila offline sincroniza de novo
  agent_id         integer NOT NULL REFERENCES users(id),
  business_name    text NOT NULL,
  category         text NOT NULL,
  appears_on_maps  text NOT NULL CHECK (appears_on_maps IN ('sim', 'nao', 'nao_sabe')),
  barriers         text[] NOT NULL DEFAULT '{}',
  accepted         boolean NOT NULL,
  provider_id      integer REFERENCES users(id),
  notes            text NOT NULL DEFAULT '',
  collected_at     timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Plano de aplicação, etapa 3: questionário de satisfação
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_group  text NOT NULL CHECK (user_group IN ('prestador', 'contratante')),
  score       integer NOT NULL CHECK (score BETWEEN 1 AND 5),
  ease        integer NOT NULL CHECK (ease BETWEEN 1 AND 5),
  will_continue boolean NOT NULL,
  comment     text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
