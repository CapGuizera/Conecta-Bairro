# 1. Inicialização e configuração

Estes arquivos são o primeiro contato de quem recebe o projeto: o `iniciar.bat` (Windows) e o `iniciar.sh` (Linux e macOS)
instalam, compilam e sobem o sistema; o `package.json` diz ao npm quais bibliotecas baixar e quais comandos existem;
o `.env.example` reúne as configurações; e o Docker é a alternativa opcional com PostgreSQL de verdade.

## `package.json`

Arquivo de manifesto do Node.js. O `npm install` lê este arquivo para saber o que baixar, e o `npm run <nome>` executa os comandos da seção `scripts`.
Há um único `package.json` para servidor e interface, de propósito: quem recebe o projeto roda só um `npm install`.

**Linhas 1 a 5**

```json
{
  "name": "conecta-bairro",
  "version": "1.0.0",
  "private": true,
  "description": "ConectaBairro: aplicação web de proximidade para o comércio e os serviços informais do bairro (UPX IV - FACENS)",
```

Nome interno do pacote, versão e `private: true`, que impede publicar o projeto no registro público do npm por engano.
A descrição é só informativa.

**Linha 6**

```json
  "type": "module",
```

`"type": "module"` faz o Node tratar os arquivos `.js` como **módulos ES** (sintaxe `import`/`export`), a mesma usada no navegador.

**Linhas 7 a 9**

```json
  "engines": {
    "node": ">=20.19.0"
  },
```

Declara a versão mínima do Node. O Vite 8 (ferramenta que compila a interface) exige 20.19 ou superior. O `iniciar.bat` confere isso antes de instalar.

**Linhas 10 a 18**

```json
  "scripts": {
    "dev": "node scripts/dev.js",
    "dev:server": "node --watch server/src/index.js",
    "dev:web": "vite --config web/vite.config.js",
    "build": "vite build --config web/vite.config.js",
    "start": "node server/src/index.js",
    "seed": "node server/src/seed.js --reset",
    "test": "node --test server/test/"
  },
```

Comandos do projeto, chamados com `npm run <nome>`:

- `dev`: modo desenvolvimento, com API e interface recarregando sozinhas ao salvar um arquivo (ver `scripts/dev.js`).
- `dev:server` e `dev:web`: as duas metades do modo desenvolvimento, caso se queira rodar separadas. O `--watch` do Node reinicia o servidor a cada alteração.
- `build`: compila a interface React para a pasta `web/dist`, que o servidor entrega ao navegador.
- `start`: sobe o sistema. É o que o `iniciar.bat` chama no fim.
- `seed`: apaga o banco e recria os dados de demonstração.
- `test`: roda os testes da pasta `server/test` com o executor de testes nativo do Node (`node --test`), sem biblioteca extra.

**Linhas 19 a 36**

```json
  "dependencies": {
    "@electric-sql/pglite": "^0.5.12",
    "@electric-sql/pglite-postgis": "^0.2.12",
    "@fontsource-variable/bricolage-grotesque": "^5.3.0",
    "@fontsource-variable/figtree": "^5.3.0",
    "express": "^5.3.0",
    "idb-keyval": "^6.3.0",
    "jsonwebtoken": "^9.0.3",
    "leaflet": "^1.9.4",
    "lucide-react": "^1.62.0",
    "pg": "^8.23.1",
    "react": "^19.3.1",
    "react-dom": "^19.3.1",
    "react-leaflet": "^5.0.0",
    "react-router-dom": "^7.18.5",
    "socket.io": "^4.8.4",
    "socket.io-client": "^4.8.4"
  },
```

Bibliotecas usadas pelo sistema em funcionamento:

