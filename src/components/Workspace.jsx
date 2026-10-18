import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Check, ChevronRight, ChevronsDownUp, Circle, CircleDot, FileText, FolderClosed,
  LayoutGrid, ListChecks, Lock, LogOut, PanelLeft, Plus, Swords, Target, Timer, Wallet,
} from 'lucide-react'
import { signOut } from '../api'
import { useAppData } from '../context/appDataContext'

// Folders that aren't built yet, with what they'll hold.
const FUTURE_FOLDERS = [
  { name: 'Goals', unlocks: 'Your goals and milestones live here.' },
  { name: 'Sessions', unlocks: 'Focus sessions you run on each goal.' },
  { name: 'Habits', unlocks: 'Daily and weekly habits with streaks.' },
  { name: 'Campaigns', unlocks: 'Time-boxed missions with daily rituals and a calendar.' },
  { name: 'Finance', unlocks: 'Income, spending and budgets.', tag: 'beta' },
]

const readSidebarPref = () => {
  try {
    return localStorage.getItem('sidebar') !== 'closed'
  } catch {
    return true
  }
}

const isNarrow = () => window.matchMedia('(max-width: 800px)').matches

const STEP_ICONS = { done: Check, current: CircleDot, next: Circle, link: FileText }

// Tapping a link on a phone also closes the drawer.
const closeDrawerOnPhone = (setOpen) => () => isNarrow() && setOpen(false)

function TreeRow({ to, active, icon, onNavigate, children }) {
  const cls = `tree-file ${active ? 'is-active' : ''}`
  return to && !active ? (
    <Link to={to} className={`${cls} is-link`} onClick={onNavigate}>{icon}<span className="tree-label">{children}</span></Link>
  ) : (
    <span className={cls} aria-current={active ? 'page' : undefined}>
      {icon}<span className="tree-label">{children}</span>
    </span>
  )
}

