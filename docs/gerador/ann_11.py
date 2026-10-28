SLUG = '11-telas-morador-e-chat'
TITLE = '11. Telas: entrada, busca, oferta e chat'
INTRO = '''
As telas por onde passa o morador contratante (persona Thiago) e onde acontece a negociação com o prestador.
Cada tela é um componente exportado com `export default` e ligado a um endereço em `main.jsx`.
'''
FILES = [
('web/src/pages/Login.jsx', '''
Tela de entrada por celular (RF01), em três passos: celular, código e, se for conta nova, nome.
''', [
('// RF01', '''
Comentário e importações.
'''),
('export default function Login() {', '''
Estados da tela: o passo atual, o celular, o código, o código de demonstração, o nome, se quer oferecer serviços, se está enviando e o erro. `from` é a tela para onde voltar depois de entrar.
'''),
('  if (user) return', '''
Quem já está logado é levado direto ao destino.
'''),
('  async function requestCode(', '''
Pede o código ao servidor. No modo demonstração o código volta na resposta e já é preenchido. O segundo parâmetro permite que os atalhos de demonstração peçam o código para um número sem esperar o estado ser atualizado.
'''),
('  async function verify(e)', '''
Confirma o código. Se o servidor responder `needsName`, avança para o passo do nome; senão, guarda a sessão e volta para a tela de origem.
'''),
('  return (', '''
Cartão central com a marca e a frase da proposta de valor.
'''),
("        {step === 'phone' && (", '''
**Passo 1**: campo de celular com formatação automática e `inputMode="tel"` (abre o teclado numérico no celular). O texto de ajuda reforça que não há pedido de CNPJ nem de documentos. O botão só é liberado com pelo menos 10 dígitos.
'''),
('            {meta?.demoAccounts?.length > 0 && (', '''
No modo demonstração, os atalhos das personas: um toque preenche o celular e já pede o código.
'''),
("        {step === 'code' && (", '''
**Passo 2**: botão para voltar e corrigir o número, aviso com o código no modo demonstração e campo de 6 dígitos. `autoComplete="one-time-code"` permite que o celular sugira o código recebido por SMS automaticamente.
'''),
("        {step === 'name' && (", '''
**Passo 3**, só para conta nova: nome e a opção de também oferecer serviços, com a garantia de que o endereço nunca é mostrado.
'''),
]),
('web/src/pages/Home.jsx', '''
Tela inicial e busca (RF05 e RF06). Os filtros ficam no endereço (`?q=...&categoria=...&raio=...`), então dá para compartilhar ou voltar a uma busca.
''', [
('// RF05', '''
Comentário e importações.
'''),
('export default function Home() {', '''
Estados: parâmetros da URL, ponto de busca, texto digitado, resultados, erro, carregando e quais painéis estão abertos.
'''),
('  // Na primeira visita', '''
Na primeira visita, tenta o GPS uma única vez (o navegador pergunta ao usuário). Uma marca no `localStorage` evita perguntar de novo; se a pessoa negar, fica o centro do bairro.
'''),
("  const category = params.get('categoria')", '''
Lê os filtros da URL; o raio padrão é 2 km.
'''),
('  const update = (changes) => {', '''
Muda os filtros na URL. `replace: true` evita encher o histórico do botão "voltar" a cada ajuste.
'''),
('  useEffect(() => {\n    if (!position)', '''
**A busca.** Roda sempre que ponto, raio, categoria ou texto mudam.

- espera 150 ms antes de buscar (se a pessoa mexer no controle de raio várias vezes seguidas, só a última busca é feita);
- o `AbortController` cancela a busca anterior se uma nova começar, evitando que um resultado antigo apareça depois do novo;
- a limpeza do efeito cancela o temporizador e a requisição.
'''),
('  const radiusOptions =', '''
Opções de raio vindas do servidor, a posição do controle deslizante e o título da seção, que muda conforme a busca.
'''),
('  if (!position) return null', '''
Saudação com o primeiro nome quando logado.
'''),
('      <form', '''
Caixa de busca por necessidade. A busca dispara ao enviar (Enter ou botão do teclado); apagar o texto limpa a busca.
'''),
('      <div className="chips">', '''
As categorias como botões roláveis na horizontal. Tocar de novo na categoria escolhida volta para "Todas".
'''),
('      <div className="card tight">', '''
Cartão da localização: de onde está buscando, raio atual, botão "Alterar" e botão para mostrar o mapa.
'''),
('        <input\n          type="range"', '''
Controle deslizante do raio (RF06). Ele trabalha com a posição na lista (0 a 5) e não com os quilômetros, para os passos ficarem uniformes (0,5, 1, 2, 3, 5 e 10 km). Abaixo, as marcas de cada opção.
'''),
('        {showMap && (', '''
O mapa do raio com o aviso: "o mapa não mostra onde os prestadores moram". Clicar no mapa muda o ponto de busca.
'''),
('      <div className="section-title">', '''
Título da lista e quantidade de resultados.
'''),
('      <ErrorBox error={error} />', '''
Erro e os blocos cinza animados (*skeleton*) enquanto a primeira busca carrega.
'''),
('      {results && results.length === 0 && (', '''
Nenhum resultado: sugere ampliar o raio com um botão que já passa para a próxima opção.
'''),
('      {results && results.length > 0 && (', '''
A lista de cartões. Durante uma nova busca, os resultados antigos ficam esmaecidos em vez de sumirem.
'''),
('      {showLocation && (', '''
O diálogo de escolha do ponto de busca.
'''),
]),
('web/src/pages/OfferDetail.jsx', '''
Detalhe da oferta, com o botão de conversar.
''', [
("import { useState }", '''
Importações.
'''),
('export default function OfferDetail() {', '''
Carrega a oferta enviando o ponto de busca do morador, para o servidor calcular a distância.
'''),
('  if (loading && !data)', '''
Carregando, erro e os dados recebidos. O ícone muda entre produto e serviço.
'''),
('  async function contact()', '''
**Conversar com o prestador**: sem login, vai para a entrada e volta para cá depois; com conversa já existente, abre a conversa; senão, cria e abre.
'''),
('  return (', '''
Botão de voltar.
'''),
('      {offer.images.length > 0 ? (', '''
Galeria de fotos rolável (ou um fundo com ícone, sem fotos), as etiquetas (categoria, tipo, destaque), o título, a **distância aproximada** e o preço.
'''),
('      {offer.outsideServiceArea && (', '''
Aviso quando o morador está além do raio de atendimento do prestador, sugerindo combinar pelo chat.
'''),
('      {offer.description &&', '''
A descrição, preservando as quebras de linha, e o aviso de privacidade: endereço não divulgado, negociação pelo chat, sem troca de telefone.
'''),
('      <Link to={`/prestador/', '''
Cartão do prestador com link para o perfil: nome, desde quando está na plataforma, estrelas e serviços concluídos (RF12).
'''),
('      <ErrorBox error={error} />', '''
O botão principal: "Editar minha oferta" para o dono, "Conversar" ou "Abrir conversa" para os demais.
'''),
('      {user && !isOwner && (', '''
Link de denúncia para usuários logados (RF15).
'''),
]),
('web/src/pages/ProviderProfile.jsx', '''
Perfil público do prestador (RF12).
''', [
('// RF12', '''
Comentário e importações.
'''),
('export default function ProviderProfile() {', '''
Carrega o perfil pelo id da URL.
'''),
('  return (', '''
Cabeçalho com iniciais, nome e data de entrada, e a apresentação escrita pelo prestador.
'''),
('      <div className="grid stats">', '''
Os dois números da reputação: serviços concluídos e avaliação média, com a quantidade de avaliações.
'''),
('      {offers.length ? (', '''
As ofertas ativas do prestador.
'''),
('      {reviews.length === 0 ? (', '''
As avaliações, cada uma com nota, data, comentário e o selo "contratou pela plataforma". Só quem fechou contratação pelo sistema pode avaliar, então toda avaliação vem de um serviço real.
'''),
('      {user && user.id !== provider.id && (', '''
Denúncia do perfil, para usuários logados que não sejam o próprio prestador.
'''),
]),
('web/src/pages/Conversations.jsx', '''
Lista de conversas.
''', [
("import { Link }", '''
Importações.
'''),
('export default function Conversations() {', '''
Carrega a lista e recarrega quando chega uma mensagem nova em tempo real.
'''),
('  return (', '''
Sem conversas, uma orientação de como começar. Com conversas, cada item mostra a foto da oferta, o nome da outra pessoa, há quanto tempo foi a última mensagem, o título da oferta, a prévia da última mensagem, quantas não foram lidas e o estado da contratação. Itens com mensagens não lidas ficam destacados.
'''),
]),
('web/src/pages/Chat.jsx', '''
O chat (RF07) com toda a negociação: solicitação, proposta e aceite (RF08), estados (RF09), conclusão com comissão (RF10) e avaliação (RF11). Os diálogos menores estão no próprio arquivo.
''', [
('// RF07 a RF11', '''
Comentário e importações.
'''),
('const STEPS =', '''
`Progress`: barra de progresso com os cinco estados do caminho normal. Cancelada pinta tudo de vermelho.
'''),
('function ProposalForm(', '''
**Diálogo de proposta** (prestador): valor (o filtro só deixa digitar números, vírgula e ponto), prazo (por padrão daqui a 2 dias, sem permitir datas passadas) e observações.
Se o servidor recusar, o erro aparece no próprio diálogo.
'''),
('function RequestForm(', '''
**Diálogo de solicitação** (contratante): descreve o que precisa; o prestador responde com valor e prazo.
'''),
('function ReviewBox(', '''
**Caixa de avaliação** (RF11), que aparece no fim do chat após a conclusão. O texto muda conforme quem avalia (o serviço ou o cliente). Envia nota e comentário.
'''),
('export default function Chat() {', '''
Estados da tela: dados da conversa, texto digitado, envio em andamento, diálogo aberto, ação em andamento e o aviso de contato removido. `bodyRef` aponta para a área das mensagens.
'''),
('  const markRead =', '''
Marca a conversa como lida ao abrir e atualiza o sino.
'''),
('  useEffect(() => {\n    if (bodyRef.current)', '''
Rola até o fim quando chega mensagem nova ou quando a contratação muda (por exemplo, para mostrar a caixa de avaliação).
'''),
('  useRealtime((ev, payload) => {', '''
**Tempo real.** Ignora eventos de outras conversas. Mensagem nova é acrescentada à lista (se ainda não estiver nela, porque quem enviou já a recebeu na resposta do envio) e a conversa é marcada como lida. Mudança na contratação recarrega os dados.
'''),
('  if (loading && !data)', '''
Carregando, erro e os dados.
'''),
('  async function send(e)', '''
Envia a mensagem. Se o servidor removeu dados de contato, mostra o aviso explicando por quê.
'''),
('  async function act(action, confirmText)', '''
Executa uma ação da contratação. Ações sérias (concluir, cancelar) passam primeiro por um diálogo de confirmação próprio. O `window.confirm` do navegador não é usado porque bloqueia a página e destoa do visual no celular.
'''),
('  const pendingProposal =', '''
A proposta pendente (que pode receber "Aceitar" ou "Recusar") e o atalho `can`, que consulta as ações liberadas pelo servidor.
'''),
('  return (', '''
Cabeçalho: voltar, iniciais e nome da outra pessoa (com link para o perfil, se for prestador), título da oferta e botão de denúncia.
'''),
('      {contract && (', '''
**Barra da contratação**: estado, valor e prazo, progresso e os botões que valem para esta pessoa agora (enviar ou refazer proposta, iniciar, concluir, comprovante, cancelar, nova solicitação).
Os botões dependem da lista `actions` calculada pelo servidor, então a tela nunca oferece uma ação que o servidor recusaria.
'''),
('      <div className="chat-body" ref={bodyRef}>', '''
Área das mensagens, começando com o lembrete de que contatos são removidos automaticamente. Mensagens de sistema aparecem centralizadas.
'''),
("          if (m.kind === 'proposta' && m.proposal) {", '''
**Cartão de proposta**: quem propôs, situação, valor, prazo e observações. Os botões "Aceitar" e "Recusar" só aparecem para o contratante e só na proposta pendente.
'''),
('          const mine = m.senderId === conv.me', '''
Balões de mensagem: os próprios à direita, em verde; os da outra pessoa à esquerda. Mensagens que tiveram contato removido ganham contorno tracejado.
'''),
('        {contract?.canReview &&', '''
A caixa de avaliação, quando liberada, e a confirmação da nota já dada.
'''),
('      {maskedNotice && (', '''
Aviso de que dados de contato foram removidos, explicando a vantagem de negociar pela plataforma.
'''),
('      {canRequest && !contract && (', '''
O botão "Solicitar este serviço", em destaque, quando ainda não há contratação.
'''),
('      <form className="chat-input"', '''
Campo de mensagem e botão de enviar.
'''),
("      {modal?.type === 'proposal' && (", '''
Os diálogos: proposta, solicitação, confirmação de ação e denúncia do usuário. Cada um recarrega os dados da conversa depois de concluído.
'''),
]),
]
