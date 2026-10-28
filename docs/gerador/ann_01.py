SLUG = '01-inicializacao-e-configuracao'
TITLE = '1. Inicialização e configuração'
INTRO = '''
Estes arquivos são o primeiro contato de quem recebe o projeto: o `iniciar.bat` (Windows) e o `iniciar.sh` (Linux e macOS)
instalam, compilam e sobem o sistema; o `package.json` diz ao npm quais bibliotecas baixar e quais comandos existem;
o `.env.example` reúne as configurações; e o Docker é a alternativa opcional com PostgreSQL de verdade.
'''
FILES = [
('package.json', '''
Arquivo de manifesto do Node.js. O `npm install` lê este arquivo para saber o que baixar, e o `npm run <nome>` executa os comandos da seção `scripts`.
Há um único `package.json` para servidor e interface, de propósito: quem recebe o projeto roda só um `npm install`.
''', [
('{', '''
Nome interno do pacote, versão e `private: true`, que impede publicar o projeto no registro público do npm por engano.
A descrição é só informativa.
'''),
('"type": "module"', '''
`"type": "module"` faz o Node tratar os arquivos `.js` como **módulos ES** (sintaxe `import`/`export`), a mesma usada no navegador.
'''),
('"engines"', '''
Declara a versão mínima do Node. O Vite 8 (ferramenta que compila a interface) exige 20.19 ou superior. O `iniciar.bat` confere isso antes de instalar.
'''),
('"scripts"', '''
Comandos do projeto, chamados com `npm run <nome>`:

- `dev`: modo desenvolvimento, com API e interface recarregando sozinhas ao salvar um arquivo (ver `scripts/dev.js`).
- `dev:server` e `dev:web`: as duas metades do modo desenvolvimento, caso se queira rodar separadas. O `--watch` do Node reinicia o servidor a cada alteração.
- `build`: compila a interface React para a pasta `web/dist`, que o servidor entrega ao navegador.
- `start`: sobe o sistema. É o que o `iniciar.bat` chama no fim.
- `seed`: apaga o banco e recria os dados de demonstração.
- `test`: roda os testes da pasta `server/test` com o executor de testes nativo do Node (`node --test`), sem biblioteca extra.
'''),
('"dependencies"', '''
Bibliotecas usadas pelo sistema em funcionamento:

- `@electric-sql/pglite` e `@electric-sql/pglite-postgis`: o PostgreSQL compilado para WebAssembly e a extensão geográfica PostGIS. É o que permite ter banco de dados sem instalar nada no Windows.
- `express`: o servidor HTTP da API.
- `idb-keyval`: acesso simples ao IndexedDB do navegador, usado na fila offline do cadastro de campo (RF18).
- `jsonwebtoken`: gera e confere o token de sessão (JWT) depois que o telefone é verificado.
- `leaflet` e `react-leaflet`: os mapas, com os blocos de imagem do OpenStreetMap.
- `lucide-react`: os ícones em SVG da interface.
- `pg`: o cliente para um PostgreSQL tradicional, usado só quando existe `DATABASE_URL`.
- `react`, `react-dom` e `react-router-dom`: a interface e a navegação entre telas.
- `socket.io` e `socket.io-client`: a comunicação em tempo real do chat e das notificações (servidor e navegador).

O `^` antes da versão permite atualizações compatíveis; as versões exatas instaladas ficam travadas no `package-lock.json`.
'''),
('"devDependencies"', '''
Ferramentas usadas só para compilar a interface: o Vite, o plugin que entende React (JSX) e o plugin que transforma o site em aplicativo instalável (PWA).
'''),
]),
('iniciar.bat', '''
Script do Prompt de Comando do Windows. Ao receber dois cliques, ele confere o Node.js, instala as dependências só na primeira vez,
compila a interface se ela não existir, cria o `.env` e sobe o servidor abrindo o navegador.
O arquivo é salvo com quebra de linha do Windows (CRLF); o `.gitattributes` garante isso mesmo quando baixado pelo Git.
''', [
('@echo off', '''
`@echo off` esconde os próprios comandos na tela, mostrando só as mensagens. As linhas `rem` são comentários.
'''),
('chcp 65001', '''
- `chcp 65001` muda o terminal para UTF-8, para os acentos das mensagens do servidor aparecerem certos.
- `setlocal` faz as variáveis criadas aqui valerem só durante este script.
- `cd /d "%~dp0"` entra na pasta onde o `.bat` está (`%~dp0` é "unidade e pasta deste arquivo"). Sem isso, um atalho ou um clique a partir de outra pasta rodaria os comandos no lugar errado. O `/d` permite trocar também de unidade (C: para D:).
- `title` define o título da janela.
'''),
('where node', '''
`where node` procura o executável do Node no PATH. Se não achar (`errorlevel 1`), explica o problema, abre o site oficial para download e encerra com `exit /b 1`. O `pause` segura a janela aberta para a pessoa conseguir ler.
'''),
(r'node scripts\check-node.js', '''
Roda o verificador de versão. Se a versão do Node for antiga, ele retorna erro e o `||` executa `pause` e encerra.
'''),
(r'if not exist node_modules\ (', '''
Na primeira execução não existe a pasta `node_modules`, então instala as bibliotecas.
O `call` é obrigatório: no Windows o `npm` é outro arquivo `.cmd`, e sem `call` o script terminaria junto com ele.
`--no-audit --no-fund` só silencia mensagens que não importam aqui. Se falhar, vai para o rótulo `:erro`.
'''),
(r'if not exist web\dist\index.html (', '''
Se a interface ainda não estiver compilada, compila. O ZIP já vem com ela pronta, então normalmente este passo é pulado.
'''),
('if not exist .env', '''
Cria o arquivo de configuração `.env` a partir do modelo na primeira vez, sem sobrescrever um já existente.
'''),
('echo Abrindo', '''
Abre o navegador alguns segundos depois. O `start "" cmd /c "timeout ..."` roda a espera numa janela separada, para não travar este script, e então abre o endereço.
Em seguida `node server\\src\\index.js` sobe o servidor nesta janela. Enquanto ela estiver aberta, o sistema está no ar.
'''),
(':erro', '''
Ponto de chegada dos erros de instalação ou compilação: mostra uma orientação e mantém a janela aberta.
'''),
]),
('iniciar.sh', '''
O equivalente do `iniciar.bat` para Linux e macOS, em Bash.
''', [
('#!/usr/bin/env bash', '''
A primeira linha (*shebang*) diz ao sistema para executar o arquivo com o Bash.
`set -e` encerra o script no primeiro comando que falhar. `cd "$(dirname "$0")"` entra na pasta do script.
'''),
('if ! command -v node', '''
Confere se o Node existe e se a versão é suficiente.
'''),
('if [ ! -d node_modules ]', '''
Instala as dependências na primeira vez, compila a interface se necessário e cria o `.env` a partir do modelo.
'''),
('( sleep 6;', '''
Em segundo plano (o `&` no fim), espera 6 segundos e abre o navegador com `xdg-open` (Linux) ou `open` (macOS).
O `exec` substitui o script pelo servidor, para o `Ctrl+C` encerrar o Node diretamente.
'''),
]),
('scripts/check-node.js', '''
Verificação da versão do Node, escrita em JavaScript para funcionar igual em todos os sistemas.
''', [
('// Verifica', '''
`process.versions.node` é algo como `"22.12.0"`; o `split('.')` separa as partes e o `map(Number)` transforma em números.
As versões aceitas são as mesmas exigidas pelo Vite 8: 20.19 ou mais, 22.12 ou mais, ou 23 em diante.
'''),
('if (!ok)', '''
Se a versão não serve, mostra a orientação e sai com código 1, que o `.bat` e o `.sh` interpretam como erro.
'''),
]),
('scripts/dev.js', '''
Liga ao mesmo tempo o servidor da API e o servidor de desenvolvimento do Vite. Ferramentas como `concurrently` resolveriam isso,
mas este script em Node puro evita mais uma dependência e funciona igual no Windows.
''', [
('// Modo desenvolvimento', '''
Importa `spawn`, que cria processos filhos, e descobre a pasta raiz do projeto a partir da localização deste arquivo (`import.meta.url`).
'''),
('const vite =', '''
Caminho do executável do Vite dentro de `node_modules`. Usar `process.execPath` (o próprio Node) em vez do comando `vite` evita as diferenças do Windows com arquivos `.cmd`.
'''),
('const procs = [', '''
Cria os dois processos: o servidor com `--watch` (reinicia ao salvar) e o Vite. `stdio: 'inherit'` faz as mensagens dos dois aparecerem neste terminal.
'''),
('console.log(', '''
A interface de desenvolvimento fica na porta 5173; o Vite repassa as chamadas `/api` para o servidor na porta 3000 (ver `web/vite.config.js`).
'''),
('const stop = () => {', '''
Ao receber `Ctrl+C` (SIGINT) ou pedido de encerramento (SIGTERM), encerra os dois processos. Se um deles terminar com erro, o outro também é encerrado, para não ficar meio sistema no ar.
'''),
]),
('.env.example', '''
Modelo de configuração. Na primeira execução vira `.env`, que é lido por `server/src/config.js`. Linhas com `#` são comentários.
''', [
('# Configuração do ConectaBairro', '''
Cabeçalho explicando o uso do arquivo.
'''),
('# Porta do servidor', '''
Porta HTTP. Se outro programa usar a 3000, troque aqui (por exemplo 3001) e acesse `http://localhost:3001`.
'''),
('# "dev"', '''
No modo `dev` o código de verificação aparece na tela de login em vez de ser enviado por SMS, pois o protótipo não tem contrato com provedor de SMS.
'''),
('# Centro do bairro piloto', '''
Nome e coordenadas do centro do bairro piloto. É o ponto de busca usado quando o morador não compartilha a localização e o centro dos dados de demonstração.
'''),
('# Banco de dados.', '''
Sem `DATABASE_URL`, o sistema usa o banco embutido. Com ela, conecta a um PostgreSQL com PostGIS (por exemplo o do `docker-compose.yml`).
'''),
('# Segredo das sessões.', '''
Chave usada para assinar os tokens de sessão. Se ficar vazia, o sistema gera uma aleatória e guarda em `server/data/.jwt-secret`, para as sessões sobreviverem a reinícios.
'''),
]),
('Dockerfile', '''
Receita de uma imagem Docker da aplicação, usada só pela alternativa com Docker. Tem dois estágios: um compila, o outro só executa.
''', [
('# Imagem opcional', '''
Estágio `build`: parte da imagem oficial do Node 22 em Alpine Linux (pequena), copia primeiro só `package.json` e `package-lock.json` e instala com `npm ci` (instalação exata pelo lock).
Copiar esses dois arquivos antes do resto aproveita o cache do Docker: se só o código mudar, a instalação não é refeita.
Depois copia o código, compila a interface e remove as ferramentas de desenvolvimento (`npm prune --omit=dev`).
'''),
('=FROM node:22-alpine', '''
Segundo estágio: uma imagem limpa que recebe o resultado do primeiro. `EXPOSE 3000` documenta a porta e `CMD` define o comando de partida.
'''),
]),
('docker-compose.yml', '''
Sobe dois containers com `docker compose up --build`: o PostgreSQL com PostGIS e a aplicação ligada a ele.
''', [
('# Alternativa com', '''
Comentário de uso.
'''),
('  db:', '''
Serviço `db`: imagem oficial `postgis/postgis` (PostgreSQL 17 com PostGIS 3.5). As variáveis criam usuário, senha e banco.
O volume `dados` mantém os dados mesmo se o container for recriado. O `healthcheck` usa `pg_isready` para saber quando o banco aceita conexões.
'''),
('  app:', '''
Serviço `app`: construído pelo `Dockerfile`. Só inicia quando o banco estiver saudável (`condition: service_healthy`).
A `DATABASE_URL` aponta para o host `db`, que é o nome do outro serviço na rede interna do Compose. A porta 3000 do container é publicada na 3000 do computador.
'''),
('volumes:', '''
Declaração do volume nomeado usado pelo banco.
'''),
]),
('.gitignore', '''
Arquivos que o Git não deve guardar no repositório.
''', [
('node_modules/', '''
- `node_modules/`: as bibliotecas, que cada um baixa com `npm install`;
- `web/dist/`: a interface compilada, gerada pelo `npm run build`;
- `server/data/`: o banco de dados, as fotos enviadas e a chave das sessões. Cada computador tem os seus;
- `.env`: a configuração local, que pode ter senhas;
- registros (`*.log`) e arquivos que o macOS e o Windows criam sozinhos nas pastas (`.DS_Store`, `Thumbs.db`).
- `__pycache__/`: arquivos temporários que o Python cria ao rodar o gerador desta documentação.
'''),
]),
('.gitattributes', '''
Regras de quebra de linha do Git, importantes para o projeto funcionar tanto no Windows quanto no Linux.
''', [
('* text=auto eol=lf', '''
- Todos os arquivos de texto usam a quebra de linha do Linux (LF), inclusive para quem clona no Windows.
- Os `.bat` usam a quebra do Windows (CRLF). Sem isso, o Prompt de Comando pode interpretar o script de forma errada.
- Os `.png` são binários e nunca devem ser alterados.
'''),
]),
('.dockerignore', '''
O que não entra na imagem Docker.
''', [
('node_modules', '''
As mesmas pastas locais do `.gitignore`, mais a pasta `.git`. A imagem instala e compila tudo por conta própria, então copiar essas pastas só deixaria a construção mais lenta.
'''),
]),
]
