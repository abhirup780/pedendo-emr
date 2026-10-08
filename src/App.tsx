import { Navigate, Route, Routes } from 'react-router-dom'
import { useUser } from './auth'
import Shell from './components/Shell'
import Login from './pages/Login'
import Patients from './pages/Patients'
import PatientForm from './pages/PatientForm'
import PatientProfile from './pages/PatientProfile'
import Settings from './pages/Settings'

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
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  )
}
