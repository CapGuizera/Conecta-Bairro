SLUG = '07-rotas-painel-moderacao-campo'
TITLE = '7. Rotas da API: painel, destaque, notificações, moderação, campo e indicadores'
INTRO = '''
Rotas que atendem aos requisitos de apoio (RF13 a RF17) e ao Plano de Aplicação do artigo (levantamento de campo, indicadores e questionário).
'''
FILES = [
('server/src/routes/provider.js', '''
Plano de destaque (RF13) e painel do prestador (RF14).
''', [
('// RF13', '''
Importações e roteador.
'''),
('export const HIGHLIGHT_PLANS', '''
Os três planos de destaque com duração e preço em centavos. Também são enviados à interface pela rota `/meta`.
'''),
("r.get('/my/highlights'", '''
Histórico de destaques do prestador, indicando quais estão vigentes agora.
'''),
('// Contratação do destaque', '''
**Contratar destaque.** Valida o plano e confere que a oferta é ativa e do próprio prestador.
'''),
('  const h = await db().transaction(async (tx) => {', '''
Se a oferta já está em destaque, o novo período começa quando o atual acabar (os períodos se somam, nada é perdido).
O código de pagamento é fictício (`PIX-SIMULADO-...`), já que o protótipo não processa pagamentos reais. A categoria do destaque é a da oferta: o destaque vale "por categoria", como pede o RF13.
'''),
('  await notify(req.user.id, {', '''
Confirma ao prestador por notificação, com a data de término e o valor.
'''),
('// RF14: métricas', '''
**Painel do prestador.** O período aceito é 7, 30, 90 ou 365 dias (30 por padrão). As seis consultas rodam em paralelo (`Promise.all`):

1. `totals`: visualizações, contatos iniciados, contratações concluídas e pedidos recebidos no período;
2. `revenue`: soma do valor bruto, da comissão e do líquido das contratações concluídas;
3. `rating`: média e quantidade de avaliações recebidas como prestador;
4. `open`: pedidos aguardando proposta e serviços em andamento (os alertas do topo do painel);
5. `series`: visualizações e contatos de cada dia, para o gráfico. `generate_series` cria uma linha por dia, mesmo nos dias sem movimento (até 30 dias no gráfico);
6. `perOffer`: os mesmos números separados por oferta.

`COALESCE(sum(...), 0)` faz a soma valer 0 em vez de nulo quando não há nada.
'''),
('  res.json({', '''
Monta a resposta e calcula a **taxa de conversão** (contratações concluídas dividido por contatos), com uma casa decimal.
'''),
]),
('server/src/routes/notifications.js', '''
Central de notificações (RF17).
''', [
('// RF17', '''
Importações e exigência de login em `/notifications`.
'''),
("r.get('/notifications', async", '''
As 100 notificações mais recentes e o total não lido.
'''),
("r.get('/notifications/unread-count'", '''
Só o número de não lidas, para o sino da barra superior.
'''),
("r.post('/notifications/read-all'", '''
Marca todas como lidas.
'''),
("r.post('/notifications/:id/read'", '''
Marca uma como lida. O `user_id = $2` garante que só se marque a própria notificação.
'''),
]),
('server/src/routes/moderation.js', '''
Denúncia e moderação (RF15).
''', [
('// RF15', '''
Importações e roteador.
'''),
('export const REPORT_REASONS', '''
Os motivos de denúncia e seus textos. "Tentativa de negociar fora da plataforma" é o mesmo motivo usado na sinalização automática do chat.
'''),
("r.post('/reports', requireAuth", '''
**Denunciar.** Valida o tipo do alvo e o motivo.
'''),
('  const table =', '''
Confere se o item denunciado existe. O nome da tabela vem de um mapa fixo no código, nunca do usuário, então montar o SQL com ele é seguro.
'''),
("  if (targetType === 'mensagem') {", '''
Mensagens só podem ser denunciadas por quem participa da conversa. Para os outros, a resposta é a mesma de "não encontrado".
'''),
('  const dup = await one(', '''
Evita denúncias repetidas: se a mesma pessoa já denunciou o mesmo item e a denúncia ainda está aberta, só confirma. Senão, grava.
'''),
('async function describeTarget(rep) {', '''
Monta o resumo do item denunciado para o moderador: título, texto, situação, dono e link para a tela correspondente. Funciona para os três tipos de alvo.
'''),
("r.get('/moderation/reports'", '''
**Fila da moderação** (só para o perfil moderador), filtrada por situação, com a contagem de abertas e resolvidas. Sinalizações automáticas aparecem como "Sistema (automático)".
'''),
("r.post('/moderation/reports/:id/resolve'", '''
**Decidir uma denúncia.** Só denúncias abertas, com decisão "procedente" ou "improcedente", providência e justificativa.
'''),
("  if (decision === 'procedente') {", '''
Providências possíveis quando a denúncia procede:

- `remover_oferta`: remove a oferta e avisa o prestador com a justificativa;
- `ocultar_mensagem`: troca o texto da mensagem por "[mensagem removida pela moderação]";
- `bloquear_usuario`: suspende a conta. O filtro `role = 'usuario'` impede bloquear contas da equipe (agentes, moderação, instituição);
- `advertir`: envia um aviso ao responsável.
'''),
("  await q('UPDATE reports SET status", '''
Registra a decisão, a providência, quem decidiu e quando. Quem denunciou (se não foi automática) recebe uma notificação com o resultado.
'''),
]),
('server/src/routes/field.js', '''
Cadastro de campo: levantamento dos negócios (etapa 1 do Plano de Aplicação), cadastro assistido (RF03) e recebimento da fila offline (RF18).
''', [
('// RF03 (cadastro assistido)', '''
Comentário sobre o funcionamento e importações. Repare que reaproveita `saveProviderLocation` e `insertOffer` das outras rotas, para o cadastro assistido seguir exatamente as mesmas regras do cadastro normal.
'''),
('const r = Router()', '''
Só agentes de campo e moderadores acessam estas rotas.
'''),
('export const BARRIERS', '''
Lista das barreiras que o agente pode marcar: os motivos que os prestadores declaram para não estar em plataformas digitais (objetivo específico "a" do artigo).
'''),
('async function saveSurvey(agent, b) {', '''
**Idempotência**: antes de tudo, procura o `clientUuid`. Se o registro já chegou antes (a fila offline pode reenviar quando a conexão oscila), devolve o que existe com `duplicate: true` e não grava de novo.
'''),
('  const businessName =', '''
Valida o levantamento: nome do negócio, categoria, se aparece em mapas (`sim`, `nao` ou `nao_sabe`), barreiras (só as da lista), se aceitou o cadastro, observações e a data da coleta.
A data da coleta é a do aparelho, porque o registro pode ter sido feito sem internet horas antes de chegar ao servidor.
'''),
('  let provider = null', '''
Se o prestador aceitou o cadastro, valida os dados dele:

- **o consentimento registrado é obrigatório** (cadastro em nome de outra pessoa exige autorização);
- nome, celular e o ponto de atendimento (normalmente o GPS do agente, que está no local);
- raio de atendimento, limitado entre 0,5 e 20 km;
- a primeira oferta, que usa o nome do negócio quando o título não é informado.
'''),
('  return db().transaction(async (tx) => {', '''
Grava tudo numa transação:

- se o celular já tem conta, só a transforma em prestadora; senão, cria a conta registrando o agente em `assisted_by`;
- salva o ponto de atendimento (com o deslocamento de privacidade) e a oferta;
- grava o levantamento. `string_to_array($6, ',')` transforma "a,b" na lista do PostgreSQL.

Depois, o prestador entra com o próprio celular e encontra a conta pronta.
'''),
("r.post('/field/surveys', async", '''
Envio de um registro, quando há conexão.
'''),
('// Sincronização em lote', '''
**Envio em lote da fila offline** (até 100 itens). Cada item é processado separadamente: um registro com erro não impede os outros. A resposta diz o resultado de cada um, e a interface mantém na fila só os que falharam, com a mensagem de erro.
'''),
("r.get('/field/surveys', async", '''
Os registros feitos pelo próprio agente, para a lista "Registros enviados".
'''),
]),
('server/src/routes/institution.js', '''
Painel de indicadores para instituições parceiras e questionário de satisfação. Implementa os indicadores da Tabela 5 do artigo e o painel de Business Intelligence citado na Seção 5.5.
''', [
('// Painel para instituições', '''
Comentário com a regra principal (só dados agregados) e importações.
'''),
('async function overview() {', '''
Dez consultas em paralelo:

- `field`: negócios abordados, quantos aceitaram, quantos não aparecem em mapas e quantos não souberam responder;
- `barriers`: quantas vezes cada barreira foi citada. `unnest(barriers)` transforma a lista de cada registro em linhas, para contar;
- `maps`: levantamentos por categoria e quantos estão fora dos mapas;
- `providers`: prestadores com oferta ativa, total de prestadores, quantos vieram do cadastro assistido e quantos moradores iniciaram conversa;
- `offersByCat`: ofertas ativas por categoria;
- `contracts`: contratações por estado;
- `money`: volume concluído e comissão total;
- `rating`: média geral das avaliações;
- `satisfaction`: média de satisfação e de facilidade e porcentagem que pretende continuar, por grupo;
- `weekly`: contatos e contratações concluídas por semana nas últimas 12 semanas.

Nenhuma consulta devolve nome, telefone ou localização.
'''),
('  const pct =', '''
Calcula as porcentagens (com uma casa decimal e protegidas contra divisão por zero) e organiza a resposta. A lista por categoria junta ofertas ativas e levantamentos de campo, omitindo categorias sem nenhum dos dois.
'''),
("r.get('/institution/overview'", '''
Rota do painel, para os perfis instituição e moderador.
'''),
('// Exportação para planilha', '''
**Exportação CSV** para análise em planilha. Cada indicador vira uma linha (seção, indicador, valor).
'''),
("  const csv = '\\uFEFF'", '''
Detalhes para o arquivo abrir certo no **Excel em português no Windows**:

- `\\uFEFF` (BOM) no início avisa que o arquivo é UTF-8; sem ele o Excel embaralha os acentos;
- separador `;` (o Excel brasileiro usa vírgula como decimal, então espera ponto e vírgula entre colunas);
- valores entre aspas, com aspas internas duplicadas;
- quebra de linha `\\r\\n`, padrão do Windows.

O cabeçalho `Content-Disposition: attachment` faz o navegador baixar o arquivo com o nome indicado.
'''),
('// Plano de aplicação, etapa 3', '''
Diz à tela de perfil se o usuário já respondeu o questionário.
'''),
("r.post('/satisfaction'", '''
Grava as respostas do questionário: grupo, satisfação e facilidade de 1 a 5, intenção de continuar (sim ou não, obrigatória) e comentário.
'''),
]),
('server/src/routes/meta.js', '''
Informações fixas que a interface precisa ao abrir.
''', [
("import { Router } from 'express'", '''
Importações.
'''),
('const DEMO_ACCOUNTS', '''
Atalhos da tela de login com as personas do artigo e os perfis de equipe.
'''),
("r.get('/meta'", '''
Devolve categorias, bairro piloto, opções de raio, taxa de comissão, planos de destaque, barreiras e motivos de denúncia. Com isso a interface não repete essas listas e tudo se mantém sincronizado com o servidor.
As contas de demonstração só são enviadas no modo `dev`.
'''),
]),
]
