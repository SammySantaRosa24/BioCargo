import { statusLabel } from './demandFormat.js'

function DemandStatus({ status }) {
  return <span className={`demand-status demand-status--${status?.toLowerCase()}`}>{statusLabel(status)}</span>
}

export default DemandStatus
