SLUG = '03-banco-de-dados'
TITLE = '3. Banco de dados'
INTRO = '''
O modelo de dados inteiro está num único arquivo SQL, executado a cada inicialização. Todos os comandos usam `IF NOT EXISTS`,
então rodar de novo não apaga nada. Convenções usadas em todas as tabelas:

- `serial PRIMARY KEY`: número inteiro gerado automaticamente que identifica a linha.
- `REFERENCES tabela(id)`: chave estrangeira; o banco recusa apontar para algo inexistente. `ON DELETE CASCADE` apaga junto as linhas dependentes.
- `CHECK (...)`: regra que o próprio banco garante, mesmo que o código tenha um erro.
- `timestamptz`: data e hora com fuso horário. `DEFAULT now()` preenche com o momento da gravação.
- Valores em dinheiro ficam em **centavos inteiros** (`_cents`), nunca em número com vírgula, para não haver erro de arredondamento.
'''
FILES = [
('server/src/schema.sql', '''
Cada bloco abaixo cria uma tabela e seus índices. Os comentários `RFxx` indicam a qual requisito funcional a tabela atende.
''', [
('-- Schema do ConectaBairro', '''
Ativa a extensão PostGIS, que acrescenta ao PostgreSQL o tipo `geography` e as funções de distância usadas na busca.
'''),
('CREATE TABLE IF NOT EXISTS users (', '''
**Usuários.** Uma pessoa pode ser contratante e prestadora ao mesmo tempo (`is_provider`).

- `phone` é único: é a identidade da conta (RF01), sem e-mail, CPF ou CNPJ.
- `role` separa os perfis especiais: `agente` (cadastro de campo), `moderador` e `instituicao` (painel de indicadores). O `CHECK` impede qualquer outro valor.
- `assisted_by` registra qual agente fez o cadastro assistido (RF03).
- `blocked` é usado pela moderação para suspender contas (RF15).
'''),
('-- RF01: códigos de verificação', '''
**Códigos de verificação do telefone.** O código de 6 dígitos nunca é guardado em texto: só o seu *hash* (`code_hash`).
`attempts` conta as tentativas erradas, `expires_at` dá a validade e `used` impede reaproveitar o código.
O índice por telefone e data acelera a busca do código mais recente.
'''),
('-- RF04: a posição exata', '''
**Localização do prestador**, a tabela mais sensível do sistema.

- `exact`: o ponto real informado pelo prestador. `geography(Point, 4326)` é um ponto em latitude e longitude no sistema GPS (código 4326), com distâncias calculadas em metros sobre a curvatura da Terra.
- `anchor`: o ponto público, deslocado de 100 a 300 m numa direção aleatória. **Todas as distâncias mostradas são calculadas a partir dele.**
- `service_radius_km`: até onde o prestador atende.
- O índice `gist` é um índice espacial: permite achar rapidamente quem está dentro de um raio sem medir a distância de todos os prestadores.

Nenhuma rota da API devolve as colunas `exact` ou `anchor`.
'''),
('-- RF02', '''
**Ofertas** (serviços ou produtos).

- `kind`: serviço ou produto.
- `price_min_cents` e `price_max_cents`: a faixa de preço, opcional (nulo significa "a combinar").
- `images`: lista dos endereços das fotos, em `jsonb` (JSON armazenado de forma estruturada).
- `status`: `ativa`, `pausada` pelo prestador ou `removida` (exclusão lógica: a linha continua existindo para o histórico das contratações).
- `search_text`: título, descrição e categoria sem acentos e em minúsculas, preparado para a busca por texto.
- `confirmed_at` e `confirm_notified_at`: controle do RF16 (última confirmação e último aviso enviado).
'''),
('-- RF14: visualizações', '''
**Visualizações das ofertas** para o painel do prestador. A chave primária composta (oferta, visitante, dia) faz cada visitante contar no máximo uma vez por dia.
'''),
('-- RF07', '''
**Conversas.** Cada par (oferta, contratante) tem uma única conversa, garantido pelo `UNIQUE (offer_id, client_id)`.
`last_message_at` ordena a lista de conversas pela mais recente.
'''),
('CREATE TABLE IF NOT EXISTS messages (', '''
**Mensagens do chat.**

- `sender_id` nulo indica mensagem do sistema (por exemplo "Serviço concluído").
- `kind`: texto comum, proposta ou sistema.
- `masked`: marca que dados de contato foram removidos da mensagem.
- `proposal_id`: liga a mensagem à proposta que ela exibe como cartão.
'''),
('CREATE TABLE IF NOT EXISTS conversation_reads (', '''
**Leitura das conversas.** Guarda, por usuário, o id da última mensagem lida. As mensagens com id maior são as "não lidas".
'''),
('-- RF09: contratação', '''
**Contratações.** O `CHECK` do `status` lista os seis estados da máquina de estados (ver `lib/contract-states.js`).
`amount_cents` e `deadline` só são preenchidos quando o contratante aceita uma proposta. `concluded_at` registra a conclusão.
Os índices por contratante e por prestador aceleram a tela "Contratações".
'''),
('-- RF08', '''
**Propostas.** Uma contratação pode ter várias (proposta recusada, nova proposta). O `CHECK (amount_cents > 0)` impede valor zero ou negativo.
`status`: pendente, aceita, recusada ou substituída (quando o prestador manda outra antes da resposta).
'''),
('CREATE TABLE IF NOT EXISTS contract_events (', '''
**Histórico da contratação.** Cada mudança de estado vira uma linha: de onde, para onde, quem fez e quando. Serve como trilha de auditoria.
'''),
('-- RF10: comissão', '''
**Comissão apurada.** Uma linha por contratação concluída, com valor bruto, taxa, comissão, valor líquido e o código único do comprovante.
Guardar a taxa usada protege o histórico caso a porcentagem mude no futuro.
'''),
('-- RF11', '''
**Avaliações.** Nota de 1 a 5 (garantida pelo `CHECK`). O `UNIQUE (contract_id, reviewer_id)` permite uma avaliação por pessoa por contratação.
`reviewee_id` é quem foi avaliado; o índice nessa coluna acelera o cálculo da reputação.
'''),
('-- RF13', '''
**Planos de destaque.** Período (`starts_at` a `ends_at`), categoria, plano, preço e o código do pagamento simulado.
O índice por oferta e data de término acelera a verificação "esta oferta está em destaque agora?", feita em toda busca.
'''),
('-- RF17', '''
**Notificações.** `read_at` nulo significa não lida; `link` é a tela que abre ao tocar na notificação.
'''),
('-- RF15', '''
**Denúncias.** `reporter_id` nulo indica sinalização automática (mensagem com dados de contato).
O alvo pode ser oferta, usuário ou mensagem (`target_type` + `target_id`). Guarda também a decisão, a justificativa, quem resolveu e quando.
'''),
('-- Plano de aplicação, etapa 1', '''
**Levantamento de campo** (Tabela 5 do artigo, etapa 1).

- `client_uuid` é gerado no aparelho do agente. Por ser único, se a fila offline enviar o mesmo registro duas vezes, a segunda é ignorada.
- `appears_on_maps`: resposta à pergunta "o negócio aparece em mapas digitais?", base do indicador principal do artigo.
- `barriers`: lista (`text[]`, vetor de textos) com os motivos declarados para não estar em plataformas digitais.
- `accepted`: se aceitou o cadastro; `provider_id` aponta para a conta criada.
- `collected_at`: quando foi coletado no campo, que pode ser bem antes de quando chegou ao servidor.
'''),
('-- Plano de aplicação, etapa 3', '''
**Questionário de satisfação** (etapa 3): grupo (prestador ou contratante), satisfação geral e facilidade de uso de 1 a 5, intenção de continuar usando e comentário.
'''),
]),
]
