import { Navigate, Route, Routes } from 'react-router-dom'
import { useUser } from './auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Patients from './pages/Patients'
import PatientForm from './pages/PatientForm'
import PatientProfile from './pages/PatientProfile'
import Photos from './pages/Photos'
import PrintRx from './pages/PrintRx'
import Registry from './pages/Registry'
import Settings from './pages/Settings'
import VisitPage from './pages/Visit'

export default function App() {
  const user = useUser()
  if (user === undefined) return <div className="login muted">Loading…</div>
  if (user === null) return <Login />
  return (
    <Shell user={user}>
      <Routes>
        <Route path="/" element={<Patients />} />
        <Route path="/patients/new" element={<PatientForm />} />
        <Route path="/patients/:id" element={<PatientProfile />} />
        <Route path="/patients/:id/edit" element={<PatientForm />} />
        <Route path="/patients/:id/photos" element={<Photos />} />
        <Route path="/patients/:id/visits/new" element={<VisitPage />} />
        <Route path="/patients/:id/visits/:vid" element={<VisitPage />} />
        <Route path="/patients/:id/visits/:vid/print" element={<PrintRx />} />
        <Route path="/registry" element={<Registry />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
