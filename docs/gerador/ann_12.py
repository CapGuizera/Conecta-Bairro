SLUG = '12-telas-prestador-e-equipe'
TITLE = '12. Telas: contratações, prestador, perfil e equipe'
INTRO = '''
As telas de acompanhamento (contratações, comprovante, notificações, perfil), as do prestador (painel e formulário de oferta)
e as da equipe do projeto (cadastro de campo, moderação e indicadores).
'''
FILES = [
('web/src/pages/Contracts.jsx', '''
Lista de contratações, em abas.
''', [
("import { useState }", '''
Importações e a cor da etiqueta de cada estado.
'''),
('export default function Contracts() {', '''
Carrega a lista (e recarrega a cada mudança em tempo real) e filtra pela aba escolhida: rolando (em aberto), concluídas ou canceladas. Na navegação esta tela se chama "Serviços".
'''),
('  return (', '''
As abas e a lista. Cada item mostra a oferta, o estado, a outra parte (prestador ou cliente, conforme o lado), valor e prazo ou "Aguardando proposta", e há quanto tempo mudou. Tocar abre a conversa.
'''),
]),
('web/src/pages/Receipt.jsx', '''
Comprovante da contratação concluída (RF10).
''', [
('// RF10', '''
Comentário e importações.
'''),
('export default function Receipt() {', '''
Carrega o comprovante; o servidor só o entrega às duas partes.
'''),
('  return (', '''
Botões de voltar e de imprimir. "Imprimir ou salvar PDF" usa a impressão do navegador (`window.print()`), que permite salvar em PDF. O CSS de impressão esconde a navegação e os botões (`no-print`).
'''),
('      <div className="card">', '''
O comprovante: código, emissão, serviço, partes, prazo e conclusão; em seguida o valor do serviço, a comissão de 6% e o valor líquido do prestador. A nota final deixa claro que, por ser um protótipo acadêmico, não há cobrança real.
'''),
]),
('web/src/pages/Dashboard.jsx', '''
Painel do prestador (RF14), com o plano de destaque (RF13) e a confirmação de atividade (RF16).
''', [
('// RF14', '''
Comentário e importações.
'''),
('function HighlightDialog(', '''
**Diálogo de destaque**: explica o efeito (topo da busca na categoria, com etiqueta), lista os planos como opções e avisa quando o destaque atual será prolongado.
O botão mostra o valor e deixa claro que o PIX é simulado.
'''),
('export default function Dashboard() {', '''
Estados: período do painel, edição do ponto de atendimento e oferta sendo destacada. Carrega o painel (que depende do período) e as ofertas.
'''),
('  if (!location.hasLocation || editingLocation) {', '''
Sem ponto de atendimento definido, o painel mostra primeiro o cartão "Onde você atende?". O mesmo cartão aparece ao clicar em alterar o raio.
'''),
('  if ((dash.loading', '''
Carregando, erro e o cálculo das ofertas que precisam de confirmação (RF16).
'''),
('  async function setStatus(', '''
Pausar ou reativar uma oferta, e confirmar todas as ofertas de uma vez.
'''),
('  const series =', '''
Prepara as datas do gráfico no formato dia/mês.
'''),
('  return (', '''
Título e botão "Novo anúncio".
'''),
('      {stale.length > 0 && (', '''
**Alerta de confirmação** (RF16): quantas ofertas precisam ser confirmadas e o aviso de que saem da busca aos 45 dias, com o botão "Ainda estou atendendo".
'''),
('      {(d.pending.awaitingProposal > 0', '''
Alerta de pedidos aguardando proposta e serviços em andamento, com link para as contratações.
'''),
('      <div className="row between wrap mt-lg mb">', '''
Seletor de período: 7, 30 ou 90 dias.
'''),
('      <div className="grid stats">', '''
Os quatro números do RF14, com nomes do dia a dia: "Pessoas que viram" (visualizações), "Te chamaram no chat" (contatos, com quantos pediram orçamento), "Serviços feitos" e "Você recebeu" (o líquido, com o bruto e a taxa).
A porcentagem de conversão só aparece até 100%: ela passa disso quando o mesmo cliente volta a contratar na mesma conversa, e aí a tela comemora ("tem cliente voltando!") em vez de mostrar um número que confunde.
'''),
('      <div className="card mt">', '''
O gráfico diário de visualizações e contatos e a avaliação média.
'''),
('      <div className="section-title">', '''
Cabeçalho da lista de ofertas, com o raio de atendimento atual (tocar abre a edição).
'''),
('      {myOffers.length === 0 ? (', '''
Sem ofertas, um convite para criar a primeira. Com ofertas, um cartão para cada uma com etiquetas (ativa ou pausada, destaque até quando, precisa confirmar), título, preço e os números da oferta no período.
'''),
('                <div className="row wrap mt">', '''
Ações de cada oferta: editar, pausar ou reativar, confirmar (quando necessário) e destacar.
'''),
('      {highlight && (', '''
O diálogo de destaque, que recarrega a lista ao concluir.
'''),
]),
('web/src/pages/OfferForm.jsx', '''
Formulário de nova oferta e de edição (RF02). O mesmo componente atende `/painel/ofertas/nova` e `/painel/ofertas/:id`.
''', [
('// RF02', '''
Comentário, importações, as unidades de preço oferecidas e a conversão de centavos para o texto do campo (`3500` vira `35,00`).
'''),
('export default function OfferForm() {', '''
Descobre se é edição pelo endereço e cria o estado do formulário, já com valores padrão.
'''),
('  useEffect(() => {', '''
Na edição, carrega a oferta e preenche o formulário.
'''),
('  const set = (k) =>', '''
Função genérica para atualizar um campo: aceita tanto o evento de um campo do formulário quanto um valor direto.
'''),
('  async function submit(e)', '''
Salva (`PUT` na edição, `POST` na criação) e abre a página da oferta. `replace` evita que o "voltar" retorne ao formulário.
'''),
('  if (loading) return <Loading />', '''
Título da tela.
'''),
('        <div className="segmented mb">', '''
Seleção entre serviço e produto.
'''),
('        <label className="field">', '''
Título, categoria (lista vinda do servidor) e descrição, com o lembrete de não colocar telefone nem endereço.
'''),
('        <div className="grid two">', '''
Faixa de preço e unidade. Os campos de preço aceitam só números, vírgula e ponto; o servidor faz a conversão para centavos.
'''),
('        <div className="field">', '''
Até 4 fotos.
'''),
('        <ErrorBox error={error} />', '''
Erro, botão de salvar e, na edição, o botão de excluir.
'''),
('      {confirmDelete && (', '''
Confirmação da exclusão, explicando que conversas e contratações continuam no histórico (a exclusão é lógica).
'''),
]),
('web/src/pages/Notifications.jsx', '''
Central de notificações (RF17).
''', [
('// RF17', '''
Comentário, importações e o ícone de cada tipo de notificação.
'''),
('export default function Notifications() {', '''
Carrega a lista e recarrega quando chega uma notificação nova (o número de não lidas muda).
'''),
('  if (loading && !data)', '''
Ao tocar numa notificação: marca como lida e abre a tela ligada a ela.
'''),
('  return (', '''
Título ("Avisos") e o botão "Já vi tudo", quando há não lidas.
'''),
("      {'Notification' in window", '''
Se o navegador permite notificações e a pessoa ainda não decidiu, oferece ativar os avisos do sistema operacional. O pedido de permissão só acontece com o toque no botão, pois os navegadores bloqueiam pedidos automáticos.
'''),
('      <div className="mt">', '''
A lista, com ícone, título, tempo e texto. Não lidas ficam destacadas.
'''),
]),
('web/src/pages/Profile.jsx', '''
Perfil do usuário, atalhos por perfil, questionário de satisfação, instalação do aplicativo e saída.
''', [
("import { useEffect, useState }", '''
Importações e o nome de cada perfil especial.
'''),
('// Plano de aplicação, etapa 3', '''
**Questionário de satisfação** (etapa 3 da Tabela 5): satisfação geral e facilidade com estrelas, intenção de continuar (sim ou não) e comentário. O botão só é liberado com as três perguntas respondidas.
'''),
('export default function Profile() {', '''
Estados do perfil e do questionário. `installEvent` guarda o pedido de instalação do aplicativo, quando o navegador oferece.
'''),
('  useEffect(() => {', '''
Ao abrir, consulta se o questionário já foi respondido e escuta o evento `beforeinstallprompt`, disparado pelo Chrome e pelo Edge quando o site pode ser instalado como aplicativo (PWA). O `preventDefault` guarda o pedido para usar no botão.
'''),
('  async function save(patch)', '''
Salva alterações do perfil e atualiza a sessão.
'''),
('  return (', '''
Cabeçalho com iniciais, nome, celular, data de entrada e a etiqueta do perfil especial.
'''),
('      <div className="list mb">', '''
Atalhos conforme o perfil (painel, campo, moderação, indicadores), o questionário com a situação ("Respondido, valeu!" ou "3 perguntas") e, quando possível, "Instalar o app no celular".
'''),
('      <form', '''
Edição do nome e, para prestadores, da apresentação.
'''),
("      {user.role === 'usuario' && (", '''
A opção de oferecer serviços. Ao ativar, a pessoa já é levada ao painel do prestador.
'''),
('      <button\n        className="btn danger block mt-lg"', '''
Sair da conta e o diálogo do questionário, que sabe o grupo da pessoa (prestador ou contratante).
'''),
]),
('web/src/pages/Field.jsx', '''
Cadastro de campo do agente (RF03 e RF18 e etapa 1 do Plano de Aplicação). Funciona sem internet.
''', [
('// RF03 (cadastro assistido)', '''
Comentário e importações.
'''),
('const EMPTY = {', '''
O formulário vazio, usado no início e depois de cada registro.
'''),
('function toPayload(f) {', '''
Converte o formulário no formato da API. O `clientUuid` e a data da coleta são gerados **no momento do registro**, no aparelho: é isso que garante que um registro reenviado pela fila não seja duplicado e que a data seja a da visita, não a da sincronização.
'''),
('export default function Field() {', '''
Estados: formulário, ação em andamento, erro, fila offline e o histórico de registros enviados.
'''),
('  const refreshQueue = useCallback(', '''
Lê a fila guardada no aparelho.
'''),
('  const sync = useCallback(', '''
Envia a fila quando há conexão e avisa quantos registros subiram. Se falhar, os registros simplesmente continuam na fila.
'''),
('  useEffect(() => {', '''
Ao abrir a tela, lê a fila e tenta enviar. Também envia automaticamente quando a conexão volta (evento `online`).
'''),
('  const set = (k) =>', '''
Atualizador genérico de campo (aceita caixa de seleção, campo de texto ou valor direto) e a marcação das barreiras.
'''),
('  async function gps()', '''
Registra o ponto de atendimento pelo GPS. O GPS funciona sem internet, porque usa o satélite.
'''),
('  async function submit(e)', '''
**Registrar.** Com conexão, envia direto. Se estiver offline, ou se o envio falhar por falta de conexão (erro com código 0), guarda na fila e avisa. Erros de validação do servidor aparecem na tela para correção.
'''),
('  const valid =', '''
O botão só é liberado com os dados obrigatórios: negócio, categoria, mapas e a decisão de cadastro; se aceitou, também consentimento, nome, celular e ponto.
'''),
('  return (', '''
Título e explicação de que funciona sem internet.
'''),
('      {queue.length > 0 && (', '''
Aviso da fila: quantos registros aguardam envio, os erros de cada um (se houver) e o botão "Enviar agora".
'''),
('      <form className="card" onSubmit={submit}>', '''
**Parte 1, o levantamento**: nome do negócio, categoria, se aparece em mapas digitais (o indicador principal do artigo), as barreiras declaradas e observações.
'''),
('        <h2 className="mt-lg">2.', '''
**Parte 2, o cadastro**: aceitou ou não.
'''),
('        {f.accepted && (', '''
Se aceitou: o termo de consentimento (obrigatório), nome e celular do prestador, o ponto de atendimento (GPS ou mapa, este só com internet, já que os blocos do mapa vêm da rede) e o raio de atendimento.
'''),
('            <h3>Primeira oferta</h3>', '''
A primeira oferta: tipo, título (se vazio, usa o nome do negócio), descrição e preço.
'''),
('        <ErrorBox error={error} />', '''
Erro e botão de registrar.
'''),
('      <div className="section-title">', '''
Histórico dos registros já enviados pelo agente, com a situação de cada um.
'''),
]),
('web/src/pages/Moderation.jsx', '''
Fila de denúncias da moderação (RF15).
''', [
('// RF15', '''
Comentário, importações e as providências disponíveis para cada tipo de alvo.
'''),
('function ResolveDialog(', '''
**Diálogo de decisão**: procedente ou improcedente; se procedente, a providência (incluindo "Apenas registrar"); e a justificativa, que é enviada ao responsável quando há advertência ou remoção.
'''),
('export default function Moderation() {', '''
Carrega as denúncias da aba escolhida.
'''),
('  return (', '''
As abas (abertas, com a quantidade; procedentes; improcedentes).
'''),
('      {loading && !data', '''
Cada denúncia mostra o motivo, data e quem denunciou ("Sistema (automático)" para o filtro do chat), o item denunciado com link e texto, os detalhes e o botão "Analisar" ou a decisão já tomada.
'''),
('      {resolving && (', '''
O diálogo de decisão, que recarrega a fila ao concluir.
'''),
]),
('web/src/pages/Institution.jsx', '''
Indicadores do bairro para instituições parceiras, organizados pelas três etapas da Tabela 5 do artigo.
''', [
('// Painel para instituições', '''
Comentário e importações.
'''),
('const pct =', '''
Formatação de porcentagem com vírgula.
'''),
('async function downloadCsv()', '''
Baixa a planilha. Um link comum não serve porque a rota exige o token no cabeçalho; por isso o arquivo é buscado com `fetch`, transformado num objeto temporário (`Blob`) e "clicado" por um link criado na hora.
'''),
('export default function Institution() {', '''
Carrega os indicadores e calcula as escalas das barras (o maior valor de cada gráfico).
'''),
('  return (', '''
Título, aviso de que os dados são agregados e o botão de exportar.
'''),
('      <div className="section-title">\n        <h2>Etapa 1', '''
**Etapa 1, validação do problema**: negócios levantados, proporção ausente dos mapas, cadastrados e taxa de conversão; as barreiras declaradas em ordem de frequência; e, por categoria, ofertas ativas comparadas com os levantamentos de campo.
'''),
('      <div className="section-title">\n        <h2>Etapa 2', '''
**Etapa 2, validação da solução**: prestadores ativos (e quantos vieram do cadastro assistido), moradores que fizeram contato, contratações concluídas e volume movimentado; gráfico semanal; contratações por estado e avaliação média.
'''),
('      <div className="section-title">\n        <h2>Etapa 3', '''
**Etapa 3, satisfação**: para contratantes e prestadores, satisfação geral, facilidade de uso e intenção de continuar, com o número de respostas.
'''),
]),
('web/src/pages/NotFound.jsx', '''
Página para endereços inexistentes.
''', [
("import { Link }", '''
Mensagem "Página não encontrada" com botão para voltar ao início.
'''),
]),
]
