SLUG = '06-rotas-chat-e-contratacao'
TITLE = '6. Rotas da API: chat, contratação, comissão e avaliação'
INTRO = '''
O arquivo `server/src/routes/conversations.js` concentra o caminho principal do sistema: o morador conversa com o prestador (RF07),
solicita o serviço, recebe e aceita uma proposta (RF08), a contratação passa pelos estados (RF09), é concluída com apuração da comissão (RF10)
e os dois se avaliam (RF11). Tudo o que muda estado acontece dentro de **transações**, para nunca ficar pela metade.
'''
FILES = [
('server/src/routes/conversations.js', '''
Organizado em três partes: funções auxiliares, rotas de conversa e rotas de contratação.
''', [
('// RF07 (chat interno)', '''
Importações. Repare em `maskContacts` (filtro de contatos), `nextStatus` e `availableActions` (máquina de estados), `computeCommission` (comissão) e `emitTo` (tempo real).
'''),
('const r = Router()', '''
Cria o roteador e exige login em todas as rotas que começam com `/conversations` ou `/contracts`.
'''),
('// ---------- helpers ----------', '''
`localYmd` monta a data local no formato `AAAA-MM-DD`. Usar a data local, e não a de Greenwich (UTC), evita que depois das 21h no horário de Brasília o sistema já considere "amanhã".
'''),
('function serializeMessage(m) {', '''
Converte uma mensagem do banco para o formato da interface. Mensagens de proposta levam junto os dados da proposta (valor, prazo, observações e situação), para virar um cartão no chat.
'''),
('const MESSAGE_SELECT', '''
Consulta-base das mensagens, já ligada à tabela de propostas. `to_char(p.deadline, 'YYYY-MM-DD')` devolve o prazo como texto, sem conversão de fuso.
'''),
('async function loadConversation(id, userId) {', '''
Carrega a conversa com título e foto da oferta e os nomes das duas partes. **Controle de acesso**: se o usuário não for o contratante nem o prestador daquela conversa, responde "não encontrada" (404). Ninguém lê a conversa dos outros, e a resposta nem confirma que ela existe.
'''),
('async function insertMessage(', '''
Grava uma mensagem e atualiza a data da última mensagem da conversa (que ordena a lista). Recebe `run` para funcionar dentro ou fora de uma transação.
'''),
('async function broadcastMessage(conv, messageId) {', '''
Lê a mensagem gravada e a envia em tempo real para as duas partes. Enviar também ao remetente mantém sincronizadas as outras abas ou aparelhos dele.
'''),
('function serializeContract(c, userId) {', '''
Converte a contratação para a interface **do ponto de vista de quem pede**: `side` diz se a pessoa é contratante ou prestador, `counterpart` é a outra parte e `actions` são os botões que ela pode usar agora.
'''),
('const CONTRACT_SELECT', '''
Consulta-base das contratações, com título da oferta e nomes das partes.
'''),
('async function loadContract(id, userId) {', '''
Carrega uma contratação com o mesmo controle de acesso da conversa: só as duas partes enxergam.
'''),
('async function contractDetails(c, userId) {', '''
Monta o detalhe completo. O `Promise.all` executa as quatro consultas ao mesmo tempo: histórico de estados, propostas, comissão e avaliações.
'''),
('  const base = serializeContract(c, userId)', '''
Junta tudo:

- `events`: a linha do tempo da contratação;
- `proposals`: todas as propostas e a situação de cada uma;
- `commission`: os valores apurados, quando concluída;
- `myReview`, `counterpartReviewed` e `canReview`: se o usuário já avaliou, se a outra parte já avaliou e se a avaliação está liberada (só depois de concluída e uma vez por pessoa).
'''),
('async function pushContractUpdate(c) {', '''
Avisa as duas partes, em tempo real, que a contratação mudou. A tela do chat recarrega os dados ao receber o aviso.
'''),
('// ---------- conversas ----------', '''
**Iniciar conversa** sobre uma oferta. Recusa oferta inexistente, inativa ou de prestador bloqueado, e impede conversar com a própria oferta.
'''),
("  let conv = await one('SELECT * FROM conversations WHERE offer_id", '''
Se já existe conversa entre essa pessoa e essa oferta, reaproveita (a tabela também garante isso com `UNIQUE`). Se é nova, cria e notifica o prestador.
Cada conversa nova conta como "contato iniciado" no painel do prestador (RF14).
'''),
("r.get('/conversations', async", '''
**Lista de conversas** do usuário, como contratante ou como prestador. Para cada uma: o nome da outra parte (o `CASE` escolhe qual), a última mensagem, quantas não foram lidas (mensagens da outra parte com id maior que o último lido) e o estado da contratação mais recente. Ordenada pela mensagem mais recente.
'''),
("r.get('/conversations/:id', async", '''
**Abrir conversa**: dados da conversa, todas as mensagens em ordem, a contratação mais recente com todos os detalhes e `canRequest`, que diz se o contratante pode solicitar o serviço (não há outra contratação em aberto).
'''),
("r.post('/conversations/:id/messages'", '''
**Enviar mensagem** (RF07). O texto é validado (até 1.000 caracteres) e passa pelo `maskContacts` **antes de ser gravado**: o telefone nunca chega ao banco nem ao destinatário.
'''),
('  if (masked) {', '''
Se algo foi removido, cria uma **denúncia automática** (sem denunciante, motivo "negociação externa") para a moderação acompanhar (RF15).
'''),
('  await q(', '''
Marca a própria mensagem como lida para quem enviou.
'''),
('  const message = await broadcastMessage(conv, id)', '''
Envia a mensagem em tempo real e cria a notificação para a outra parte, com uma prévia de até 90 caracteres.
'''),
("r.post('/conversations/:id/read'", '''
Marca a conversa como lida até a última mensagem e também as notificações que apontam para ela, zerando o número no sino.
'''),
('// ---------- contratação ----------', '''
Separador das rotas de contratação.
'''),
('// O contratante solicita o serviço', '''
**Solicitar serviço.** Só o contratante pode, e só se não houver outra contratação em aberto na conversa (409 se houver). A descrição do pedido também passa pelo filtro de contatos.
'''),
('  const { contractId, messageId } = await db().transaction(', '''
Numa única transação: cria a contratação no estado `solicitada`, registra o primeiro evento do histórico e grava a mensagem de sistema no chat.
Fora da transação (depois que tudo foi confirmado no banco), envia a mensagem em tempo real, notifica o prestador e avisa as duas telas.
'''),
('// RF08: proposta com valor e prazo', '''
**Enviar proposta.** `nextStatus(c.status, 'propor', side)` já recusa quem não é o prestador ou um estado inválido. Depois valida:

- valor de pelo menos R$ 1,00 e no máximo R$ 100.000,00;
- prazo em formato de data válido e não anterior a hoje;
- observações passando pelo filtro de contatos.
'''),
('  const messageId = await db().transaction(async (tx) => {', '''
Na transação: marca como "substituída" a proposta anterior ainda pendente, grava a nova, muda o estado, registra o evento com valor e prazo e cria a mensagem do tipo `proposta`, que aparece como cartão no chat.
Depois notifica o contratante e atualiza as telas.
'''),
('function receiptCode() {', '''
Código do comprovante: `CB-` + data local + 6 caracteres aleatórios, por exemplo `CB-20261027-1F26CF`.
'''),
('const ACTION_MESSAGES', '''
Texto da mensagem de sistema de cada ação.
'''),
('// RF09: aceitar, recusar', '''
**Ações da contratação**: aceitar, recusar, iniciar, concluir e cancelar. Propor tem rota própria.
'''),
('  const result = await db().transaction(async (tx) => {', '''
Tudo numa transação. O `SELECT ... FOR UPDATE` **trava a linha** da contratação até o fim: se as duas partes clicarem ao mesmo tempo (por exemplo, um cancela enquanto o outro conclui), a segunda espera a primeira terminar e então é validada sobre o estado já atualizado.
Em seguida confere o acesso, descobre o lado da pessoa e valida a ação com `nextStatus`.
'''),
("    if (action === 'aceitar' || action === 'recusar') {", '''
Aceitar ou recusar exige uma proposta pendente. Ao aceitar, o valor e o prazo da proposta passam a ser os da contratação.
'''),
("    if (action === 'cancelar') {", '''
Ao cancelar, a proposta pendente (se houver) é encerrada como recusada.
'''),
("    if (action === 'concluir') {", '''
**Conclusão com comissão (RF10).** Calcula a comissão de 6% sobre o valor aceito e grava valor bruto, taxa, comissão, líquido e o código do comprovante. Por estar na mesma transação da mudança de estado, não existe contratação concluída sem comissão nem comissão sem contratação concluída.

Depois, para qualquer ação: atualiza o estado (e a data de conclusão, se for o caso) e registra o evento no histórico.
'''),
('    let body = ACTION_MESSAGES[action]', '''
Monta a mensagem de sistema do chat. Na conclusão, ela informa valor e comissão e convida os dois a se avaliarem.
'''),
('  const { c, to, messageId } = result', '''
Depois da transação: envia a mensagem em tempo real e notifica a outra parte da mudança.
'''),
("  if (to === 'concluida') {", '''
Na conclusão, as duas partes recebem a notificação pedindo a avaliação. Por fim, recarrega a contratação, avisa as telas e devolve o detalhe atualizado.
'''),
("r.get('/contracts', async", '''
Lista de contratações do usuário, dos dois lados, da mais recente para a mais antiga.
'''),
("r.get('/contracts/:id', async", '''
Detalhe de uma contratação.
'''),
('// RF10: comprovante', '''
**Comprovante.** Só existe depois da conclusão (antes, responde 404 explicando). Disponível para as duas partes.
'''),
('// RF11: avaliação recíproca', '''
**Avaliação mútua.** Exige contratação concluída, nota inteira de 1 a 5 e uma única avaliação por pessoa. O comentário passa pelo filtro de contatos.
O avaliado é sempre a outra parte; ele recebe uma notificação com a nota.
'''),
('export default r', '''
Exporta o roteador.
'''),
]),
]
