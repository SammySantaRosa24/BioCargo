function Brand({ light = false }) {
  return (
    <a className={`brand${light ? ' brand--light' : ''}`} href="/" aria-label="BioCargo, início">
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" fill="none">
          <path d="M20 4v32M4 20h32M8.7 8.7l22.6 22.6M31.3 8.7 8.7 31.3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="20" cy="20" r="5.5" fill="currentColor" />
          <circle cx="20" cy="5" r="3" fill="currentColor" />
          <circle cx="35" cy="20" r="3" fill="currentColor" />
          <circle cx="20" cy="35" r="3" fill="currentColor" />
          <circle cx="5" cy="20" r="3" fill="currentColor" />
        </svg>
      </span>
      <span className="brand__name">Bio<span>Cargo</span></span>
    </a>
  )
}

export default Brand
