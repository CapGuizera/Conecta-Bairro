SLUG = '10-interface-componentes'
TITLE = '10. Interface web: componentes'
INTRO = '''
Peças reaproveitadas pelas telas: layout, elementos visuais, mapas e diálogos. Em JSX, `className` é o equivalente ao `class` do HTML,
`{...}` insere um valor JavaScript e `{condição && <Elemento/>}` mostra o elemento só quando a condição é verdadeira.
'''
FILES = [
('web/src/components/Layout.jsx', '''
Moldura de todas as telas: barra superior, aviso de sem conexão, conteúdo, navegação inferior e aviso rápido.
''', [
("import { useEffect, useState }", '''
Importações, incluindo os ícones da navegação.
'''),
('function navItems(user) {', '''
Define os itens de navegação conforme quem está logado: visitante vê Início e Entrar; usuário vê Início, Conversas e Serviços (as contratações), mais um item do seu perfil (Campo, Moderação, Indicadores ou, para prestadores, Painel) e Perfil.
'''),
('export function Layout() {', '''
Estados do layout: usuário, número de notificações, aviso rápido, se há conexão e o endereço atual.
'''),
('  useEffect(() => {\n', '''
Acompanha a conexão com os eventos `online` e `offline` do navegador; a limpeza remove os ouvintes ao sair.
'''),
('  useEffect(() => {\n    if (!toast)', '''
Esconde o aviso rápido depois de 4,5 segundos.
'''),
('  useEffect(() => {\n    window.scrollTo', '''
Volta ao topo a cada troca de tela. As chaves `{ }` são necessárias: no Chromium recente `window.scrollTo` devolve uma `Promise`, e um efeito do React só pode devolver uma função de limpeza.
'''),
('  const items = navItems(user)', '''
Barra superior com a marca em forma de **placa de rua** ("Sorocaba" em cima, "ConectaBairro" embaixo; o `aria-label` diz a leitores de tela que ela leva ao início) e, em telas largas (computador), os itens de navegação no topo. O sino com o número de não lidas aparece para quem está logado.
'''),
('      {!online && (', '''
Faixa amarela de sem conexão. Para o agente de campo, explica que os cadastros serão guardados e enviados depois.
'''),
('      <main className="main">', '''
`<Outlet />` é onde o React Router desenha a tela atual.
'''),
('      <nav className="bottomnav"', '''
Navegação inferior (no celular) e o aviso rápido, que some ao ser tocado. `role="status"` faz leitores de tela anunciarem o aviso.
'''),
]),
('web/src/components/ui.jsx', '''
Componentes visuais pequenos usados em várias telas e o *hook* `useLoad`.
''', [
("import { useCallback", '''
Importações.
'''),
('export function Stars(', '''
Estrelas da avaliação: arredonda a média para escolher quantas preencher, mostra a nota com vírgula e, opcionalmente, a quantidade de avaliações.
'''),
('export function StarInput(', '''
Estrelas clicáveis para dar nota. Cada botão tem rótulo ("3 estrelas") para leitores de tela.
'''),
('export function Empty(', '''
Mensagem para listas vazias, com ícone, título e texto opcional.
'''),
('export function Modal(', '''
Janela sobreposta (diálogo). Fecha com a tecla Esc ou ao clicar fora (`e.target === e.currentTarget` confere que o clique foi no fundo, não dentro da janela). Os atributos `role` e `aria-modal` informam leitores de tela.
'''),
('export function Avatar(', '''
Círculo com as iniciais do nome (por exemplo, "CB" para Cleusa Batista), numa cor tirada do próprio nome (`avatarColors`): cada pessoa tem sempre a mesma cor, e a lista de conversas não fica toda igual. O sistema não pede foto de perfil.
'''),
('export function Loading(', '''
Indicador de carregamento e caixa de erro.
'''),
('// tone:', '''
Cartão de número (estatística) dos painéis. Opcionalmente leva um ícone ao lado do rótulo, num quadradinho colorido (`tone`: azul, amarelo, verde, laranja ou ameixa). Cada número do painel tem uma cor diferente, o que ajuda a achar o que se procura sem ler tudo.
'''),
('// Gráfico de barras simples', '''
Gráfico de barras feito só com CSS, sem biblioteca: cada barra tem altura proporcional ao maior valor da série (`max`). Mostra até duas séries lado a lado, com legenda e o valor no `title` (aparece ao passar o mouse).
'''),
('export function HBar(', '''
Barra horizontal de proporção, usada no painel de indicadores.
'''),
('// Carrega dados assíncronos', '''
`useLoad` padroniza o carregamento de dados das telas: devolve os dados, o erro, se está carregando, `reload` para buscar de novo e `setData` para ajustar os dados localmente.
`setData` aceita um valor ou uma função que recebe os dados atuais (como o `setState` do React); o chat usa essa forma para acrescentar mensagens sem perder as que já estão na tela.
'''),
]),
('web/src/components/OfferCard.jsx', '''
Cartão de oferta da lista de resultados.
''', [
("import { Link }", '''
Importações.
'''),
('export function Thumb(', '''
Miniatura: a primeira foto da oferta ou, sem foto, o ícone da categoria (bolo, tesoura, chave inglesa...) no fundo da cor da categoria (`catStyle`). Junta o estilo da cor com o tamanho, quando a tela pede um tamanho diferente. `loading="lazy"` só baixa a imagem quando ela chega perto da tela.
'''),
('export function OfferCard(', '''
O cartão inteiro é um link para a oferta. Mostra a categoria (etiqueta na cor dela), a etiqueta Destaque com megafone (e borda amarela), título, **distância aproximada**, nome do prestador, preço, estrelas e quantidade de serviços concluídos.
'''),
]),
('web/src/components/Maps.jsx', '''
Mapas com Leaflet e OpenStreetMap. Por decisão de projeto, nenhum mapa mostra onde os prestadores estão.
''', [
('// Mapas com Leaflet', '''
Comentário com a regra de privacidade, o CSS do Leaflet e os componentes do `react-leaflet`.
'''),
('const TILE =', '''
Endereço dos blocos de imagem do OpenStreetMap e o crédito obrigatório pela licença deles.
'''),
('function zoomForRadius(km)', '''
Escolhe o zoom para o raio caber no mapa: quanto maior o raio, mais afastado.
'''),
('function Recenter(', '''
Componente invisível que move o mapa quando o ponto ou o zoom mudam. `useMap()` dá acesso ao mapa do Leaflet.
'''),
('function ClickToPick(', '''
Componente invisível que avisa onde a pessoa clicou no mapa.
'''),
('export function RadiusMap(', '''
Mapa da busca: o círculo do raio e o ponto do **próprio morador**. Mais nada. A rolagem do mouse fica desligada para não atrapalhar a rolagem da página.
'''),
('export function PickPointMap(', '''
Mapa para escolher um ponto (morador escolhendo de onde busca, prestador marcando onde atende). Mostra o ponto escolhido e, se informado, o raio de atendimento.
'''),
]),
('web/src/components/LocationDialog.jsx', '''
Diálogo "De onde você está buscando?" da tela inicial.
''', [
("import { useState }", '''
Importações.
'''),
('// Escolha do ponto de busca', '''
Três opções: GPS, ponto clicado no mapa ou centro do bairro.
'''),
('  async function useGps()', '''
Pede a localização ao navegador e salva; se falhar, mostra o motivo (por exemplo, GPS indisponível pelo IP da rede local).
'''),
('  return (', '''
Botão do GPS, o mapa para clicar e os botões "Centro do bairro" e "Usar este ponto" (habilitado só depois de clicar no mapa).
'''),
]),
('web/src/components/ReportDialog.jsx', '''
Diálogo de denúncia (RF15), usado na oferta, no perfil e no chat.
''', [
("import { useState }", '''
Importações.
'''),
('// RF15', '''
Estados do formulário: motivo, detalhes, enviando e erro.
'''),
('  async function submit(e)', '''
Envia a denúncia. `e.preventDefault()` impede o formulário de recarregar a página (comportamento padrão do HTML).
'''),
('  return (', '''
Os motivos vêm do servidor (`meta.reportReasons`), como opções de escolha única. O botão só é liberado depois de escolher um motivo.
'''),
]),
('web/src/components/ImagePicker.jsx', '''
Escolha de fotos da oferta (RF02).
''', [
("import { useRef }", '''
Importações.
'''),
('// Reduz a foto', '''
`resize` reduz a foto **no próprio aparelho** antes do envio: desenha a imagem num `canvas` com o lado maior em até 1.280 pixels e gera um JPEG com qualidade 82%.
Uma foto de celular de 4 MB vira algo como 200 KB, economizando o plano de dados de quem está publicando.
'''),
('export function ImagePicker(', '''
`onFiles` reduz cada foto escolhida, respeitando o limite de 4, e limpa o campo para permitir escolher a mesma foto de novo.
'''),
('  return (', '''
Mostra as miniaturas com botão de remover e um botão "+" que abre o seletor de arquivos (escondido) aceitando JPG, PNG e WEBP.
'''),
]),
('web/src/components/ProviderLocation.jsx', '''
Cartão "Onde você atende?" do painel do prestador (RF04).
''', [
('// RF04', '''
Comentário e importações.
'''),
('export function ProviderLocation(', '''
Estados: ponto escolhido, raio, ação em andamento e erro.
'''),
('  async function gps()', '''
"Estou no local de atendimento agora": usa o GPS do aparelho.
'''),
('  async function save()', '''
Com ponto novo, salva ponto e raio (`PUT`); sem ponto novo, só o raio (`PATCH`). O servidor responde apenas que a localização existe, sem as coordenadas.
'''),
('  return (', '''
A explicação de privacidade para o prestador (o que os vizinhos veem e o que não veem), o botão de GPS, o mapa, o controle do raio de 0,5 a 20 km e os botões.
O texto do botão muda conforme o que será salvo.
'''),
]),
]
