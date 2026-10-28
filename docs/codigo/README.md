# Documentação do código, linha por linha

Cada arquivo do projeto aparece dividido em trechos numerados, com o código real e a explicação logo abaixo.
A ordem segue o caminho de quem está conhecendo o sistema: primeiro como ele sobe, depois o banco e as regras,
as rotas da API e, por fim, a interface.

Para a visão geral (arquitetura, requisitos e testes) veja [DOCUMENTACAO.md](../../DOCUMENTACAO.md).

| Parte | Arquivos |
|---|---|
| [1. Inicialização e configuração](01-inicializacao-e-configuracao.md) | `package.json`, `iniciar.bat`, `iniciar.sh`, `scripts/check-node.js`, `scripts/dev.js`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `.gitignore`, `.gitattributes`, `.dockerignore` |
| [2. Servidor: núcleo](02-servidor-nucleo.md) | `server/src/config.js`, `server/src/db.js`, `server/src/index.js`, `server/src/app.js`, `server/src/realtime.js`, `server/src/jobs.js` |
| [3. Banco de dados](03-banco-de-dados.md) | `server/src/schema.sql` |
| [4. Regras de negócio (server/src/lib)](04-regras-de-negocio.md) | `server/src/lib/money.js`, `server/src/lib/contract-states.js`, `server/src/lib/geo.js`, `server/src/lib/text.js`, `server/src/lib/categories.js`, `server/src/lib/http.js`, `server/src/lib/auth.js`, `server/src/lib/notify.js`, `server/src/lib/images.js`, `server/src/lib/offers.js` |
| [5. Rotas da API: cadastro, ofertas e busca](05-rotas-cadastro-e-busca.md) | `server/src/routes/auth.js`, `server/src/routes/offers.js` |
| [6. Rotas da API: chat, contratação, comissão e avaliação](06-rotas-chat-e-contratacao.md) | `server/src/routes/conversations.js` |
| [7. Rotas da API: painel, destaque, notificações, moderação, campo e indicadores](07-rotas-painel-moderacao-campo.md) | `server/src/routes/provider.js`, `server/src/routes/notifications.js`, `server/src/routes/moderation.js`, `server/src/routes/field.js`, `server/src/routes/institution.js`, `server/src/routes/meta.js` |
| [8. Dados de demonstração e testes](08-dados-de-demonstracao-e-testes.md) | `server/src/seed.js`, `server/test/unit.test.js`, `server/test/api.test.js` |
| [9. Interface web: base](09-interface-base.md) | `web/index.html`, `web/vite.config.js`, `web/src/main.jsx`, `web/src/api.js`, `web/src/session.jsx`, `web/src/position.js`, `web/src/offline-queue.js`, `web/src/format.js`, `web/public/icon.svg`, `web/src/categories.jsx` |
| [10. Interface web: componentes](10-interface-componentes.md) | `web/src/components/Layout.jsx`, `web/src/components/ui.jsx`, `web/src/components/OfferCard.jsx`, `web/src/components/Maps.jsx`, `web/src/components/LocationDialog.jsx`, `web/src/components/ReportDialog.jsx`, `web/src/components/ImagePicker.jsx`, `web/src/components/ProviderLocation.jsx` |
| [11. Telas: entrada, busca, oferta e chat](11-telas-morador-e-chat.md) | `web/src/pages/Login.jsx`, `web/src/pages/Home.jsx`, `web/src/pages/OfferDetail.jsx`, `web/src/pages/ProviderProfile.jsx`, `web/src/pages/Conversations.jsx`, `web/src/pages/Chat.jsx` |
| [12. Telas: contratações, prestador, perfil e equipe](12-telas-prestador-e-equipe.md) | `web/src/pages/Contracts.jsx`, `web/src/pages/Receipt.jsx`, `web/src/pages/Dashboard.jsx`, `web/src/pages/OfferForm.jsx`, `web/src/pages/Notifications.jsx`, `web/src/pages/Profile.jsx`, `web/src/pages/Field.jsx`, `web/src/pages/Moderation.jsx`, `web/src/pages/Institution.jsx`, `web/src/pages/NotFound.jsx` |
| [13. Estilos (CSS)](13-estilos.md) | `web/src/styles.css` |

Esta documentação é gerada por `docs/gerador/gerar.py`. Depois de mudar o código, rode
`python docs/gerador/gerar.py`: os trechos são atualizados sozinhos, e o script avisa se algum trecho
explicado deixou de existir.
