import { Link, useNavigate } from 'react-router-dom'
import DemandForm from '../components/company/DemandForm.jsx'
import { createCompanyDemand } from '../services/api.js'

function CompanyDemandCreatePage() {
  const navigate = useNavigate()

  async function handleCreate(demand) {
    const created = await createCompanyDemand(demand)
    navigate(`/empresa/demandas/${created.id}`, { replace: true })
  }

  return (
    <div className="dashboard-content">
      <div className="dashboard-page-heading dashboard-page-heading--stacked">
        <div><Link className="dashboard-back" to="/empresa">← Voltar ao painel</Link><span className="dashboard-eyebrow">NOVA PUBLICAÇÃO</span><h1>Publicar demanda</h1><p>Informe os dados do transporte para encontrar um prestador adequado.</p></div>
      </div>
      <DemandForm submitLabel="Publicar demanda" onSubmit={handleCreate} />
    </div>
  )
}

export default CompanyDemandCreatePage
