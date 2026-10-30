# 13. Estilos (CSS)

Todo o visual está num único arquivo CSS, sem biblioteca de componentes. A abordagem é *mobile first*: as regras base valem para o celular,
e blocos `@media (min-width: ...)` ajustam para telas maiores. As cores ficam em **variáveis** (`--nome`), definidas uma vez e reaproveitadas,
o que também permite o tema escuro trocando só os valores das variáveis.

## `web/src/styles.css`

Organizado em seções marcadas por comentários `/* ---------- nome ---------- */`.

**Linhas 1 a 38**

```css
:root {
  /* Cores de placa de rua (azul e branco) com o amarelo dos ipês da cidade */
  --bg: #f4f1ea;
  --surface: #fffdf9;
  --surface-2: #ece7dc;
  --ink: #1d2330;
  --muted: #5c6371;
  --line: #ddd6c7;
  --primary: #1c4b86;
  --primary-hover: #163c6c;
  --primary-ink: #ffffff;
  --primary-soft: #dfe8f4;
  /* barra do topo: azul de placa nos dois modos (no escuro, mais fechado) */
  --bar: #1c4b86;
  --bar-ink: #ffffff;
  --accent: #e9a800;
  --accent-ink: #2a2000;
  --accent-soft: #fbefc9;
  --accent-text: #7a5700;
  --danger: #b3261e;
  --danger-soft: #fbe4e2;
  --ok: #2c7a4b;
  --ok-soft: #dff1e5;
  --warn: #8a5a00;
  --warn-soft: #fbefd5;
  --star: #e0a100;
  --orange: #c2410c;
  --orange-soft: #fbe3d6;
  --plum: #8a3a72;
  --plum-soft: #f4e1ee;
  --shadow: 0 1px 0 rgba(29, 35, 48, 0.06);
  --radius: 10px;
  --radius-sm: 8px;
  --nav-h: 64px;
  --font-body: 'Figtree Variable', system-ui, 'Segoe UI', Roboto, Arial, sans-serif;
  --font-title: 'Bricolage Grotesque Variable', 'Figtree Variable', system-ui, sans-serif;
  color-scheme: light;
}
```

**Variáveis do tema claro.** A identidade parte de duas coisas da rua: o **azul das placas de rua** (`--primary`, com letra branca) e o **amarelo dos ipês** (`--accent`), sobre um fundo cor de papel (`--bg`).
O amarelo é claro demais para texto branco, por isso tem `--accent-ink` (texto escuro por cima dele) e `--accent-text` (amarelo escurecido, legível sobre fundo claro). Há também as cores de erro, sucesso, alerta e estrelas, cada uma com uma versão clara (`-soft`) para fundos.

`--bar` é a cor da barra do topo: no claro é o mesmo azul de placa; no escuro fica um azul fechado (se usasse o azul clarinho do modo escuro, a barra viraria uma faixa clara ofuscante). `--orange` e `--plum` são as cores extras dos ícones dos painéis.

O resto: sombra quase imperceptível (só uma linha embaixo, sem o "cartão flutuando" típico de modelo pronto), cantos discretos de 8 a 10 px, altura da navegação inferior e as duas fontes:

- **Figtree** no texto: simples, amigável e com números fáceis de ler nos preços;
- **Bricolage Grotesque** nos títulos e números grandes: tem personalidade, foge do visual genérico.

As duas vêm instaladas pelo npm (`@fontsource-variable/...`) e são servidas pelo próprio sistema, então funcionam sem internet. `color-scheme` avisa o navegador para desenhar campos e barras de rolagem no tema certo.

**Linhas 40 a 71**

```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171d;
    --surface: #1b2029;
    --surface-2: #232a35;
    --ink: #e8ebf0;
    --muted: #9ba3b0;
    --line: #2c3440;
    --primary: #7eaee8;
    --primary-hover: #9cc2ef;
    --primary-ink: #0c1a2c;
    --primary-soft: #1e2f47;
    --bar: #18304f;
    --bar-ink: #e8eef7;
    --accent: #f2c14e;
    --accent-ink: #231a00;
    --accent-soft: #3a3016;
    --accent-text: #f2c14e;
    --danger: #f07a72;
    --danger-soft: #3b1b19;
    --ok: #6cd197;
    --ok-soft: #173525;
    --warn: #f0b860;
    --warn-soft: #3a2b12;
    --orange: #f59a6b;
    --orange-soft: #3d2216;
    --plum: #e09ccd;
    --plum-soft: #352032;
    --shadow: 0 1px 0 rgba(0, 0, 0, 0.3);
    color-scheme: dark;
  }
}
```

