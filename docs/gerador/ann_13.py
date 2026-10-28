SLUG = '13-estilos'
TITLE = '13. Estilos (CSS)'
INTRO = '''
Todo o visual está num único arquivo CSS, sem biblioteca de componentes. A abordagem é *mobile first*: as regras base valem para o celular,
e blocos `@media (min-width: ...)` ajustam para telas maiores. As cores ficam em **variáveis** (`--nome`), definidas uma vez e reaproveitadas,
o que também permite o tema escuro trocando só os valores das variáveis.
'''
FILES = [
('web/src/styles.css', '''
Organizado em seções marcadas por comentários `/* ---------- nome ---------- */`.
''', [
('=:root {', '''
**Variáveis do tema claro**: fundo creme (`--bg`), superfícies brancas, texto quase preto, verde-petróleo como cor principal (`--primary`), laranja como destaque (`--accent`) e as cores de erro, sucesso, alerta e estrelas, cada uma com uma versão clara (`-soft`) para fundos.
Também a sombra, os raios das bordas e a altura da navegação inferior. `color-scheme` avisa o navegador para desenhar campos e barras de rolagem no tema certo.
'''),
('=@media (prefers-color-scheme: dark) {', '''
**Tema escuro automático**: se o aparelho estiver em modo escuro, as mesmas variáveis recebem tons escuros, e o verde e o laranja ficam mais claros para manter o contraste. Nenhuma outra regra precisa mudar.
'''),
('=* {', '''
`box-sizing: border-box` faz largura e altura incluírem borda e espaçamento interno, o que torna o layout previsível.
'''),
('=html,', '''
Base da página: fundo e texto pelas variáveis, fonte do sistema (Segoe UI no Windows, Roboto no Android, San Francisco no iPhone), tamanho 16 px (abaixo disso o iPhone dá zoom ao tocar nos campos) e remoção do realce azul ao tocar em links no celular.
Em seguida, estilos dos links, títulos, parágrafos e imagens (que nunca passam da largura disponível).
'''),
('/* ---------- estrutura', '''
**Estrutura.** `.app` ocupa a altura toda da tela (`100dvh`, que considera a barra de endereço do celular).
'''),
('=.topbar {', '''
**Barra superior** fixa no topo ao rolar (`position: sticky`), verde, com a marca. `env(safe-area-inset-top)` afasta o conteúdo do entalhe da câmera nos celulares.
'''),
('=.topnav {', '''
Navegação no topo, escondida no celular e mostrada no computador, com o item atual destacado.
'''),
('=.icon-btn {', '''
Botão redondo só com ícone (sino, voltar, fechar) e a bolinha laranja com o número de notificações (`.dot`).
'''),
('=.main {', '''
Área de conteúdo: largura máxima de 980 px centralizada e espaço inferior para a navegação fixa não cobrir o fim da página.
'''),
('=.bottomnav {', '''
**Navegação inferior** do celular, fixa embaixo, com espaço para a barra de gestos (`safe-area-inset-bottom`). O item ativo fica verde, com um traço em cima (`::before`).
'''),
('=@media (min-width: 900px) {', '''
Em telas a partir de 900 px (computador), a navegação vai para o topo e a inferior some.
'''),
('=.offline-bar {', '''
Faixa amarela de sem conexão.
'''),
('/* ---------- blocos', '''
**Blocos**: o cartão (`.card`) com borda, raio e sombra, e o espaçamento automático entre cartões seguidos (`.card + .card`).
'''),
('=.section-title {', '''
Título de seção com elemento à direita (por exemplo, "16 encontrados").
'''),
('=.row {', '''
**Utilitários**: linha flexível com espaçamento (`.row`), variações de quebra e distribuição, `.grow` (ocupa o espaço restante), tamanhos e pesos de texto, centralização, texto em uma linha com reticências (`.ellipsis`) e margens.
'''),
('=.grid {', '''
**Grades**: no celular, uma coluna; a partir de 640 px, `.grid.two` vira duas colunas e `.grid.stats` vira quatro (os números dos painéis). `align-items: start` evita que um cartão curto estique para acompanhar o vizinho.
'''),
('/* ---------- botões', '''
**Botões**: formato de pílula com altura mínima de 44 px (tamanho recomendado para o dedo), transição suave e leve afundamento ao pressionar. Variações: contorno (`outline`), transparente (`ghost`), laranja (`accent`), perigo (`danger`), pequeno (`sm`) e largura total (`block`). Desabilitado fica translúcido.
'''),
('=.field {', '''
**Campos de formulário**: rótulo em negrito, texto de ajuda e o estilo comum de campos de texto, listas e áreas de texto. Ao receber o foco, a borda fica verde com um halo. O campo de código usa letras espaçadas e números de largura fixa.
'''),
('=.search-box {', '''
Caixa de busca arredondada com o ícone de lupa posicionado dentro do campo.
'''),
('=.checkbox {', '''
Caixas de seleção grandes (20 px) na cor principal (`accent-color`) e o controle segmentado (botões lado a lado, como "Sim / Não / Não sabe"), com a opção escolhida em destaque. Também o controle deslizante na cor principal.
'''),
('=.error {', '''
Caixas de mensagem: erro (vermelho) e avisos (`.notice`) nas variações verde, amarela e laranja, com ícone à esquerda.
'''),
('/* ---------- chips', '''
**Chips de categoria**: faixa rolável na horizontal, sem barra de rolagem visível, que se estende até as bordas da tela (as margens negativas compensam o espaçamento da página). O chip escolhido fica verde.
'''),
('=.badge {', '''
**Etiquetas** pequenas (categoria, estado, destaque) nas cores do tema, a distância em verde e negrito, as estrelas amarelas e as estrelas clicáveis da avaliação.
'''),
('/* ---------- ofertas', '''
**Ofertas**: a lista é uma coluna no celular e duas a partir de 720 px. O cartão tem miniatura à esquerda e borda verde ao passar o mouse; o cartão em destaque ganha borda laranja.
'''),
('=.thumb {', '''
Miniatura quadrada; a foto preenche o quadrado sem distorcer (`object-fit: cover`).
'''),
('=.gallery {', '''
Galeria de fotos da oferta, rolável na horizontal e "encaixando" em cada foto (`scroll-snap`). Sem fotos, um fundo em degradê com ícone. Também os quadrados do seletor de fotos com o botão de remover.
'''),
('/* ---------- listas', '''
**Listas** (conversas, contratações, notificações): itens com divisória, realce ao passar o mouse e fundo verde claro para não lidos. Os botões que funcionam como item de lista têm o estilo padrão de botão zerado.
'''),
('=.avatar {', '''
Círculo das iniciais, em dois tamanhos, e o estado vazio (ícone, título e texto centralizados).
'''),
('/* ---------- chat', '''
**Chat**: ocupa a altura disponível descontando barra superior e navegação, para que só as mensagens rolem e o campo de digitar fique sempre visível.
'''),
('=.chat-head {', '''
Cabeçalho do chat e a área de mensagens rolável, em coluna.
'''),
('=.bubble {', '''
**Balões**: os da outra pessoa à esquerda, brancos; os próprios à direita, verdes. `white-space: pre-wrap` preserva as quebras de linha digitadas. O balão com contato removido ganha contorno tracejado amarelo.
'''),
('=.sys-msg {', '''
Mensagens de sistema centralizadas e discretas, o cartão de proposta laranja com o valor em destaque, o campo de digitar, a barra da contratação e a barra de progresso dos estados (vermelha quando cancelada).
'''),
('/* ---------- painéis', '''
**Painéis**: cartão de número (rótulo, valor grande com algarismos de largura fixa e texto auxiliar).
'''),
('=.bars {', '''
**Gráfico de barras**: cada barra é uma coluna flexível com as duas séries lado a lado, alinhadas na base; as alturas vêm do componente em porcentagem. Legenda com quadradinhos de cor.
'''),
('=.hbar {', '''
Barra horizontal de proporção (trilho cinza e preenchimento verde ou laranja).
'''),
('=.tabs {', '''
Abas com sublinhado na aba ativa, roláveis se não couberem na tela.
'''),
('/* ---------- mapa', '''
**Mapa**: altura fixa, bordas arredondadas e a fonte do sistema também dentro do Leaflet.
'''),
('/* ---------- modal', '''
**Diálogos**: fundo escurecido cobrindo a tela; no celular a janela sobe de baixo (como as folhas dos aplicativos nativos) e no computador fica centralizada.
'''),
('=.toast {', '''
**Aviso rápido**: flutua acima da navegação, com animação de entrada e versões de erro e sucesso.
'''),
('=.skeleton {', '''
Blocos de carregamento com brilho animado e o ícone girando (`.spin`).
'''),
('/* ---------- login', '''
**Tela de entrada**: cartão centralizado sobre um degradê suave e os botões das contas de demonstração.
'''),
('/* ---------- comprovante', '''
**Comprovante**: linhas com rótulo e valor separadas por tracejado, total em destaque e o código em fonte monoespaçada.
'''),
('=@media print {', '''
**Impressão** (ou "salvar como PDF"): esconde barras, navegação e botões, e usa fundo branco e texto preto, para o comprovante sair limpo.
'''),
]),
]
