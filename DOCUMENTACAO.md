# ConectaBairro: documentação técnica

Este documento liga o que foi especificado no artigo (AC1) e no documento do projeto ao que está implementado.
A explicação de cada arquivo, linha por linha, está em [docs/codigo/](docs/codigo/README.md).

## 1. Arquitetura

```
Navegador (PWA React)  ──HTTP /api──►  Node.js + Express  ──SQL──►  PostgreSQL + PostGIS
        ▲                                   │                     (PGlite embutido ou servidor real)
        └────────── Socket.IO (chat e notificações em tempo real)
```

- **Uma única porta (3000)** serve a API, a interface compilada e o tempo real. Isso simplifica rodar no Windows e acessar pela rede local.
- **Banco**: o mesmo SQL roda em dois modos (`server/src/db.js`):
  - sem `DATABASE_URL`: PGlite, que é o PostgreSQL compilado para WebAssembly, com a extensão PostGIS. Não exige instalar nada além do Node e funciona igual em Windows, Linux e macOS.
  - com `DATABASE_URL`: PostgreSQL + PostGIS tradicional (por exemplo via `docker compose`).
  - o PGlite só aceita um processo por vez. Uma trava (`server/data/pglite.lock`) impede abrir o sistema duas vezes ou rodar o seed com ele aberto, o que já corrompeu o banco uma vez durante o desenvolvimento.
- **Sem dependências nativas no servidor**: as senhas de verificação usam `node:crypto`, as imagens são redimensionadas no navegador. Nada precisa ser compilado na instalação.

### Tecnologias

| Camada | Tecnologia | Seção do artigo |
|---|---|---|
| Interface | React 19, React Router, Leaflet + OpenStreetMap, lucide (ícones), fontes Figtree e Bricolage Grotesque (instaladas, funcionam offline) | 5.2 |
| PWA | vite-plugin-pwa (Workbox): instalação, cache da interface, funcionamento offline | 5.2 |
| API | Node.js, Express 5, Socket.IO | 5.2, 5.5 (Programação Web) |
| Persistência | PostgreSQL + PostGIS (`geography`, `ST_DWithin`, `ST_Distance`) | 5.2 |
| Fila offline | IndexedDB (idb-keyval) | RF18 |
| Testes | `node:test` (nativo do Node) | 5.5 (Qualidade e Testes) |

## 2. Decisão central: a localização nunca sai do servidor

O artigo (Seção 5.2) define que as coordenadas exatas do prestador ficam só no servidor e que a aplicação devolve apenas a distância aproximada. A implementação vai além do simples "não enviar a coordenada", porque só esconder o ponto não basta: com distâncias exatas medidas de três lugares diferentes, qualquer pessoa conseguiria triangular o endereço.

1. **Ponto deslocado** (`server/src/lib/geo.js`, `randomAnchor`): ao salvar a localização, o servidor gera um segundo ponto, deslocado entre 100 e 300 metros numa direção aleatória. As duas posições ficam em `provider_locations` (`exact` e `anchor`).
2. **Distância calculada a partir do ponto deslocado**: toda busca usa `anchor`. A triangulação, no máximo, encontraria o ponto falso.
3. **Arredondamento**: a distância é arredondada em 100 m e tem piso de 0,5 km ("menos de 0,5 km").
4. **Mapa sem prestadores**: o mapa da busca mostra só o ponto do próprio morador e o raio.
5. **Verificação automática**: o teste `privacidade: nenhuma resposta da API contém coordenadas do prestador` (`server/test/api.test.js`) varre todas as respostas JSON do fluxo completo procurando campos como `lat`, `lng`, `exact`, `anchor` ou números próximos da coordenada real.

A posição do morador fica só no navegador dele e é enviada a cada busca, sem ser armazenada.

## 3. Requisitos funcionais

O artigo lista 13 requisitos (Tabela 2). O documento do projeto lista 18. Todos os 18 estão implementados.

