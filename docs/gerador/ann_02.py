SLUG = '02-servidor-nucleo'
TITLE = '2. Servidor: núcleo'
INTRO = '''
Como o servidor nasce: `index.js` é o ponto de entrada, `config.js` lê as configurações, `db.js` escolhe e abre o banco,
`app.js` monta as rotas da API e a entrega da interface, `realtime.js` cuida do Socket.IO e `jobs.js` roda a rotina periódica do RF16.
'''
FILES = [
('server/src/config.js', '''
Centraliza as configurações. Todos os outros arquivos importam o objeto `config` daqui em vez de ler variáveis de ambiente espalhadas pelo código.
''', [
('// Configuração central', '''
Importações do próprio Node: `fs` (arquivos), `path` (caminhos, com a barra certa para cada sistema), `crypto` (números aleatórios seguros) e `fileURLToPath` (converte o endereço do módulo em caminho de arquivo).
'''),
('export const ROOT', '''
Descobre a pasta raiz do projeto subindo dois níveis a partir deste arquivo (`server/src` até a raiz). Assim o sistema funciona de qualquer pasta, inclusive com espaços ou acentos no caminho do Windows.
'''),
('const envFile', '''
Leitor do arquivo `.env` sem biblioteca externa. Para cada linha:

- `split(/\\r?\\n/)` separa as linhas aceitando quebra do Windows (`\\r\\n`) ou do Linux (`\\n`);
- ignora linhas vazias, comentários (`#`) e linhas sem `=`;
- separa chave e valor no primeiro `=` e tira aspas em volta do valor;
- só define a variável se ela ainda não existir, para uma variável definida no terminal ter prioridade sobre o arquivo.
'''),
('// Segredo do JWT', '''
`resolveSecret` devolve a chave que assina os tokens de sessão. Usa `JWT_SECRET` se existir; senão, lê ou cria `server/data/.jwt-secret` com 48 bytes aleatórios.
Gravar a chave em arquivo faz os usuários continuarem logados depois que o servidor reinicia.
'''),
('export const config = {', '''
Porta, endereço de escuta (`0.0.0.0` aceita conexões de outros aparelhos da rede), URL do banco externo, pasta do banco embutido, pasta das imagens enviadas e pasta da interface compilada.
'''),
('  jwtSecret:', '''
Nos testes (`NODE_ENV=test`) usa uma chave fixa, para não criar arquivos durante os testes.
'''),
('  // "dev"', '''
Modo do SMS e taxa de comissão do RF10 (6%), num lugar só para facilitar mudanças.
'''),
('  // Centro do bairro piloto', '''
Ponto padrão de busca quando o morador não compartilha a localização. `Number(...)` converte o texto do `.env` em número.
'''),
('  // Dias sem confirmação', '''
Prazos do RF16: aos 30 dias sem confirmação o prestador é avisado; aos 45 a oferta deixa de aparecer na busca.
'''),
]),
('server/src/db.js', '''
Camada de acesso ao banco. Expõe sempre a mesma interface (`query`, `exec`, `transaction`, `close`) para os dois modos, de modo que o resto do sistema não precisa saber qual banco está em uso.
''', [
('// Camada de banco', '''
Comentário explicando os dois modos. Importações e leitura do arquivo `schema.sql`, que fica na mesma pasta.
'''),
('let impl = null', '''
Guarda a conexão aberta (padrão *singleton*: o banco é aberto uma vez e reaproveitado) e a função que libera a trava do banco.
'''),
('// O PGlite não aguenta', '''
**A trava do banco embutido.** O PGlite não foi feito para dois processos abrirem a mesma pasta: o segundo atrapalha as gravações do primeiro e o banco pode corromper.
Isso aconteceu de verdade durante o desenvolvimento, quando o sistema foi aberto duas vezes ao mesmo tempo (as páginas de oferta passaram a dar "erro interno").

`processAlive` confere se um processo ainda existe: `process.kill(pid, 0)` não mata nada, só pergunta ao sistema operacional se o PID existe (funciona igual no Windows). O erro `EPERM` significa "existe, mas é de outro usuário".
'''),
('function acquireLock(dir) {', '''
`acquireLock` cria o arquivo `server/data/pglite.lock` com o PID do processo:

- a opção `flag: 'wx'` só cria se o arquivo **não existir**, numa operação única do sistema de arquivos. Dois processos tentando ao mesmo tempo nunca ganham os dois;
- se já existir e o dono ainda estiver vivo, recusa com o erro `DB_LOCKED`;
- se o dono já morreu (por exemplo, a janela foi fechada no X sem encerrar direito), a trava é considerada esquecida: apaga e tenta de novo.

A liberação só apaga o arquivo se ele ainda for deste processo, e é registrada no evento `exit` para acontecer também quando o programa termina.
'''),
('export async function initDb', '''
Abre o banco. O parâmetro `memory` é usado pelos testes para criar um banco temporário só na memória.
'''),
('  if (config.databaseUrl && !memory) {', '''
**Modo PostgreSQL**: importa o `pg` só quando necessário (`await import`), para quem usa o banco embutido não depender dele.
Os `setTypeParser` fazem números grandes (`bigint`) e decimais (`numeric`) virem números JavaScript, e não texto, igualando o comportamento ao do PGlite.
O `Pool` mantém várias conexões abertas para atender requisições em paralelo.
'''),
('    impl = {', '''
`query` e `exec` repassam para o pool. A `transaction` pega uma conexão exclusiva, executa `BEGIN`, roda a função recebida e faz `COMMIT`;
se algo der errado, faz `ROLLBACK` e nada fica gravado pela metade. O `finally` devolve a conexão ao pool em qualquer caso.
'''),
('  } else {', '''
**Modo PGlite**: pega a trava (só quando grava em disco; o banco em memória dos testes não precisa), carrega o PostgreSQL em WebAssembly com a extensão PostGIS e grava os dados na pasta `server/data/pglite`.
O PGlite já tem transação própria; aqui ela só é adaptada para o mesmo formato do modo PostgreSQL.
'''),
('  await impl.exec(schemaSql)', '''
Executa o `schema.sql` a cada inicialização. Ele usa `CREATE ... IF NOT EXISTS`, então só cria o que falta.
'''),
('export function db()', '''
Devolve o banco aberto, ou avisa claramente se alguém tentar usar antes de abrir.
'''),
('export async function closeDb()', '''
Fecha o banco e libera a trava (usado no encerramento, no seed e nos testes).
'''),
('export const q =', '''
Atalhos usados em todo o servidor: `q` executa e devolve o resultado completo, `one` devolve a primeira linha (ou `null`) e `many` devolve todas as linhas.
O `$1`, `$2` nas consultas são **parâmetros**: o valor vai separado do SQL, o que impede injeção de SQL.
'''),
]),
('server/src/index.js', '''
Ponto de entrada (`npm start`). Abre o banco, cria os dados de demonstração se o banco estiver vazio, sobe o servidor HTTP com o tempo real e mostra no terminal os endereços de acesso.
''', [
('// Ponto de entrada', '''
Importações: o servidor HTTP nativo, `os` (para descobrir os IPs da máquina) e os módulos do próprio projeto.
'''),
('const started', '''
Marca o horário de início para mostrar quanto tempo a inicialização levou. O `await` no nível do módulo é permitido em módulos ES.
Abre o banco. Se ele já estiver aberto por outra janela (erro `DB_LOCKED` da trava), explica isso e encerra **antes** de tocar no banco, em vez de mostrar um erro técnico. Depois mostra qual modo está em uso e roda o seed se for a primeira vez.
'''),
('const app = createApp()', '''
Cria o aplicativo Express e o servidor HTTP, liga o Socket.IO no mesmo servidor (mesma porta) e agenda a rotina do RF16.
'''),
("server.on('error'", '''
Trata o erro mais comum ao rodar no Windows: a porta já está em uso (por exemplo, o sistema já aberto em outra janela). Mostra como resolver em vez de um erro técnico.
'''),
('server.listen(', '''
Começa a aceitar conexões. O código seguinte só roda quando o servidor está pronto.
'''),
('  // Endereços para abrir', '''
Lista os IPs da máquina que outros aparelhos podem usar. Ignora interfaces virtuais (Docker, WSL, VirtualBox, VPNs), que confundiriam quem está apresentando, e fica só com IPv4 não internos.
'''),
("  const demo = await many(", '''
Busca as contas de demonstração (telefones que começam com `+551590000`) para listar no terminal.
'''),
('  console.log(`\\nConectaBairro pronto', '''
Mostra o tempo de inicialização, o endereço local e os da rede.
'''),
("  if (config.smsMode === 'dev') {", '''
No modo demonstração, lista as contas com o celular formatado. A expressão regular transforma `15900000001` em `(15) 90000-0001`.
'''),
('const shutdown = async () => {', '''
Encerramento organizado ao receber `Ctrl+C`: para de aceitar conexões e fecha o banco, evitando corromper os dados do PGlite.
'''),
]),
('server/src/app.js', '''
Monta o aplicativo Express. Fica separado do `index.js` para os testes criarem o aplicativo sem abrir a porta 3000.
''', [
('// Monta a aplicação', '''
Importa o Express, a configuração, o carregador de usuário e todos os grupos de rotas.
'''),
('export function createApp() {', '''
- `disable('x-powered-by')` não anuncia que o servidor é Express.
- `trust proxy` para `loopback` faz o Express confiar no IP repassado só quando há um proxy na própria máquina.
'''),
('  app.use((_req, res, next) => {', '''
Cabeçalhos de segurança em todas as respostas: impedem o navegador de adivinhar o tipo de arquivo, limitam o envio do endereço de origem e proíbem que o site seja exibido dentro de outro site (proteção contra *clickjacking*).
'''),
("  app.use(express.json({ limit: '8mb' }))", '''
Interpreta corpos JSON. O limite de 8 MB comporta até quatro fotos já reduzidas pelo navegador.
'''),
('  const api = express.Router()', '''
Agrupa todas as rotas da API sob `/api`. O `loadUser` roda antes de todas e identifica o usuário pelo token, se houver.
Rotas `/api` inexistentes devolvem 404 em JSON.
'''),
('  fs.mkdirSync(config.uploadsDir', '''
Serve as fotos enviadas em `/uploads`. Como cada arquivo tem nome aleatório e nunca muda, o navegador pode guardá-lo por 30 dias (`immutable`).
'''),
('  // Interface web compilada', '''
Se a interface estiver compilada, entrega os arquivos de `web/dist`. Qualquer outro endereço que não seja da API devolve o `index.html`: é o React que decide qual tela mostrar (aplicação de página única, SPA).
Sem a interface compilada, mostra uma mensagem orientando a rodar o build.
'''),
('  app.use((err, _req, res, _next) => {', '''
Tratador de erros central. Erros com `status` (os `fail(...)` das rotas) mostram a mensagem ao usuário. Erros inesperados aparecem no terminal, mas o usuário recebe só "Erro interno", para não expor detalhes técnicos.
O Express 5 encaminha para cá também os erros de funções `async`, por isso as rotas não precisam de `try/catch`.
'''),
]),
('server/src/realtime.js', '''
Comunicação em tempo real com Socket.IO: mensagens do chat, mudanças na contratação e notificações chegam sem recarregar a página.
''', [
('// Comunicação em tempo real', '''
Importações e a variável que guarda o servidor Socket.IO.
'''),
('export function attachRealtime', '''
Liga o Socket.IO ao servidor HTTP. O `io.use` é um filtro que roda na conexão: confere o token enviado pelo navegador e recusa quem não estiver logado.
'''),
("  io.on('connection'", '''
Cada usuário conectado entra numa "sala" com o próprio id. Assim o servidor envia um evento a uma pessoa específica, em todas as abas e aparelhos dela.
'''),
('export function emitTo', '''
Envia um evento para a sala de um usuário. Se o tempo real não estiver ligado (nos testes), não faz nada.
'''),
]),
('server/src/jobs.js', '''
Rotina periódica do RF16 (confirmação de atividade).
''', [
('// RF16', '''
Comentário e importações.
'''),
('export async function runActivityCheck', '''
Busca ofertas ativas confirmadas há mais de 30 dias que ainda não receberam aviso, ou cujo último aviso tem mais de 7 dias (para não mandar aviso todo dia).
`make_interval(days => $1)` monta o intervalo de tempo a partir do parâmetro.
'''),
('  for (const o of stale) {', '''
Para cada oferta encontrada, notifica o prestador com um link para o painel e marca a data do aviso.
'''),
('export function scheduleJobs()', '''
Roda a verificação 5 segundos depois de iniciar e depois a cada 6 horas. Um erro aqui só aparece no terminal e não derruba o servidor.
'''),
]),
]
