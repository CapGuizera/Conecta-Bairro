// Painel para instituições parceiras (Business Intelligence): indicadores do Plano de Aplicação
// (Tabela 5 do artigo) com dados apenas agregados.
import { Download } from 'lucide-react'
import { api, getToken } from '../api.js'
import { Bars, ErrorBox, HBar, Loading, Stat, useLoad } from '../components/ui.jsx'
import { brl } from '../format.js'

const pct = (v) => `${String(v).replace('.', ',')}%`

async function downloadCsv() {
  const res = await fetch('/api/institution/export.csv', { headers: { Authorization: `Bearer ${getToken()}` } })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'conectabairro-indicadores.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Institution() {
  const { data, error, loading } = useLoad(() => api('/institution/overview'), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const { field, platform, satisfaction, weekly } = data
  const maxBarrier = Math.max(1, ...field.barriers.map((b) => b.count))
  const maxCat = Math.max(1, ...platform.offersByCategory.map((c) => Math.max(c.offers, c.surveyed)))
  const sat = Object.fromEntries(satisfaction.map((s) => [s.group, s]))

  return (
    <div>
      <div className="row between wrap">
        <div>
          <h1 style={{ marginBottom: 2 }}>Indicadores do bairro</h1>
          <p className="muted small" style={{ margin: 0 }}>Dados agregados, sem identificação de pessoas ou endereços.</p>
        </div>
        <button className="btn outline sm" onClick={downloadCsv}>
          <Download size={16} /> Exportar planilha (CSV)
        </button>
      </div>

      <div className="section-title">
        <h2>Etapa 1: validação do problema</h2>
      </div>
      <div className="grid stats">
        <Stat label="Negócios levantados" value={field.approached} />
        <Stat label="Ausentes de mapas digitais" value={pct(field.notOnMapsPct)} sub={`${field.notOnMaps} de ${field.approached}`} />
        <Stat label="Cadastrados" value={field.accepted} />
        <Stat label="Conversão abordados x cadastrados" value={pct(field.conversionPct)} />
      </div>
      <div className="grid two mt">
        <div className="card">
          <h3>Barreiras declaradas</h3>
          {field.barriers.map((b) => (
            <HBar key={b.id} label={b.label} value={b.count} max={maxBarrier} display={`${b.count} (${pct(b.pct)})`} accent />
          ))}
        </div>
        <div className="card">
          <h3>Oferta por categoria</h3>
          <div className="legend mb">
            <span>
              <i style={{ background: 'var(--primary)' }} />
              Ofertas ativas
            </span>
            <span>
              <i style={{ background: 'var(--accent)' }} />
              Levantados em campo
            </span>
          </div>
          {platform.offersByCategory.map((c) => (
            <div key={c.category}>
              <HBar label={c.name} value={c.offers} max={maxCat} />
              <div style={{ marginTop: -6 }}>
                <HBar label="" value={c.surveyed} max={maxCat} display={c.surveyed ? `${c.surveyed} levantados · ${c.notOnMaps} fora de mapas` : ' '} accent />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-title">
        <h2>Etapa 2: validação da solução</h2>
      </div>
      <div className="grid stats">
        <Stat label="Prestadores com oferta ativa" value={platform.active_providers} sub={`${platform.assisted} via cadastro assistido`} />
        <Stat label="Moradores que contataram" value={platform.active_clients} />
        <Stat label="Contratações concluídas" value={platform.concluded} />
        <Stat label="Volume movimentado" value={brl(platform.grossCents)} sub={`comissão apurada ${brl(platform.commissionCents)}`} />
      </div>
      <div className="grid two mt">
        <div className="card">
          <h3>Contatos e contratações por semana</h3>
          <Bars data={weekly.map((w) => ({ ...w, label: w.week }))} a="contacts" b="concluded" labelA="Contatos" labelB="Concluídas" />
        </div>
        <div className="card">
          <h3>Contratações por estado</h3>
          {platform.contractsByStatus.map((c) => (
            <HBar key={c.status} label={c.label} value={c.count} max={Math.max(...platform.contractsByStatus.map((x) => x.count))} />
          ))}
          <p className="small muted mt">
            Avaliação média: <strong>{platform.avgRating ? String(platform.avgRating).replace('.', ',') : '-'}</strong> em {platform.reviews} avaliações
          </p>
        </div>
      </div>

      <div className="section-title">
        <h2>Etapa 3: avaliação de satisfação</h2>
      </div>
      <div className="grid two">
        {['contratante', 'prestador'].map((g) => (
          <div className="card" key={g}>
            <h3>{g === 'contratante' ? 'Moradores contratantes' : 'Prestadores'}</h3>
            {sat[g] ? (
              <>
                <HBar label="Satisfação geral" value={sat[g].score} max={5} display={`${String(sat[g].score).replace('.', ',')} / 5`} />
                <HBar label="Facilidade de uso" value={sat[g].ease} max={5} display={`${String(sat[g].ease).replace('.', ',')} / 5`} />
                <HBar label="Intenção de continuar" value={sat[g].continuePct} max={100} display={pct(sat[g].continuePct)} accent />
                <div className="tiny muted">{sat[g].responses} respostas</div>
              </>
            ) : (
              <p className="muted small">Sem respostas ainda.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
