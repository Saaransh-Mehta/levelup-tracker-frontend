import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import api from '../api'
import { AppDataContext } from './appDataContext'

// Wraps every signed-in route: redirects to login without a token, loads the user, goal list,
// any focus session still running, the campaign list and the study topics.
export function SignedIn() {
  const token = localStorage.getItem('token')
  const [me, setMe] = useState(null)
  const [goals, setGoals] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [campaigns, setCampaigns] = useState(null)
  const [topics, setTopics] = useState(null)

  useEffect(() => {
    if (!token) return
    api.get('/users/me').then(({ data }) => setMe(data.user)).catch(() => {})
    api.get('/goals').then(({ data }) => setGoals(data.goals)).catch(() => setGoals([]))
    api.get('/sessions/active').then(({ data }) => setActiveSession(data.session)).catch(() => {})
    api.get('/campaigns').then(({ data }) => setCampaigns(data.campaigns)).catch(() => setCampaigns([]))
    api.get('/topics').then(({ data }) => setTopics(data.topics)).catch(() => setTopics([]))
  }, [token])

  // Re-reads topic totals after a study session ends.
  const refreshTopics = useCallback(() => {
    api.get('/topics').then(({ data }) => setTopics(data.topics)).catch(() => {})
  }, [])

  // Re-reads goal totals after a session ends, so cards and the sidebar stay current.
  const refreshGoals = useCallback(() => {
    api.get('/goals').then(({ data }) => setGoals(data.goals)).catch(() => {})
  }, [])

  // Keeps the sidebar and goal list in step with edits made on a goal page.
  const upsertGoal = useCallback((goal) => {
    const { content: _content, ...summary } = goal
    setGoals((list) => {
      const previous = (list || []).find((g) => g._id === summary._id)
      const rest = (list || []).filter((g) => g._id !== summary._id)
      return [{ sessions: previous?.sessions || { count: 0, seconds: 0 }, ...summary }, ...rest]
    })
  }, [])

  const removeGoal = useCallback((id) => {
    setGoals((list) => (list || []).filter((g) => g._id !== id))
  }, [])

  // Keeps the sidebar's campaign list in step with the campaign pages.
  const upsertCampaign = useCallback((campaign) => {
    setCampaigns((list) => {
      const rest = (list || []).filter((c) => c._id !== campaign._id)
      return [campaign, ...rest].sort((a, b) => b.startDate.localeCompare(a.startDate))
    })
  }, [])

  const removeCampaign = useCallback((id) => {
    setCampaigns((list) => (list || []).filter((c) => c._id !== id))
  }, [])

  // Keeps the sidebar and topic list in step with edits made on a topic page.
  const upsertTopic = useCallback((topic) => {
    const { content: _content, ...summary } = topic
    setTopics((list) => {
      const previous = (list || []).find((t) => t._id === summary._id)
      const rest = (list || []).filter((t) => t._id !== summary._id)
      return [{ sessions: previous?.sessions || { count: 0, seconds: 0, lastAt: null }, ...summary }, ...rest]
    })
  }, [])

  const removeTopic = useCallback((id) => {
    setTopics((list) => (list || []).filter((t) => t._id !== id))
  }, [])

  const value = useMemo(
    () => ({
      me, setMe, goals, upsertGoal, removeGoal, refreshGoals, activeSession, setActiveSession,
      campaigns, upsertCampaign, removeCampaign, topics, upsertTopic, removeTopic, refreshTopics,
    }),
    [
      me, goals, upsertGoal, removeGoal, refreshGoals, activeSession, campaigns, upsertCampaign, removeCampaign,
      topics, upsertTopic, removeTopic, refreshTopics,
    ],
  )

  if (!token) return <Navigate to="/login" replace />

  return (
    <AppDataContext.Provider value={value}>
      <Outlet />
    </AppDataContext.Provider>
  )
}