// step: 'login' | 'register' | 'setup' | 'done' on sign-up pages; omitted inside the app.
// folder: breadcrumb root. tabIcon: replaces the file icon in the tab (a goal's emoji).
// wide: use the full pane width instead of a centred reading column.
function Workspace({ title, step, folder, tabIcon, status, wide = false, children }) {
  const app = useAppData()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(() => !isNarrow() && readSidebarPref())
  const [expanded, setExpanded] = useState({ 'Getting started': true, Account: true, Goals: true, Sessions: true, Habits: true, Campaigns: true, Finance: true })
  const signedIn = Boolean(localStorage.getItem('token'))

  const lockReason = app || step === 'done'
    ? 'not built yet'
    : step === 'login' ? 'log in first' : 'unlocks after setup'

  useEffect(() => {
    if (!open || !isNarrow()) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const toggleSidebar = () => {
    const next = !open
    setOpen(next)
    if (!isNarrow()) {
      try {
        localStorage.setItem('sidebar', next ? 'open' : 'closed')
      } catch {
        // Preference just won't be remembered.
      }
    }
  }

  const onNavigate = closeDrawerOnPhone(setOpen)

  const toggleFolder = (name) => setExpanded({ ...expanded, [name]: !expanded[name] })

  const signupFolder = step === 'login' ? 'Account' : 'Getting started'
  const signupSteps = step === 'login'
    ? [
        { label: 'Log in', state: 'current' },
        { label: 'Create an account', state: 'link', to: '/register' },
      ]
    : [
        { label: 'Start leveling up', state: step === 'register' ? 'current' : 'done' },
        { label: 'Setup', state: step === 'setup' ? 'current' : step === 'done' ? 'done' : 'next' },
      ]

  // Inside the app, every folder is real; before sign-in they say what they'll hold.
  const lockedFolders = FUTURE_FOLDERS.filter((f) => !(app && ['Goals', 'Sessions', 'Habits', 'Campaigns', 'Finance'].includes(f.name)))
  const liveSession = app?.activeSession && ['running', 'paused'].includes(app.activeSession.status)
    ? app.activeSession
    : null
  const crumbRoot = folder || (app ? 'Goals' : signupFolder)

  const folderButton = (name, { locked, tag } = {}) => (
    <button
      type="button"
      className={`tree-folder ${locked ? 'is-locked' : ''}`}
      onClick={() => toggleFolder(name)}
      aria-expanded={Boolean(expanded[name])}
    >
      <ChevronRight size={14} className="chevron" aria-hidden="true" />
      {name}
      {tag && <span className="tag">{tag}</span>}
      {locked && <Lock size={13} className="lock" aria-label="Locked" />}
    </button>
  )

  return (
    <div className={`workspace ${open ? 'sidebar-open' : ''}`}>
      <nav className="ribbon" aria-label="Ribbon">
        <button
          type="button"
          className={`ribbon-btn ${open ? 'is-active' : ''}`}
          onClick={toggleSidebar}
          aria-pressed={open}
          aria-label="Files"
          title="Files"
        >
          <FolderClosed size={18} />
        </button>
        {app && (
          <Link
            to="/goals"
            className={`ribbon-btn ${pathname.startsWith('/goals') ? 'is-current' : ''}`}
            aria-label="Goals"
            title="Goals"
          >
            <Target size={18} />
          </Link>
        )}
        {liveSession ? (
          <Link to={`/focus/${liveSession._id}`} className="ribbon-btn is-current ribbon-live"
            aria-label="Return to your focus session" title="Return to your focus session">
            <Timer size={18} />
          </Link>
        ) : (
          app ? (
            <Link to="/sessions" className={`ribbon-btn ${pathname === '/sessions' ? 'is-current' : ''}`}
              aria-label="Focus sessions" title="Focus sessions">
              <Timer size={18} />
            </Link>
          ) : (
            <button type="button" className="ribbon-btn" aria-disabled="true"
              aria-label={`Focus sessions (${lockReason})`} title={`Focus sessions — ${lockReason}`}>
              <Timer size={18} />
            </button>
          )
        )}
        {app && (
          <Link to="/habits" className={`ribbon-btn ${pathname === '/habits' ? 'is-current' : ''}`}
            aria-label="Habits" title="Habits">
            <ListChecks size={18} />
          </Link>
        )}
        {app && (
          <Link to="/campaigns" className={`ribbon-btn ${pathname.startsWith('/campaigns') ? 'is-current' : ''}`}
            aria-label="Campaigns" title="Campaigns">
            <Swords size={18} />
          </Link>
        )}
        {app ? (
          <Link to="/finance" className={`ribbon-btn ${pathname === '/finance' ? 'is-current' : ''}`}
            aria-label="Finance" title="Finance">
            <Wallet size={18} />
          </Link>
        ) : (
          <button type="button" className="ribbon-btn" aria-disabled="true"
            aria-label={`Finance (${lockReason})`} title={`Finance — ${lockReason}`}>
            <Wallet size={18} />
          </button>
        )}
      </nav>

      <div className="scrim" onClick={toggleSidebar} aria-hidden="true" />

      <aside className="sidebar" aria-label="File explorer">
        <div className="explorer-header">
          <span className="explorer-title">Files</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setExpanded({})}
            aria-label="Collapse all"
            title="Collapse all"
          >
            <ChevronsDownUp size={16} />
          </button>
        </div>

        <ul className="tree">
          {app ? (
            <li>
              {folderButton('Goals')}
              {expanded.Goals && (
                <ul className="tree-children">
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/goals" active={pathname === '/goals'}
                      icon={<LayoutGrid size={14} className="tree-icon" aria-hidden="true" />}>
                      All goals
                    </TreeRow>
                  </li>
                  <AnimatePresence initial={false}>
                    {(app.goals || []).map((g) => (
                      <motion.li
                        key={g._id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <TreeRow onNavigate={onNavigate} to={`/goals/${g._id}`} active={pathname === `/goals/${g._id}`}
                          icon={<span className="tree-emoji" aria-hidden="true">{g.icon}</span>}>
                          {g.title}
                        </TreeRow>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/goals/new" active={pathname === '/goals/new'}
                      icon={<Plus size={14} className="tree-icon" aria-hidden="true" />}>
                      New goal
                    </TreeRow>
                  </li>
                </ul>
              )}
            </li>
          ) : null}

          {app && (
            <li>
              {folderButton('Sessions')}
              {expanded.Sessions && (
                <ul className="tree-children">
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/sessions" active={pathname === '/sessions'}
                      icon={<Timer size={14} className="tree-icon" aria-hidden="true" />}>
                      All sessions
                    </TreeRow>
                  </li>
                  {liveSession && (
                    <li>
                      <TreeRow onNavigate={onNavigate} to={`/focus/${liveSession._id}`} active={false}
                        icon={<span className="live-dot tree-live" aria-hidden="true" />}>
                        {liveSession.status === 'paused' ? 'Paused session' : 'Running now'}
                      </TreeRow>
                    </li>
                  )}
                </ul>
              )}
            </li>
          )}

          {app && (
            <li>
              {folderButton('Habits')}
              {expanded.Habits && (
                <ul className="tree-children">
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/habits" active={pathname === '/habits'}
                      icon={<ListChecks size={14} className="tree-icon" aria-hidden="true" />}>
                      Today
                    </TreeRow>
                  </li>
                </ul>
              )}
            </li>
          )}

          {app && (
            <li>
              {folderButton('Campaigns')}
              {expanded.Campaigns && (
                <ul className="tree-children">
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/campaigns" active={pathname === '/campaigns'}
                      icon={<Swords size={14} className="tree-icon" aria-hidden="true" />}>
                      All campaigns
                    </TreeRow>
                  </li>
                  <AnimatePresence initial={false}>
                    {(app.campaigns || []).map((c) => (
                      <motion.li
                        key={c._id}
                        layout
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                      >
                        <TreeRow onNavigate={onNavigate} to={`/campaigns/${c._id}`} active={pathname === `/campaigns/${c._id}`}
                          icon={<span className="tree-emoji" aria-hidden="true">{c.icon}</span>}>
                          {c.name}
                        </TreeRow>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/campaigns/new" active={pathname === '/campaigns/new'}
                      icon={<Plus size={14} className="tree-icon" aria-hidden="true" />}>
                      New campaign
                    </TreeRow>
                  </li>
                </ul>
              )}
            </li>
          )}

          {app && (
            <li>
              {folderButton('Finance', { tag: 'beta' })}
              {expanded.Finance && (
                <ul className="tree-children">
                  <li>
                    <TreeRow onNavigate={onNavigate} to="/finance" active={pathname === '/finance'}
                      icon={<Wallet size={14} className="tree-icon" aria-hidden="true" />}>
                      This week
                    </TreeRow>
                  </li>
                </ul>
              )}
            </li>
          )}

          {!app && (
            <li>
              {folderButton(signupFolder)}
              {expanded[signupFolder] && (
                <ul className="tree-children">
                  {signupSteps.map((s) => {
                    const Icon = STEP_ICONS[s.state]
                    return (
                      <li key={s.label}>
                        <TreeRow onNavigate={onNavigate} to={s.to} active={s.state === 'current'}
                          icon={<Icon size={14} className={`step-icon step-${s.state}`} aria-hidden="true" />}>
                          {s.label}
                        </TreeRow>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )}

          {lockedFolders.map((f) => (
            <li key={f.name}>
              {folderButton(f.name, { locked: true, tag: f.tag })}
              {expanded[f.name] && (
                <p className="tree-note">{f.unlocks} {lockReason[0].toUpperCase() + lockReason.slice(1)}.</p>
              )}
            </li>
          ))}
        </ul>

        <div className="vault-bar">
          <span className="vault-name">LevelUp</span>
          {app ? (
            <>
              <Link to="/profile" className={`vault-account ${pathname === '/profile' ? 'is-active' : ''}`}
                onClick={onNavigate} title="Profile">
                {app.me?.username || 'Profile'}
              </Link>
              <button type="button" className="icon-btn" onClick={signOut} aria-label="Log out" title="Log out">
                <LogOut size={15} />
              </button>
            </>
          ) : (
            <span className="vault-account">{signedIn ? 'signed in' : 'guest'}</span>
          )}
        </div>
      </aside>

      <div className="pane">
        <div className="tab-strip">
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={open ? 'Hide sidebar' : 'Show sidebar'}
            title={open ? 'Hide sidebar' : 'Show sidebar'}
          >
            <PanelLeft size={16} />
          </button>
          <div className="tab">
            {tabIcon ? <span aria-hidden="true">{tabIcon}</span> : <FileText size={14} aria-hidden="true" />}
            <span>{title}</span>
          </div>
        </div>

        <div className="view-header">
          {crumbRoot !== title && (
            <>
              <span className="crumb">{crumbRoot}</span>
              <span className="crumb-sep" aria-hidden="true">/</span>
            </>
          )}
          <span className="crumb-current">{title}</span>
        </div>

        <main className="note-scroll">
          <div className={`note ${wide ? 'note-wide' : ''}`}>{children}</div>
        </main>

        {status && <footer className="status-bar">{status}</footer>}
      </div>
    </div>
  )
}

export default Workspace