**Tema escuro automático**: se o aparelho estiver em modo escuro, as mesmas variáveis recebem tons escuros, e o azul e o amarelo ficam mais claros para manter o contraste. Nenhuma outra regra precisa mudar.

**Linhas 73 a 75**

```css
* {
  box-sizing: border-box;
}
```

`box-sizing: border-box` faz largura e altura incluírem borda e espaçamento interno, o que torna o layout previsível.

**Linhas 77 a 119**

```css
html,
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-body);
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

a {
  color: var(--primary);
  text-decoration: none;
}

h1,
h2,
h3 {
  font-family: var(--font-title);
  font-weight: 700;
  line-height: 1.15;
  margin: 0 0 0.5rem;
  letter-spacing: -0.015em;
}
h1 {
  font-size: 1.65rem;
}
h2 {
  font-size: 1.15rem;
}
h3 {
  font-size: 1rem;
}
p {
  margin: 0 0 0.75rem;
}

img {
  max-width: 100%;
  display: block;
}
```

Base da página: fundo e texto pelas variáveis, a fonte do texto (se ela não carregar, cai na do sistema: Segoe UI no Windows, Roboto no Android), tamanho 16 px (abaixo disso o iPhone dá zoom ao tocar nos campos) e remoção do realce azul ao tocar em links no celular.
Em seguida, estilos dos links, dos títulos (na fonte de título, com letras um pouco mais juntas), parágrafos e imagens (que nunca passam da largura disponível).

**Linhas 121 a 127**

```css
/* ---------- estrutura ---------- */

.app {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
```

**Estrutura.** `.app` ocupa a altura toda da tela (`100dvh`, que considera a barra de endereço do celular).

**Linhas 129 a 171**

```css
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--bar);
  color: var(--bar-ink);
  padding: calc(env(safe-area-inset-top) + 10px) 16px 10px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.topbar .brand {
  color: inherit;
}
/* A marca imita uma placa de rua: fundo azul, filete branco por dentro e letras brancas */
.sign {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 12px 4px;
  border: 2px solid currentColor;
  border-radius: 5px;
  box-shadow: inset 0 0 0 2px var(--bar);
  font-family: var(--font-title);
  font-weight: 700;
  font-size: 1.05rem;
  line-height: 1.1;
  letter-spacing: 0.01em;
}
.sign small {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}
.topbar .spacer {
  flex: 1;
}
.topbar .icon-btn {
  color: inherit;
}
```

**Barra superior** fixa no topo ao rolar (`position: sticky`), na cor `--bar`. `env(safe-area-inset-top)` afasta o conteúdo do entalhe da câmera nos celulares.

A marca `.sign` imita uma **placa de rua**: borda branca e, por dentro dela, um segundo filete na cor de fundo (`box-shadow: inset`), que dá o efeito de moldura dupla das placas. Em cima, "Sorocaba" em letras pequenas e espaçadas; embaixo, o nome.

**Linhas 172 a 188**

```css
.topnav {
  display: none;
  gap: 4px;
}
.topnav a {
  color: inherit;
  opacity: 0.85;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.95rem;
}
.topnav a.active,
.topnav a:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.14);
}
```

Navegação no topo, escondida no celular e mostrada no computador, com o item atual destacado.

**Linhas 190 a 219**

```css
.icon-btn {
  position: relative;
  border: 0;
  background: transparent;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  color: var(--ink);
}
.icon-btn:hover {
  background: rgba(127, 127, 127, 0.14);
}
.dot {
  position: absolute;
  top: 4px;
  right: 2px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 0.7rem;
  font-weight: 700;
  display: grid;
  place-items: center;
}
```

Botão redondo só com ícone (sino, voltar, fechar) e a bolinha amarela com o número de notificações (`.dot`), com texto escuro para dar contraste.

**Linhas 221 a 227**

