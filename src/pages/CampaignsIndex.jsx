import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { Flame, Plus, Trophy } from 'lucide-react'
import api from '../api'
import Workspace from '../components/Workspace'
import { useAppData } from '../context/appDataContext'
import { localToday } from '../habits'
import { plural, shortDate } from '../campaigns'

const EASE = [0.2, 0.8, 0.2, 1]

const STATUS_LABEL = { active: 'Live', upcoming: 'Upcoming', complete: 'Complete' }

function CampaignCard({ campaign: c, index }) {
  const pct = c.totalDays ? c.elapsed / c.totalDays : 0
  const today = c.today
  const tasks = today ? c.rituals.length + today.todos.length : 0
  const tasksDone = today ? today.rituals.length + today.todos.filter((t) => t.done).length : 0

  return (
    <motion.li layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: EASE, delay: index * 0.05 }}>
      <Link to={`/campaigns/${c._id}`} className={`camp-card is-${c.status}`}>
        <span className="camp-card-top">
          <span className="camp-card-icon" aria-hidden="true">{c.icon}</span>
          <span className={`camp-chip is-${c.status}`}>
            {c.status === 'active' && <span className="live-dot" aria-hidden="true" />}
            {STATUS_LABEL[c.status]}
          </span>
        </span>
        <span className="camp-card-name">{c.name}</span>
        {c.mission && <span className="camp-card-mission">{c.mission}</span>}

        <span className="camp-card-day">
          {c.status === 'active' ? (
            <><span className="camp-card-num">Day {c.dayNumber}</span><span className="camp-card-of">/ {c.totalDays}</span></>
          ) : c.status === 'upcoming' ? (
            <><span className="camp-card-num">T−{c.daysLeft - c.totalDays}</span><span className="camp-card-of">starts {shortDate(c.startDate)}</span></>
          ) : (
            <><span className="camp-card-num">{c.wins}</span><span className="camp-card-of">/ {c.totalDays} days won</span></>
          )}
        </span>

        <span className="camp-card-track" aria-hidden="true">
          <motion.span className="camp-card-fill" initial={{ scaleX: 0 }} animate={{ scaleX: pct }}
            transition={{ duration: 1, ease: EASE, delay: 0.2 + index * 0.05 }} />
        </span>

        <span className="camp-card-stats">
          <span className={`habit-streak ${c.streak ? 'is-lit' : ''}`} title={`Best: ${plural(c.best, 'day')}`}>
            <Flame size={13} aria-hidden="true" />{c.streak}
          </span>
          <span className="camp-card-stat"><Trophy size={13} aria-hidden="true" />{plural(c.wins, 'win')}</span>
          {today && tasks > 0 && <span className="camp-card-stat">Today {tasksDone}/{tasks}</span>}
          {c.status !== 'complete' && <span className="camp-card-stat camp-card-left">{plural(c.daysLeft, 'day')} left</span>}
        </span>
      </Link>
    </motion.li>
  )
}

function CampaignsIndex() {
  const app = useAppData()
  const [campaigns, setCampaigns] = useState(app.campaigns)

  // The sidebar copy can be a day old; the cards show today's numbers.
  useEffect(() => {
    api.get(`/campaigns?today=${localToday()}`).then(({ data }) => setCampaigns(data.campaigns)).catch(() => {
      setCampaigns((c) => c || [])
    })
  }, [])

  const list = campaigns || []
  const live = list.filter((c) => c.status === 'active').length

  return (
    <Workspace title="Campaigns" folder="Campaigns" wide
      status={campaigns ? `${plural(list.length, 'campaign')} · ${live} live` : 'Loading…'}>
      <div className="stagger">
        <div className="page-head">
          <h1 className="inline-title">Campaigns</h1>
          {list.length > 0 && (
            <Link to="/campaigns/new" className="btn btn-cta"><Plus size={16} aria-hidden="true" />New campaign</Link>
          )}
        </div>
        <p className="lede">
          A set stretch of days with one mission. Show up for your daily protocol, hold the line against distractions, win the day.
        </p>

        {campaigns === null ? (
          <ul className="goal-grid" aria-label="Loading campaigns">
            {[0, 1, 2].map((i) => <li key={i} className="goal-card skeleton" />)}
          </ul>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">⚔️</span>
            <h2>No campaign running</h2>
            <p>Pick a stretch of days, name what you're after and what keeps pulling you off course. Six quick steps.</p>
            <Link to="/campaigns/new" className="btn btn-cta btn-large"><Plus size={16} aria-hidden="true" />Start your first campaign</Link>
          </div>
        ) : (
          <ul className="goal-grid">
            <AnimatePresence mode="popLayout">
              {list.map((c, i) => <CampaignCard key={c._id} campaign={c} index={i} />)}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </Workspace>
  )
}

export default CampaignsIndex