| ID | Requisito | Onde está |
|---|---|---|
| RF01 | Cadastro com telefone verificado, sem documento empresarial | `routes/auth.js`, `pages/Login.jsx`. Código de 6 dígitos guardado como HMAC, expira em 10 min, 5 tentativas, 6 códigos por hora por número |
| RF02 | Cadastro de oferta (descrição, categoria, faixa de preço, imagens opcionais) | `routes/offers.js`, `pages/OfferForm.jsx`, `lib/images.js` (valida o tipo real do arquivo) |
| RF03 | Cadastro assistido por terceiro autorizado | `routes/field.js`, `pages/Field.jsx`. Exige registrar o consentimento; o prestador entra depois com o próprio celular |
| RF04 | Exibição só pela distância aproximada | `lib/geo.js`, `lib/offers.js` (`serializeOffer` nunca inclui coordenadas). Ver Seção 2 |
| RF05 | Busca por categoria e por necessidade, ordenada pela distância | `routes/offers.js` (`/search`), `lib/categories.js` (palavras-chave: "chuveiro queimou" chega em Manutenção) |
| RF06 | Filtro por raio | `ST_DWithin` na busca; controle deslizante de 0,5 a 10 km em `pages/Home.jsx` |
| RF07 | Chat interno sem telefone, endereço ou perfil externo | `routes/conversations.js`, `pages/Chat.jsx`, `lib/text.js` (`maskContacts` remove telefones, e-mails, links, @perfis e "me chama no zap") |
| RF08 | Proposta com valor e prazo e aceite do contratante | `POST /contracts/:id/proposals`, cartão de proposta no chat |
| RF09 | Contratação com estados até a conclusão | `lib/contract-states.js` (máquina de estados), histórico em `contract_events` |
| RF10 | Comissão automática de 6% e comprovante | `lib/money.js` (centavos inteiros, arredondamento meio para cima), `pages/Receipt.jsx` (imprimível/PDF) |
| RF11 | Avaliação recíproca | `POST /contracts/:id/review`; uma avaliação por parte, só após a conclusão |
| RF12 | Histórico de reputação no perfil | `pages/ProviderProfile.jsx`; a média só considera avaliações recebidas como prestador |
| RF13 | Plano de destaque por categoria e período | `routes/provider.js` (semanal, quinzenal, mensal); pagamento simulado; destaque aparece primeiro na categoria |
| RF14 | Painel do prestador | `GET /my/dashboard`, `pages/Dashboard.jsx`: visualizações, contatos, conversão, receita bruta/comissão/líquida |
| RF15 | Denúncia e moderação | `routes/moderation.js`, `pages/Moderation.jsx`. Mensagens com contato geram denúncia automática |
| RF16 | Confirmação periódica de atividade | `server/src/jobs.js`: aviso aos 30 dias, oferta sai da busca aos 45 |
| RF17 | Notificações | `lib/notify.js` + Socket.IO; central de notificações e aviso do sistema operacional |
| RF18 | Operação offline do cadastro de campo | `web/src/offline-queue.js`: fila no IndexedDB, envio em lote quando a conexão volta, sem duplicar |

### Estados da contratação (RF09)

```
solicitada ──(prestador envia proposta)──► proposta_enviada ──(contratante aceita)──► aceita
     ▲                                          │                                    │
     └────────(contratante recusa)──────────────┘                         (prestador inicia)
                                                                                     ▼
                         cancelada ◄──(qualquer parte, antes de concluir)──   em_andamento
                                                                                     │
                                                                          (prestador conclui)
                                                                                     ▼
                                                                    concluida (comissão + comprovante)
```

Cada transição verifica **quem** pode fazer (prestador, contratante ou ambos) e **de qual estado** é possível partir. Tentativas inválidas retornam 403 (lado errado) ou 409 (estado errado).

## 4. Plano de aplicação e avaliação (Tabela 5 do artigo)

O painel **Indicadores** (conta da Associação de Moradores) calcula os indicadores de cada etapa só com dados agregados, sem nomes, telefones ou endereços:

| Etapa | Indicador do artigo | Como é medido |
|---|---|---|
| 1. Validação do problema | Proporção de negócios levantados que não constam de mapas convencionais | Pergunta "aparece no Google Maps?" do cadastro de campo |
| 1. (objetivo específico a) | Barreiras declaradas | Lista de motivos marcada pelo agente |
| 2. Validação da solução | Prestadores cadastrados e contratações concluídas | Contagens da plataforma, taxa de conversão abordados x cadastrados |
| 3. Avaliação de satisfação | Grau de satisfação e intenção de continuidade | Questionário em Perfil > Pesquisa de satisfação |

O botão **Exportar planilha (CSV)** gera um arquivo com separador `;` que abre direto no Excel em português, para o trabalho de Business Intelligence.

## 5. Estrutura de pastas

