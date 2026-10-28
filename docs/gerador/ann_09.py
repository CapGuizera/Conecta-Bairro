SLUG = '09-interface-base'
TITLE = '9. Interface web: base'
INTRO = '''
A interface é uma aplicação React de página única: o navegador baixa o aplicativo uma vez e troca de tela sem recarregar.
Conceitos de React usados nos arquivos seguintes:

- **componente**: função que devolve o que deve aparecer na tela, escrito em JSX (parecido com HTML dentro do JavaScript);
- **`useState`**: guarda um valor que, quando muda, faz o componente ser desenhado de novo;
- **`useEffect`**: executa algo depois de desenhar (buscar dados, ligar um evento). A função que ele devolve é a "limpeza", executada ao sair da tela;
- **`useCallback` / `useMemo`**: guardam uma função ou valor entre os desenhos, para não recriar à toa;
- **contexto**: compartilha dados (como o usuário logado) com todos os componentes sem passá-los de um em um.
'''
FILES = [
('web/index.html', '''
A única página HTML. O React desenha tudo dentro da `div` com id `root`.
''', [
('<!doctype html>', '''
Idioma português, codificação UTF-8 e o `viewport`, que faz o layout se adaptar à largura do celular (`viewport-fit=cover` aproveita a área das bordas arredondadas dos celulares modernos).
`theme-color` pinta a barra do navegador no celular com o verde do sistema. Ícones da aba e da tela inicial do iPhone.
'''),
('  <body>', '''
O ponto de montagem do React e o arquivo JavaScript de entrada.
'''),
]),
('web/vite.config.js', '''
Configuração do Vite, que compila a interface (`npm run build`) e serve o modo desenvolvimento (`npm run dev`).
''', [
("import { fileURLToPath }", '''
Importações e o endereço da API usado no modo desenvolvimento.
'''),
('export default defineConfig({', '''
`root` aponta para a pasta `web`. O plugin `react` entende JSX.
'''),
('    // Aplicação web progressiva', '''
**PWA**: o que torna o site instalável como aplicativo.

- `registerType: 'autoUpdate'`: quando sai uma versão nova, o aplicativo se atualiza sozinho;
- `manifest`: nome, cores, ícones e `display: 'standalone'` (abre sem a barra de endereço, como aplicativo).
'''),
('      workbox: {', '''
O *service worker* (programa que o navegador mantém em segundo plano) gerado pelo Workbox:

- guarda a interface inteira no aparelho (`globPatterns`), então ela abre mesmo sem internet. É isso que permite o cadastro de campo offline (RF18);
- navegações caem no `index.html`, exceto API, fotos e tempo real (`navigateFallbackDenylist`);
- `runtimeCaching`: os metadados ficam salvos e são atualizados em segundo plano; as fotos e os blocos do mapa ficam guardados por 30 e 14 dias, economizando dados móveis.
'''),
('  server: {', '''
Modo desenvolvimento: porta 5173, acessível pela rede (`host: true`), repassando `/api`, `/uploads` e o tempo real (`ws: true`, WebSocket) para o servidor na porta 3000.
O `build` gera a pasta `dist` e eleva o limite do aviso de tamanho (o mapa e o React juntos passam do padrão).
'''),
]),
('web/src/main.jsx', '''
Entrada da interface: define as telas (rotas) e quem pode acessar cada uma.
''', [
("import { StrictMode }", '''
Importa as telas, o layout, a sessão e o CSS global.
'''),
('function Private(', '''
**Porteiro das telas.** Sem login, manda para "Entrar", lembrando de onde a pessoa veio (`state.from`) para voltar depois do login. Telas de prestador exigem o perfil de prestador; telas de equipe exigem o perfil certo.
Isso é só conveniência de navegação: a proteção de verdade está no servidor, que recusa qualquer acesso indevido.
'''),
('function App() {', '''
Enquanto a sessão carrega, mostra "Abrindo...". Se não conseguiu falar com o servidor, mostra uma tela com botão para tentar de novo.
'''),
('  return (', '''
A tabela de rotas. "Entrar" fica fora do layout (tela cheia); as demais ficam dentro do `Layout` (barra superior e navegação inferior). Telas públicas: início, oferta e perfil do prestador. As outras passam pelo `Private`. O `*` final é a página não encontrada.
'''),
('createRoot(', '''
Monta o aplicativo: `StrictMode` ativa verificações extras do React, `BrowserRouter` cuida dos endereços e `SessionProvider` disponibiliza a sessão para todas as telas.
'''),
]),
('web/src/api.js', '''
Todas as chamadas da interface ao servidor passam por aqui.
''', [
('// Cliente HTTP', '''
O token de sessão fica no `localStorage` (armazenamento do navegador, por site). Leitura e gravação ficam em `try/catch` porque, em janelas anônimas de alguns navegadores, o `localStorage` pode falhar.
'''),
('export class ApiError', '''
Erro com o código HTTP, para as telas tratarem casos específicos (por exemplo, código 0 é "sem conexão").
'''),
('export async function api(', '''
Função única de chamada: monta o endereço `/api...`, envia o token no cabeçalho `Authorization` e o corpo em JSON.
Falha de rede vira a mensagem "Sem conexão com o servidor". Cancelamentos (`AbortError`, quando a pessoa digita de novo na busca) são repassados sem mensagem.
'''),
('  const data = await res.json()', '''
Se o servidor recusar a sessão (401), apaga o token e avisa o restante da interface com o evento `cb:logout`. Qualquer erro vira `ApiError` com a mensagem do servidor, já pronta para mostrar ao usuário.
'''),
('export const qs', '''
Monta a parte `?a=1&b=2` da URL, ignorando valores vazios.
'''),
]),
('web/src/session.jsx', '''
Estado global da interface: usuário logado, localização do prestador, metadados, notificações, avisos rápidos (*toast*) e a conexão em tempo real.
''', [
('// Estado global', '''
Importações e criação do contexto.
'''),
('export function SessionProvider', '''
Os estados globais. `socketRef` guarda a conexão de tempo real e `listeners` as telas interessadas nos eventos (um `Set`, conjunto sem repetição).
'''),
('  const showToast = useCallback(', '''
Mostra um aviso rápido na parte de baixo da tela (o `Layout` o esconde depois de alguns segundos).
'''),
('  const refreshMe = useCallback(', '''
Recarrega os dados do usuário a partir do token. Sem token, não há usuário.
'''),
('  const refreshUnread = useCallback(', '''
Atualiza o número de notificações não lidas. Se estiver offline, mantém o número atual.
'''),
('=useEffect(() => {', '''
Ao abrir o aplicativo, busca os metadados e o usuário ao mesmo tempo. A variável `cancelled` evita atualizar a tela se ela já tiver sido fechada. Também escuta o evento de logout disparado pelo `api.js`.
'''),
('  // Conexão em tempo real', '''
**Tempo real.** Só com usuário logado: abre a conexão Socket.IO enviando o token (o servidor recusa sem ele).
'''),
("    socket.on('notification'", '''
Ao chegar uma notificação: soma no sino e mostra um aviso, a menos que a pessoa já esteja na tela da conversa. Se a aba estiver em segundo plano e a permissão tiver sido dada, mostra também a notificação do sistema operacional (RF17).
'''),
("    for (const ev of ['message', 'contract'])", '''
Repassa mensagens e mudanças de contratação para as telas inscritas (chat, lista de conversas, contratações). Ao (re)conectar, atualiza o número de não lidas.
A limpeza fecha a conexão quando a pessoa sai da conta.
'''),
('  const subscribe = useCallback(', '''
Inscreve uma tela nos eventos e devolve a função que cancela a inscrição.
'''),
('  const login = useCallback(', '''
`login` guarda o token e carrega o usuário; `logout` apaga tudo.
'''),
('  const value = useMemo(', '''
O pacote de dados e funções disponibilizado para todas as telas. O `useMemo` evita redesenhar o aplicativo inteiro sem necessidade.
'''),
('export const useSession', '''
`useSession()` é como cada tela acessa a sessão.
`useRealtime(handler)` inscreve a tela nos eventos de tempo real. O `ref` guarda sempre a versão mais nova da função, sem precisar refazer a inscrição a cada desenho; ao sair da tela, a inscrição é cancelada.
'''),
]),
('web/src/position.js', '''
Ponto de busca do morador (RF05 e RF06). Fica só no navegador dele.
''', [
('// Posição de busca', '''
Comentário sobre a privacidade do morador e importações.
'''),
('const KEY =', '''
Lê e grava o ponto escolhido no `localStorage`, para lembrar entre visitas.
'''),
('export const geolocationAvailable', '''
O GPS só é liberado pelos navegadores em "contexto seguro" (`https` ou `localhost`). Por isso, ao abrir pelo IP da rede local, o sistema oferece escolher o ponto no mapa.
'''),
('export function getCurrentPosition()', '''
Transforma a API de geolocalização do navegador (baseada em funções de retorno) numa `Promise`. Traduz os erros para mensagens claras: permissão negada ou localização indisponível. Pede alta precisão, espera até 12 segundos e aceita uma posição de até 1 minuto atrás.
'''),
('export function usePosition(pilot)', '''
*Hook* próprio que devolve o ponto atual e a função para mudá-lo. Sem ponto salvo, usa o centro do bairro piloto.
'''),
('export const SOURCE_LABEL', '''
Como cada origem aparece na tela de busca.
'''),
]),
('web/src/offline-queue.js', '''
Fila offline do cadastro de campo (RF18). Usa o **IndexedDB**, banco de dados do próprio navegador, que sobrevive a fechar a aba e desligar o celular.
''', [
('// RF18', '''
Comentário e importações. A fila inteira fica guardada numa única chave.
'''),
('export async function listQueue()', '''
Lê a fila (lista vazia se não houver nada) e acrescenta um registro com a hora em que entrou.
'''),
('let syncing = null', '''
Garante que só uma sincronização rode por vez: se já houver uma em andamento, devolve a mesma.
'''),
('// Retorna { sent, failed', '''
**Sincronização**: envia toda a fila num lote só, remove os itens aceitos e mantém os recusados com a mensagem de erro, para o agente corrigir. Sem itens ou sem conexão, não faz nada.
Como o servidor ignora `clientUuid` repetido, reenviar nunca duplica cadastros.
'''),
('export function newUuid()', '''
Gera o identificador único de cada registro no aparelho. `crypto.randomUUID` também só existe em contexto seguro; pelo IP da rede local usa uma alternativa com data e números aleatórios.
'''),
]),
('web/src/format.js', '''
Formatação de valores para exibição em português.
''', [
('export const brl', '''
Centavos para reais (`R$ 1.500,00`).
'''),
('export function priceRange(o)', '''
Monta o texto da faixa de preço: "a combinar", "R$ 35,00 a R$ 120,00 por bolo", "a partir de..." ou "até...".
'''),
('export const localYmd', '''
Data local no formato `AAAA-MM-DD` (o mesmo cuidado com o fuso explicado no servidor).
'''),
('export const date =', '''
Datas e horas no formato brasileiro e a conversão de `2026-10-30` para `30/10/2026`.
'''),
('export function relative(iso)', '''
Tempo relativo para listas: "agora", "há 5 min", "há 2 h", "há 3 d" ou a data.
'''),
('export const plural', '''
Concordância de número ("1 serviço", "2 serviços") e o primeiro nome de uma pessoa.
'''),
('export function formatPhoneInput', '''
Formata o celular enquanto a pessoa digita: `(15`, `(15) 9987`, `(15) 99876-5432`.
'''),
('export const since', '''
"outubro de 2026", usado em "No ConectaBairro desde...".
'''),
]),
('web/public/icon.svg', '''
O ícone do aplicativo em formato vetorial (SVG), desenhado em código. A partir dele foram geradas as versões PNG de 180, 192 e 512 pixels exigidas para instalar o aplicativo no Android e no iPhone.
''', [
('<svg', '''
- quadrado verde com cantos arredondados (o fundo do ícone);
- um círculo tracejado e outro contínuo, que lembram o **raio de busca**;
- uma casa no centro, o bairro;
- um ponto laranja, a cor de destaque, sugerindo uma notificação ou um ponto no mapa.

`viewBox="0 0 512 512"` define a área de desenho; o SVG pode ser ampliado sem perder nitidez.
'''),
]),
]
