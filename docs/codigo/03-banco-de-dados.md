# 3. Banco de dados

O modelo de dados inteiro está num único arquivo SQL, executado a cada inicialização. Todos os comandos usam `IF NOT EXISTS`,
então rodar de novo não apaga nada. Convenções usadas em todas as tabelas:

- `serial PRIMARY KEY`: número inteiro gerado automaticamente que identifica a linha.
- `REFERENCES tabela(id)`: chave estrangeira; o banco recusa apontar para algo inexistente. `ON DELETE CASCADE` apaga junto as linhas dependentes.
- `CHECK (...)`: regra que o próprio banco garante, mesmo que o código tenha um erro.
- `timestamptz`: data e hora com fuso horário. `DEFAULT now()` preenche com o momento da gravação.
- Valores em dinheiro ficam em **centavos inteiros** (`_cents`), nunca em número com vírgula, para não haver erro de arredondamento.

## `server/src/schema.sql`

Cada bloco abaixo cria uma tabela e seus índices. Os comentários `RFxx` indicam a qual requisito funcional a tabela atende.

**Linhas 1 a 2**

```sql
-- Schema do ConectaBairro (PostgreSQL + PostGIS). Idempotente: roda a cada inicialização.
CREATE EXTENSION IF NOT EXISTS postgis;
```

Ativa a extensão PostGIS, que acrescenta ao PostgreSQL o tipo `geography` e as funções de distância usadas na busca.

**Linhas 4 a 15**

```sql
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
```

**Usuários.** Uma pessoa pode ser contratante e prestadora ao mesmo tempo (`is_provider`).

- `phone` é único: é a identidade da conta (RF01), sem e-mail, CPF ou CNPJ.
- `role` separa os perfis especiais: `agente` (cadastro de campo), `moderador` e `instituicao` (painel de indicadores). O `CHECK` impede qualquer outro valor.
- `assisted_by` registra qual agente fez o cadastro assistido (RF03).
- `blocked` é usado pela moderação para suspender contas (RF15).

**Linhas 17 a 27**

```sql
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
```

**Códigos de verificação do telefone.** O código de 6 dígitos nunca é guardado em texto: só o seu *hash* (`code_hash`).
`attempts` conta as tentativas erradas, `expires_at` dá a validade e `used` impede reaproveitar o código.
O índice por telefone e data acelera a busca do código mais recente.

**Linhas 29 a 39**

```sql
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
```

**Localização do prestador**, a tabela mais sensível do sistema.

- `exact`: o ponto real informado pelo prestador. `geography(Point, 4326)` é um ponto em latitude e longitude no sistema GPS (código 4326), com distâncias calculadas em metros sobre a curvatura da Terra.
- `anchor`: o ponto público, deslocado de 100 a 300 m numa direção aleatória. **Todas as distâncias mostradas são calculadas a partir dele.**
- `service_radius_km`: até onde o prestador atende.
- O índice `gist` é um índice espacial: permite achar rapidamente quem está dentro de um raio sem medir a distância de todos os prestadores.

Nenhuma rota da API devolve as colunas `exact` ou `anchor`.

**Linhas 41 a 61**

```sql
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
```

**Ofertas** (serviços ou produtos).

- `kind`: serviço ou produto.
- `price_min_cents` e `price_max_cents`: a faixa de preço, opcional (nulo significa "a combinar").
- `images`: lista dos endereços das fotos, em `jsonb` (JSON armazenado de forma estruturada).
- `status`: `ativa`, `pausada` pelo prestador ou `removida` (exclusão lógica: a linha continua existindo para o histórico das contratações).
- `search_text`: título, descrição e categoria sem acentos e em minúsculas, preparado para a busca por texto.
- `confirmed_at` e `confirm_notified_at`: controle do RF16 (última confirmação e último aviso enviado).

**Linhas 63 a 69**

```sql
-- RF14: visualizações (uma por visitante por dia)
CREATE TABLE IF NOT EXISTS offer_views (
  offer_id    integer NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  viewer_key  text NOT NULL,
  day         date NOT NULL DEFAULT current_date,
  PRIMARY KEY (offer_id, viewer_key, day)
);
```

**Visualizações das ofertas** para o painel do prestador. A chave primária composta (oferta, visitante, dia) faz cada visitante contar no máximo uma vez por dia.

