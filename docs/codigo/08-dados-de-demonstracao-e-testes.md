# 8. Dados de demonstração e testes

O seed cria um bairro fictício completo para apresentar o sistema já com movimento. Os testes conferem as regras de negócio sensíveis e o fluxo
inteiro da API, como pede a disciplina de Qualidade e Testes de Software (Seção 5.5 do artigo).

## `server/src/seed.js`

Cria os dados de demonstração na primeira vez que o sistema sobe (`seedIfEmpty`), ou do zero com `npm run seed`.

**Linhas 1 a 8**

```js
// Dados de demonstração do bairro piloto. Roda automaticamente quando o banco está vazio.
// Para recriar do zero: npm run seed
import { pathToFileURL } from 'node:url'
import { config } from './config.js'
import { closeDb, db, initDb, one } from './db.js'
import { randomAnchor } from './lib/geo.js'
import { computeCommission } from './lib/money.js'
import { buildSearchText } from './lib/offers.js'
```

Comentário e importações.

**Linhas 10 a 20**

```js
// Gerador pseudoaleatório com semente fixa: o seed sai igual em todas as máquinas.
function rng(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

`rng` é o algoritmo *mulberry32*: com a mesma semente, gera sempre a mesma sequência de números "aleatórios".
Assim o bairro de demonstração sai **igual em todos os computadores** do grupo, o que facilita combinar a apresentação. O `Math.random` comum daria dados diferentes a cada vez.

**Linhas 21 a 22**

```js
const rand = rng(20260910)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]
```

O gerador com a semente fixa e `pick`, que sorteia um item de uma lista.

**Linhas 24 a 31**

```js
function pointNear(lat, lng, maxMeters) {
  const d = Math.sqrt(rand()) * maxMeters
  const angle = rand() * 2 * Math.PI
  return {
    lat: lat + (d * Math.sin(angle)) / 111_320,
    lng: lng + (d * Math.cos(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180)),
  }
}
```

Sorteia um ponto a até `maxMeters` do centro. A raiz quadrada (`Math.sqrt(rand())`) distribui os pontos por igual na área do círculo, sem amontoar no centro.
A conversão de metros para graus usa cerca de 111.320 m por grau, corrigindo a longitude pelo cosseno da latitude (os meridianos se aproximam longe do Equador).

**Linhas 33 a 37**

```js
const daysAgo = (n, hour = 10) => {
  const d = new Date(Date.now() - n * 86_400_000)
  d.setHours(hour, Math.floor(rand() * 60), 0, 0)
  return d.toISOString()
}
```

Data de "n dias atrás" num horário definido, para espalhar o histórico pelo último mês e meio.

**Linha 39**

```js
const phone = (n) => `+551590000${String(n).padStart(4, '0')}`
```

Telefones de demonstração no formato `+551590000NNNN`, ou seja `(15) 90000-NNNN`.

**Linhas 41 a 87**

```js
// Personas do artigo (Seção 4.3) e demais moradores fictícios.
const PROVIDERS = [
  {
    n: 1, name: 'Cleusa Batista', bio: 'Faço bolos e salgados por encomenda há mais de 20 anos, tudo caseiro.', radius: 3,
    offers: [
      { kind: 'produto', category: 'alimentacao', title: 'Bolos caseiros por encomenda', description: 'Bolo de cenoura, fubá, chocolate e bolos recheados para aniversário. Encomendas com 2 dias de antecedência.', min: 35, max: 120, unit: 'por bolo' },
      { kind: 'produto', category: 'alimentacao', title: 'Salgados fritos para festa', description: 'Coxinha, risoles, bolinha de queijo e kibe. Cento congelado ou frito na hora.', min: 60, max: 85, unit: 'por cento' },
    ],
  },
  {
    n: 3, name: 'Marcelo Duarte', bio: 'Técnico em manutenção residencial. Atendo no seu endereço.', radius: 6,
    offers: [
      { kind: 'servico', category: 'manutencao', title: 'Eletricista: tomadas, chuveiro e disjuntor', description: 'Troca de chuveiro e resistência, instalação de tomadas, ventilador de teto e revisão do quadro de energia.', min: 80, max: 250, unit: 'por serviço' },
      { kind: 'servico', category: 'manutencao', title: 'Pequenos reparos hidráulicos', description: 'Vazamentos, troca de torneira, registro e sifão, desentupimento simples.', min: 70, max: 200, unit: 'por serviço' },
    ],
  },
  { n: 10, name: 'Josefa Lima', bio: 'Costureira, faço ajustes e consertos.', radius: 2, offers: [
    { kind: 'servico', category: 'costura', title: 'Ajustes e barras de calça', description: 'Barra, ajuste de cintura, troca de zíper e pequenos consertos. Entrega em até 3 dias.', min: 15, max: 60, unit: 'por peça' } ] },
  { n: 11, name: 'Aline Rocha', bio: 'Manicure e designer de sobrancelhas.', radius: 2, offers: [
    { kind: 'servico', category: 'beleza', title: 'Manicure e pedicure', description: 'Esmaltação simples e em gel. Atendimento com hora marcada.', min: 30, max: 70, unit: 'por atendimento' },
    { kind: 'servico', category: 'beleza', title: 'Design de sobrancelha com henna', description: 'Modelagem com pinça e aplicação de henna.', min: 35, max: 45, unit: 'por atendimento' } ] },
  { n: 12, name: 'Prof. Renato Alves', bio: 'Professor de matemática aposentado.', radius: 4, offers: [
    { kind: 'servico', category: 'aulas', title: 'Reforço escolar de matemática', description: 'Ensino fundamental e médio, preparação para provas e ENEM.', min: 50, max: 50, unit: 'por hora' } ] },
  { n: 13, name: 'Carla Menezes', bio: 'Diarista com 10 anos de experiência.', radius: 5, offers: [
    { kind: 'servico', category: 'domesticos', title: 'Diarista e faxina pesada', description: 'Limpeza completa de casas e apartamentos. Levo os produtos se precisar.', min: 150, max: 220, unit: 'por diária' } ] },
  { n: 14, name: 'Dona Benedita Souza', bio: 'Marmitas caseiras de segunda a sexta.', radius: 1.5, offers: [
    { kind: 'produto', category: 'alimentacao', title: 'Marmita caseira do dia', description: 'Arroz, feijão, mistura e salada. Cardápio do dia pelo chat. Retirada ou entrega na rua.', min: 18, max: 25, unit: 'por marmita' } ] },
  { n: 15, name: 'Lucas Ferreira', bio: 'Conserto de celulares e computadores.', radius: 4, offers: [
    { kind: 'servico', category: 'tecnologia', title: 'Formatação e limpeza de notebook', description: 'Formatação com backup, troca de pasta térmica e instalação de programas.', min: 90, max: 150, unit: 'por aparelho' },
    { kind: 'servico', category: 'tecnologia', title: 'Troca de tela de celular', description: 'Orçamento pelo modelo do aparelho. Peças com garantia de 90 dias.', min: null, max: null, unit: 'a combinar' } ] },
  { n: 16, name: 'Sueli Martins', bio: 'Cuido de idosos e crianças.', radius: 3, offers: [
    { kind: 'servico', category: 'cuidados', title: 'Cuidadora de idosos (diurno)', description: 'Acompanhamento, medicação no horário, passeios e companhia. Referências disponíveis.', min: 120, max: 180, unit: 'por dia' } ] },
  { n: 17, name: 'Paulo Henrique Dias', bio: 'Pintor e pedreiro.', radius: 8, offers: [
    { kind: 'servico', category: 'manutencao', title: 'Pintura de paredes e muros', description: 'Pintura interna e externa, massa corrida e textura.', min: 25, max: 35, unit: 'por m²' } ] },
  { n: 18, name: 'Fernanda Oliveira', bio: 'Artesã, peças em crochê.', radius: 3, offers: [
    { kind: 'produto', category: 'artesanato', title: 'Tapetes e jogos de banheiro em crochê', description: 'Peças sob encomenda nas cores que você escolher.', min: 40, max: 150, unit: 'por peça' } ] },
  { n: 19, name: 'Seu Antônio Ribeiro', bio: 'Faço carretos com minha caminhonete.', radius: 10, offers: [
    { kind: 'servico', category: 'fretes', title: 'Carretos e pequenas mudanças', description: 'Caminhonete com caçamba. Móveis, eletrodomésticos e entulho leve.', min: 80, max: 300, unit: 'por viagem' } ] },
  { n: 20, name: 'Patrícia Gomes', bio: 'Cabeleireira em casa.', radius: 2, offers: [
    { kind: 'servico', category: 'beleza', title: 'Corte, escova e tranças', description: 'Cortes feminino e infantil, escova, tranças box braids.', min: 40, max: 250, unit: 'por atendimento' } ] },
  { n: 21, name: 'Mariana Teixeira', bio: 'Professora de inglês.', radius: 3, offers: [
    { kind: 'servico', category: 'aulas', title: 'Aulas de inglês para iniciantes', description: 'Conversação e gramática, crianças e adultos. Também online.', min: 60, max: 60, unit: 'por hora' } ] },
  { n: 22, name: 'Rogério Campos', bio: 'Jardinagem e manutenção de quintal.', radius: 5, offers: [
    { kind: 'servico', category: 'domesticos', title: 'Corte de grama e limpeza de quintal', description: 'Roçada, poda de plantas e retirada do material.', min: 60, max: 150, unit: 'por serviço' } ] },
  { n: 23, name: 'Edna Pereira', bio: 'Doces finos para festas.', radius: 2.5, offers: [
    { kind: 'produto', category: 'alimentacao', title: 'Brigadeiros gourmet e docinhos', description: 'Brigadeiro, beijinho, bicho de pé e cajuzinho. Mínimo de 50 unidades.', min: 1.2, max: 2.5, unit: 'por unidade' } ] },
]
```

Os 16 prestadores fictícios com apresentação, raio de atendimento e ofertas. Os três primeiros são as **personas da Seção 4.3 do artigo**: Cleusa Batista (bolos e salgados), Marcelo Duarte (manutenção) e, entre os contratantes, Thiago Nunes.
Os preços estão em reais aqui e são convertidos para centavos na gravação. `null` significa "a combinar".

**Linhas 89 a 95**

```js
const CLIENTS = [
  { n: 2, name: 'Thiago Nunes' },
  { n: 30, name: 'Rosângela Araújo' },
  { n: 31, name: 'Gabriel Moura' },
  { n: 32, name: 'Helena Castro' },
  { n: 33, name: 'Wagner Santos' },
]
```

Moradores contratantes, começando pelo Thiago (persona 2).

**Linhas 97 a 101**

```js
const STAFF = [
  { n: 5, name: 'Agente de Campo (demo)', role: 'agente' },
  { n: 6, name: 'Moderação (demo)', role: 'moderador' },
  { n: 7, name: 'Associação de Moradores (demo)', role: 'instituicao' },
]
```

Contas de equipe: agente de campo, moderação e associação de moradores (instituição).

**Linhas 103 a 110**

```js
const REVIEW_COMMENTS = {
  5: ['Excelente, recomendo muito!', 'Muito caprichoso e pontual.', 'Atendimento ótimo, voltarei a contratar.', 'Perfeito, melhor do bairro.'],
  4: ['Bom serviço, chegou um pouco atrasado.', 'Gostei bastante.', 'Preço justo e bom trabalho.'],
  3: ['Resolveu, mas demorou mais que o combinado.'],
}

const BARRIER_POOL = ['expor_endereco', 'expor_endereco', 'sem_cnpj', 'sem_cnpj', 'fiscalizacao', 'sem_tempo', 'nao_sabe_usar', 'taxas_altas', 'nao_precisa']
const SURVEY_NAMES = ['Salão da Neide', 'Costuras da Vera', 'Bolos da Ivone', 'Conserto de bicicletas do Zé', 'Marmitex da Lu', 'Unhas da Kátia', 'Aulas de violão do Beto', 'Chaveiro Silva', 'Doces da Rita', 'Passadeira Marta', 'Banho e tosa da Cris', 'Sapateiro Joaquim', 'Salgados da Dona Lurdes', 'Eletricista Nando', 'Brechó da Sônia', 'Artesanato da Tânia', 'Reforço da Prof. Ana', 'Pães caseiros do Seu Jorge', 'Manicure Jéssica', 'Ferro-velho do Tião', 'Bordados da Lígia', 'Faxina da Dalva', 'Pastel da Fátima']
```

Comentários de avaliação por nota, as barreiras sorteadas no levantamento (repetidas para pesarem mais no sorteio) e nomes de negócios abordados que não aceitaram o cadastro.

**Linhas 112 a 115**

```js
export async function seed() {
  await db().transaction(async (tx) => {
    const run = (sql, params) => tx.query(sql, params).then((r) => r.rows)
    const ids = {}
```

Tudo é criado dentro de **uma transação**: se algo falhar no meio, o banco não fica com dados pela metade. `run` é um atalho que devolve só as linhas.

**Linhas 117 a 122**

```js
    for (const s of STAFF) {
      ids[s.n] = (await run('INSERT INTO users (phone, name, role, created_at) VALUES ($1, $2, $3, $4) RETURNING id', [phone(s.n), s.name, s.role, daysAgo(60)]))[0].id
    }
    for (const c of CLIENTS) {
      ids[c.n] = (await run('INSERT INTO users (phone, name, created_at) VALUES ($1, $2, $3) RETURNING id', [phone(c.n), c.name, daysAgo(20 + Math.floor(rand() * 30))]))[0].id
    }
```

Cria as contas de equipe e os contratantes, guardando os ids em `ids` (indexado pelo número do telefone) para usar depois.

**Linhas 124 a 139**

```js
    const offerIds = []
    for (const p of PROVIDERS) {
      const assisted = p.n !== 3 && p.n !== 11 && p.n !== 15 && p.n !== 21 // a maioria entrou pelo cadastro assistido
      const uid = (
        await run('INSERT INTO users (phone, name, is_provider, bio, assisted_by, created_at) VALUES ($1, $2, true, $3, $4, $5) RETURNING id', [
          phone(p.n), p.name, p.bio, assisted ? ids[5] : null, daysAgo(40 + Math.floor(rand() * 15)),
        ])
      )[0].id
      ids[p.n] = uid
      const exact = pointNear(config.pilot.lat, config.pilot.lng, 2200)
      const anchor = randomAnchor(exact.lat, exact.lng)
      await run(
        `INSERT INTO provider_locations (user_id, exact, anchor, service_radius_km)
         VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6)`,
        [uid, exact.lat, exact.lng, anchor.lat, anchor.lng, p.radius],
      )
```

Para cada prestador: cria a conta (a maioria marcada como vinda do cadastro assistido do agente) e grava o ponto exato e o ponto público deslocado, sorteados a até 2,2 km do centro do bairro.

**Linhas 140 a 153**

```js
      for (const o of p.offers) {
        const toCents = (v) => (v === null ? null : Math.round(v * 100))
        // Uma oferta propositalmente sem confirmação há 35 dias, para demonstrar o RF16.
        const confirmed = p.n === 18 ? daysAgo(35) : daysAgo(Math.floor(rand() * 20))
        const row = (
          await run(
            `INSERT INTO offers (provider_id, kind, title, description, category, price_min_cents, price_max_cents, price_unit, search_text, confirmed_at, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
            [uid, o.kind, o.title, o.description, o.category, toCents(o.min), toCents(o.max), o.unit, buildSearchText(o), confirmed, daysAgo(38)],
          )
        )[0]
        offerIds.push({ id: row.id, providerId: uid, providerN: p.n, title: o.title, min: o.min, max: o.max })
      }
    }
```

Grava as ofertas. A da Fernanda (número 18) fica com a última confirmação há 35 dias, para demonstrar o aviso de confirmação de atividade (RF16).

**Linhas 155 a 163**

```js
    // Visualizações dos últimos 30 dias (RF14).
    for (const o of offerIds) {
      const total = 15 + Math.floor(rand() * 60)
      for (let i = 0; i < total; i++) {
        await run('INSERT INTO offer_views (offer_id, viewer_key, day) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING', [
          o.id, `seed${Math.floor(rand() * 400)}`, daysAgo(Math.floor(rand() * 30)),
        ])
      }
    }
```

Gera entre 15 e 75 visualizações por oferta nos últimos 30 dias, para o gráfico do painel do prestador (RF14).

**Linhas 165 a 204**

```js
    // Histórico de contratações concluídas com comissão e avaliação mútua (RF09 a RF12).
    const clientIds = CLIENTS.map((c) => ids[c.n])
    let receipt = 1
    for (let i = 0; i < 26; i++) {
      const o = i < 6 ? offerIds[i % 2] : i < 10 ? offerIds[2 + (i % 2)] : pick(offerIds)
      const clientId = pick(clientIds)
      const ago = 2 + Math.floor(rand() * 50)
      const base = o.min ?? 100
      const top = o.max ?? base * 2
      const amount = Math.round((base + rand() * (top - base)) * (o.min && o.min < 5 ? 80 : 1) * 100)
      let conv = (await run('SELECT id FROM conversations WHERE offer_id = $1 AND client_id = $2', [o.id, clientId]))[0]
      if (!conv) {
        conv = (await run('INSERT INTO conversations (offer_id, client_id, provider_id, created_at, last_message_at) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
          o.id, clientId, o.providerId, daysAgo(ago + 2), daysAgo(ago),
        ]))[0]
      }
      await run("INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES ($1, $2, $3, $4)", [conv.id, clientId, 'Olá! Você tem disponibilidade esta semana?', daysAgo(ago + 2, 9)])
      await run("INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES ($1, $2, $3, $4)", [conv.id, o.providerId, 'Tenho sim! Me conte o que precisa.', daysAgo(ago + 2, 11)])
      const k = (await run(
        `INSERT INTO contracts (conversation_id, offer_id, client_id, provider_id, status, amount_cents, deadline, created_at, updated_at, concluded_at)
         VALUES ($1, $2, $3, $4, 'concluida', $5, $6::date, $7, $8, $8) RETURNING id`,
        [conv.id, o.id, clientId, o.providerId, amount, daysAgo(ago), daysAgo(ago + 2), daysAgo(ago, 17)],
      ))[0]
      await run("INSERT INTO proposals (contract_id, amount_cents, deadline, status, created_at) VALUES ($1, $2, $3::date, 'aceita', $4)", [k.id, amount, daysAgo(ago), daysAgo(ago + 1)])
      for (const [from, to, actor, when] of [[null, 'solicitada', clientId, ago + 2], ['solicitada', 'proposta_enviada', o.providerId, ago + 1], ['proposta_enviada', 'aceita', clientId, ago + 1], ['aceita', 'em_andamento', o.providerId, ago], ['em_andamento', 'concluida', o.providerId, ago]]) {
        await run('INSERT INTO contract_events (contract_id, from_status, to_status, actor_id, created_at) VALUES ($1, $2, $3, $4, $5)', [k.id, from, to, actor, daysAgo(when, 12)])
      }
      const c = computeCommission(amount, config.commissionRate)
      await run('INSERT INTO commissions (contract_id, gross_cents, rate, commission_cents, net_cents, receipt_code, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        k.id, c.grossCents, c.rate, c.commissionCents, c.netCents, `CB-DEMO-${String(receipt++).padStart(4, '0')}`, daysAgo(ago, 17),
      ])
      await run("INSERT INTO messages (conversation_id, sender_id, kind, body, created_at) VALUES ($1, NULL, 'sistema', 'Serviço concluído', $2)", [conv.id, daysAgo(ago, 17)])
      const rating = rand() < 0.65 ? 5 : rand() < 0.85 ? 4 : 3
      await run('INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [
        k.id, clientId, o.providerId, rating, pick(REVIEW_COMMENTS[rating]), daysAgo(Math.max(0, ago - 1)),
      ])
      await run("INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment, created_at) VALUES ($1, $2, $3, $4, 'Cliente educado e pagou certinho.', $5)", [
        k.id, o.providerId, clientId, 5, daysAgo(Math.max(0, ago - 1)),
      ])
    }
```

Cria 26 contratações concluídas. As primeiras ficam concentradas nas ofertas da Cleusa e do Marcelo, para as personas terem reputação. Para cada uma:

- reaproveita ou cria a conversa e grava duas mensagens;
- cria a contratação concluída com valor sorteado dentro da faixa de preço da oferta (a dos docinhos, vendidos por unidade, é multiplicada por 80 unidades);
- grava a proposta aceita e os cinco eventos do histórico, de "solicitada" a "concluída";
- calcula a comissão com a **mesma função** usada pelo sistema real e grava o comprovante;
- grava as duas avaliações (cerca de 65% das notas do cliente são 5).

**Linhas 206 a 211**

```js
    // Plano de destaque ativo para a Cleusa (RF13).
    await run(
      `INSERT INTO highlights (provider_id, offer_id, category, plan, starts_at, ends_at, price_cents, payment_code)
       VALUES ($1, $2, 'alimentacao', 'quinzenal', now() - interval '3 days', now() + interval '12 days', 1790, 'PIX-SIMULADO-DEMO01')`,
      [offerIds[0].providerId, offerIds[0].id],
    )
```

Deixa a oferta de bolos da Cleusa em destaque, começado há 3 dias e terminando em 12 (RF13).

**Linhas 213 a 224**

```js
    // Levantamento de campo (Plano de aplicação, etapa 1).
    const accepted = PROVIDERS.filter((p) => ![3, 11, 15, 21].includes(p.n))
    let uuid = 1
    for (const p of accepted) {
      const nBarriers = 1 + Math.floor(rand() * 3)
      const barriers = [...new Set(Array.from({ length: nBarriers }, () => pick(BARRIER_POOL)))]
      await run(
        `INSERT INTO field_surveys (client_uuid, agent_id, business_name, category, appears_on_maps, barriers, accepted, provider_id, collected_at)
         VALUES ($1, $2, $3, $4, $5, string_to_array($6, ','), true, $7, $8)`,
        [`seed-${uuid++}`, ids[5], p.name, p.offers[0].category, rand() < 0.9 ? 'nao' : 'nao_sabe', barriers.join(','), ids[p.n], daysAgo(40 + Math.floor(rand() * 10))],
      )
    }
```

Grava o levantamento dos prestadores que aceitaram o cadastro, a maioria marcada como ausente dos mapas digitais, com de 1 a 3 barreiras cada.

**Linhas 225 a 235**

```js
    const cats = ['beleza', 'costura', 'alimentacao', 'outros', 'alimentacao', 'beleza', 'aulas', 'manutencao', 'alimentacao', 'domesticos', 'cuidados', 'outros', 'alimentacao', 'manutencao', 'outros', 'artesanato', 'aulas', 'alimentacao', 'beleza', 'outros', 'costura', 'domesticos', 'alimentacao']
    for (let i = 0; i < SURVEY_NAMES.length; i++) {
      const nBarriers = 1 + Math.floor(rand() * 3)
      const barriers = [...new Set(Array.from({ length: nBarriers }, () => pick(BARRIER_POOL)))]
      const onMaps = rand() < 0.18 ? 'sim' : rand() < 0.9 ? 'nao' : 'nao_sabe'
      await run(
        `INSERT INTO field_surveys (client_uuid, agent_id, business_name, category, appears_on_maps, barriers, accepted, collected_at, notes)
         VALUES ($1, $2, $3, $4, $5, string_to_array($6, ','), false, $7, $8)`,
        [`seed-${uuid++}`, ids[5], SURVEY_NAMES[i], cats[i], onMaps, barriers.join(','), daysAgo(38 + Math.floor(rand() * 12)), 'Preferiu pensar antes de se cadastrar.'],
      )
    }
```

E o levantamento dos 23 negócios que não aceitaram o cadastro, com categorias, presença nos mapas e barreiras. Com isso o painel de indicadores mostra a taxa de conversão e a proporção fora dos mapas.

**Linhas 237 a 242**

```js
    // Questionário de satisfação (Plano de aplicação, etapa 3).
    for (const [uid, group] of [...clientIds.map((id) => [id, 'contratante']), ...accepted.slice(0, 8).map((p) => [ids[p.n], 'prestador'])]) {
      await run('INSERT INTO satisfaction_surveys (user_id, user_group, score, ease, will_continue, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        uid, group, rand() < 0.7 ? 5 : 4, rand() < 0.6 ? 5 : rand() < 0.8 ? 4 : 3, rand() < 0.88, '', daysAgo(Math.floor(rand() * 10)),
      ])
    }
```

Respostas do questionário de satisfação de contratantes e prestadores (etapa 3 do plano de avaliação).

**Linhas 244 a 250**

```js
    // Uma denúncia aberta para a moderação demonstrar o RF15.
    await run(
      "INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, 'oferta', $2, 'informacao_incorreta', 'O preço anunciado não corresponde ao cobrado.')",
      [ids[31], offerIds[offerIds.length - 2].id],
    )
  })
}
```

Uma denúncia aberta para a moderação ter o que analisar na demonstração (RF15).

**Linhas 252 a 258**

```js
export async function seedIfEmpty() {
  const r = await one('SELECT count(*)::int AS n FROM users')
  if (r.n > 0) return false
  console.log('Banco vazio: criando dados de demonstração do bairro piloto...')
  await seed()
  return true
}
```

Só cria os dados se não houver nenhum usuário. É chamada a cada inicialização, então nunca apaga dados reais.

**Linhas 260 a 262**

```js
export async function resetDatabase() {
  await db().exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
}
```

Apaga tudo: remove o esquema `public` inteiro (tabelas e extensão) e o recria vazio.

**Linhas 264 a 276**

```js
// Execução direta: node server/src/seed.js --reset
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  await initDb()
  if (process.argv.includes('--reset')) {
    console.log('Apagando todos os dados...')
    await resetDatabase()
    await closeDb()
    await initDb()
  }
  const created = await seedIfEmpty()
  console.log(created ? 'Dados de demonstração criados.' : 'O banco já tinha dados. Use --reset para recriar.')
  await closeDb()
}
```

Quando o arquivo é executado diretamente (`npm run seed`), e não importado, abre o banco, apaga com `--reset`, reabre (o que recria as tabelas pelo `schema.sql`) e popula.
A comparação com `pathToFileURL` funciona igual no Windows, onde os caminhos usam barra invertida.

---

## `server/test/unit.test.js`

Testes das funções puras. `node:test` é o executor de testes do próprio Node e `assert/strict` faz as comparações. Cada `test(...)` é um caso independente; se uma comparação falha, o teste é marcado como falho com a diferença encontrada.

**Linhas 1 a 8**

```js
// Testes unitários das regras de negócio sensíveis (Seção 5.5: Qualidade e Testes de Software).
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeCommission, parseMoneyToCents } from '../src/lib/money.js'
import { availableActions, nextStatus } from '../src/lib/contract-states.js'
import { approxDistance, randomAnchor } from '../src/lib/geo.js'
import { maskContacts, normalizePhone, searchTokens } from '../src/lib/text.js'
import { categoriesForTokens } from '../src/lib/categories.js'
```

Importações das funções testadas.

**Linhas 10 a 22**

```js
test('RF10: comissão de 6% em centavos, arredondada meio para cima', () => {
  assert.deepEqual(computeCommission(15000, 0.06), { grossCents: 15000, rate: 0.06, commissionCents: 900, netCents: 14100 })
  assert.equal(computeCommission(1234, 0.06).commissionCents, 74) // 74,04
  assert.equal(computeCommission(25, 0.06).commissionCents, 2) // 1,5 sobe
  assert.equal(computeCommission(24, 0.06).commissionCents, 1) // 1,44 desce
  assert.equal(computeCommission(9999999, 0.06).commissionCents, 600000) // 599.999,94
  for (const v of [1, 99, 12345, 333333]) {
    const c = computeCommission(v, 0.06)
    assert.equal(c.commissionCents + c.netCents, v, 'bruto = comissão + líquido')
  }
  assert.throws(() => computeCommission(0, 0.06))
  assert.throws(() => computeCommission(10.5, 0.06))
})
```

**Comissão**: R$ 150,00 gera R$ 9,00; os comentários mostram o valor exato e o arredondamento esperado (74,04 vira 74; 1,5 sobe para 2; 1,44 desce para 1). O laço confere que bruto é sempre comissão mais líquido, e os `throws` que valores inválidos são recusados.

**Linhas 24 a 30**

```js
test('conversão de valores digitados para centavos', () => {
  assert.equal(parseMoneyToCents('150'), 15000)
  assert.equal(parseMoneyToCents('1.500,90'), 150090)
  assert.equal(parseMoneyToCents('R$ 35,5'), 3550)
  assert.equal(parseMoneyToCents(''), null)
  assert.equal(parseMoneyToCents('abc'), null)
})
```

Conversão do que o usuário digita: "1.500,90" vira 150.090 centavos; campo vazio e texto que não é número viram `null`.

**Linhas 32 a 48**

```js
test('RF09: máquina de estados da contratação', () => {
  assert.equal(nextStatus('solicitada', 'propor', 'provider'), 'proposta_enviada')
  assert.equal(nextStatus('proposta_enviada', 'aceitar', 'client'), 'aceita')
  assert.equal(nextStatus('proposta_enviada', 'recusar', 'client'), 'solicitada')
  assert.equal(nextStatus('aceita', 'iniciar', 'provider'), 'em_andamento')
  assert.equal(nextStatus('em_andamento', 'concluir', 'provider'), 'concluida')
  assert.equal(nextStatus('aceita', 'cancelar', 'client'), 'cancelada')
  // Quem não pode
  assert.throws(() => nextStatus('proposta_enviada', 'aceitar', 'provider'), { status: 403 })
  assert.throws(() => nextStatus('solicitada', 'propor', 'client'), { status: 403 })
  // Estados inválidos
  assert.throws(() => nextStatus('solicitada', 'concluir', 'provider'), { status: 409 })
  assert.throws(() => nextStatus('concluida', 'cancelar', 'client'), { status: 409 })
  assert.throws(() => nextStatus('cancelada', 'propor', 'provider'), { status: 409 })
  assert.deepEqual(availableActions('proposta_enviada', 'client'), ['aceitar', 'recusar', 'cancelar'])
  assert.deepEqual(availableActions('concluida', 'provider'), [])
})
```

**Máquina de estados**: o caminho completo permitido, as ações proibidas para o lado errado (403), as feitas no estado errado (409) e as ações oferecidas em cada estado.

**Linhas 50 a 60**

```js
test('RF04: ponto público fica entre 100 e 300 m do endereço real', () => {
  const lat = -23.48
  const lng = -47.42
  for (let i = 0; i < 300; i++) {
    const a = randomAnchor(lat, lng)
    const dy = (a.lat - lat) * 111_320
    const dx = (a.lng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180)
    const d = Math.hypot(dx, dy)
    assert.ok(d >= 99 && d <= 301, `deslocamento ${d.toFixed(1)} m fora da faixa`)
  }
})
```

Gera 300 pontos deslocados e confere que **todos** estão entre 100 e 300 m do ponto real (com 1 m de tolerância para o arredondamento da conta).

**Linhas 62 a 67**

```js
test('RF04: distância exibida é arredondada e tem piso de 0,5 km', () => {
  assert.deepEqual(approxDistance(120), { km: 0.5, label: 'menos de 0,5 km' })
  assert.equal(approxDistance(1234).km, 1.2)
  assert.equal(approxDistance(1251).km, 1.3)
  assert.equal(approxDistance(2049).label, '2,0 km')
})
```

Arredondamento da distância exibida e o piso de 0,5 km.

**Linhas 69 a 90**

```js
test('RF07: o chat remove telefone, e-mail, links e convites para outros apps', () => {
  const cases = [
    'me chama no (15) 99876-5432',
    'meu numero é 15998765432',
    '+55 15 9 9876 5432',
    'manda email pra cleusa.bolos@gmail.com',
    'me chama no zap',
    'segue no insta @cleusabolos',
    'olha www.meusite.com.br',
    'me liga',
  ]
  for (const c of cases) {
    const r = maskContacts(c)
    assert.equal(r.masked, true, `não mascarou: ${c}`)
    assert.ok(!/\d{4}-?\d{4}|@gmail|zap|cleusabolos|meusite/i.test(r.text), `sobrou contato em: ${r.text}`)
  }
  for (const ok of ['O bolo custa R$ 120,00', 'Posso ir dia 12/11 às 14h', 'Cento de salgados por 85 reais', 'Faço 2 bolos de 1,5 kg']) {
    const r = maskContacts(ok)
    assert.equal(r.masked, false, `mascarou indevidamente: ${ok}`)
    assert.equal(r.text, ok)
  }
})
```

**Filtro de contatos**: oito formas de passar contato (telefone com e sem formatação, com +55, e-mail, "zap", @perfil, site, "me liga") precisam ser removidas.
E quatro frases normais (preço, data e hora, quantidade, medida) **não podem** ser alteradas. Este segundo grupo é tão importante quanto o primeiro: um filtro exagerado atrapalharia a negociação.

**Linhas 92 a 98**

```js
test('RF01: normalização de celular brasileiro', () => {
  assert.equal(normalizePhone('(15) 99876-5432'), '+5515998765432')
  assert.equal(normalizePhone('+55 15 99876 5432'), '+5515998765432')
  assert.equal(normalizePhone('1532345678'), '+551532345678')
  assert.equal(normalizePhone('12345'), null)
  assert.equal(normalizePhone('0159987654'), null)
})
```

Normalização do celular nos formatos mais comuns e recusa dos inválidos.

**Linhas 100 a 105**

```js
test('RF05: busca por necessidade identifica a categoria', () => {
  assert.deepEqual(searchTokens('Preciso de alguém para consertar meu chuveiro'), ['consertar', 'chuveiro'])
  assert.ok(categoriesForTokens(searchTokens('meu chuveiro queimou')).includes('manutencao'))
  assert.ok(categoriesForTokens(searchTokens('bolo de aniversário')).includes('alimentacao'))
  assert.ok(categoriesForTokens(searchTokens('ajustar a barra da calça')).includes('costura'))
})
```

Busca por necessidade: as palavras irrelevantes são descartadas e frases do dia a dia chegam à categoria certa.

---

## `server/test/api.test.js`

Teste de integração: sobe a API de verdade numa porta livre, com banco PGlite em memória, e percorre o sistema como um usuário faria.
Os testes deste arquivo rodam em sequência e compartilham o estado (`ctx`), formando um único roteiro.

**Linhas 1 a 16**

```js
// Testes de integração da API com banco PGlite em memória.
// Cobre o fluxo completo e, principalmente, o requisito de que a localização do prestador nunca vaze.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

process.env.NODE_ENV = 'test'
process.env.SMS_MODE = 'dev'
const { initDb, closeDb, one } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { runActivityCheck } = await import('../src/jobs.js')

const PROVIDER_POINT = { lat: -23.481234, lng: -47.421987 }
let base = ''
let server
const seen = [] // todas as respostas JSON, para a varredura de privacidade
```

Define o ambiente de teste **antes** de importar o sistema (por isso os `await import` em vez de `import` no topo): assim a configuração já nasce em modo de teste.
`PROVIDER_POINT` é a localização real do prestador de teste, usada no fim para procurar vazamentos. `seen` guarda todas as respostas da API.

**Linhas 18 a 28**

```js
async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  seen.push({ path, data })
  return { status: res.status, data }
}
```

Função auxiliar que chama a API com `fetch`, envia o token quando informado e **guarda cada resposta em `seen`** para a varredura de privacidade.

**Linhas 30 a 41**

```js
async function login(phone, name, isProvider = false) {
  const r1 = await api('POST', '/api/auth/request-code', { body: { phone } })
  assert.equal(r1.status, 200)
  const code = r1.data.devCode
  const r2 = await api('POST', '/api/auth/verify', { body: { phone, code } })
  if (r2.data.needsName) {
    const r3 = await api('POST', '/api/auth/verify', { body: { phone, code, name, isProvider } })
    assert.equal(r3.status, 200)
    return r3.data
  }
  return r2.data
}
```

Faz o login completo: pede o código, confirma e, se for conta nova, reenvia com o nome.

**Linhas 43 a 53**

```js
test.before(async () => {
  await initDb({ memory: true })
  server = http.createServer(createApp())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  server.close()
  await closeDb()
})
```

Antes de tudo: abre o banco em memória e sobe o servidor na porta 0 (o sistema escolhe uma livre). Depois de tudo: desliga o servidor e fecha o banco.

**Linha 55**

```js
const ctx = {}
```

Estado compartilhado entre os passos do roteiro.

**Linhas 57 a 76**

```js
test('RF01: cadastro com telefone verificado e sem documentação', async () => {
  const wrong = await api('POST', '/api/auth/request-code', { body: { phone: '123' } })
  assert.equal(wrong.status, 400)

  const r1 = await api('POST', '/api/auth/request-code', { body: { phone: '(15) 91111-0001' } })
  const bad = await api('POST', '/api/auth/verify', { body: { phone: '15911110001', code: r1.data.devCode === '000000' ? '111111' : '000000' } })
  assert.equal(bad.status, 400)
  const okButNoName = await api('POST', '/api/auth/verify', { body: { phone: '15911110001', code: r1.data.devCode } })
  assert.equal(okButNoName.data.needsName, true)

  const provider = await login('15911110001', 'Cleusa Teste', true)
  assert.ok(provider.token)
  assert.equal(provider.user.isProvider, true)
  ctx.provider = provider

  ctx.client = await login('15922220002', 'Thiago Teste')
  ctx.other = await login('15933330003', 'Intruso Teste')
  const again = await login('15922220002', 'ignorado')
  assert.equal(again.user.name, 'Thiago Teste', 'login repetido não recria a conta')
})
```

**Cadastro**: telefone inválido recusado, código errado recusado, código certo sem nome devolvendo `needsName`, criação do prestador, do contratante e de um terceiro ("intruso", usado para testar acessos indevidos). Entrar de novo não recria a conta.

**Linhas 78 a 93**

```js
test('RF02 e RF04: prestador cadastra localização e oferta', async () => {
  const loc = await api('PUT', '/api/me/location', { token: ctx.provider.token, body: { ...PROVIDER_POINT, serviceRadiusKm: 3 } })
  assert.equal(loc.status, 200)
  assert.equal(loc.data.location.hasLocation, true)

  const notProvider = await api('POST', '/api/offers', { token: ctx.client.token, body: { title: 'x', category: 'outros' } })
  assert.equal(notProvider.status, 403)

  const created = await api('POST', '/api/offers', {
    token: ctx.provider.token,
    body: { title: 'Bolo de cenoura', description: 'Com cobertura de chocolate', category: 'alimentacao', kind: 'produto', priceMin: '40', priceMax: '80,00', priceUnit: 'por bolo' },
  })
  assert.equal(created.status, 201)
  assert.equal(created.data.offer.priceMinCents, 4000)
  ctx.offerId = created.data.offer.id
})
```

O prestador grava a localização, um não prestador é impedido de publicar oferta (403) e a oferta é criada com o preço convertido para centavos.

**Linhas 95 a 117**

```js
test('RF05 e RF06: busca por proximidade, necessidade e raio', async () => {
  const near = { lat: -23.4850, lng: -47.4250 }
  const r = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=2&q=bolo`)
  assert.equal(r.status, 200)
  const hit = r.data.results.find((o) => o.id === ctx.offerId)
  assert.ok(hit, 'oferta encontrada pela necessidade')
  assert.ok(hit.distance.km >= 0.5 && hit.distance.km <= 1.2)

  const byNeed = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=2&q=${encodeURIComponent('festa de aniversário')}`)
  assert.ok(byNeed.data.results.some((o) => o.id === ctx.offerId), 'necessidade mapeada para a categoria')

  const otherCategory = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=2&category=beleza`)
  assert.ok(!otherCategory.data.results.some((o) => o.id === ctx.offerId))

  // ~ 6 km de distância: fora de um raio de 2 km, dentro de 10 km
  const far = { lat: -23.535, lng: -47.42 }
  const out = await api('GET', `/api/search?lat=${far.lat}&lng=${far.lng}&radius=2`)
  assert.ok(!out.data.results.some((o) => o.id === ctx.offerId))
  const wide = await api('GET', `/api/search?lat=${far.lat}&lng=${far.lng}&radius=10`)
  const w = wide.data.results.find((o) => o.id === ctx.offerId)
  assert.ok(w)
  assert.equal(w.outsideServiceArea, true, 'sinaliza que está além do raio de atendimento do prestador')
})
```

**Busca**: encontra pela palavra e pela necessidade, com distância plausível; filtra por categoria; fica de fora a 6 km com raio de 2 km, mas aparece com raio de 10 km, marcada como fora da área de atendimento do prestador.

**Linhas 119 a 145**

```js
test('RF07: chat interno mascara contatos e gera sinalização automática', async () => {
  const conv = await api('POST', '/api/conversations', { token: ctx.client.token, body: { offerId: ctx.offerId } })
  assert.equal(conv.status, 201)
  ctx.convId = conv.data.conversationId
  const same = await api('POST', '/api/conversations', { token: ctx.client.token, body: { offerId: ctx.offerId } })
  assert.equal(same.data.conversationId, ctx.convId, 'não duplica conversa')

  const self = await api('POST', '/api/conversations', { token: ctx.provider.token, body: { offerId: ctx.offerId } })
  assert.equal(self.status, 400)

  const msg = await api('POST', `/api/conversations/${ctx.convId}/messages`, {
    token: ctx.client.token,
    body: { body: 'Oi! Me chama no whatsapp 15 99999-8888' },
  })
  assert.equal(msg.status, 201)
  assert.equal(msg.data.message.masked, true)
  assert.ok(!msg.data.message.body.includes('9999'))
  const auto = await one("SELECT count(*)::int AS n FROM reports WHERE reporter_id IS NULL AND reason = 'negociacao_externa'")
  assert.equal(auto.n, 1)

  const intruder = await api('GET', `/api/conversations/${ctx.convId}`, { token: ctx.other.token })
  assert.equal(intruder.status, 404, 'terceiros não leem a conversa')

  const view = await api('GET', `/api/conversations/${ctx.convId}`, { token: ctx.provider.token })
  assert.equal(view.data.messages.length, 1)
  assert.equal(JSON.stringify(view.data).includes('15922220002'), false, 'telefone do contratante não aparece')
})
```

**Chat**: cria a conversa sem duplicar, impede conversar com a própria oferta, remove o telefone da mensagem, cria a sinalização automática, bloqueia a leitura pelo intruso e confere que o telefone do contratante não aparece para o prestador.

**Linhas 147 a 198**

```js
test('RF08, RF09 e RF10: proposta, aceite, estados e comissão de 6%', async () => {
  const req = await api('POST', `/api/conversations/${ctx.convId}/contracts`, { token: ctx.client.token, body: { note: 'Bolo para sábado' } })
  assert.equal(req.status, 201)
  const id = req.data.contract.id
  ctx.contractId = id
  assert.equal(req.data.contract.status, 'solicitada')

  const dup = await api('POST', `/api/conversations/${ctx.convId}/contracts`, { token: ctx.client.token, body: {} })
  assert.equal(dup.status, 409)

  const t = new Date(Date.now() + 86_400_000)
  const tomorrow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  const byClient = await api('POST', `/api/contracts/${id}/proposals`, { token: ctx.client.token, body: { amount: '100', deadline: tomorrow } })
  assert.equal(byClient.status, 403, 'contratante não envia proposta')

  const p1 = await api('POST', `/api/contracts/${id}/proposals`, { token: ctx.provider.token, body: { amount: '90', deadline: tomorrow } })
  assert.equal(p1.data.contract.status, 'proposta_enviada')
  const rej = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.client.token, body: { action: 'recusar' } })
  assert.equal(rej.data.contract.status, 'solicitada')

  const p2 = await api('POST', `/api/contracts/${id}/proposals`, { token: ctx.provider.token, body: { amount: '123,45', deadline: tomorrow, notes: 'Com entrega' } })
  assert.equal(p2.status, 201)
  const tooEarly = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'concluir' } })
  assert.equal(tooEarly.status, 409, 'não conclui com proposta pendente')
  const providerAccept = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'aceitar' } })
  assert.equal(providerAccept.status, 403)

  const acc = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.client.token, body: { action: 'aceitar' } })
  assert.equal(acc.data.contract.status, 'aceita')
  assert.equal(acc.data.contract.amountCents, 12345)

  const skip = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'concluir' } })
  assert.equal(skip.status, 409, 'não conclui sem iniciar')

  await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'iniciar' } })
  const done = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'concluir' } })
  assert.equal(done.data.contract.status, 'concluida')
  assert.equal(done.data.contract.commission.commissionCents, 741) // 6% de 123,45 = 7,407
  assert.equal(done.data.contract.commission.netCents, 12345 - 741)
  assert.match(done.data.contract.commission.receiptCode, /^CB-\d{8}-[0-9A-F]{6}$/)

  const statuses = done.data.contract.events.map((e) => e.toStatus)
  assert.deepEqual(statuses, ['solicitada', 'proposta_enviada', 'solicitada', 'proposta_enviada', 'aceita', 'em_andamento', 'concluida'])

  const receipt = await api('GET', `/api/contracts/${id}/receipt`, { token: ctx.client.token })
  assert.equal(receipt.data.receipt.grossCents, 12345)
  const intruder = await api('GET', `/api/contracts/${id}/receipt`, { token: ctx.other.token })
  assert.equal(intruder.status, 404)

  const cancelAfter = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.client.token, body: { action: 'cancelar' } })
  assert.equal(cancelAfter.status, 409, 'estado final não muda')
})
```

**Contratação completa**, incluindo os desvios: solicitação duplicada (409), proposta enviada pelo contratante (403), proposta recusada e reenviada, conclusão antes da hora (409), aceite pelo lado errado (403).
No fim confere a comissão de **R$ 7,41 sobre R$ 123,45** (6% dá 7,407), o líquido, o formato do comprovante, a sequência exata dos estados no histórico, o acesso ao comprovante só pelas partes e que um estado final não muda mais.

**Linhas 200 a 212**

```js
test('RF11 e RF12: avaliação mútua e reputação', async () => {
  const id = ctx.contractId
  const r1 = await api('POST', `/api/contracts/${id}/review`, { token: ctx.client.token, body: { rating: 5, comment: 'Delicioso' } })
  assert.equal(r1.status, 201)
  const again = await api('POST', `/api/contracts/${id}/review`, { token: ctx.client.token, body: { rating: 1 } })
  assert.equal(again.status, 409)
  const r2 = await api('POST', `/api/contracts/${id}/review`, { token: ctx.provider.token, body: { rating: 4 } })
  assert.equal(r2.status, 201)

  const profile = await api('GET', `/api/providers/${ctx.provider.user.id}`)
  assert.equal(profile.data.reputation.concluded, 1)
  assert.equal(profile.data.reputation.avgRating, 5, 'reputação do prestador ignora a nota que ele deu')
})
```

**Avaliações**: as duas partes avaliam, repetir é recusado e a reputação do prestador mostra só a nota recebida como prestador (5), ignorando a que ele deu ao cliente.

**Linhas 214 a 233**

```js
test('RF13 e RF14: destaque aparece primeiro e painel soma receita', async () => {
  const p2 = await login('15944440004', 'Concorrente Teste', true)
  await api('PUT', '/api/me/location', { token: p2.token, body: { lat: -23.4851, lng: -47.4251, serviceRadiusKm: 3 } })
  const o2 = await api('POST', '/api/offers', { token: p2.token, body: { title: 'Bolo de pote', category: 'alimentacao' } })
  const near = { lat: -23.4852, lng: -47.4252 }
  const before = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=3&category=alimentacao`)
  assert.equal(before.data.results[0].id, o2.data.offer.id, 'sem destaque, o mais perto vem primeiro')

  const h = await api('POST', '/api/highlights', { token: ctx.provider.token, body: { offerId: ctx.offerId, plan: 'semanal' } })
  assert.equal(h.status, 201)
  const after = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=3&category=alimentacao`)
  assert.equal(after.data.results[0].id, ctx.offerId)
  assert.equal(after.data.results[0].highlighted, true)

  const dash = await api('GET', '/api/my/dashboard?days=30', { token: ctx.provider.token })
  assert.equal(dash.data.totals.concluded, 1)
  assert.equal(dash.data.totals.contacts, 1)
  assert.equal(dash.data.revenue.gross, 12345)
  assert.equal(dash.data.revenue.commission, 741)
})
```

**Destaque e painel**: um concorrente mais próximo aparece primeiro; depois do destaque, a oferta destacada passa à frente. O painel soma um contato, uma conclusão, o bruto e a comissão corretos.

**Linhas 235 a 240**

```js
test('RF15: denúncia e moderação', async () => {
  const rep = await api('POST', '/api/reports', { token: ctx.other.token, body: { targetType: 'oferta', targetId: ctx.offerId, reason: 'informacao_incorreta' } })
  assert.equal(rep.status, 201)
  const noAccess = await api('GET', '/api/moderation/reports', { token: ctx.other.token })
  assert.equal(noAccess.status, 403)
})
```

Denúncia aceita e fila da moderação inacessível para quem não é moderador.

**Linhas 242 a 255**

```js
test('RF16: oferta sem confirmação gera aviso e sai da busca após 45 dias', async () => {
  await one("UPDATE offers SET confirmed_at = now() - interval '31 days' WHERE id = $1 RETURNING id", [ctx.offerId])
  assert.equal(await runActivityCheck(), 1)
  assert.equal(await runActivityCheck(), 0, 'não repete o aviso no mesmo período')
  const notes = await api('GET', '/api/notifications', { token: ctx.provider.token })
  assert.ok(notes.data.notifications.some((n) => n.kind === 'confirmacao'))

  await one("UPDATE offers SET confirmed_at = now() - interval '46 days' WHERE id = $1 RETURNING id", [ctx.offerId])
  const hidden = await api('GET', `/api/search?lat=${PROVIDER_POINT.lat}&lng=${PROVIDER_POINT.lng}&radius=3`)
  assert.ok(!hidden.data.results.some((o) => o.id === ctx.offerId))
  await api('POST', `/api/offers/${ctx.offerId}/confirm`, { token: ctx.provider.token })
  const back = await api('GET', `/api/search?lat=${PROVIDER_POINT.lat}&lng=${PROVIDER_POINT.lng}&radius=3`)
  assert.ok(back.data.results.some((o) => o.id === ctx.offerId))
})
```

**Confirmação de atividade**: com 31 dias, a rotina avisa uma vez e não repete; com 46, a oferta some da busca; confirmada, volta.

**Linhas 257 a 282**

```js
test('RF03 e RF18: cadastro assistido idempotente (fila offline reenviada)', async () => {
  await one("UPDATE users SET role = 'agente' WHERE id = $1 RETURNING id", [ctx.other.user.id])
  const item = {
    clientUuid: 'teste-uuid-1',
    businessName: 'Costuras da Vera',
    category: 'costura',
    appearsOnMaps: 'nao',
    barriers: ['expor_endereco', 'sem_cnpj'],
    accepted: true,
    collectedAt: new Date().toISOString(),
    provider: { consent: true, name: 'Vera', phone: '15955550005', lat: -23.48, lng: -47.42, serviceRadiusKm: 2, offer: { title: 'Ajustes de roupa' } },
  }
  const b1 = await api('POST', '/api/field/surveys/batch', { token: ctx.other.token, body: { items: [item, { ...item, clientUuid: 'teste-uuid-2', accepted: false, provider: undefined }] } })
  assert.equal(b1.data.results.every((x) => x.ok), true)
  const b2 = await api('POST', '/api/field/surveys/batch', { token: ctx.other.token, body: { items: [item] } })
  assert.equal(b2.data.results[0].duplicate, true)
  const n = await one("SELECT count(*)::int AS n FROM users WHERE phone = '+5515955550005' AND assisted_by IS NOT NULL")
  assert.equal(n.n, 1)
  const noConsent = await api('POST', '/api/field/surveys', { token: ctx.other.token, body: { ...item, clientUuid: 'teste-uuid-3', provider: { ...item.provider, consent: false } } })
  assert.equal(noConsent.status, 400)

  // O prestador cadastrado em campo entra depois com o próprio celular.
  const vera = await login('15955550005', 'x')
  assert.equal(vera.user.name, 'Vera')
  assert.equal(vera.user.isProvider, true)
})
```

**Cadastro assistido e fila offline**: envia um lote com dois registros, reenvia o mesmo (como faria a fila após uma queda de conexão) e confere que nada foi duplicado. Sem consentimento, é recusado. Por fim a prestadora entra com o próprio celular e encontra a conta pronta.

**Linhas 284 a 311**

```js
test('privacidade: nenhuma resposta da API contém coordenadas do prestador', async () => {
  // Varre todas as respostas recebidas durante os testes acima.
  const forbiddenKeys = /^(lat|lng|lon|latitude|longitude|exact|anchor|location_point|geom|geography|coordinates)$/i
  const offenders = []
  const near = (v, ref) => typeof v === 'number' && Math.abs(v - ref) < 0.01
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((x, i) => walk(x, `${path}[${i}]`))
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (forbiddenKeys.test(k) && !path.endsWith('pilot')) offenders.push(`${path}.${k}`)
        walk(v, `${path}.${k}`)
      }
      return
    }
    if (near(node, PROVIDER_POINT.lat) || near(node, PROVIDER_POINT.lng)) offenders.push(`${path}=${node}`)
    if (typeof node === 'string' && /-23\.48\d{2,}|-47\.42\d{2,}/.test(node)) offenders.push(`${path}="${node}"`)
  }
  for (const { path, data } of seen) walk(data, path)
  assert.deepEqual(offenders, [])
  assert.ok(seen.length > 40, 'a varredura cobriu as respostas do fluxo completo')

  // E a distância exibida é calculada a partir do ponto deslocado, não do endereço real.
  const row = await one(
    'SELECT ST_Distance(exact, anchor)::float8 AS d FROM provider_locations WHERE user_id = $1',
    [ctx.provider.user.id],
  )
  assert.ok(row.d >= 99 && row.d <= 301)
})
```

**O teste mais importante do RF04.** Percorre recursivamente **todas** as respostas recebidas nos testes anteriores (mais de 40) procurando:

- campos com nomes de coordenada (`lat`, `lng`, `latitude`, `exact`, `anchor`, `geom`...), exceto o centro público do bairro (`pilot`);
- qualquer número a menos de cerca de 1 km da coordenada real do prestador;
- textos que contenham a coordenada.

A lista de ocorrências precisa sair vazia. Depois confere no banco que o ponto público está mesmo entre 100 e 300 m do real.

---
