SLUG = '05-rotas-cadastro-e-busca'
TITLE = '5. Rotas da API: cadastro, ofertas e busca'
INTRO = '''
As rotas recebem as requisições do navegador. Padrão usado em todos os arquivos de rotas: cria-se um `Router` do Express,
cada `r.get`/`r.post`/... associa um endereço a uma função `async (req, res)`, e o arquivo exporta o roteador para o `app.js`.
`req.body` é o JSON enviado, `req.query` são os parâmetros da URL (depois do `?`), `req.params` são as partes variáveis do caminho (`:id`)
e `req.user` é o usuário logado (preenchido pelo `loadUser`). O `?.` (encadeamento opcional) evita erro quando o corpo não veio.
'''
FILES = [
('server/src/routes/auth.js', '''
Cadastro e login por telefone (RF01), dados do próprio usuário e ponto de atendimento do prestador (RF04).
''', [
('// RF01', '''
Comentário e importações. `const r = Router()` cria o roteador.
'''),
("r.post('/auth/request-code'", '''
**Pedir código.** Normaliza o telefone e recusa formatos inválidos.
'''),
('  const recent = await one(', '''
Limite de 6 códigos por hora para o mesmo número (resposta 429, "muitas requisições"). Isso impede usar o sistema para disparar SMS em massa para um número.
'''),
('  const code = generateCode()', '''
Gera o código, invalida os códigos anteriores ainda não usados desse número e grava o novo (só o hash), válido por 10 minutos.
'''),
("  if (config.smsMode === 'dev') {", '''
No modo demonstração, mostra o código no terminal e o devolve na resposta, para a tela de login exibi-lo. Em produção, aqui entraria o envio por SMS, e o código nunca voltaria na resposta.
'''),
("r.post('/auth/verify'", '''
**Confirmar código.** Normaliza o telefone, mantém só os dígitos do código e exige exatamente 6.
'''),
('  const otp = await one(', '''
Busca o código mais recente, não usado e dentro da validade. Depois de 5 tentativas erradas o código fica bloqueado.
Se o hash não bate, soma uma tentativa e responde "Código incorreto". Com 5 tentativas em 1 milhão de combinações, adivinhar é inviável.
'''),
('  let user = await one(', '''
Se o telefone ainda não tem conta, é um cadastro novo: exige o nome.
O detalhe importante está no comentário: com o código certo mas sem o nome, a rota responde `needsName` **sem consumir o código**, e a interface pede o nome e reenvia.
Só então cria o usuário, sem pedir CNPJ, CPF ou endereço (o artigo aponta a exigência de documentos como barreira de adesão).
'''),
('  if (user.blocked)', '''
Contas suspensas pela moderação não entram. O código é marcado como usado (não pode ser reaproveitado) e a resposta traz o token de sessão e os dados do usuário.
'''),
("r.get('/me', requireAuth", '''
Dados do usuário logado. Sobre a localização, devolve **apenas** se ela existe e o raio de atendimento, nunca as coordenadas, nem para o próprio prestador.
'''),
("r.patch('/me', requireAuth", '''
Atualiza nome, apresentação e o "também ofereço serviços". Cada campo só muda se tiver sido enviado (`!== undefined`).
'''),
('// RF04: o prestador informa', '''
`saveProviderLocation` grava o ponto exato e gera o ponto público deslocado (`randomAnchor`).

- `ST_MakePoint(lng, lat)` cria o ponto: o PostGIS usa a ordem **longitude, latitude**, por isso os parâmetros aparecem invertidos.
- `ST_SetSRID(..., 4326)` diz que são coordenadas de GPS, e `::geography` faz as distâncias saírem em metros.
- `ON CONFLICT (user_id) DO UPDATE` é um *upsert*: cria se não existir, atualiza se já existir. Cada atualização sorteia um novo deslocamento.

A função recebe `run` como parâmetro para poder ser usada também dentro da transação do cadastro de campo.
'''),
("r.put('/me/location'", '''
Rota que salva ponto e raio, validando as coordenadas e o raio (0,5 a 20 km). A resposta confirma o salvamento sem repetir as coordenadas.
'''),
("r.patch('/me/location'", '''
Muda só o raio de atendimento, sem mexer no ponto. Se o ponto ainda não existe, pede para defini-lo primeiro.
'''),
('export default r', '''
Exporta o roteador.
'''),
]),
('server/src/routes/offers.js', '''
Busca por proximidade (RF05 e RF06), detalhe da oferta, perfil público (RF12), cadastro e edição de ofertas (RF02) e confirmação de atividade (RF16).
''', [
('// RF02, RF04', '''
Importações e criação do roteador.
'''),
('function readPoint(src) {', '''
Lê `lat` e `lng` dos parâmetros da URL e devolve o ponto, ou `null` se forem inválidos.
'''),
('// RF05 + RF06', '''
**Busca.** Prepara os filtros:

- ponto de busca: o enviado pelo navegador ou, na falta, o centro do bairro piloto;
- raio entre 0,5 e 10 km (2 km se não vier);
- categoria, aceita só se estiver na lista oficial;
- palavras da busca por necessidade.
'''),
('  const params = [', '''
Monta a consulta aos poucos. `params` guarda os valores e `where` as condições, sempre com `$n` (parâmetro numerado), nunca colando o texto do usuário no SQL.

Condições fixas:

- oferta ativa e prestador não bloqueado;
- confirmada nos últimos 45 dias (RF16);
- `ST_DWithin(anchor, ponto, metros)`: está dentro do raio. É aqui que o índice espacial trabalha. Repare que a medida usa o `anchor` (ponto deslocado), não o ponto exato.
'''),
('  if (category) {', '''
Filtro por categoria. `params.length` dá o número do próximo parâmetro.
'''),
('  if (tokens.length) {', '''
Busca por texto: para cada palavra, uma condição `search_text LIKE '%palavra%'`.
`textMatch` guarda essas condições para a ordenação: quem cita a palavra aparece antes de quem só é da categoria relacionada.
Depois acrescenta as categorias ligadas às palavras (busca por necessidade) e junta tudo com `OR`: basta uma das condições.
'''),
('  const rows = await many(', '''
Executa a consulta:

- `ST_Distance` calcula a distância até o ponto deslocado;
- traz nome do prestador, raio de atendimento, destaque, se cita o termo e a reputação;
- ordena por destaque, depois por citar o termo, depois **pela distância** (RF05), e por id para empates;
- limita a 60 resultados.

Cada linha passa por `serializeOffer`, que não tem como incluir coordenadas.
'''),
("r.get('/offers/:id'", '''
**Detalhe da oferta.** Se o navegador mandou a posição, calcula a distância; senão, ela fica nula.
'''),
('  const row = await one(', '''
Busca a oferta com prestador, destaque e reputação. Ofertas removidas e prestadores bloqueados não aparecem; ofertas pausadas só para o próprio dono.
'''),
('  // RF14: registra a visualização', '''
Registra uma visualização para o painel do prestador, sem contar o próprio dono. O visitante é identificado pelo id (logado) ou por um hash de IP com navegador (anônimo); o hash evita guardar o IP em si.
O `ON CONFLICT DO NOTHING` ignora a segunda visita do mesmo visitante no mesmo dia.
'''),
('  let conversationId = null', '''
Se o usuário logado já conversou sobre esta oferta, devolve o id da conversa: a tela mostra "Abrir conversa" em vez de criar outra.
'''),
('// RF12: perfil público', '''
**Perfil público do prestador**: dados públicos e reputação.
'''),
('  const offers = await many(', '''
Ofertas ativas do prestador e as últimas 30 avaliações recebidas como prestador, com o primeiro nome de quem avaliou e o título do serviço contratado.
'''),
('function readOfferBody(b) {', '''
Valida o formulário de oferta: título obrigatório (até 80 caracteres), descrição, categoria da lista, tipo, preços convertidos para centavos (máximo não pode ser menor que o mínimo) e unidade de preço.
'''),
('export async function insertOffer', '''
Grava a oferta já com o texto de busca preparado. É exportada porque o cadastro de campo também cria ofertas, dentro da transação dele.
'''),
("r.get('/my/offers'", '''
Ofertas do próprio prestador para o painel, com destaque vigente, data de término do destaque e total de visualizações.
'''),
("r.post('/offers'", '''
Publica uma oferta: valida, salva as fotos e grava. Responde 201 ("criado").
'''),
('async function ownOffer(req) {', '''
Busca a oferta garantindo que ela pertence ao usuário logado (`provider_id = $2`). Um prestador não consegue editar a oferta de outro nem descobrir se ela existe.
'''),
("r.put('/offers/:id'", '''
Edita a oferta. Se as fotos não vierem no pedido, mantém as atuais. Editar também conta como confirmação de atividade (`confirmed_at = now()`).
'''),
("r.patch('/offers/:id/status'", '''
Pausa, reativa ou remove a oferta (a remoção é lógica: a linha continua para o histórico).
'''),
('// RF16: o prestador confirma', '''
Confirmação de atividade (RF16), de uma oferta ou de todas de uma vez. Zera o aviso enviado para a contagem recomeçar.
'''),
('export default r', '''
Exporta o roteador.
'''),
]),
]