```
conecta-bairro/
├── iniciar.bat / iniciar.sh     inicialização com dois cliques (Windows / Linux e macOS)
├── package.json                 dependências e comandos (npm start, test, dev, seed, build)
├── .env.example                 configuração
├── docker-compose.yml           alternativa com PostgreSQL + PostGIS em container
├── scripts/
│   ├── dev.js                   API + Vite juntos, sem depender de ferramentas do Linux
│   └── check-node.js            confere a versão do Node antes de instalar
├── server/
│   ├── src/
│   │   ├── index.js             ponto de entrada (porta, rede local, contas de demonstração)
│   │   ├── app.js               Express: rotas, arquivos estáticos, tratamento de erros
│   │   ├── config.js            leitura do .env
│   │   ├── db.js                PGlite ou PostgreSQL, mesma interface
│   │   ├── schema.sql           tabelas (idempotente)
│   │   ├── seed.js              bairro de demonstração (personas do artigo e histórico)
│   │   ├── jobs.js              RF16
│   │   ├── realtime.js          Socket.IO
│   │   ├── lib/                 regras de negócio puras (comissão, estados, geo, texto, auth)
│   │   └── routes/              endpoints da API agrupados por assunto
│   └── test/                    testes unitários e de integração
└── web/
    ├── index.html, vite.config.js (PWA)
    ├── public/                  ícones do aplicativo
    └── src/
        ├── main.jsx             rotas e controle de acesso por perfil
        ├── session.jsx          usuário logado, notificações, tempo real
        ├── api.js, position.js, offline-queue.js, format.js
        ├── components/          layout, mapas, cartões, diálogos
        └── pages/               uma tela por arquivo
```

## 6. API

Todas as rotas começam com `/api`. As marcadas com (A) exigem o cabeçalho `Authorization: Bearer <token>`.

| Método e rota | Descrição |
|---|---|
| `GET /meta` | Categorias, centro do bairro, planos de destaque, motivos de denúncia |
| `POST /auth/request-code` | Envia o código (no modo demonstração ele volta na resposta) |
| `POST /auth/verify` | Confere o código; cria a conta quando é a primeira vez |
| `GET/PATCH /me` (A) | Dados do usuário |
| `PUT/PATCH /me/location` (A) | Ponto e raio de atendimento do prestador (a resposta não devolve coordenadas) |
| `GET /search?lat&lng&radius&category&q` | Busca por proximidade |
| `GET /offers/:id` | Detalhe da oferta, com distância |
| `GET /providers/:id` | Perfil público e reputação |
| `GET/POST/PUT/PATCH /offers...`, `/my/offers` (A) | Gestão das ofertas do prestador |
| `POST /offers/:id/confirm`, `/my/offers/confirm-all` (A) | RF16 |
| `GET/POST /conversations`, `/conversations/:id/messages` (A) | Chat |
| `POST /conversations/:id/contracts` (A) | Solicitar serviço |
| `POST /contracts/:id/proposals` (A) | Enviar proposta |
| `POST /contracts/:id/actions` (A) | `aceitar`, `recusar`, `iniciar`, `concluir`, `cancelar` |
| `GET /contracts/:id/receipt` (A) | Comprovante |
| `POST /contracts/:id/review` (A) | Avaliação |
| `POST /highlights`, `GET /my/highlights` (A) | Destaque |
| `GET /my/dashboard?days=30` (A) | Painel do prestador |
| `GET /notifications` e afins (A) | Notificações |
| `POST /reports` (A) | Denúncia |
| `GET /moderation/reports`, `POST /moderation/reports/:id/resolve` (A, moderador) | Moderação |
| `POST /field/surveys`, `/field/surveys/batch`, `GET /field/surveys` (A, agente) | Campo |
| `GET /institution/overview`, `/institution/export.csv` (A, instituição) | Indicadores |
| `POST /satisfaction`, `GET /satisfaction/mine` (A) | Questionário |

## 7. Testes

`npm test` roda 19 testes em cerca de 10 segundos, com banco em memória (não mexe nos dados de demonstração):

- **Regras de negócio** (`unit.test.js`): cálculo da comissão em vários valores e arredondamentos, todas as transições permitidas e proibidas, deslocamento do ponto entre 100 e 300 m, arredondamento da distância, filtro de contatos (casos que devem ser removidos e casos que não podem ser, como "R$ 120,00" e "12/11 às 14h"), normalização de celular, busca por necessidade.
- **Fluxo completo pela API** (`api.test.js`): cadastro, oferta, busca dentro e fora do raio, chat com máscara, proposta recusada e reenviada, aceite, conclusão com comissão de R$ 7,41 sobre R$ 123,45, avaliações, destaque passando à frente de quem está mais perto, painel, denúncia, confirmação de atividade, cadastro assistido reenviado pela fila offline sem duplicar, e a varredura de privacidade.

## 8. Limitações do protótipo

- **SMS**: o código de verificação aparece na tela. A integração com um provedor real fica no ponto marcado em `routes/auth.js`.
- **Pagamentos**: a comissão é apurada e registrada, e o PIX do plano de destaque é simulado. Não há cobrança real.
- **GPS na rede local**: navegadores só liberam a localização em `https` ou `localhost`. Para um piloto real, publique com HTTPS.
- **Mapa**: os blocos do OpenStreetMap precisam de internet. O restante do cadastro de campo funciona offline.
