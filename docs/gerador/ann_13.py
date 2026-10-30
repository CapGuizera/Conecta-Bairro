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
**Variáveis do tema claro.** A identidade parte de duas coisas da rua: o **azul das placas de rua** (`--primary`, com letra branca) e o **amarelo dos ipês** (`--accent`), sobre um fundo cor de papel (`--bg`).
O amarelo é claro demais para texto branco, por isso tem `--accent-ink` (texto escuro por cima dele) e `--accent-text` (amarelo escurecido, legível sobre fundo claro). Há também as cores de erro, sucesso, alerta e estrelas, cada uma com uma versão clara (`-soft`) para fundos.

`--bar` é a cor da barra do topo: no claro é o mesmo azul de placa; no escuro fica um azul fechado (se usasse o azul clarinho do modo escuro, a barra viraria uma faixa clara ofuscante). `--orange` e `--plum` são as cores extras dos ícones dos painéis.

O resto: sombra quase imperceptível (só uma linha embaixo, sem o "cartão flutuando" típico de modelo pronto), cantos discretos de 8 a 10 px, altura da navegação inferior e as duas fontes:

- **Figtree** no texto: simples, amigável e com números fáceis de ler nos preços;
- **Bricolage Grotesque** nos títulos e números grandes: tem personalidade, foge do visual genérico.

As duas vêm instaladas pelo npm (`@fontsource-variable/...`) e são servidas pelo próprio sistema, então funcionam sem internet. `color-scheme` avisa o navegador para desenhar campos e barras de rolagem no tema certo.
'''),
('=@media (prefers-color-scheme: dark) {', '''
**Tema escuro automático**: se o aparelho estiver em modo escuro, as mesmas variáveis recebem tons escuros, e o azul e o amarelo ficam mais claros para manter o contraste. Nenhuma outra regra precisa mudar.
'''),
('=* {', '''
`box-sizing: border-box` faz largura e altura incluírem borda e espaçamento interno, o que torna o layout previsível.
'''),
('=html,', '''
Base da página: fundo e texto pelas variáveis, a fonte do texto (se ela não carregar, cai na do sistema: Segoe UI no Windows, Roboto no Android), tamanho 16 px (abaixo disso o iPhone dá zoom ao tocar nos campos) e remoção do realce azul ao tocar em links no celular.
Em seguida, estilos dos links, dos títulos (na fonte de título, com letras um pouco mais juntas), parágrafos e imagens (que nunca passam da largura disponível).
'''),
('/* ---------- estrutura', '''
**Estrutura.** `.app` ocupa a altura toda da tela (`100dvh`, que considera a barra de endereço do celular).
'''),
('=.topbar {', '''
**Barra superior** fixa no topo ao rolar (`position: sticky`), na cor `--bar`. `env(safe-area-inset-top)` afasta o conteúdo do entalhe da câmera nos celulares.