```css
.main {
  flex: 1;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 16px 16px calc(var(--nav-h) + 24px + env(safe-area-inset-bottom));
}
```

Área de conteúdo: largura máxima de 980 px centralizada e espaço inferior para a navegação fixa não cobrir o fim da página.

**Linhas 229 a 268**

```css
.bottomnav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 40;
  height: calc(var(--nav-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--surface);
  border-top: 1px solid var(--line);
  display: flex;
}
.bottomnav a {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 500;
}
.bottomnav a.active {
  color: var(--primary);
}
.bottomnav a.active::before {
  content: '';
  position: absolute;
  top: 0;
  width: 36px;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--primary);
}
.bottomnav .dot {
  top: 6px;
  right: calc(50% - 22px);
}
```

**Navegação inferior** do celular, fixa embaixo, com espaço para a barra de gestos (`safe-area-inset-bottom`). O item ativo fica azul, com um traço em cima (`::before`).

**Linhas 270 a 281**

```css
@media (min-width: 900px) {
  .topnav {
    display: flex;
  }
  .bottomnav {
    display: none;
  }
  .main {
    padding-bottom: 40px;
    padding-top: 24px;
  }
}
```

Em telas a partir de 900 px (computador), a navegação vai para o topo e a inferior some.

**Linhas 283 a 290**

```css
.offline-bar {
  background: var(--warn-soft);
  color: var(--warn);
  text-align: center;
  font-size: 0.85rem;
  padding: 6px 12px;
  font-weight: 500;
}
```

Faixa amarela de sem conexão.

**Linhas 292 a 310**

```css
/* ---------- blocos ---------- */

.card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
}
.card + .card,
.stack > * + * {
  margin-top: 12px;
}
.card.flat {
  box-shadow: none;
}
.card.tight {
  padding: 12px;
}
```

**Blocos**: o cartão (`.card`) com borda, raio e sombra, e o espaçamento automático entre cartões seguidos (`.card + .card`).

**Linhas 312 a 321**

```css
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 24px 0 10px;
}
.section-title h2 {
  margin: 0;
}
```

Título de seção com elemento à direita (por exemplo, "16 encontrados").

**Linhas 323 a 372**

```css
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row.wrap {
  flex-wrap: wrap;
}
.row.between {
  justify-content: space-between;
}
.grow {
  flex: 1;
  min-width: 0;
}
.muted {
  color: var(--muted);
}
.small {
  font-size: 0.86rem;
}
.tiny {
  font-size: 0.76rem;
}
.strong {
  font-weight: 600;
}
.center {
  text-align: center;
}
.nowrap {
  white-space: nowrap;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mt {
  margin-top: 12px;
}
.mt-lg {
  margin-top: 24px;
}
.mb {
  margin-bottom: 12px;
}
.gap-lg {
  gap: 16px;
}
```

**Utilitários**: linha flexível com espaçamento (`.row`), variações de quebra e distribuição, `.grow` (ocupa o espaço restante), tamanhos e pesos de texto, centralização, texto em uma linha com reticências (`.ellipsis`) e margens.

**Linhas 374 a 392**

```css
.grid {
  display: grid;
  gap: 12px;
}
.grid.two {
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
}
.grid.stats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 640px) {
  .grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid.stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
```

**Grades**: no celular, uma coluna; a partir de 640 px, `.grid.two` vira duas colunas e `.grid.stats` vira quatro (os números dos painéis). `align-items: start` evita que um cartão curto estique para acompanhar o vizinho.

**Linhas 394 a 462**

```css
/* ---------- botões e formulários ---------- */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: var(--primary);
  color: var(--primary-ink);
  font: inherit;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
  text-decoration: none;
  white-space: nowrap;
}
.btn:hover {
  background: var(--primary-hover);
}
.btn:active {
  transform: translateY(1px);
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn.outline {
  background: transparent;
  color: var(--primary);
  border-color: var(--primary);
}
.btn.outline:hover {
  background: var(--primary-soft);
}
.btn.ghost {
  background: transparent;
  color: var(--ink);
}
.btn.ghost:hover {
  background: var(--surface-2);
}
.btn.accent {
  background: var(--accent);
  color: var(--accent-ink);
}
.btn.accent:hover {
  background: #d69a00;
}
.btn.danger {
  background: transparent;
  color: var(--danger);
  border-color: var(--danger);
}
.btn.danger:hover {
  background: var(--danger-soft);
}
.btn.sm {
  min-height: 34px;
  padding: 0 12px;
  font-size: 0.85rem;
}
.btn.block {
  width: 100%;
}
```

