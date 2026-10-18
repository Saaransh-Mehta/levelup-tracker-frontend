import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Register from './pages/Register'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import { SignedIn } from './context/AppData'

// The goal pages carry the editor, so they load on first visit instead of with sign-up.
const GoalsIndex = lazy(() => import('./pages/GoalsIndex'))
const NewGoal = lazy(() => import('./pages/NewGoal'))
const GoalRoute = lazy(() => import('./pages/GoalPage'))
const FocusRoute = lazy(() => import('./pages/Focus'))
const Sessions = lazy(() => import('./pages/Sessions'))
const Habits = lazy(() => import('./pages/Habits'))
const Finance = lazy(() => import('./pages/Finance'))
const CampaignsIndex = lazy(() => import('./pages/CampaignsIndex'))
const NewCampaign = lazy(() => import('./pages/NewCampaign'))
const CampaignPage = lazy(() => import('./pages/CampaignPage'))
const Profile = lazy(() => import('./pages/Profile'))

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<SignedIn />}>
            <Route path="/goals" element={<GoalsIndex />} />
            <Route path="/goals/new" element={<NewGoal />} />
            <Route path="/goals/:id" element={<GoalRoute />} />
            <Route path="/focus/:id" element={<FocusRoute />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/campaigns" element={<CampaignsIndex />} />
            <Route path="/campaigns/new" element={<NewCampaign />} />
            <Route path="/campaigns/:id" element={<CampaignPage />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to={localStorage.getItem('token') ? '/goals' : '/register'} replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