- `@electric-sql/pglite` e `@electric-sql/pglite-postgis`: o PostgreSQL compilado para WebAssembly e a extensão geográfica PostGIS. É o que permite ter banco de dados sem instalar nada no Windows.
- `@fontsource-variable/figtree` e `@fontsource-variable/bricolage-grotesque`: as fontes do texto e dos títulos, instaladas junto com o projeto (funcionam sem internet e não dependem do Google Fonts).
- `express`: o servidor HTTP da API.
- `idb-keyval`: acesso simples ao IndexedDB do navegador, usado na fila offline do cadastro de campo (RF18).
- `jsonwebtoken`: gera e confere o token de sessão (JWT) depois que o telefone é verificado.
- `leaflet` e `react-leaflet`: os mapas, com os blocos de imagem do OpenStreetMap.
- `lucide-react`: os ícones em SVG da interface.
- `pg`: o cliente para um PostgreSQL tradicional, usado só quando existe `DATABASE_URL`.
- `react`, `react-dom` e `react-router-dom`: a interface e a navegação entre telas.
- `socket.io` e `socket.io-client`: a comunicação em tempo real do chat e das notificações (servidor e navegador).

O `^` antes da versão permite atualizações compatíveis; as versões exatas instaladas ficam travadas no `package-lock.json`.

**Linhas 37 a 42**

```json
  "devDependencies": {
    "@vitejs/plugin-react": "^6.1.2",
    "vite": "^8.3.5",
    "vite-plugin-pwa": "^2.0.0"
  }
}
```

Ferramentas usadas só para compilar a interface: o Vite, o plugin que entende React (JSX) e o plugin que transforma o site em aplicativo instalável (PWA).

---

## `iniciar.bat`

Script do Prompt de Comando do Windows. Ao receber dois cliques, ele confere o Node.js, instala as dependências só na primeira vez,
compila a interface se ela não existir, cria o `.env` e sobe o servidor abrindo o navegador.
O arquivo é salvo com quebra de linha do Windows (CRLF); o `.gitattributes` garante isso mesmo quando baixado pelo Git.

**Linhas 1 a 6**

```bat
@echo off
rem ============================================================
rem  ConectaBairro - inicializacao no Windows
rem  De dois cliques neste arquivo. Requer Node.js 22 LTS:
rem  https://nodejs.org
rem ============================================================
```

`@echo off` esconde os próprios comandos na tela, mostrando só as mensagens. As linhas `rem` são comentários.

**Linhas 7 a 10**

```bat
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title ConectaBairro
```

- `chcp 65001` muda o terminal para UTF-8, para os acentos das mensagens do servidor aparecerem certos.
- `setlocal` faz as variáveis criadas aqui valerem só durante este script.
- `cd /d "%~dp0"` entra na pasta onde o `.bat` está (`%~dp0` é "unidade e pasta deste arquivo"). Sem isso, um atalho ou um clique a partir de outra pasta rodaria os comandos no lugar errado. O `/d` permite trocar também de unidade (C: para D:).
- `title` define o título da janela.

**Linhas 12 a 21**

```bat
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js nao encontrado.
  echo  Instale a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)
```

`where node` procura o executável do Node no PATH. Se não achar (`errorlevel 1`), explica o problema, abre o site oficial para download e encerra com `exit /b 1`. O `pause` segura a janela aberta para a pessoa conseguir ler.

**Linha 23**

```bat
node scripts\check-node.js || (pause & exit /b 1)
```

Roda o verificador de versão. Se a versão do Node for antiga, ele retorna erro e o `||` executa `pause` e encerra.

**Linhas 25 a 29**

```bat
if not exist node_modules\ (
  echo Instalando dependencias, so na primeira vez. Pode levar alguns minutos...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto erro
)
```

Na primeira execução não existe a pasta `node_modules`, então instala as bibliotecas.
O `call` é obrigatório: no Windows o `npm` é outro arquivo `.cmd`, e sem `call` o script terminaria junto com ele.
`--no-audit --no-fund` só silencia mensagens que não importam aqui. Se falhar, vai para o rótulo `:erro`.

**Linhas 31 a 35**

```bat
if not exist web\dist\index.html (
  echo Preparando a interface...
  call npm run build
  if errorlevel 1 goto erro
)
```

Se a interface ainda não estiver compilada, compila. O ZIP já vem com ela pronta, então normalmente este passo é pulado.

**Linhas 37 a 39**