**Botões**: retangulares com cantos discretos (as "pílulas" totalmente redondas ficaram só nos chips e etiquetas), altura mínima de 44 px (tamanho recomendado para o dedo), texto em negrito, transição suave e leve afundamento ao pressionar. Variações: contorno (`outline`), transparente (`ghost`), amarelo com texto escuro (`accent`), perigo (`danger`), pequeno (`sm`) e largura total (`block`). Desabilitado fica translúcido.

**Linhas 464 a 507**

```css
.field {
  display: block;
  margin-bottom: 14px;
}
.field > span {
  display: block;
  font-size: 0.86rem;
  font-weight: 600;
  margin-bottom: 6px;
}
.field .hint {
  display: block;
  font-weight: 400;
  color: var(--muted);
  font-size: 0.8rem;
  margin-top: 4px;
}
.input,
select.input,
textarea.input {
  width: 100%;
  min-height: 46px;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  outline: none;
}
textarea.input {
  min-height: 96px;
  resize: vertical;
}
.input:focus {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.input.code {
  font-size: 1.6rem;
  letter-spacing: 0.4em;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

**Campos de formulário**: rótulo em negrito, texto de ajuda e o estilo comum de campos de texto, listas e áreas de texto. Ao receber o foco, a borda fica azul com um halo. O campo de código usa letras espaçadas e números de largura fixa.

**Linhas 509 a 525**

```css
.search-box {
  position: relative;
}
.search-box svg {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted);
}
.search-box .input {
  padding-left: 44px;
  min-height: 52px;
  border-radius: var(--radius);
  font-size: 1rem;
  border-width: 2px;
}
```

Caixa de busca com borda mais grossa (2 px), para ficar claro onde digitar, e o ícone de lupa dentro do campo.

**Linhas 527 a 572**

```css
.checkbox {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 0;
  cursor: pointer;
}
.checkbox input {
  width: 20px;
  height: 20px;
  accent-color: var(--primary);
  margin-top: 1px;
  flex: none;
}

.segmented {
  display: flex;
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: 4px;
  gap: 4px;
}
.segmented button {
  flex: 1;
  white-space: nowrap;
  padding: 0 12px;
  border: 0;
  background: transparent;
  border-radius: calc(var(--radius) - 3px);
  min-height: 38px;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
}
.segmented button.on {
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow);
}

input[type='range'] {
  width: 100%;
  accent-color: var(--primary);
}
```

Caixas de seleção grandes (20 px) na cor principal (`accent-color`) e o controle segmentado (botões lado a lado, como "Sim / Não / Não sabe"), com a opção escolhida em destaque. Também o controle deslizante na cor principal.

**Linhas 574 a 608**

```css
.error {
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 0.9rem;
  margin-bottom: 12px;
}
.notice {
  background: var(--primary-soft);
  color: var(--ink);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  font-size: 0.9rem;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.notice svg {
  flex: none;
  color: var(--primary);
  margin-top: 2px;
}
.notice.warn {
  background: var(--warn-soft);
}
.notice.warn svg {
  color: var(--warn);
}
.notice.accent {
  background: var(--accent-soft);
}
.notice.accent svg {
  color: var(--accent-text);
}
```

Caixas de mensagem: erro (vermelho) e avisos (`.notice`) nas variações verde, amarela e laranja, com ícone à esquerda.

**Linhas 610 a 657**

```css
/* ---------- chips e etiquetas ---------- */

.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 2px 8px;
  margin: 0 -16px;
  padding-left: 16px;
  padding-right: 16px;
  scrollbar-width: none;
}
.chips::-webkit-scrollbar {
  display: none;
}
.chip {
  flex: none;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 999px;
  padding: 7px 14px;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 500;
  cursor: pointer;
}
.chip.on {
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-ink);
}
.chip.cat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.chip.cat svg {
  color: var(--cat-ink);
}
.chip.cat.on {
  background: var(--cat-ink);
  border-color: var(--cat-ink);
  color: var(--surface);
}
.chip.cat.on svg {
  color: inherit;
}
```

**Chips de categoria**: faixa rolável na horizontal, sem barra de rolagem visível, que se estende até as bordas da tela (as margens negativas compensam o espaçamento da página). O chip escolhido fica azul; os de categoria têm o ícone colorido e, quando escolhidos, ficam preenchidos com a cor da categoria.

**Linhas 659 a 670**

```css
/* Cor da categoria: o componente põe --cat (categories.jsx) e daqui saem o fundo
   clarinho e o tom do texto. No modo escuro o texto clareia para continuar legível. */
