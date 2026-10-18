import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'
import {
  ChevronLeft, ChevronRight, CircleAlert, CircleCheck, ListChecks, Pencil, Plus, Trash2, TriangleAlert, Wallet, X,
} from 'lucide-react'
import api, { getErrorMessage } from '../api'
import Workspace from '../components/Workspace'
import Burst from '../components/Burst'
import CheckButton from '../components/CheckButton'
import {
  CATEGORIES, CURRENCIES, addDays, addMonths, budgetForDays, categoryOf, currencyOf, fromDay, longDay, localToday,
  money, monthDays, monthName, monthStartOf, shortDay, toMinor, weekDays, weekRange, weekStartOf, weeksOfMonth,
} from '../finance'

const EASE = [0.2, 0.8, 0.2, 1]
const SPRING = { type: 'spring', stiffness: 520, damping: 30 }
// Share of the budget spent before the meter warns.
const WARN_AT = 0.75

const budgetStatus = (spent, budget) => {
  const pct = budget ? spent / budget : 0
  if (pct > 1) return { key: 'over', label: 'Over budget', icon: CircleAlert }
  if (pct >= WARN_AT) return { key: 'close', label: 'Getting close', icon: TriangleAlert }
  return { key: 'good', label: 'On track', icon: CircleCheck }
}

// Counts from the old amount to the new one, so spending visibly eats into the budget.
function AnimatedMoney({ value, currency }) {
  const ref = useRef(null)
  const prev = useRef(value)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const controls = animate(prev.current, value, {
      duration: reduceMotion ? 0 : 0.7,
      ease: EASE,
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = money(Math.round(v), currency)
      },
    })
    prev.current = value
    return () => controls.stop()
  }, [value, currency, reduceMotion])

  return <span ref={ref}>{money(value, currency)}</span>
}

