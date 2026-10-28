// Dados de demonstração do bairro piloto. Roda automaticamente quando o banco está vazio.
// Para recriar do zero: npm run seed
import { pathToFileURL } from 'node:url'
import { config } from './config.js'
import { closeDb, db, initDb, one } from './db.js'
import { randomAnchor } from './lib/geo.js'
import { computeCommission } from './lib/money.js'
import { buildSearchText } from './lib/offers.js'

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
const rand = rng(20260910)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

function pointNear(lat, lng, maxMeters) {
  const d = Math.sqrt(rand()) * maxMeters
  const angle = rand() * 2 * Math.PI
  return {
    lat: lat + (d * Math.sin(angle)) / 111_320,
    lng: lng + (d * Math.cos(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180)),
  }
}

const daysAgo = (n, hour = 10) => {
  const d = new Date(Date.now() - n * 86_400_000)
  d.setHours(hour, Math.floor(rand() * 60), 0, 0)
  return d.toISOString()
}

const phone = (n) => `+551590000${String(n).padStart(4, '0')}`

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

const CLIENTS = [
  { n: 2, name: 'Thiago Nunes' },
  { n: 30, name: 'Rosângela Araújo' },
  { n: 31, name: 'Gabriel Moura' },
  { n: 32, name: 'Helena Castro' },
  { n: 33, name: 'Wagner Santos' },
]

const STAFF = [
  { n: 5, name: 'Agente de Campo (demo)', role: 'agente' },
  { n: 6, name: 'Moderação (demo)', role: 'moderador' },
  { n: 7, name: 'Associação de Moradores (demo)', role: 'instituicao' },
]

const REVIEW_COMMENTS = {
  5: ['Excelente, recomendo muito!', 'Muito caprichoso e pontual.', 'Atendimento ótimo, voltarei a contratar.', 'Perfeito, melhor do bairro.'],
  4: ['Bom serviço, chegou um pouco atrasado.', 'Gostei bastante.', 'Preço justo e bom trabalho.'],
  3: ['Resolveu, mas demorou mais que o combinado.'],
}

const BARRIER_POOL = ['expor_endereco', 'expor_endereco', 'sem_cnpj', 'sem_cnpj', 'fiscalizacao', 'sem_tempo', 'nao_sabe_usar', 'taxas_altas', 'nao_precisa']
const SURVEY_NAMES = ['Salão da Neide', 'Costuras da Vera', 'Bolos da Ivone', 'Conserto de bicicletas do Zé', 'Marmitex da Lu', 'Unhas da Kátia', 'Aulas de violão do Beto', 'Chaveiro Silva', 'Doces da Rita', 'Passadeira Marta', 'Banho e tosa da Cris', 'Sapateiro Joaquim', 'Salgados da Dona Lurdes', 'Eletricista Nando', 'Brechó da Sônia', 'Artesanato da Tânia', 'Reforço da Prof. Ana', 'Pães caseiros do Seu Jorge', 'Manicure Jéssica', 'Ferro-velho do Tião', 'Bordados da Lígia', 'Faxina da Dalva', 'Pastel da Fátima']

export async function seed() {
  await db().transaction(async (tx) => {
    const run = (sql, params) => tx.query(sql, params).then((r) => r.rows)
    const ids = {}

    for (const s of STAFF) {
      ids[s.n] = (await run('INSERT INTO users (phone, name, role, created_at) VALUES ($1, $2, $3, $4) RETURNING id', [phone(s.n), s.name, s.role, daysAgo(60)]))[0].id
    }
    for (const c of CLIENTS) {
      ids[c.n] = (await run('INSERT INTO users (phone, name, created_at) VALUES ($1, $2, $3) RETURNING id', [phone(c.n), c.name, daysAgo(20 + Math.floor(rand() * 30))]))[0].id
    }

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

    // Visualizações dos últimos 30 dias (RF14).
    for (const o of offerIds) {
      const total = 15 + Math.floor(rand() * 60)
      for (let i = 0; i < total; i++) {
        await run('INSERT INTO offer_views (offer_id, viewer_key, day) VALUES ($1, $2, $3::date) ON CONFLICT DO NOTHING', [
          o.id, `seed${Math.floor(rand() * 400)}`, daysAgo(Math.floor(rand() * 30)),
        ])
      }
    }

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

    // Plano de destaque ativo para a Cleusa (RF13).
    await run(
      `INSERT INTO highlights (provider_id, offer_id, category, plan, starts_at, ends_at, price_cents, payment_code)
       VALUES ($1, $2, 'alimentacao', 'quinzenal', now() - interval '3 days', now() + interval '12 days', 1790, 'PIX-SIMULADO-DEMO01')`,
      [offerIds[0].providerId, offerIds[0].id],
    )

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

    // Questionário de satisfação (Plano de aplicação, etapa 3).
    for (const [uid, group] of [...clientIds.map((id) => [id, 'contratante']), ...accepted.slice(0, 8).map((p) => [ids[p.n], 'prestador'])]) {
      await run('INSERT INTO satisfaction_surveys (user_id, user_group, score, ease, will_continue, comment, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
        uid, group, rand() < 0.7 ? 5 : 4, rand() < 0.6 ? 5 : rand() < 0.8 ? 4 : 3, rand() < 0.88, '', daysAgo(Math.floor(rand() * 10)),
      ])
    }

    // Uma denúncia aberta para a moderação demonstrar o RF15.
    await run(
      "INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, 'oferta', $2, 'informacao_incorreta', 'O preço anunciado não corresponde ao cobrado.')",
      [ids[31], offerIds[offerIds.length - 2].id],
    )
  })
}

export async function seedIfEmpty() {
  const r = await one('SELECT count(*)::int AS n FROM users')
  if (r.n > 0) return false
  console.log('Banco vazio: criando dados de demonstração do bairro piloto...')
  await seed()
  return true
}

export async function resetDatabase() {
  await db().exec('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;')
}

// Execução direta: node server/src/seed.js --reset
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    await initDb()
  } catch (err) {
    if (err.code !== 'DB_LOCKED') throw err
    console.error('\nFeche o ConectaBairro (Ctrl+C na janela dele) antes de recriar os dados.')
    process.exit(1)
  }
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