.cat {
  --cat-ink: var(--cat);
  --cat-soft: color-mix(in srgb, var(--cat) 13%, var(--surface));
}
@media (prefers-color-scheme: dark) {
  .cat {
    --cat-ink: color-mix(in srgb, var(--cat) 45%, #ffffff);
    --cat-soft: color-mix(in srgb, var(--cat) 26%, var(--surface));
  }
}
```

**Cor da categoria.** Cada elemento com a classe `.cat` recebe `--cat` do componente e daqui saem duas variáveis: `--cat-ink` (o tom para texto e ícone) e `--cat-soft` (o fundo clarinho, 13% da cor misturada ao fundo do cartão com `color-mix`). No modo escuro, o texto é clareado misturando com branco e o fundo fica um pouco mais forte, para continuar legível.

**Linhas 672 a 744**

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--surface-2);
  color: var(--muted);
  white-space: nowrap;
}
.badge.primary {
  background: var(--primary-soft);
  color: var(--primary);
}
.badge.accent {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.badge.ok {
  background: var(--ok-soft);
  color: var(--ok);
}
.badge.warn {
  background: var(--warn-soft);
  color: var(--warn);
}
.badge.danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.badge.cat {
  background: var(--cat-soft);
  color: var(--cat-ink);
}

.distance {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  color: var(--primary);
  font-size: 0.9rem;
  white-space: nowrap;
}

.stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--star);
}
.stars .num {
  color: var(--ink);
  font-weight: 600;
  margin-left: 4px;
  font-size: 0.88rem;
}
.star-input {
  display: flex;
  gap: 6px;
}
.star-input button {
  border: 0;
  background: none;
  padding: 4px;
  cursor: pointer;
  color: var(--line);
}
.star-input button.on {
  color: var(--star);
}
```

**Etiquetas** pequenas (categoria, estado, destaque) nas cores do tema (a de categoria, `.badge.cat`, na cor da categoria), a distância em azul e negrito, as estrelas amarelas e as estrelas clicáveis da avaliação.

**Linhas 746 a 776**

```css
/* ---------- ofertas ---------- */

.offer-list {
  display: grid;
  gap: 12px;
  /* minmax(0, ...) impede que um título comprido alargue a coluna além da tela */
  grid-template-columns: minmax(0, 1fr);
}
@media (min-width: 720px) {
  .offer-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.offer-card {
  display: flex;
  gap: 12px;
  color: inherit;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 12px;
  box-shadow: var(--shadow);
  transition: border-color 0.15s;
}
.offer-card:hover {
  border-color: var(--primary);
}
.offer-card.highlighted {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), var(--shadow);
}
```

**Ofertas**: a lista é uma coluna no celular e duas a partir de 720 px. O `minmax(0, 1fr)` é importante: sem ele, um título comprido alarga a coluna além da tela (aconteceu ao trocar a fonte). O cartão tem miniatura à esquerda e borda azul ao passar o mouse; o cartão em destaque ganha borda amarela.

**Linhas 777 a 804**

```css
.thumb {
  flex: none;
  width: 84px;
  height: 84px;
  border-radius: var(--radius-sm);
  background: var(--cat-soft, var(--primary-soft));
  color: var(--cat-ink, var(--primary));
  display: grid;
  place-items: center;
  overflow: hidden;
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.offer-card h3 {
  margin: 2px 0 4px;
  font-size: 1rem;
}
.offer-card .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  align-items: center;
  font-size: 0.84rem;
  color: var(--muted);
}
```

Miniatura quadrada no fundo e na cor da categoria (cai no azul se não houver categoria); a foto preenche o quadrado sem distorcer (`object-fit: cover`).

**Linhas 806 a 868**

```css
.gallery {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  margin: 0 -16px 16px;
  padding: 0 16px;
  scroll-snap-type: x mandatory;
}
.gallery img {
  flex: none;
  width: min(86%, 420px);
  aspect-ratio: 4/3;
  object-fit: cover;
  border-radius: var(--radius);
  scroll-snap-align: start;
}
.hero-placeholder {
  height: 140px;
  border-radius: var(--radius);
  background: linear-gradient(135deg, var(--cat-soft, var(--primary-soft)), var(--surface-2));
  display: grid;
  place-items: center;
  color: var(--cat-ink, var(--primary));
  margin-bottom: 16px;
}

.image-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.image-picker .slot {
  position: relative;
  width: 86px;
  height: 86px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 1px dashed var(--line);
  display: grid;
  place-items: center;
  color: var(--muted);
  background: var(--surface-2);
  cursor: pointer;
}
.image-picker .slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-picker .slot .remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 0;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
}
```

Galeria de fotos da oferta, rolável na horizontal e "encaixando" em cada foto (`scroll-snap`). Sem fotos, um fundo em degradê com ícone. Também os quadrados do seletor de fotos com o botão de remover.

**Linhas 870 a 903**

```css
/* ---------- listas ---------- */

.list {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow);
}
.list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  color: inherit;
  border-bottom: 1px solid var(--line);
  background: none;
  width: 100%;
  text-align: left;
  font: inherit;
  border-left: 0;
  border-right: 0;
  border-top: 0;
  cursor: pointer;
}
.list-item:last-child {
  border-bottom: 0;
}
.list-item:hover {
  background: var(--surface-2);
}
.list-item.unread {
  background: var(--primary-soft);
}
```

**Listas** (conversas, contratações, notificações): itens com divisória, realce ao passar o mouse e fundo azul claro para não lidos. Os botões que funcionam como item de lista têm o estilo padrão de botão zerado.

**Linhas 904 a 939**

```css
.avatar {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--primary-soft);
  color: var(--primary);
  display: grid;
  place-items: center;
  font-weight: 700;
  overflow: hidden;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar.lg {
  width: 64px;
  height: 64px;
  font-size: 1.4rem;
}

.empty {
  text-align: center;
  padding: 40px 16px;
  color: var(--muted);
}
.empty svg {
  color: var(--primary);
  opacity: 0.7;
  margin-bottom: 8px;
}
.empty h3 {
  color: var(--ink);
}
```

Círculo das iniciais, em dois tamanhos, e o estado vazio (ícone, título e texto centralizados).

**Linhas 941 a 953**

```css
/* ---------- chat ---------- */

.chat {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 64px - var(--nav-h) - env(safe-area-inset-bottom) - 32px);
  min-height: 420px;
}
@media (min-width: 900px) {
  .chat {
    height: calc(100dvh - 64px - 64px);
  }
}
```

**Chat**: ocupa a altura disponível descontando barra superior e navegação, para que só as mensagens rolem e o campo de digitar fique sempre visível.

**Linhas 954 a 968**

```css
.chat-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--line);
}
.chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 2px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

Cabeçalho do chat e a área de mensagens rolável, em coluna.

**Linhas 969 a 995**

```css
.bubble {
  max-width: 80%;
  padding: 9px 13px;
  border-radius: 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  align-self: flex-start;
  word-wrap: break-word;
  white-space: pre-wrap;
}
.bubble.mine {
  align-self: flex-end;
  background: var(--primary);
  border-color: var(--primary);
  color: var(--primary-ink);
}
.bubble .when {
  display: block;
  font-size: 0.7rem;
  opacity: 0.7;
  margin-top: 2px;
  text-align: right;
}
.bubble.masked {
  outline: 2px dashed var(--warn);
  outline-offset: 2px;
}
```

**Balões**: os da outra pessoa à esquerda, brancos; os próprios à direita, azuis. `white-space: pre-wrap` preserva as quebras de linha digitadas. O balão com contato removido ganha contorno tracejado amarelo.

**Linhas 996 a 1052**

```css
.sys-msg {
  align-self: center;
  max-width: 92%;
  text-align: center;
  font-size: 0.8rem;
  color: var(--muted);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 5px 12px;
}
.proposal-card {
  align-self: stretch;
  border: 1px solid var(--accent);
  background: var(--accent-soft);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin: 4px 0;
}
.proposal-card .amount {
  font-family: var(--font-title);
  font-size: 1.5rem;
  font-weight: 700;
}
.chat-input {
  display: flex;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}
.chat-input .input {
  border-radius: var(--radius);
}
.contract-bar {
  border: 1px solid var(--line);
  background: var(--surface);
  border-radius: var(--radius);
  padding: 10px 12px;
  margin: 10px 0 0;
}

.steps {
  display: flex;
  gap: 4px;
  margin: 8px 0 4px;
}
.steps span {
  flex: 1;
  height: 5px;
  border-radius: 99px;
  background: var(--line);
}
.steps span.on {
  background: var(--primary);
}
.steps.cancelled span.on {
  background: var(--danger);
}
```

Mensagens de sistema centralizadas e discretas, o cartão de orçamento amarelo com o valor em destaque, o campo de digitar, a barra da contratação e a barra de progresso dos estados (vermelha quando cancelada).

**Linhas 1054 a 1109**

```css
/* ---------- painéis ---------- */

.stat {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow);
}
.stat .label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 500;
}
.stat-ico {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
}
.stat-ico.blue {
  background: var(--primary-soft);
  color: var(--primary);
}
.stat-ico.yellow {
  background: var(--accent-soft);
  color: var(--accent-text);
}
.stat-ico.green {
  background: var(--ok-soft);
  color: var(--ok);
}
.stat-ico.orange {
  background: var(--orange-soft);
  color: var(--orange);
}
.stat-ico.plum {
  background: var(--plum-soft);
  color: var(--plum);
}
.stat .value {
  font-family: var(--font-title);
  font-size: 1.6rem;
  font-weight: 700;
  margin-top: 2px;
  font-variant-numeric: tabular-nums;
}
.stat .sub {
  font-size: 0.78rem;
  color: var(--muted);
}
```

**Painéis**: cartão de número (rótulo, valor grande com algarismos de largura fixa e texto auxiliar). `.stat-ico` é o quadradinho colorido do ícone ao lado do rótulo, em cinco tons (azul, amarelo, verde, laranja, ameixa).

**Linhas 1111 a 1150**

```css
.bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 120px;
  padding-top: 8px;
}
.bars .bar {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 100%;
  min-width: 0;
}
.bars .bar i {
  display: block;
  flex: 1;
  border-radius: 3px 3px 0 0;
  background: var(--primary);
  min-height: 2px;
}
.bars .bar i.alt {
  background: var(--accent);
}
.legend {
  display: flex;
  gap: 14px;
  font-size: 0.8rem;
  color: var(--muted);
  margin-top: 6px;
}
.legend i {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 3px;
  margin-right: 5px;
  vertical-align: -1px;
}
```

**Gráfico de barras**: cada barra é uma coluna flexível com as duas séries lado a lado, alinhadas na base; as alturas vêm do componente em porcentagem. Legenda com quadradinhos de cor.

**Linhas 1152 a 1176**

```css
.hbar {
  margin: 10px 0;
}
.hbar .top {
  display: flex;
  justify-content: space-between;
  font-size: 0.88rem;
  margin-bottom: 4px;
  gap: 8px;
}
.hbar .track {
  height: 10px;
  border-radius: 99px;
  background: var(--surface-2);
  overflow: hidden;
}
.hbar .track i {
  display: block;
  height: 100%;
  background: var(--primary);
  border-radius: 99px;
}
.hbar.accent .track i {
  background: var(--accent);
}
```

Barra horizontal de proporção (trilho cinza e preenchimento azul ou amarelo).

**Linhas 1178 a 1200**

```css
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
  overflow-x: auto;
}
.tabs button {
  border: 0;
  background: none;
  font: inherit;
  font-weight: 600;
  font-size: 0.92rem;
  color: var(--muted);
  padding: 10px 14px;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}
