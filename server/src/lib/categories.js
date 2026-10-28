// Categorias e palavras-chave usadas na busca por necessidade (RF05).
export const CATEGORIES = [
  { slug: 'alimentacao', name: 'Alimentação', keywords: 'bolo bolos salgado salgados doce doces marmita marmitas comida lanche torta pao paes festa aniversario encomenda brigadeiro coxinha almoco jantar' },
  { slug: 'costura', name: 'Costura e ajustes', keywords: 'costura costureira ajuste ajustes barra bainha roupa roupas conserto ziper vestido calca uniforme' },
  { slug: 'beleza', name: 'Beleza e estética', keywords: 'manicure pedicure unha unhas cabelo cabeleireira corte escova trança sobrancelha maquiagem depilacao barba barbeiro cilios' },
  { slug: 'aulas', name: 'Aulas particulares', keywords: 'aula aulas reforco escolar professor professora ingles matematica portugues violao musica redacao vestibular enem tarefa' },
  { slug: 'manutencao', name: 'Manutenção residencial', keywords: 'eletricista encanador chuveiro tomada torneira vazamento pintura pintor pedreiro reforma instalacao reparo conserto ventilador portao fechadura montagem moveis' },
  { slug: 'domesticos', name: 'Serviços domésticos', keywords: 'diarista faxina limpeza passadeira passar roupa lavar jardinagem jardineiro quintal organizacao' },
  { slug: 'cuidados', name: 'Cuidados', keywords: 'baba crianca criancas cuidador cuidadora idoso idosos acompanhante pet cachorro gato passeador banho tosa' },
  { slug: 'tecnologia', name: 'Informática e celulares', keywords: 'computador notebook formatacao formatar celular tela conserto internet wifi impressora programa' },
  { slug: 'artesanato', name: 'Artesanato e presentes', keywords: 'artesanato croche trico bordado presente lembrancinha personalizado sabonete vela decoracao' },
  { slug: 'fretes', name: 'Fretes e carretos', keywords: 'frete fretes carreto mudanca entrega transporte levar buscar' },
  { slug: 'outros', name: 'Outros', keywords: '' },
]

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug)
export const categoryName = (slug) => CATEGORIES.find((c) => c.slug === slug)?.name || slug

// Categorias cujas palavras-chave aparecem nos termos buscados.
export function categoriesForTokens(tokens) {
  return CATEGORIES.filter((c) => {
    const words = c.keywords.split(' ')
    return tokens.some((t) => words.some((w) => w && (w.startsWith(t) || t.startsWith(w))))
  }).map((c) => c.slug)
}
