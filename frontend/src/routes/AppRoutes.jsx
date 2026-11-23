import { BrowserRouter, Route, Routes } from 'react-router-dom'
import LandingPage from '../pages/LandingPage.jsx'
import CompanySignupPage from '../pages/CompanySignupPage.jsx'
import DriverSignupPage from '../pages/DriverSignupPage.jsx'
import LoginPage from '../pages/LoginPage.jsx'
import SignupTypePage from '../pages/SignupTypePage.jsx'
import AudiencePage from '../pages/AudiencePage.jsx'
import CompanyDashboardLayout from '../components/company/CompanyDashboardLayout.jsx'
import CompanyDashboardPage from '../pages/CompanyDashboardPage.jsx'
import CompanyDemandCreatePage from '../pages/CompanyDemandCreatePage.jsx'
import CompanyDemandDetailPage from '../pages/CompanyDemandDetailPage.jsx'
import DriverDashboardLayout from '../components/driver/DriverDashboardLayout.jsx'
import DriverDashboardPage from '../pages/DriverDashboardPage.jsx'
import DriverProfilePage from '../pages/DriverProfilePage.jsx'
import CompanyDriverSearchPage from '../pages/CompanyDriverSearchPage.jsx'
import AdminDashboardLayout from '../components/admin/AdminDashboardLayout.jsx'
import AdminDashboardPage from '../pages/AdminDashboardPage.jsx'
import AdminUsersPage from '../pages/AdminUsersPage.jsx'
import AdminUserDetailPage from '../pages/AdminUserDetailPage.jsx'
import AdminDemandsPage from '../pages/AdminDemandsPage.jsx'
import AdminDemandDetailPage from '../pages/AdminDemandDetailPage.jsx'

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/empresas" element={<AudiencePage audience="companies" />} />
        <Route path="/motoristas-pj" element={<AudiencePage audience="drivers" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/cadastro" element={<SignupTypePage />} />
        <Route path="/cadastro/empresa" element={<CompanySignupPage />} />
        <Route path="/cadastro/motorista" element={<DriverSignupPage />} />
        <Route path="/empresa" element={<CompanyDashboardLayout />}>
          <Route index element={<CompanyDashboardPage />} />
          <Route path="demandas/nova" element={<CompanyDemandCreatePage />} />
          <Route path="demandas/:id" element={<CompanyDemandDetailPage />} />
          <Route path="motoristas" element={<CompanyDriverSearchPage />} />
        </Route>
        <Route path="/motorista" element={<DriverDashboardLayout />}>
          <Route index element={<DriverDashboardPage />} />
          <Route path="perfil" element={<DriverProfilePage />} />
        </Route>
        <Route path="/admin" element={<AdminDashboardLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="usuarios" element={<AdminUsersPage />} />
          <Route path="usuarios/:id" element={<AdminUserDetailPage />} />
          <Route path="demandas" element={<AdminDemandsPage />} />
          <Route path="demandas/:id" element={<AdminDemandDetailPage />} />
        </Route>
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes
