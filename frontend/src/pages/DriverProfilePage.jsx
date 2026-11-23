import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDriverProfile, updateDriverProfile, uploadDriverPhoto } from '../services/api.js'

export default function DriverProfilePage() {
  const [profile, setProfile] = useState(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    getDriverProfile().then((data) => active && setProfile(data)).catch((e) => active && setError(e.message)).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!file) { setPreview(''); return undefined }
    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  async function saveProfile(event) {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const form = new FormData(event.currentTarget)
    try {
      const updated = await updateDriverProfile({ nome: form.get('nome'), telefone: form.get('telefone') || null, disponivel: form.get('disponivel') === 'true' })
      setProfile(updated); setNotice('Perfil atualizado.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function savePhoto() {
    if (!file) { setError('Selecione uma foto antes de salvar.'); return }
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('A foto deve ser JPG ou PNG e ter até 5 MB.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      await uploadDriverPhoto(file)
      const updated = await getDriverProfile()
      setProfile(updated); setFile(null); setNotice('Foto de perfil atualizada.')
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  if (loading) return <div className="dashboard-state">Carregando perfil...</div>
  if (!profile) return <div className="dashboard-content"><div className="dashboard-alert" role="alert">{error || 'Perfil não encontrado.'}</div></div>

  const imageSrc = preview || (profile.fotoDisponivel ? `/api/v1/drivers/me/photo?v=${encodeURIComponent(profile.id)}` : '')
  return <div className="dashboard-content">
    <div className="dashboard-page-heading dashboard-page-heading--stacked">
      <div><Link className="dashboard-back" to="/motorista">← Voltar ao painel</Link><span className="dashboard-eyebrow">PERFIL DO MOTORISTA</span><h1>Seus dados</h1></div>
    </div>
    {error && <div className="dashboard-alert" role="alert">{error}</div>}
    {notice && <p className="dashboard-alert" role="status">{notice}</p>}
    <section className="demand-detail-card driver-profile-card">
      <div className="driver-profile-photo-wrap">
        {imageSrc ? <img className="driver-profile-photo" src={imageSrc} alt={`Foto de ${profile.nome}`} /> : <div className="driver-profile-placeholder" aria-label="Sem foto de perfil">{profile.nome.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>}
      </div>
      <div className="driver-profile-photo-controls">
        <label className="demand-field">Foto de perfil<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>JPG ou PNG, até 5 MB.</small></label>
        <button className="dashboard-button dashboard-button--secondary" type="button" onClick={savePhoto} disabled={busy || !file}>{busy ? 'Salvando...' : profile.fotoDisponivel ? 'Substituir foto' : 'Salvar foto'}</button>
      </div>
    </section>
    <form className="demand-form driver-profile-form" onSubmit={saveProfile}>
      <div className="demand-form__grid">
        <label className="demand-field demand-field--full">Nome completo<input name="nome" defaultValue={profile.nome} maxLength="255" required /></label>
        <label className="demand-field">Telefone<input name="telefone" defaultValue={profile.telefone || ''} maxLength="20" /></label>
        <label className="demand-field">Disponibilidade<select name="disponivel" defaultValue={String(profile.disponivel)}><option value="true">Disponível</option><option value="false">Indisponível</option></select></label>
        <label className="demand-field">CPF<input value={profile.cpf} readOnly /></label>
        <label className="demand-field">CNPJ<input value={profile.cnpj} readOnly /></label>
      </div>
      <button className="dashboard-button" type="submit" disabled={busy}>{busy ? 'Salvando...' : 'Salvar dados do perfil'}</button>
    </form>
  </div>
}