.tabs button.on {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
```

Abas com sublinhado na aba ativa, roláveis se não couberem na tela.

**Linhas 1202 a 1217**

```css
/* ---------- mapa ---------- */

.map {
  height: 220px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--line);
  z-index: 0;
}
.map.tall {
  height: 320px;
}
.leaflet-container {
  font: inherit;
  background: var(--surface-2);
}
```

**Mapa**: altura fixa, bordas arredondadas e a fonte do sistema também dentro do Leaflet.

**Linhas 1219 a 1257**

```css
/* ---------- modal e aviso ---------- */

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(10, 20, 17, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.modal {
  background: var(--surface);
  width: 100%;
  max-width: 560px;
  max-height: 92dvh;
  overflow-y: auto;
  border-radius: 20px 20px 0 0;
  padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.2);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.modal-head h2 {
  margin: 0;
}
@media (min-width: 640px) {
  .backdrop {
    align-items: center;
  }
  .modal {
    border-radius: 20px;
    padding: 24px;
  }
}
```

**Diálogos**: fundo escurecido cobrindo a tela; no celular a janela sobe de baixo (como as folhas dos aplicativos nativos) e no computador fica centralizada.

**Linhas 1259 a 1293**

```css
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--nav-h) + 16px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 200;
  background: var(--ink);
  color: var(--bg);
  padding: 12px 18px;
  border-radius: 14px;
  font-size: 0.9rem;
  max-width: min(92vw, 460px);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  animation: toast-in 0.2s ease-out;
}
.toast.error {
  background: var(--danger);
  color: #fff;
}
.toast.ok {
  background: var(--ok);
  color: #fff;
}
@media (min-width: 900px) {
  .toast {
    bottom: 24px;
  }
}
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, 8px);
  }
}
```

**Aviso rápido**: flutua acima da navegação, com animação de entrada e versões de erro e sucesso.

**Linhas 1295 a 1314**

```css
.skeleton {
  background: linear-gradient(90deg, var(--surface-2), var(--line), var(--surface-2));
  background-size: 200% 100%;
  animation: shimmer 1.2s infinite;
  border-radius: var(--radius);
  height: 108px;
}
@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
```

Blocos de carregamento com brilho animado e o ícone girando (`.spin`).

**Linhas 1316 a 1354**

```css
/* ---------- login ---------- */

