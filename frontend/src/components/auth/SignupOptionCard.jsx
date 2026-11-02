import { Link } from 'react-router-dom'

function SignupOptionCard({ to, title, description, icon }) {
  return (
    <Link className="signup-option" to={to}>
      <span className="signup-option__icon" aria-hidden="true">{icon}</span>
      <span className="signup-option__copy">
        <span className="signup-option__title">{title}</span>
        <span className="signup-option__description">{description}</span>
      </span>
      <span className="signup-option__arrow" aria-hidden="true">↗</span>
    </Link>
  )
}

export default SignupOptionCard