A marca `.sign` imita uma **placa de rua**: borda branca e, por dentro dela, um segundo filete na cor de fundo (`box-shadow: inset`), que dá o efeito de moldura dupla das placas. Em cima, "Sorocaba" em letras pequenas e espaçadas; embaixo, o nome.
'''),
('=.topnav {', '''
Navegação no topo, escondida no celular e mostrada no computador, com o item atual destacado.
'''),
('=.icon-btn {', '''
Botão redondo só com ícone (sino, voltar, fechar) e a bolinha amarela com o número de notificações (`.dot`), com texto escuro para dar contraste.
'''),
('=.main {', '''
Área de conteúdo: largura máxima de 980 px centralizada e espaço inferior para a navegação fixa não cobrir o fim da página.
'''),
('=.bottomnav {', '''
**Navegação inferior** do celular, fixa embaixo, com espaço para a barra de gestos (`safe-area-inset-bottom`). O item ativo fica azul, com um traço em cima (`::before`).
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
**Botões**: retangulares com cantos discretos (as "pílulas" totalmente redondas ficaram só nos chips e etiquetas), altura mínima de 44 px (tamanho recomendado para o dedo), texto em negrito, transição suave e leve afundamento ao pressionar. Variações: contorno (`outline`), transparente (`ghost`), amarelo com texto escuro (`accent`), perigo (`danger`), pequeno (`sm`) e largura total (`block`). Desabilitado fica translúcido.
'''),
('=.field {', '''
**Campos de formulário**: rótulo em negrito, texto de ajuda e o estilo comum de campos de texto, listas e áreas de texto. Ao receber o foco, a borda fica azul com um halo. O campo de código usa letras espaçadas e números de largura fixa.
'''),
('=.search-box {', '''
Caixa de busca com borda mais grossa (2 px), para ficar claro onde digitar, e o ícone de lupa dentro do campo.
'''),
('=.checkbox {', '''
Caixas de seleção grandes (20 px) na cor principal (`accent-color`) e o controle segmentado (botões lado a lado, como "Sim / Não / Não sabe"), com a opção escolhida em destaque. Também o controle deslizante na cor principal.
'''),
('=.error {', '''
Caixas de mensagem: erro (vermelho) e avisos (`.notice`) nas variações verde, amarela e laranja, com ícone à esquerda.
'''),
('/* ---------- chips', '''
**Chips de categoria**: faixa rolável na horizontal, sem barra de rolagem visível, que se estende até as bordas da tela (as margens negativas compensam o espaçamento da página). O chip escolhido fica azul; os de categoria têm o ícone colorido e, quando escolhidos, ficam preenchidos com a cor da categoria.
'''),
('/* Cor da categoria', '''
**Cor da categoria.** Cada elemento com a classe `.cat` recebe `--cat` do componente e daqui saem duas variáveis: `--cat-ink` (o tom para texto e ícone) e `--cat-soft` (o fundo clarinho, 13% da cor misturada ao fundo do cartão com `color-mix`). No modo escuro, o texto é clareado misturando com branco e o fundo fica um pouco mais forte, para continuar legível.
'''),
('=.badge {', '''
**Etiquetas** pequenas (categoria, estado, destaque) nas cores do tema (a de categoria, `.badge.cat`, na cor da categoria), a distância em azul e negrito, as estrelas amarelas e as estrelas clicáveis da avaliação.
'''),
('/* ---------- ofertas', '''
**Ofertas**: a lista é uma coluna no celular e duas a partir de 720 px. O `minmax(0, 1fr)` é importante: sem ele, um título comprido alarga a coluna além da tela (aconteceu ao trocar a fonte). O cartão tem miniatura à esquerda e borda azul ao passar o mouse; o cartão em destaque ganha borda amarela.
'''),
('=.thumb {', '''
Miniatura quadrada no fundo e na cor da categoria (cai no azul se não houver categoria); a foto preenche o quadrado sem distorcer (`object-fit: cover`).
'''),
('=.gallery {', '''
Galeria de fotos da oferta, rolável na horizontal e "encaixando" em cada foto (`scroll-snap`). Sem fotos, um fundo em degradê com ícone. Também os quadrados do seletor de fotos com o botão de remover.
'''),
('/* ---------- listas', '''
**Listas** (conversas, contratações, notificações): itens com divisória, realce ao passar o mouse e fundo azul claro para não lidos. Os botões que funcionam como item de lista têm o estilo padrão de botão zerado.
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
**Balões**: os da outra pessoa à esquerda, brancos; os próprios à direita, azuis. `white-space: pre-wrap` preserva as quebras de linha digitadas. O balão com contato removido ganha contorno tracejado amarelo.
'''),
('=.sys-msg {', '''
Mensagens de sistema centralizadas e discretas, o cartão de orçamento amarelo com o valor em destaque, o campo de digitar, a barra da contratação e a barra de progresso dos estados (vermelha quando cancelada).
'''),
('/* ---------- painéis', '''
**Painéis**: cartão de número (rótulo, valor grande com algarismos de largura fixa e texto auxiliar). `.stat-ico` é o quadradinho colorido do ícone ao lado do rótulo, em cinco tons (azul, amarelo, verde, laranja, ameixa).
'''),
('=.bars {', '''
**Gráfico de barras**: cada barra é uma coluna flexível com as duas séries lado a lado, alinhadas na base; as alturas vêm do componente em porcentagem. Legenda com quadradinhos de cor.
'''),
('=.hbar {', '''
Barra horizontal de proporção (trilho cinza e preenchimento azul ou amarelo).
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
**Tela de entrada**: cartão centralizado, a placa de rua em tamanho grande (`.login-sign`, com fundo azul próprio porque aqui ela fica sobre o cartão claro) e os botões das contas de demonstração.
'''),
('/* ---------- comprovante', '''
**Comprovante**: linhas com rótulo e valor separadas por tracejado, total em destaque e o código em fonte monoespaçada.
'''),
('=@media print {', '''
**Impressão** (ou "salvar como PDF"): esconde barras, navegação e botões, e usa fundo branco e texto preto, para o comprovante sair limpo.
'''),
]),
]
