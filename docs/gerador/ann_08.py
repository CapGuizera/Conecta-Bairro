SLUG = '08-dados-de-demonstracao-e-testes'
TITLE = '8. Dados de demonstração e testes'
INTRO = '''
O seed cria um bairro fictício completo para apresentar o sistema já com movimento. Os testes conferem as regras de negócio sensíveis e o fluxo
inteiro da API, como pede a disciplina de Qualidade e Testes de Software (Seção 5.5 do artigo).
'''
FILES = [
('server/src/seed.js', '''
Cria os dados de demonstração na primeira vez que o sistema sobe (`seedIfEmpty`), ou do zero com `npm run seed`.
''', [
('// Dados de demonstração', '''
Comentário e importações.
'''),
('// Gerador pseudoaleatório', '''
`rng` é o algoritmo *mulberry32*: com a mesma semente, gera sempre a mesma sequência de números "aleatórios".
Assim o bairro de demonstração sai **igual em todos os computadores** do grupo, o que facilita combinar a apresentação. O `Math.random` comum daria dados diferentes a cada vez.
'''),
('const rand = rng(', '''
O gerador com a semente fixa e `pick`, que sorteia um item de uma lista.
'''),
('function pointNear(', '''
Sorteia um ponto a até `maxMeters` do centro. A raiz quadrada (`Math.sqrt(rand())`) distribui os pontos por igual na área do círculo, sem amontoar no centro.
A conversão de metros para graus usa cerca de 111.320 m por grau, corrigindo a longitude pelo cosseno da latitude (os meridianos se aproximam longe do Equador).
'''),
('const daysAgo =', '''
Data de "n dias atrás" num horário definido, para espalhar o histórico pelo último mês e meio.
'''),
('const phone =', '''
Telefones de demonstração no formato `+551590000NNNN`, ou seja `(15) 90000-NNNN`.
'''),
('// Personas do artigo', '''
Os 16 prestadores fictícios com apresentação, raio de atendimento e ofertas. Os três primeiros são as **personas da Seção 4.3 do artigo**: Cleusa Batista (bolos e salgados), Marcelo Duarte (manutenção) e, entre os contratantes, Thiago Nunes.
Os preços estão em reais aqui e são convertidos para centavos na gravação. `null` significa "a combinar".
'''),
('const CLIENTS = [', '''
Moradores contratantes, começando pelo Thiago (persona 2).
'''),
('const STAFF = [', '''
Contas de equipe: agente de campo, moderação e associação de moradores (instituição).
'''),
('const REVIEW_COMMENTS', '''
Comentários de avaliação por nota, as barreiras sorteadas no levantamento (repetidas para pesarem mais no sorteio) e nomes de negócios abordados que não aceitaram o cadastro.
'''),
('export async function seed() {', '''
Tudo é criado dentro de **uma transação**: se algo falhar no meio, o banco não fica com dados pela metade. `run` é um atalho que devolve só as linhas.
'''),
('    for (const s of STAFF) {', '''
Cria as contas de equipe e os contratantes, guardando os ids em `ids` (indexado pelo número do telefone) para usar depois.
'''),
('    const offerIds = []', '''
Para cada prestador: cria a conta (a maioria marcada como vinda do cadastro assistido do agente) e grava o ponto exato e o ponto público deslocado, sorteados a até 2,2 km do centro do bairro.
'''),
('      for (const o of p.offers) {', '''
Grava as ofertas. A da Fernanda (número 18) fica com a última confirmação há 35 dias, para demonstrar o aviso de confirmação de atividade (RF16).
'''),
('    // Visualizações dos últimos 30 dias', '''
Gera entre 15 e 75 visualizações por oferta nos últimos 30 dias, para o gráfico do painel do prestador (RF14).
'''),
('    // Histórico de contratações', '''
Cria 26 contratações concluídas. As primeiras ficam concentradas nas ofertas da Cleusa e do Marcelo, para as personas terem reputação. Para cada uma:

- reaproveita ou cria a conversa e grava duas mensagens;
- cria a contratação concluída com valor sorteado dentro da faixa de preço da oferta (a dos docinhos, vendidos por unidade, é multiplicada por 80 unidades);
- grava a proposta aceita e os cinco eventos do histórico, de "solicitada" a "concluída";
- calcula a comissão com a **mesma função** usada pelo sistema real e grava o comprovante;
- grava as duas avaliações (cerca de 65% das notas do cliente são 5).
'''),
('    // Plano de destaque ativo', '''
Deixa a oferta de bolos da Cleusa em destaque, começado há 3 dias e terminando em 12 (RF13).
'''),
('    // Levantamento de campo', '''
Grava o levantamento dos prestadores que aceitaram o cadastro, a maioria marcada como ausente dos mapas digitais, com de 1 a 3 barreiras cada.
'''),
('    const cats = [', '''
E o levantamento dos 23 negócios que não aceitaram o cadastro, com categorias, presença nos mapas e barreiras. Com isso o painel de indicadores mostra a taxa de conversão e a proporção fora dos mapas.
'''),
('    // Questionário de satisfação', '''
Respostas do questionário de satisfação de contratantes e prestadores (etapa 3 do plano de avaliação).
'''),
('    // Uma denúncia aberta', '''
Uma denúncia aberta para a moderação ter o que analisar na demonstração (RF15).
'''),
('export async function seedIfEmpty()', '''
Só cria os dados se não houver nenhum usuário. É chamada a cada inicialização, então nunca apaga dados reais.
'''),
('export async function resetDatabase()', '''
Apaga tudo: remove o esquema `public` inteiro (tabelas e extensão) e o recria vazio.
'''),
('// Execução direta', '''
Quando o arquivo é executado diretamente (`npm run seed`), e não importado, abre o banco, apaga com `--reset`, reabre (o que recria as tabelas pelo `schema.sql`) e popula.
A comparação com `pathToFileURL` funciona igual no Windows, onde os caminhos usam barra invertida.
'''),
]),
('server/test/unit.test.js', '''
Testes das funções puras. `node:test` é o executor de testes do próprio Node e `assert/strict` faz as comparações. Cada `test(...)` é um caso independente; se uma comparação falha, o teste é marcado como falho com a diferença encontrada.
''', [
('// Testes unitários', '''
Importações das funções testadas.
'''),
("test('RF10:", '''
**Comissão**: R$ 150,00 gera R$ 9,00; os comentários mostram o valor exato e o arredondamento esperado (74,04 vira 74; 1,5 sobe para 2; 1,44 desce para 1). O laço confere que bruto é sempre comissão mais líquido, e os `throws` que valores inválidos são recusados.
'''),
("test('conversão de valores", '''
Conversão do que o usuário digita: "1.500,90" vira 150.090 centavos; campo vazio e texto que não é número viram `null`.
'''),
("test('RF09:", '''
**Máquina de estados**: o caminho completo permitido, as ações proibidas para o lado errado (403), as feitas no estado errado (409) e as ações oferecidas em cada estado.
'''),
("test('RF04: ponto público", '''
Gera 300 pontos deslocados e confere que **todos** estão entre 100 e 300 m do ponto real (com 1 m de tolerância para o arredondamento da conta).
'''),
("test('RF04: distância exibida", '''
Arredondamento da distância exibida e o piso de 0,5 km.
'''),
("test('RF07:", '''
**Filtro de contatos**: oito formas de passar contato (telefone com e sem formatação, com +55, e-mail, "zap", @perfil, site, "me liga") precisam ser removidas.
E quatro frases normais (preço, data e hora, quantidade, medida) **não podem** ser alteradas. Este segundo grupo é tão importante quanto o primeiro: um filtro exagerado atrapalharia a negociação.
'''),
("test('RF01:", '''
Normalização do celular nos formatos mais comuns e recusa dos inválidos.
'''),
("test('RF05:", '''
Busca por necessidade: as palavras irrelevantes são descartadas e frases do dia a dia chegam à categoria certa.
'''),
]),
('server/test/api.test.js', '''
Teste de integração: sobe a API de verdade numa porta livre, com banco PGlite em memória, e percorre o sistema como um usuário faria.
Os testes deste arquivo rodam em sequência e compartilham o estado (`ctx`), formando um único roteiro.
''', [
('// Testes de integração', '''
Define o ambiente de teste **antes** de importar o sistema (por isso os `await import` em vez de `import` no topo): assim a configuração já nasce em modo de teste.
`PROVIDER_POINT` é a localização real do prestador de teste, usada no fim para procurar vazamentos. `seen` guarda todas as respostas da API.
'''),
('async function api(', '''
Função auxiliar que chama a API com `fetch`, envia o token quando informado e **guarda cada resposta em `seen`** para a varredura de privacidade.
'''),
('async function login(', '''
Faz o login completo: pede o código, confirma e, se for conta nova, reenvia com o nome.
'''),
('test.before(', '''
Antes de tudo: abre o banco em memória e sobe o servidor na porta 0 (o sistema escolhe uma livre). Depois de tudo: desliga o servidor e fecha o banco.
'''),
('const ctx = {}', '''
Estado compartilhado entre os passos do roteiro.
'''),
("test('RF01:", '''
**Cadastro**: telefone inválido recusado, código errado recusado, código certo sem nome devolvendo `needsName`, criação do prestador, do contratante e de um terceiro ("intruso", usado para testar acessos indevidos). Entrar de novo não recria a conta.
'''),
("test('RF02 e RF04:", '''
O prestador grava a localização, um não prestador é impedido de publicar oferta (403) e a oferta é criada com o preço convertido para centavos.
'''),
("test('RF05 e RF06:", '''
**Busca**: encontra pela palavra e pela necessidade, com distância plausível; filtra por categoria; fica de fora a 6 km com raio de 2 km, mas aparece com raio de 10 km, marcada como fora da área de atendimento do prestador.
'''),
("test('RF07:", '''
**Chat**: cria a conversa sem duplicar, impede conversar com a própria oferta, remove o telefone da mensagem, cria a sinalização automática, bloqueia a leitura pelo intruso e confere que o telefone do contratante não aparece para o prestador.
'''),
("test('RF08, RF09 e RF10:", '''
**Contratação completa**, incluindo os desvios: solicitação duplicada (409), proposta enviada pelo contratante (403), proposta recusada e reenviada, conclusão antes da hora (409), aceite pelo lado errado (403).
No fim confere a comissão de **R$ 7,41 sobre R$ 123,45** (6% dá 7,407), o líquido, o formato do comprovante, a sequência exata dos estados no histórico, o acesso ao comprovante só pelas partes e que um estado final não muda mais.
'''),
("test('RF11 e RF12:", '''
**Avaliações**: as duas partes avaliam, repetir é recusado e a reputação do prestador mostra só a nota recebida como prestador (5), ignorando a que ele deu ao cliente.
'''),
("test('RF13 e RF14:", '''
**Destaque e painel**: um concorrente mais próximo aparece primeiro; depois do destaque, a oferta destacada passa à frente. O painel soma um contato, uma conclusão, o bruto e a comissão corretos.
'''),
("test('RF15:", '''
Denúncia aceita e fila da moderação inacessível para quem não é moderador.
'''),
("test('RF16:", '''
**Confirmação de atividade**: com 31 dias, a rotina avisa uma vez e não repete; com 46, a oferta some da busca; confirmada, volta.
'''),
("test('RF03 e RF18:", '''
**Cadastro assistido e fila offline**: envia um lote com dois registros, reenvia o mesmo (como faria a fila após uma queda de conexão) e confere que nada foi duplicado. Sem consentimento, é recusado. Por fim a prestadora entra com o próprio celular e encontra a conta pronta.
'''),
("test('privacidade:", '''
**O teste mais importante do RF04.** Percorre recursivamente **todas** as respostas recebidas nos testes anteriores (mais de 40) procurando:

- campos com nomes de coordenada (`lat`, `lng`, `latitude`, `exact`, `anchor`, `geom`...), exceto o centro público do bairro (`pilot`);
- qualquer número a menos de cerca de 1 km da coordenada real do prestador;
- textos que contenham a coordenada.

A lista de ocorrências precisa sair vazia. Depois confere no banco que o ponto público está mesmo entre 100 e 300 m do real.
'''),
]),
]
