SLUG = '04-regras-de-negocio'
TITLE = '4. Regras de negócio (server/src/lib)'
INTRO = '''
Funções "puras" ou quase puras, que não dependem de requisição HTTP. É aqui que estão as regras mais sensíveis citadas na Seção 5.5 do artigo:
cálculo da comissão, consistência dos estados da contratação e controle de exposição da localização. Por serem isoladas, são as mais fáceis de testar (ver `server/test/unit.test.js`).
'''
FILES = [
('server/src/lib/money.js', '''
Dinheiro (RF10). Regra de ouro: valores sempre em **centavos inteiros**. Em JavaScript, `0.1 + 0.2` dá `0.30000000000000004`; com inteiros esse problema não existe.
''', [
('// RF10', '''
Comentário com a regra do arquivo.
'''),
('// Comissão com arredondamento', '''
`computeCommission` recebe o valor bruto em centavos e a taxa (0,06).

- As duas primeiras verificações recusam valor não inteiro, zero, negativo ou taxa fora de 0 a 1.
- A taxa vira "partes por milhão" (`0.06` vira `60000`), um inteiro. Até `0.06 * 100` dá `6.000000000000001` em ponto flutuante, por isso a conta é feita com inteiros.
- `(bruto * ppm + 500000) / 1000000` com `Math.floor` é o arredondamento **meio para cima**: somar meio milhão antes de truncar faz 1,5 centavo virar 2 e 1,44 virar 1.
- O líquido é calculado por subtração, garantindo que **bruto = comissão + líquido** sempre, sem centavo perdido.
'''),
('export function formatBRL', '''
Formata centavos como moeda brasileira (`15000` vira `R$ 150,00`) usando a internacionalização nativa do JavaScript.
'''),
('// Converte "150"', '''
`parseMoneyToCents` aceita o que a pessoa digita: `150`, `150,5`, `1.500,00` ou `R$ 35,5`.

- Vazio vira `null` (preço "a combinar").
- Número já pronto só é multiplicado por 100.
- Remove `R$` e espaços. Se houver vírgula, o formato é brasileiro: os pontos são separadores de milhar (removidos) e a vírgula vira ponto decimal.
- Texto que não é número vira `null`.
'''),
]),
('server/src/lib/contract-states.js', '''
Máquina de estados da contratação (RF09). Todas as mudanças de estado passam por `nextStatus`, que decide se a ação é permitida. Concentrar a regra num lugar evita que uma rota esqueça alguma verificação.
''', [
('// RF09', '''
Diagrama em comentário com todas as transições possíveis.
'''),
('export const STATUS_LABELS', '''
Nome de cada estado para exibir na tela.
'''),
('export const TRANSITIONS', '''
Tabela de transições. Cada ação diz de quais estados pode partir (`from`), para qual vai (`to`) e quem pode executá-la (`by`): o prestador, o contratante ou qualquer um dos dois.
Exemplos: só o prestador propõe, inicia e conclui; só o contratante aceita ou recusa; ambos podem cancelar enquanto não estiver concluída.
'''),
('export const FINAL_STATUSES', '''
Estados finais: depois deles nada mais muda.
'''),
('// Retorna o novo estado', '''
`nextStatus` valida a ação em três passos e lança erro com o código HTTP adequado:

1. ação desconhecida: 400 (pedido inválido);
2. a pessoa está do lado errado (por exemplo, o prestador tentando aceitar a própria proposta): 403 (proibido);
3. o estado atual não permite a ação (por exemplo, concluir algo que nem começou): 409 (conflito).

Se tudo estiver certo, devolve o novo estado.
'''),
('// Ações disponíveis', '''
`availableActions` lista o que um lado pode fazer no estado atual. A interface usa essa lista para mostrar só os botões válidos, e o servidor confere de novo quando o botão é usado.
'''),
]),
('server/src/lib/geo.js', '''
Localização (RF04 e RF06). Aqui está a técnica que protege o endereço do prestador.
''', [
('// RF04 e RF06', '''
Importa `crypto` para sortear com um gerador seguro (não previsível). Raio médio da Terra em metros, usado na conta abaixo.
'''),
('export function validLatLng', '''
Confere se latitude e longitude são números válidos (latitude de -90 a 90, longitude de -180 a 180).
'''),
('// Desloca o ponto exato', '''
`randomAnchor` gera o **ponto público** a partir do ponto real:

- sorteia uma distância entre 100 e 300 m e uma direção (*bearing*) de 0 a 360 graus;
- converte graus em radianos (`φ` é a latitude, `λ` a longitude, `δ` a distância angular);
- aplica a fórmula do "ponto de destino" da trigonometria esférica, que calcula onde se chega andando aquela distância naquela direção sobre a superfície da Terra;
- devolve o resultado em graus.

Como as distâncias exibidas saem deste ponto, quem tentar triangular o endereço medindo de vários lugares chega, no máximo, ao ponto deslocado.
'''),
('// Distância exibida', '''
`approxDistance` prepara o que aparece na tela: arredonda em 100 m, nunca mostra menos que 0,5 km e usa o texto "menos de 0,5 km" para quem está muito perto. O número sai com vírgula, no formato brasileiro.
'''),
('export const RADIUS_OPTIONS_KM', '''
Opções do controle deslizante de raio (RF06) e o raio máximo aceito pela busca.
'''),
]),
('server/src/lib/text.js', '''
Tratamento de texto: busca, telefone e o filtro de contatos do chat.
''', [
('// Utilitários de texto', '''
Comentário do arquivo.
'''),
('export function normalize(s) {', '''
Deixa o texto comparável: `normalize('NFD')` separa letra e acento, o primeiro `replace` remove os acentos, tudo vai para minúsculas, sinais viram espaço e espaços repetidos viram um só.
Assim "Aniversário" e "aniversario" são iguais na busca.
'''),
('const STOPWORDS', '''
Palavras que não ajudam a buscar ("de", "para", "preciso", "alguém"...). Elas são descartadas de frases como "preciso de alguém para consertar meu chuveiro".
'''),
('export function searchTokens(query) {', '''
Quebra a busca em palavras, descarta as curtas (menos de 3 letras) e as da lista acima, e limita a 8 palavras para a consulta não ficar pesada.
'''),
('// Aceita "(15) 99876-5432"', '''
`normalizePhone` (RF01) mantém só os dígitos, tira o `55` do Brasil se veio junto, exige 10 dígitos (fixo) ou 11 (celular) e recusa DDD começando com zero.
Todos os telefones ficam gravados no mesmo formato (`+5515998765432`), então a mesma pessoa não cria duas contas digitando de jeitos diferentes.
'''),
('// RF07/RF15', '''
As expressões regulares que identificam formas de levar a negociação para fora da plataforma:

- `EMAIL_RE`: endereços de e-mail;
- `URL_RE`: links com `http`, `www` ou terminações como `.com` e `.com.br`;
- `HANDLE_RE`: perfis de rede social como `@cleusabolos`;
- `APP_RE`: menções como "whatsapp", "zap", "insta", "me liga", "meu número";
- `DIGIT_RUN_RE`: sequências de dígitos com espaços, pontos, traços ou parênteses, candidatas a telefone.

O `/gi` no fim significa "todas as ocorrências" e "ignorando maiúsculas e minúsculas".
'''),
('export function maskContacts(text) {', '''
`maskContacts` aplica os filtros em ordem e troca cada ocorrência por `[contato removido]`. A função `mark` registra que houve remoção.

Para os números, só remove sequências com **8 dígitos ou mais**: assim "R$ 120,00", "12/11 às 14h" e "2 bolos de 1,5 kg" continuam intactos, enquanto qualquer telefone (8 dígitos no mínimo) é removido.
Devolve o texto limpo e o indicador `masked`, que a rota usa para avisar o remetente e criar a sinalização automática para a moderação.
'''),
]),
('server/src/lib/categories.js', '''
Categorias de oferta e as palavras-chave da **busca por necessidade** (RF05).
''', [
('// Categorias e palavras-chave', '''
Cada categoria tem um identificador (`slug`, sem acento, usado no banco e na URL), um nome para exibição e uma lista de palavras associadas.
É isso que faz "meu chuveiro queimou" encontrar Manutenção residencial, ou "festa de aniversário" encontrar Alimentação, mesmo que nenhuma oferta tenha essas palavras exatas.
'''),
('export const CATEGORY_SLUGS', '''
Lista só dos identificadores (para validar o que chega na API) e uma função que devolve o nome de exibição de um identificador.
'''),
('// Categorias cujas palavras-chave', '''
`categoriesForTokens` devolve as categorias relacionadas às palavras buscadas. A comparação por prefixo nos dois sentidos aceita variações: "bolos" encontra "bolo", "conserto" encontra "consertar".
'''),
]),
('server/src/lib/http.js', '''
Utilitários das rotas: erro com código HTTP e validação de texto.
''', [
('export class HttpError', '''
Um erro que carrega o código HTTP (400, 403, 404...). O tratador de erros do `app.js` usa esse código na resposta.
'''),
('export const fail', '''
Atalho para interromper uma rota com erro: `fail(404, 'Oferta não encontrada')`.
'''),
('export function str(', '''
Valida campos de texto recebidos: aceita só texto (qualquer outra coisa vira vazio), tira espaços das pontas, exige preenchimento quando `required` e limita o tamanho.
O `name` deixa a mensagem de erro clara para o usuário ("Preencha o campo título").
'''),
]),
('server/src/lib/auth.js', '''
Autenticação (RF01): código de verificação, token de sessão e os "porteiros" que protegem as rotas.
''', [
('// RF01', '''
Importações: `crypto` para o código e o hash, `jsonwebtoken` para a sessão.
'''),
('export function hashCode', '''
Calcula o HMAC-SHA256 de "telefone:código" com a chave secreta do servidor. O banco só guarda esse resultado: quem tiver acesso ao banco não descobre os códigos.
Incluir o telefone impede reaproveitar o hash de um número em outro.
'''),
('export function generateCode', '''
Sorteia um número de 0 a 999.999 com gerador seguro e completa com zeros à esquerda (`7` vira `000007`).
'''),
('export function signToken', '''
Cria o token de sessão (JWT) com o id do usuário (`sub`), válido por 30 dias. O token é assinado: se alguém alterar o conteúdo, a assinatura deixa de bater.
'''),
('export async function userFromToken', '''
Confere a assinatura e a validade do token e busca o usuário. Devolve `null` se o token for inválido, se o usuário não existir mais ou se estiver bloqueado pela moderação.
'''),
('// Preenche req.user', '''
`loadUser` roda antes de todas as rotas: lê o cabeçalho `Authorization: Bearer <token>` e, se for válido, coloca o usuário em `req.user`. Não bloqueia ninguém, porque várias rotas (como a busca) são públicas.
'''),
('export function requireAuth', '''
Porteiro das rotas que exigem login: sem usuário, responde 401 pedindo para entrar.
'''),
('export const requireRole', '''
Porteiro por perfil, por exemplo `requireRole('moderador')`. É uma função que devolve outra função (*middleware*); responde 403 se o perfil não estiver na lista.
'''),
('export function requireProvider', '''
Porteiro das funções de prestador (publicar oferta, painel, destaque).
'''),
('// Dados do usuário que podem', '''
`publicUser` define o que terceiros podem ver de alguém: id, nome, se é prestador e desde quando. **Nunca telefone nem localização.**
`selfUser` acrescenta o telefone, o perfil e a apresentação, e só é usado para o próprio usuário.
'''),
]),
('server/src/lib/notify.js', '''
Notificações (RF17): gravadas no banco e enviadas na hora para quem estiver conectado.
''', [
('// RF17', '''
Importações.
'''),
('export async function notify(', '''
Grava a notificação e a envia pelo tempo real. O parâmetro `tx` permite gravar dentro de uma transação já aberta; sem ele, usa a consulta comum `q`.
'''),
('export function serializeNotification', '''
Converte a linha do banco (nomes com `_`) no formato enviado à interface (*camelCase*).
'''),
('export async function unreadCount', '''
Conta as notificações não lidas para o número no sino da barra superior.
'''),
]),
('server/src/lib/images.js', '''
Fotos das ofertas (RF02). O navegador já reduz a foto antes de enviar (ver `ImagePicker.jsx`); aqui o servidor valida e grava.
''', [
('// RF02', '''
Comentário e importações.
'''),
('const MAX_IMAGES', '''
Limites (4 fotos de até 1,5 MB) e as **assinaturas** de cada formato: os primeiros bytes de todo JPG, PNG e WEBP são sempre os mesmos.
Conferir os bytes, e não só a extensão do nome, impede enviar outro tipo de arquivo disfarçado de imagem.
'''),
('export function saveImages(list) {', '''
Começa validando que é uma lista dentro do limite e garante que a pasta de destino existe.
'''),
('  return list.map((item) => {', '''
Para cada item:

- se for o endereço de uma foto já salva (formato exato, nome com 32 caracteres hexadecimais), mantém. Isso permite editar a oferta sem reenviar as fotos;
- senão, espera um *data URL* (`data:image/jpeg;base64,...`), que é a imagem codificada em texto;
- decodifica o base64 em bytes, confere o tamanho e a assinatura;
- grava com nome aleatório e devolve o endereço público `/uploads/<nome>`.
'''),
]),
('server/src/lib/offers.js', '''
Trechos de SQL e a serialização de ofertas, compartilhados entre as rotas de busca, de detalhe e do painel.
''', [
('// Consultas e serialização', '''
Importações.
'''),
('// Reputação do prestador (RF12)', '''
`REPUTATION_JOIN` é um pedaço de SQL reaproveitado. O `LEFT JOIN LATERAL` executa, para cada prestador da consulta principal, três subconsultas:

- quantos serviços ele concluiu como prestador;
- a média das notas recebidas, arredondada em uma casa;
- quantas avaliações recebeu.

As avaliações só contam se ele era o **prestador** daquela contratação: notas recebidas quando ele contratou alguém não entram na reputação profissional.
'''),
('export const HIGHLIGHT_EXPR', '''
Expressão SQL que diz se a oferta tem um plano de destaque vigente agora (RF13).
'''),
('export function buildSearchText', '''
Monta o texto pesquisável da oferta (título, descrição e nome da categoria, normalizados).
'''),
('export function needsConfirmation', '''
Diz se a oferta passou de 30 dias sem confirmação (RF16).
'''),
('// Nunca inclui coordenadas', '''
`serializeOffer` transforma a linha do banco no formato da API. Este é o **único** ponto que monta ofertas para o navegador, e ele não tem como incluir coordenadas: só recebe a distância (`dist_m`), que já sai arredondada por `approxDistance`.

Também calcula `outsideServiceArea`, que avisa quando o morador está além do raio de atendimento do prestador, e só inclui os dados do prestador e a reputação quando a consulta os trouxe.
'''),
]),
]