```bat
if not exist .env copy .env.example .env >nul

echo.
```

Cria o arquivo de configuração `.env` a partir do modelo na primeira vez, sem sobrescrever um já existente.

**Linhas 40 a 44**

```bat
echo Abrindo http://localhost:3000 no navegador...
start "" cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
node server\src\index.js
pause
exit /b 0
```

Abre o navegador alguns segundos depois. O `start "" cmd /c "timeout ..."` roda a espera numa janela separada, para não travar este script, e então abre o endereço.
Em seguida `node server\src\index.js` sobe o servidor nesta janela. Enquanto ela estiver aberta, o sistema está no ar.

**Linhas 46 a 51**

```bat
:erro
echo.
echo Algo deu errado. Veja a mensagem acima. Se for problema de rede,
echo verifique a internet e rode o iniciar.bat novamente.
pause
exit /b 1
```

Ponto de chegada dos erros de instalação ou compilação: mostra uma orientação e mantém a janela aberta.

---

## `iniciar.sh`

O equivalente do `iniciar.bat` para Linux e macOS, em Bash.

**Linhas 1 a 4**

```bash
#!/usr/bin/env bash
# ConectaBairro - inicialização no Linux e macOS. Requer Node.js 22 LTS.
set -e
cd "$(dirname "$0")"
```

A primeira linha (*shebang*) diz ao sistema para executar o arquivo com o Bash.
`set -e` encerra o script no primeiro comando que falhar. `cd "$(dirname "$0")"` entra na pasta do script.

**Linhas 6 a 10**

```bash
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js não encontrado. Instale a versão LTS em https://nodejs.org"
  exit 1
fi
node scripts/check-node.js
```

Confere se o Node existe e se a versão é suficiente.

**Linhas 12 a 20**

```bash
if [ ! -d node_modules ]; then
  echo "Instalando dependências (só na primeira vez)..."
  npm install --no-audit --no-fund
fi
if [ ! -f web/dist/index.html ]; then
  echo "Preparando a interface..."
  npm run build
fi
[ -f .env ] || cp .env.example .env
```

Instala as dependências na primeira vez, compila a interface se necessário e cria o `.env` a partir do modelo.

**Linhas 22 a 23**

```bash
( sleep 6; (xdg-open http://localhost:3000 || open http://localhost:3000) >/dev/null 2>&1 || true ) &
exec node server/src/index.js
```

Em segundo plano (o `&` no fim), espera 6 segundos e abre o navegador com `xdg-open` (Linux) ou `open` (macOS).
O `exec` substitui o script pelo servidor, para o `Ctrl+C` encerrar o Node diretamente.

---

## `scripts/check-node.js`

Verificação da versão do Node, escrita em JavaScript para funcionar igual em todos os sistemas.

**Linhas 1 a 3**

```js
// Verifica a versão do Node antes de instalar (Vite 8 exige 20.19 ou superior).
const [major, minor] = process.versions.node.split('.').map(Number)
const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major >= 23
```

`process.versions.node` é algo como `"22.12.0"`; o `split('.')` separa as partes e o `map(Number)` transforma em números.
As versões aceitas são as mesmas exigidas pelo Vite 8: 20.19 ou mais, 22.12 ou mais, ou 23 em diante.

**Linhas 4 a 7**