.login {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background: radial-gradient(circle at 20% 0%, var(--primary-soft), transparent 55%), var(--bg);
}
.login .card {
  width: 100%;
  max-width: 420px;
  padding: 24px;
}
.login-sign {
  background: var(--bar);
  color: var(--bar-ink);
  font-size: 1.6rem;
  padding: 6px 18px 8px;
}
.demo-accounts {
  display: grid;
  gap: 6px;
  margin-top: 8px;
}
.demo-accounts button {
  text-align: left;
  border: 1px solid var(--line);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  font: inherit;
  font-size: 0.86rem;
  cursor: pointer;
  color: var(--ink);
}
.demo-accounts button:hover {
  border-color: var(--primary);
}
```

**Tela de entrada**: cartão centralizado, a placa de rua em tamanho grande (`.login-sign`, com fundo azul próprio porque aqui ela fica sobre o cartão claro) e os botões das contas de demonstração.

**Linhas 1356 a 1378**

```css
/* ---------- comprovante ---------- */

.receipt {
  max-width: 520px;
  margin: 0 auto;
}
.receipt .line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--line);
}
.receipt .line.total {
  font-weight: 700;
  font-size: 1.1rem;
  border-bottom: 0;
}
.receipt .code {
  font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
  font-size: 1rem;
  letter-spacing: 0.04em;
}
```

**Comprovante**: linhas com rótulo e valor separadas por tracejado, total em destaque e o código em fonte monoespaçada.

**Linhas 1380 a 1397**

```css
@media print {
  .topbar,
  .bottomnav,
  .no-print,
  .offline-bar {
    display: none !important;
  }
  body,
  .main {
    background: #fff;
    color: #000;
    padding: 0;
  }
  .card {
    box-shadow: none;
    border-color: #999;
  }
}
```

**Impressão** (ou "salvar como PDF"): esconde barras, navegação e botões, e usa fundo branco e texto preto, para o comprovante sair limpo.

---