// "1 Oct" style, for week segments inside a month.
const dayMonth = (s) => fromDay(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// First visit asks for the budget; later it edits it. Weekly or monthly, both views follow from it.
function BudgetForm({ profile, today, onSave, onCancel }) {
  const [code, setCode] = useState(profile?.currency || 'INR')
  const [period, setPeriod] = useState(profile?.budgetPeriod || 'week')
  const [amount, setAmount] = useState(profile ? String(profile.budgetAmount / 100) : '')
  const [saving, setSaving] = useState(false)
  const currency = currencyOf(code)
  const minor = toMinor(amount)
  const presets = period === 'month' ? currency.monthPresets : currency.presets

  // What the other view will show, for the month we're in.
  const month = monthStartOf(today)
  const asMonth = minor && budgetForDays(minor, period, monthDays(month))
  const asWeek = minor && budgetForDays(minor, period, weekDays(weekStartOf(today)))

  const submit = async (e) => {
    e.preventDefault()
    if (!minor || saving) return
    setSaving(true)
    if (!(await onSave({ amount: minor, period, currency: code }))) setSaving(false)
  }

  return (
    <form className="card budget-form" onSubmit={submit}>
      <div className="budget-form-head">
        <span className="budget-form-icon" aria-hidden="true"><Wallet size={20} /></span>
        <div>
          <h2>{profile ? 'Edit your budget' : 'Set your budget'}</h2>
          <p className="text-muted">Set it per week or per month, whichever you think in. The other one follows from it.</p>
        </div>
        {onCancel && <button type="button" className="icon-btn" onClick={onCancel} aria-label="Cancel"><X size={16} /></button>}
      </div>

      <div className="budget-form-row">
        <span className="habit-option-key" id="cur-key">Currency</span>
        <div className="pills" role="radiogroup" aria-labelledby="cur-key">
          {CURRENCIES.map((c) => (
            <label key={c.code} className="pill pill-small">
              <input type="radio" name="currency" checked={code === c.code} onChange={() => setCode(c.code)} />
              {c.symbol} {c.label}
            </label>
          ))}
        </div>
      </div>

      <div className="budget-form-row">
        <span className="habit-option-key" id="per-key">Budget per</span>
        <div className="pills" role="radiogroup" aria-labelledby="per-key">
          {['week', 'month'].map((p) => (
            <label key={p} className="pill pill-small">
              <input type="radio" name="period" checked={period === p} onChange={() => { setPeriod(p); setAmount('') }} />
              {p === 'week' ? 'Week' : 'Month'}
            </label>
          ))}
        </div>
      </div>

      <div className="budget-form-row">
        <label className="habit-option-key" htmlFor="budget-amount">{period === 'week' ? 'Weekly budget' : 'Monthly budget'}</label>
        <div>
          <div className="money-input">
            <span aria-hidden="true">{currency.symbol}</span>
            <input id="budget-amount" className="property-value" inputMode="decimal" value={amount} autoFocus={!profile}
              onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </div>
          <div className="pills budget-presets">
            {presets.map((p) => (
              <button key={p} type="button" className={`habit-step ${minor === p * 100 ? 'is-selected' : ''}`}
                onClick={() => setAmount(String(p))}>
                {money(p * 100, code)}
              </button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {minor && (
              <motion.p className="budget-sync" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}>
                {period === 'week'
                  ? <>That&apos;s <strong>{money(Math.round(asMonth / 100) * 100, code)}</strong> for {monthName(month, false)}.</>
                  : <>That&apos;s about <strong>{money(Math.round(asWeek / 100) * 100, code)}</strong> a week.</>}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="sheet-actions">
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
        <motion.button type="submit" className="btn btn-cta" disabled={!minor || saving} whileTap={{ scale: 0.97 }}>
          {profile ? 'Save budget' : 'Start tracking'}
        </motion.button>
      </div>
    </form>
  )
}

// Spending per day, with the even daily share of the budget as a dashed line.
function DayBars({ days, expenses, budget, today, currency }) {
  const [hover, setHover] = useState(null)
  const isMonth = days.length > 7
  const sums = days.map((d) => {
    const list = expenses.filter((e) => e.date === d)
    return { date: d, total: list.reduce((s, e) => s + e.amount, 0), count: list.length }
  })
  const pace = budget / days.length
  const max = Math.max(pace, ...sums.map((s) => s.total)) * 1.15
  const columns = { gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }
  // A month labels its first day and each Monday; a week labels every day.
  const labelOf = (d) => (!isMonth ? shortDay(d).slice(0, 2) : d.endsWith('-01') || fromDay(d).getDay() === 1 ? Number(d.slice(8)) : '')

  return (
    <div className={`day-bars ${isMonth ? 'is-month' : ''}`} onMouseLeave={() => setHover(null)}>
      <div className="day-bars-plot" style={columns}>
        <div className="day-pace" style={{ bottom: `${(pace / max) * 100}%` }}>
          <span>daily pace {money(Math.round(pace / 100) * 100, currency)}</span>
        </div>
        {sums.map((s, i) => {
          const label = `${longDay(s.date)}: ${money(s.total, currency)}${s.count ? `, ${s.count} item${s.count === 1 ? '' : 's'}` : ''}`
          return (
            <button key={s.date} type="button" className={`day-col ${s.date > today ? 'is-future' : ''} ${hover === i ? 'is-hover' : ''}`}
              onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} aria-label={label}>
              <motion.span className="day-bar" style={{ minHeight: s.total ? 4 : 0 }} initial={{ height: '0%' }}
                animate={{ height: `${(s.total / max) * 100}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 20, delay: Math.min(i, 14) * 0.03 }} />
              {hover === i && (
                <span className={`day-tip ${i < 2 ? 'is-start' : i > days.length - 3 ? 'is-end' : ''}`} role="presentation">
                  <strong>{isMonth ? dayMonth(s.date) : shortDay(s.date)}</strong> {money(s.total, currency)}
                  {s.count > 0 && <span className="text-faint"> · {s.count} item{s.count === 1 ? '' : 's'}</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="day-labels" style={columns} aria-hidden="true">
        {days.map((d) => <span key={d} className={d === today ? 'is-today' : ''}>{labelOf(d)}</span>)}
      </div>
    </div>
  )
}

function BudgetCard({ data, today, onEdit, onOpenMonth }) {
  const { profile, period, range, budget, total, previous, month } = data
  const days = period === 'month' ? monthDays(range.start) : weekDays(range.start)
  const left = budget - total
  const status = budgetStatus(total, budget)
  const StatusIcon = status.icon
  const isCurrent = today >= range.start && today <= range.end
  const daysLeft = isCurrent ? days.length - days.indexOf(today) : 0
  const pct = Math.min(1, budget ? total / budget : 0)
  const monthStatus = month && budgetStatus(month.total, month.budget)

  return (
    <section className={`card budget-card is-${status.key}`} aria-labelledby="budget-title">
      <div className="budget-main">
        <div className="budget-top">
          <span className="budget-kicker" id="budget-title">
            {left < 0 ? 'Over budget by' : isCurrent ? 'Left to spend' : 'Came in under budget by'}
          </span>
          <button type="button" className="btn btn-ghost budget-edit" onClick={onEdit}>
            <Pencil size={14} aria-hidden="true" />Edit budget
          </button>
        </div>
        <div className="budget-hero"><AnimatedMoney value={Math.abs(left)} currency={profile.currency} /></div>

        <div className="budget-meter" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={total}
          aria-label={`Spent this ${period}`}>
          <motion.span className="budget-meter-fill" initial={false} animate={{ scaleX: pct }}
            transition={{ type: 'spring', stiffness: 110, damping: 20 }} />
        </div>
        <div className="budget-line">
          <span className="budget-status"><StatusIcon size={14} aria-hidden="true" />{status.label}</span>
          <span><strong>{money(total, profile.currency)}</strong> of {money(budget, profile.currency)} spent</span>
        </div>

        <ul className="budget-facts">
          {isCurrent && left > 0 && (
            <li>About <strong>{money(Math.floor(left / daysLeft / 100) * 100, profile.currency)}</strong> a day for the {daysLeft} day{daysLeft === 1 ? '' : 's'} left</li>
          )}
          {previous.total > 0 && (
            <li>{period === 'month' ? monthName(previous.start, false) : 'Week before'}: {money(previous.total, profile.currency)}
              {/* Comparing a part-finished week or month with a whole one would mislead, so only finished ones get a verdict. */}
              {!isCurrent && total > 0 && (total < previous.total ? ' · you spent less' : total > previous.total ? ' · you spent more' : '')}
            </li>
          )}
          {month && (
            <li className="budget-month-link">
              <button type="button" className={`month-chip is-${monthStatus.key}`} onClick={() => onOpenMonth(month.start)}>
                <span className="month-chip-meter" aria-hidden="true">
                  <span style={{ transform: `scaleX(${Math.min(1, month.budget ? month.total / month.budget : 0)})` }} />
                </span>
                <span>{monthName(month.start, false)}: <strong>{money(month.total, profile.currency)}</strong> of {money(month.budget, profile.currency)}</span>
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </li>
          )}
        </ul>
      </div>
      <DayBars days={days} expenses={data.expenses} budget={budget} today={today} currency={profile.currency} />
    </section>
  )
}

// A month, week by week. Each week's share of the budget comes from the same daily allowance.
function WeeksCard({ data, today, onOpenWeek }) {
  const { profile, range, expenses } = data
  const weeks = weeksOfMonth(range.start).map((w) => {
    const spent = expenses.filter((e) => w.days.includes(e.date)).reduce((s, e) => s + e.amount, 0)
    const budget = budgetForDays(profile.budgetAmount, profile.budgetPeriod, w.days)
    return { ...w, spent, budget, status: budgetStatus(spent, budget) }
  })

  return (
    <section className="card weeks-card" aria-labelledby="weeks-title">
      <h2 className="side-title" id="weeks-title">{monthName(range.start, false)}, week by week</h2>
      <ul className="weeks">
        {weeks.map((w, i) => {
          const current = today >= w.days[0] && today <= w.days[w.days.length - 1]
          const future = w.days[0] > today
          const StatusIcon = w.status.icon
          return (
            <motion.li key={w.start} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <button type="button" className={`week-row is-${w.status.key} ${future ? 'is-future' : ''}`} onClick={() => onOpenWeek(w.start)}>
                <span className="week-row-name">
                  {dayMonth(w.days[0])} – {dayMonth(w.days[w.days.length - 1])}
                  {current && <span className="chip">this week</span>}
                  {w.days.length < 7 && <span className="week-row-part">{w.days.length} day{w.days.length === 1 ? '' : 's'} in {monthName(range.start, false)}</span>}
                </span>
                <span className="week-row-amount">
                  <strong>{money(w.spent, profile.currency)}</strong> / {money(w.budget, profile.currency)}
                </span>
                <span className="week-row-meter" aria-hidden="true">
                  <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, w.budget ? w.spent / w.budget : 0) }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                </span>
                <span className="week-row-status">
                  {future ? <span className="text-faint">Coming up</span> : <><StatusIcon size={13} aria-hidden="true" />{w.status.label}</>}
                </span>
              </button>
            </motion.li>
          )
        })}
      </ul>
    </section>
  )
}

function ExpenseComposer({ currency, days, today, onAdd }) {
  const defaultDay = days.includes(today) ? today : days[days.length - 1]
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('food')
  const [date, setDate] = useState(defaultDay)
  const [saving, setSaving] = useState(false)
  const rangeKey = `${days[0]}:${days.length}`
  const [lastRange, setLastRange] = useState(rangeKey)
  const itemRef = useRef(null)
  const minor = toMinor(amount)
  const open = Boolean(item.trim() || amount)

  // A different week or month was opened: pick a day inside it.
  if (lastRange !== rangeKey) {
    setLastRange(rangeKey)
    setDate(defaultDay)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!item.trim() || !minor || saving) return
    setSaving(true)
    const ok = await onAdd({ item: item.trim(), amount: minor, category, date })
    setSaving(false)
    if (ok) {
      setItem('')
      setAmount('')
      itemRef.current?.focus()
    }
  }

  return (
    <form className={`card habit-composer expense-composer ${open ? 'is-open' : ''}`} onSubmit={submit}>
      <div className="habit-composer-row">
        <span className="habit-composer-icon" aria-hidden="true">{open ? categoryOf(category).icon : <Plus size={18} />}</span>
        <input ref={itemRef} className="habit-composer-input" value={item} maxLength={120}
          onChange={(e) => setItem(e.target.value)} placeholder="What did you spend on?" aria-label="Item" />
        <div className="money-input money-input-inline">
          <span aria-hidden="true">{currencyOf(currency).symbol}</span>
          <input className="property-value" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0" aria-label="Amount" />
        </div>
        <motion.button type="submit" className="btn btn-cta" disabled={!item.trim() || !minor || saving} whileTap={{ scale: 0.95 }}>
          Add
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div className="habit-composer-options" initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="habit-options-inner">
              <div className="habit-option">
                <span className="habit-option-key" id="cat-key">Category</span>
                <div className="pills" role="radiogroup" aria-labelledby="cat-key">
                  {CATEGORIES.map((c) => (
                    <label key={c.value} className="pill pill-small">
                      <input type="radio" name="category" checked={category === c.value} onChange={() => setCategory(c.value)} />
                      <span className="pill-emoji" aria-hidden="true">{c.icon}</span>{c.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="habit-option">
                <span className="habit-option-key" id="day-key">Day</span>
                {days.length > 7 ? (
                  <div className="habit-days">
                    <input type="date" className="property-value expense-date" aria-labelledby="day-key" value={date}
                      min={days[0]} max={days[days.length - 1] < today ? days[days.length - 1] : today}
                      onChange={(e) => e.target.value && setDate(e.target.value)} />
                    <span className="habit-days-label">{date === today ? 'Today' : longDay(date)}</span>
                  </div>
                ) : (
                <div className="habit-days" role="radiogroup" aria-labelledby="day-key">
                  {days.map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={date === d} aria-label={longDay(d)}
                      className={`habit-day ${date === d ? 'is-on' : ''}`} disabled={d > today} onClick={() => setDate(d)}>
                      {shortDay(d).slice(0, 2)}
                    </button>
                  ))}
                  <span className="habit-days-label">{date === today ? 'Today' : longDay(date)}</span>
                </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  )
}

// Where the week's money went, by category. Clicking one filters the list.
function Breakdown({ expenses, total, currency, filter, setFilter }) {
  const rows = CATEGORIES.map((c) => ({
    ...c,
    total: expenses.filter((e) => e.category === c.value).reduce((s, e) => s + e.amount, 0),
  })).filter((r) => r.total > 0).sort((a, b) => b.total - a.total)
  const max = rows[0]?.total || 1

  return (
    <section className="card side-card" aria-labelledby="where-title">
      <h2 className="side-title" id="where-title">Where it went</h2>
      {rows.length === 0 ? (
        <p className="text-faint finance-empty">Nothing spent this week yet.</p>
      ) : (
        <ul className="breakdown">
          {rows.map((r, i) => (
            <motion.li key={r.value} layout="position" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.04 }}>
              <button type="button" className={`breakdown-row ${filter === r.value ? 'is-active' : ''}`}
                onClick={() => setFilter(filter === r.value ? null : r.value)} aria-pressed={filter === r.value}>
                <span className="breakdown-label"><span className="pill-emoji" aria-hidden="true">{r.icon}</span>{r.label}</span>
                <span className="breakdown-amount">{money(r.total, currency)}</span>
                <span className="breakdown-track" aria-hidden="true">
                  <motion.span className="breakdown-fill" initial={{ scaleX: 0 }} animate={{ scaleX: r.total / max }}
                    transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
                </span>
                <span className="breakdown-pct">{Math.round((r.total / total) * 100)}%</span>
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  )
}

function ExpenseRow({ expense, currency, onDelete }) {
  const [armed, setArmed] = useState(false)
  const cat = categoryOf(expense.category)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <motion.li layout="position" className="expense-row" initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}>
      <span className="expense-icon" aria-hidden="true">{cat.icon}</span>
      <span className="expense-text">
        <span className="expense-item">{expense.item}</span>
        <span className="expense-cat">{cat.label}</span>
      </span>
      <span className="expense-amount">{money(expense.amount, currency)}</span>
      <button type="button" className={`icon-btn habit-delete ${armed ? 'is-armed' : ''}`}
        onClick={() => (armed ? onDelete(expense) : setArmed(true))}
        aria-label={armed ? `Confirm deleting ${expense.item}` : `Delete ${expense.item}`}
        title={armed ? 'Click again to delete' : 'Delete'}>
        {armed ? <X size={15} /> : <Trash2 size={15} />}
      </button>
    </motion.li>
  )
}

function ExpenseList({ expenses, currency, filter, setFilter, onDelete }) {
  const shown = filter ? expenses.filter((e) => e.category === filter) : expenses
  const dates = [...new Set(shown.map((e) => e.date))].sort().reverse()

  return (
    <section className="expense-days" aria-labelledby="spent-title">
      <div className="finance-section-head">
        <h2 id="spent-title" className="section-title">What you spent on</h2>
        {filter && (
          <button type="button" className="chip chip-button" onClick={() => setFilter(null)}>
            {categoryOf(filter).label}<X size={12} aria-label="Clear filter" />
          </button>
        )}
      </div>
      {dates.length === 0 ? (
        <p className="text-faint finance-empty">
          {filter ? 'Nothing in this category this week.' : 'Add what you spend above and it shows up here, day by day.'}
        </p>
      ) : (
        <AnimatePresence initial={false}>
          {dates.map((d) => {
            const list = shown.filter((e) => e.date === d)
            return (
              <motion.div key={d} layout="position" className="card expense-day" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}>
                <div className="expense-day-head">
                  <span>{d === localToday() ? 'Today' : longDay(d)}</span>
                  <span className="expense-day-total">{money(list.reduce((s, e) => s + e.amount, 0), currency)}</span>
                </div>
                <ul className="expense-list">
                  <AnimatePresence initial={false}>
                    {list.map((e) => <ExpenseRow key={e._id} expense={e} currency={currency} onDelete={onDelete} />)}
                  </AnimatePresence>
                </ul>
              </motion.div>
            )
          })}
        </AnimatePresence>
      )}
    </section>
  )
}

// Big money tasks to get done, separate from weekly spending.
function Checklist({ tasks, currency, onAdd, onToggle, onDelete }) {
  const reduceMotion = useReducedMotion()
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [celebrate, setCelebrate] = useState(0)
  const done = tasks.filter((t) => t.done).length
  const ordered = [...tasks.filter((t) => !t.done), ...tasks.filter((t) => t.done)]

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    if (await onAdd({ title: title.trim(), amount: toMinor(amount) })) {
      setTitle('')
      setAmount('')
    }
  }

  const toggle = (task) => {
    if (!task.done && done + 1 === tasks.length) setCelebrate((n) => n + 1)
    onToggle(task)
  }

  return (
    <section className="card side-card checklist-card" aria-labelledby="check-title">
      <div className="checklist-head">
        <h2 className="side-title" id="check-title"><ListChecks size={15} aria-hidden="true" />Major checklist</h2>
        {tasks.length > 0 && <span className="checklist-count">{done}/{tasks.length}</span>}
        {!reduceMotion && celebrate > 0 && <Burst key={celebrate} count={30} spread={260} height={110} />}
      </div>
      {tasks.length > 0 && (
        <div className="checklist-meter" aria-hidden="true">
          <motion.span className={done === tasks.length ? 'is-full' : ''} initial={false}
            animate={{ scaleX: done / tasks.length }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
      )}

      <ul className="checklist">
        <AnimatePresence initial={false}>
          {ordered.map((t) => (
            <ChecklistRow key={t._id} task={t} currency={currency} onToggle={() => toggle(t)} onDelete={() => onDelete(t)} />
          ))}
        </AnimatePresence>
      </ul>
      {tasks.length === 0 && (
        <p className="text-faint finance-empty">The big money moves: an emergency fund, clearing a loan, starting to invest.</p>
      )}

      <form className="checklist-add" onSubmit={submit}>
        <input className="property-value" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task, e.g. Save 3 months of expenses" aria-label="New checklist task" />
        <div className="money-input">
          <span aria-hidden="true">{currencyOf(currency).symbol}</span>
          <input className="property-value" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount" aria-label="Amount (optional)" />
        </div>
        <button type="submit" className="btn" disabled={!title.trim()}><Plus size={14} aria-hidden="true" />Add</button>
      </form>
    </section>
  )
}

function ChecklistRow({ task, currency, onToggle, onDelete }) {
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <motion.li layout="position" className={`checklist-row ${task.done ? 'is-done' : ''}`}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30, transition: { duration: 0.2 } }}
      transition={{ duration: 0.35, ease: EASE }}>
      <CheckButton done={task.done} label={task.title} onToggle={onToggle} />
      <span className="checklist-text">
        <span className="habit-title">
          <span>{task.title}</span>
          <motion.span className="habit-strike" aria-hidden="true" initial={false}
            animate={{ scaleX: task.done ? 1 : 0 }} transition={{ duration: 0.35, ease: EASE }} />
        </span>
        {task.amount > 0 && <span className="checklist-amount">{money(task.amount, currency)}</span>}
      </span>
      <button type="button" className={`icon-btn habit-delete ${armed ? 'is-armed' : ''}`}
        onClick={() => (armed ? onDelete() : setArmed(true))}
        aria-label={armed ? `Confirm deleting ${task.title}` : `Delete ${task.title}`}
        title={armed ? 'Click again to delete' : 'Delete'}>
        {armed ? <X size={15} /> : <Trash2 size={15} />}
      </button>
    </motion.li>
  )
}

// Adds (sign 1) or removes (sign -1) an expense in the loaded range, and in the linked month total.
const withExpense = (data, e, sign) => {
  const inRange = (r) => r && e.date >= r.start && e.date <= r.end
  if (!inRange(data.range) && !inRange(data.month)) return data
  return {
    ...data,
    ...(inRange(data.range) && {
      expenses: sign > 0 ? [e, ...data.expenses] : data.expenses.filter((x) => x._id !== e._id),
      total: data.total + sign * e.amount,
    }),
    month: inRange(data.month) ? { ...data.month, total: data.month.total + sign * e.amount } : data.month,
  }
}

function Finance() {
  const [today] = useState(localToday)
  // What's on screen: a week (start is its Monday) or a month (start is its 1st).
  const [view, setView] = useState({ period: 'week', start: weekStartOf(localToday()) })
  const [reload, setReload] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [filter, setFilter] = useState(null)
  const { period, start } = view
  const isMonth = period === 'month'
  const current = isMonth ? monthStartOf(today) : weekStartOf(today)
  const previous = isMonth ? addMonths(current, -1) : addDays(current, -7)
  const step = (n) => (isMonth ? addMonths(start, n) : addDays(start, 7 * n))

  const goTo = (nextPeriod, nextStart) => {
    setView({ period: nextPeriod, start: nextStart })
    setFilter(null)
    setEditing(false)
  }

  // Switching week ↔ month keeps you on the same stretch of time: today if it's on screen, else the range start.
  const switchTo = (nextPeriod) => {
    if (nextPeriod === period) return
    const end = isMonth ? monthDays(start).at(-1) : addDays(start, 6)
    const anchor = today >= start && today <= end ? today : start
    goTo(nextPeriod, nextPeriod === 'month' ? monthStartOf(anchor) : weekStartOf(anchor))
  }

  useEffect(() => {
    let live = true
    api.get(`/finance?period=${period}&start=${start}&today=${today}`).then(({ data: d }) => live && setData(d))
      .catch((err) => live && setError(getErrorMessage(err)))
    return () => { live = false }
  }, [period, start, today, reload])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(''), 4000)
    return () => clearTimeout(t)
  }, [error])

  const fail = (err) => {
    setError(getErrorMessage(err))
    return false
  }

  const saveBudget = async (fields) => {
    try {
      await api.put('/finance/profile', fields)
      // Budgets for the week, month and the one before are worked out on the server.
      setReload((n) => n + 1)
      setEditing(false)
      return true
    } catch (err) {
      return fail(err)
    }
  }

  const addExpense = async (fields) => {
    try {
      const { data: d } = await api.post('/finance/expenses', fields)
      const e = d.expense
      setData((prev) => withExpense(prev, e, 1))
      return true
    } catch (err) {
      return fail(err)
    }
  }

  const deleteExpense = async (expense) => {
    const before = data
    setData((prev) => withExpense(prev, expense, -1))
    try {
      await api.delete(`/finance/expenses/${expense._id}`)
    } catch (err) {
      setData(before)
      fail(err)
    }
  }

  const setTasks = (fn) => setData((prev) => ({ ...prev, checklist: fn(prev.checklist) }))

  const addTask = async (fields) => {
    try {
      const { data: d } = await api.post('/finance/checklist', fields)
      setTasks((list) => [...list, d.task])
      return true
    } catch (err) {
      return fail(err)
    }
  }

  const toggleTask = async (task) => {
    setTasks((list) => list.map((t) => (t._id === task._id ? { ...t, done: !task.done } : t)))
    try {
      await api.patch(`/finance/checklist/${task._id}`, { done: !task.done })
    } catch (err) {
      setTasks((list) => list.map((t) => (t._id === task._id ? task : t)))
      fail(err)
    }
  }

  const deleteTask = async (task) => {
    setTasks((list) => list.filter((t) => t._id !== task._id))
    try {
      await api.delete(`/finance/checklist/${task._id}`)
    } catch (err) {
      setTasks((list) => [...list, task])
      fail(err)
    }
  }

  const ready = data && data.period === period && data.range.start === start
  const profile = data?.profile
  const currency = profile?.currency || 'INR'
  const navLabel = isMonth
    ? (start === current ? 'This month' : start === previous ? 'Last month' : 'Month of')
    : (start === current ? 'This week' : start === previous ? 'Last week' : 'Week of')

  return (
    <Workspace title="Finance" folder="Finance" wide
      status={profile ? `${money(profile.budgetAmount, currency)} a ${profile.budgetPeriod}` : 'Finance · beta'}>
      <div className="stagger finance-page">
        <h1 className="inline-title">Finance</h1>
        <p className="lede">Your budget by week and by month, what you spent it on, and the bigger money moves to get done.</p>

        {!data ? (
          <div className="goal-skeleton"><span /><span /><span /></div>
        ) : !profile ? (
          <BudgetForm today={today} onSave={saveBudget} />
        ) : (
          <>
            <div className="week-nav">
              <div className="segmented period-switch" role="tablist" aria-label="Budget view">
                {['week', 'month'].map((p) => (
                  <button key={p} type="button" role="tab" aria-selected={period === p} className="segmented-btn"
                    onClick={() => switchTo(p)}>
                    {period === p && <motion.span layoutId="period-pill" className="segmented-pill" transition={SPRING} />}
                    <span className="segmented-label">{p === 'week' ? 'Week' : 'Month'}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="icon-btn" onClick={() => goTo(period, step(-1))} aria-label={`Previous ${period}`}>
                <ChevronLeft size={18} />
              </button>
              <span className="week-label">
                <strong>{navLabel}</strong>
                {isMonth ? monthName(start) : weekRange(start)}
              </span>
              <button type="button" className="icon-btn" onClick={() => goTo(period, step(1))}
                disabled={start >= current} aria-label={`Next ${period}`}>
                <ChevronRight size={18} />
              </button>
              {start !== current && (
                <button type="button" className="btn btn-ghost" onClick={() => goTo(period, current)}>Back to this {period}</button>
              )}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {editing ? (
                <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}>
                  <BudgetForm profile={profile} today={today} onSave={saveBudget} onCancel={() => setEditing(false)} />
                </motion.div>
              ) : (
                <motion.div key="card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: ready ? 1 : 0.5, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                  <BudgetCard data={data} today={today} onEdit={() => setEditing(true)} onOpenMonth={(m) => goTo('month', m)} />
                </motion.div>
              )}
            </AnimatePresence>

            {isMonth && data.period === 'month' && (
              <WeeksCard data={data} today={today} onOpenWeek={(w) => goTo('week', w)} />
            )}

            <ExpenseComposer currency={currency} days={isMonth ? monthDays(start) : weekDays(start)} today={today} onAdd={addExpense} />

            <div className="finance-layout">
              <ExpenseList expenses={data.expenses} currency={currency} filter={filter} setFilter={setFilter}
                onDelete={deleteExpense} />
              <div className="finance-side">
                <Breakdown expenses={data.expenses} total={data.total} currency={currency} filter={filter} setFilter={setFilter} />
                <Checklist tasks={data.checklist} currency={currency} onAdd={addTask} onToggle={toggleTask} onDelete={deleteTask} />
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div className="toast habit-error" role="alert" initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={SPRING}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </Workspace>
  )
}

export default Finance