```js
if (!ok) {
  console.error(`\nNode.js ${process.versions.node} é antigo demais. Instale a versão LTS em https://nodejs.org (22 ou mais recente).\n`)
  process.exit(1)
}
```

Se a versão não serve, mostra a orientação e sai com código 1, que o `.bat` e o `.sh` interpretam como erro.

---

## `scripts/dev.js`

Liga ao mesmo tempo o servidor da API e o servidor de desenvolvimento do Vite. Ferramentas como `concurrently` resolveriam isso,
mas este script em Node puro evita mais uma dependência e funciona igual no Windows.

**Linhas 1 a 7**

```js
// Modo desenvolvimento: API com recarga automática + Vite com recarga da interface.
// Feito em Node puro para funcionar igual no Windows, Linux e macOS.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
```

Importa `spawn`, que cria processos filhos, e descobre a pasta raiz do projeto a partir da localização deste arquivo (`import.meta.url`).

**Linha 8**

```js
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
```

Caminho do executável do Vite dentro de `node_modules`. Usar `process.execPath` (o próprio Node) em vez do comando `vite` evita as diferenças do Windows com arquivos `.cmd`.

**Linhas 9 a 12**

```js
const procs = [
  spawn(process.execPath, ['--watch', 'server/src/index.js'], { cwd: root, stdio: 'inherit' }),
  spawn(process.execPath, [vite, '--config', 'web/vite.config.js'], { cwd: root, stdio: 'inherit' }),
]
```

Cria os dois processos: o servidor com `--watch` (reinicia ao salvar) e o Vite. `stdio: 'inherit'` faz as mensagens dos dois aparecerem neste terminal.

**Linha 13**

```js
console.log('Interface em desenvolvimento: http://localhost:5173 (a API roda na porta 3000)')
```

A interface de desenvolvimento fica na porta 5173; o Vite repassa as chamadas `/api` para o servidor na porta 3000 (ver `web/vite.config.js`).

**Linhas 14 a 20**

```js
const stop = () => {
  for (const p of procs) p.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
for (const p of procs) p.on('exit', (code) => code && stop())
```

Ao receber `Ctrl+C` (SIGINT) ou pedido de encerramento (SIGTERM), encerra os dois processos. Se um deles terminar com erro, o outro também é encerrado, para não ficar meio sistema no ar.

---

## `.env.example`

Modelo de configuração. Na primeira execução vira `.env`, que é lido por `server/src/config.js`. Linhas com `#` são comentários.

**Linhas 1 a 2**

```ini
# Configuração do ConectaBairro. Copie para ".env" e ajuste se precisar
# (os scripts iniciar.bat / iniciar.sh fazem a cópia automaticamente).
```

Cabeçalho explicando o uso do arquivo.

**Linhas 4 a 5**

```ini
# Porta do servidor. Troque se a 3000 já estiver em uso.
PORT=3000
```

Porta HTTP. Se outro programa usar a 3000, troque aqui (por exemplo 3001) e acesse `http://localhost:3001`.

**Linhas 7 a 8**

```ini
# "dev": o código de verificação aparece na tela (não envia SMS). Mantenha assim no protótipo.
SMS_MODE=dev
```

No modo `dev` o código de verificação aparece na tela de login em vez de ser enviado por SMS, pois o protótipo não tem contrato com provedor de SMS.

**Linhas 10 a 13**

```ini
# Centro do bairro piloto (usado quando o morador não compartilha a localização).
PILOT_NAME=Bairro piloto - Sorocaba/SP
PILOT_LAT=-23.4806
PILOT_LNG=-47.4205
```

Nome e coordenadas do centro do bairro piloto. É o ponto de busca usado quando o morador não compartilha a localização e o centro dos dados de demonstração.

**Linhas 15 a 17**

```ini
# Banco de dados. Vazio = PGlite embutido (não precisa instalar nada).
# Para usar PostgreSQL + PostGIS (por exemplo o do docker compose):
# DATABASE_URL=postgres://conecta:conecta@localhost:5432/conecta
```

Sem `DATABASE_URL`, o sistema usa o banco embutido. Com ela, conecta a um PostgreSQL com PostGIS (por exemplo o do `docker-compose.yml`).

**Linhas 19 a 20**

```ini
# Segredo das sessões. Vazio = gerado automaticamente em server/data/.jwt-secret
JWT_SECRET=
```

Chave usada para assinar os tokens de sessão. Se ficar vazia, o sistema gera uma aleatória e guarda em `server/data/.jwt-secret`, para as sessões sobreviverem a reinícios.

---

## `Dockerfile`

Receita de uma imagem Docker da aplicação, usada só pela alternativa com Docker. Tem dois estágios: um compila, o outro só executa.

**Linhas 1 a 7**

```dockerfile
# Imagem opcional da aplicação (o caminho principal é rodar com Node direto).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev
```

Estágio `build`: parte da imagem oficial do Node 22 em Alpine Linux (pequena), copia primeiro só `package.json` e `package-lock.json` e instala com `npm ci` (instalação exata pelo lock).
Copiar esses dois arquivos antes do resto aproveita o cache do Docker: se só o código mudar, a instalação não é refeita.
Depois copia o código, compila a interface e remove as ferramentas de desenvolvimento (`npm prune --omit=dev`).

**Linhas 9 a 14**

```dockerfile
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["node", "server/src/index.js"]
```

Segundo estágio: uma imagem limpa que recebe o resultado do primeiro. `EXPOSE 3000` documenta a porta e `CMD` define o comando de partida.

---

## `docker-compose.yml`

Sobe dois containers com `docker compose up --build`: o PostgreSQL com PostGIS e a aplicação ligada a ele.

**Linhas 1 a 4**

```yaml
# Alternativa com PostgreSQL + PostGIS "de verdade" (Docker Desktop no Windows).
#   docker compose up --build
# Depois acesse http://localhost:3000
services:
```

Comentário de uso.

**Linhas 5 a 16**

```yaml
  db:
    image: postgis/postgis:17-3.5
    environment:
      POSTGRES_USER: conecta
      POSTGRES_PASSWORD: conecta
      POSTGRES_DB: conecta
    volumes:
      - dados:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U conecta"]
      interval: 3s
      retries: 20
```

Serviço `db`: imagem oficial `postgis/postgis` (PostgreSQL 17 com PostGIS 3.5). As variáveis criam usuário, senha e banco.
O volume `dados` mantém os dados mesmo se o container for recriado. O `healthcheck` usa `pg_isready` para saber quando o banco aceita conexões.

**Linhas 17 a 26**

```yaml
  app:
    build: .
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://conecta:conecta@db:5432/conecta
      SMS_MODE: dev
    ports:
      - "3000:3000"
```

Serviço `app`: construído pelo `Dockerfile`. Só inicia quando o banco estiver saudável (`condition: service_healthy`).
A `DATABASE_URL` aponta para o host `db`, que é o nome do outro serviço na rede interna do Compose. A porta 3000 do container é publicada na 3000 do computador.

**Linhas 27 a 28**

```yaml
volumes:
  dados:
```

Declaração do volume nomeado usado pelo banco.

---

## `.gitignore`

Arquivos que o Git não deve guardar no repositório.

**Linhas 1 a 8**

```gitignore
node_modules/
web/dist/
server/data/
.env
*.log
.DS_Store
Thumbs.db
__pycache__/
```

- `node_modules/`: as bibliotecas, que cada um baixa com `npm install`;
- `web/dist/`: a interface compilada, gerada pelo `npm run build`;
- `server/data/`: o banco de dados, as fotos enviadas e a chave das sessões. Cada computador tem os seus;
- `.env`: a configuração local, que pode ter senhas;
- registros (`*.log`) e arquivos que o macOS e o Windows criam sozinhos nas pastas (`.DS_Store`, `Thumbs.db`).
- `__pycache__/`: arquivos temporários que o Python cria ao rodar o gerador desta documentação.

---

## `.gitattributes`

Regras de quebra de linha do Git, importantes para o projeto funcionar tanto no Windows quanto no Linux.

**Linhas 1 a 3**

```gitattributes
* text=auto eol=lf
*.bat text eol=crlf
*.png binary
```

- Todos os arquivos de texto usam a quebra de linha do Linux (LF), inclusive para quem clona no Windows.
- Os `.bat` usam a quebra do Windows (CRLF). Sem isso, o Prompt de Comando pode interpretar o script de forma errada.
- Os `.png` são binários e nunca devem ser alterados.

---

## `.dockerignore`

O que não entra na imagem Docker.

**Linhas 1 a 5**

```gitignore
node_modules
web/dist
server/data
.env
.git
```

As mesmas pastas locais do `.gitignore`, mais a pasta `.git`. A imagem instala e compila tudo por conta própria, então copiar essas pastas só deixaria a construção mais lenta.

---