**Linhas 71 a 80**

```sql
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
```

**Conversas.** Cada par (oferta, contratante) tem uma única conversa, garantido pelo `UNIQUE (offer_id, client_id)`.
`last_message_at` ordena a lista de conversas pela mais recente.

**Linhas 82 a 92**

```sql
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
```

**Mensagens do chat.**

- `sender_id` nulo indica mensagem do sistema (por exemplo "Serviço concluído").
- `kind`: texto comum, proposta ou sistema.
- `masked`: marca que dados de contato foram removidos da mensagem.
- `proposal_id`: liga a mensagem à proposta que ela exibe como cartão.

**Linhas 94 a 99**

```sql
CREATE TABLE IF NOT EXISTS conversation_reads (
  conversation_id  integer NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_id     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);
```

**Leitura das conversas.** Guarda, por usuário, o id da última mensagem lida. As mensagens com id maior são as "não lidas".

**Linhas 101 a 118**

```sql
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
```

**Contratações.** O `CHECK` do `status` lista os seis estados da máquina de estados (ver `lib/contract-states.js`).
`amount_cents` e `deadline` só são preenchidos quando o contratante aceita uma proposta. `concluded_at` registra a conclusão.
Os índices por contratante e por prestador aceleram a tela "Contratações".

**Linhas 120 a 129**

```sql
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
```

**Propostas.** Uma contratação pode ter várias (proposta recusada, nova proposta). O `CHECK (amount_cents > 0)` impede valor zero ou negativo.
`status`: pendente, aceita, recusada ou substituída (quando o prestador manda outra antes da resposta).

**Linhas 131 a 139**

```sql
CREATE TABLE IF NOT EXISTS contract_events (
  id           serial PRIMARY KEY,
  contract_id  integer NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  from_status  text,
  to_status    text NOT NULL,
  actor_id     integer REFERENCES users(id),
  note         text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

**Histórico da contratação.** Cada mudança de estado vira uma linha: de onde, para onde, quem fez e quando. Serve como trilha de auditoria.

**Linhas 141 a 150**

```sql
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
```

**Comissão apurada.** Uma linha por contratação concluída, com valor bruto, taxa, comissão, valor líquido e o código único do comprovante.
Guardar a taxa usada protege o histórico caso a porcentagem mude no futuro.

**Linhas 152 a 163**

```sql
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
```

**Avaliações.** Nota de 1 a 5 (garantida pelo `CHECK`). O `UNIQUE (contract_id, reviewer_id)` permite uma avaliação por pessoa por contratação.
`reviewee_id` é quem foi avaliado; o índice nessa coluna acelera o cálculo da reputação.

**Linhas 165 a 178**

```sql
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
```

**Planos de destaque.** Período (`starts_at` a `ends_at`), categoria, plano, preço e o código do pagamento simulado.
O índice por oferta e data de término acelera a verificação "esta oferta está em destaque agora?", feita em toda busca.

**Linhas 180 a 191**

```sql
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
```

**Notificações.** `read_at` nulo significa não lida; `link` é a tela que abre ao tocar na notificação.

**Linhas 193 a 206**

```sql
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
```

**Denúncias.** `reporter_id` nulo indica sinalização automática (mensagem com dados de contato).
O alvo pode ser oferta, usuário ou mensagem (`target_type` + `target_id`). Guarda também a decisão, a justificativa, quem resolveu e quando.

**Linhas 208 a 222**

```sql
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
```

**Levantamento de campo** (Tabela 5 do artigo, etapa 1).

- `client_uuid` é gerado no aparelho do agente. Por ser único, se a fila offline enviar o mesmo registro duas vezes, a segunda é ignorada.
- `appears_on_maps`: resposta à pergunta "o negócio aparece em mapas digitais?", base do indicador principal do artigo.
- `barriers`: lista (`text[]`, vetor de textos) com os motivos declarados para não estar em plataformas digitais.
- `accepted`: se aceitou o cadastro; `provider_id` aponta para a conta criada.
- `collected_at`: quando foi coletado no campo, que pode ser bem antes de quando chegou ao servidor.

**Linhas 224 a 234**

```sql
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
```

**Questionário de satisfação** (etapa 3): grupo (prestador ou contratante), satisfação geral e facilidade de uso de 1 a 5, intenção de continuar usando e comentário.

---
