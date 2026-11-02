import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from '../pages/LandingPage.jsx'
import CompanySignupPage from '../pages/CompanySignupPage.jsx'
import DriverSignupPage from '../pages/DriverSignupPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import SignupTypePage from '../pages/SignupTypePage.jsx'

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<SignupTypePage />} />
        <Route path="/cadastro/empresa" element={<CompanySignupPage />} />
        <Route path="/cadastro/motorista" element={<DriverSignupPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes
