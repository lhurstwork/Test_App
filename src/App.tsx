import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { supabase, supabaseConfigError } from './lib/supabaseClient'

type TaskTag = 'work' | 'personal' | null
type TaskView = 'all' | 'work' | 'personal' | 'overdue' | 'upcoming' | 'completed'

type Task = {
  id: string
  title: string
  completed: boolean
  createdAt: string
  dueDate: string | null
  tag: TaskTag
}

type DbTaskRow = {
  id: string
  text: string
  completed: boolean
  created_at: string
  due_date: string | null
  tag: TaskTag
}

type InsertTaskPayload = {
  text: string
  completed: boolean
  created_at: string
  due_date: string | null
  tag: TaskTag
  user_id?: string
}

type Theme = 'light' | 'dark'

const THEME_KEY = 'theme'

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const toDueDateKey = (dueDate: string | null): string | null => {
  if (!dueDate) return null
  const dateOnlyMatch = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`
  }

  const parsed = new Date(dueDate)
  if (!Number.isNaN(parsed.getTime())) {
    return toLocalDateKey(parsed)
  }

  const fallbackParsed = new Date(dueDate.replace(' ', 'T'))
  if (!Number.isNaN(fallbackParsed.getTime())) {
    return toLocalDateKey(fallbackParsed)
  }

  return null
}

const normalizeTag = (value: unknown): TaskTag => {
  if (value === 'work' || value === 'personal') {
    return value
  }
  return null
}

const toAppTask = (row: DbTaskRow): Task => ({
  id: row.id,
  title: row.text,
  completed: row.completed,
  createdAt: row.created_at,
  dueDate: row.due_date,
  tag: normalizeTag(row.tag),
})

const parseBuildVersion = (): { sha: string; time: string } => {
  const content = document.querySelector('meta[name="build-version"]')?.getAttribute('content') ?? ''
  const [sha = 'dev', time = 'local'] = content.split('|')
  return { sha: sha.trim() || 'dev', time: time.trim() || 'local' }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState<string | null>(null)
  const [newTag, setNewTag] = useState<TaskTag>(null)
  const [view, setView] = useState<TaskView>('all')
  const [theme, setTheme] = useState<Theme>('light')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [build, setBuild] = useState<{ sha: string; time: string }>({ sha: 'dev', time: 'local' })
  const inputRef = useRef<HTMLInputElement | null>(null)

  const loadTasks = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setError(null)

    const query = supabase.from('tasks').select('*').order('created_at', { ascending: false })
    const { data, error } = await query

    setLoading(false)
    if (error) {
      setError(`Could not load tasks: ${error.message}`)
      return
    }

    const rows = (data ?? []) as DbTaskRow[]
    setTasks(rows.map(toAppTask))
  }, [])

  useEffect(() => {
    setBuild(parseBuildVersion())
  }, [])

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_KEY)
    if (storedTheme === 'light' || storedTheme === 'dark') {
      setTheme(storedTheme)
      return
    }
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    setTheme(prefersDark ? 'dark' : 'light')
  }, [])

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark')
    document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!supabase) return

    let isMounted = true
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return
        if (error) {
          setError(`Could not restore session: ${error.message}`)
          return
        }
        setSession(data.session)
        void loadTasks()
      })
      .catch(() => {
        if (isMounted) {
          setError('Could not restore session.')
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadTasks()
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [loadTasks])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const addTask = async () => {
    if (!supabase) return
    const trimmed = newTitle.trim()
    if (!trimmed) {
      setError('Task title cannot be empty.')
      return
    }

    setSaving(true)
    setError(null)
    const payload: InsertTaskPayload = {
      text: trimmed,
      completed: false,
      created_at: new Date().toISOString(),
      due_date: newDueDate,
      tag: newTag,
      ...(session?.user.id ? { user_id: session.user.id } : {}),
    }

    const { data, error } = await supabase.from('tasks').insert(payload).select('*').single()
    setSaving(false)
    if (error) {
      setError(`Could not add task: ${error.message}`)
      return
    }

    const inserted = data as DbTaskRow
    setTasks((prev) => [toAppTask(inserted), ...prev])
    setNewTitle('')
    setNewDueDate(null)
    setNewTag(null)
    inputRef.current?.focus()
  }

  const toggleTask = async (task: Task) => {
    if (!supabase) return
    const previous = task
    const optimistic: Task = { ...task, completed: !task.completed }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? optimistic : t)))

    const { data, error } = await supabase
      .from('tasks')
      .update({ completed: optimistic.completed })
      .eq('id', task.id)
      .select('*')
      .single()

    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? previous : t)))
      setError(`Could not update task: ${error.message}`)
      return
    }

    const updated = data as DbTaskRow
    setTasks((prev) => prev.map((t) => (t.id === task.id ? toAppTask(updated) : t)))
  }

  const deleteTask = async (task: Task) => {
    if (!supabase) return
    const previous = tasks
    setTasks((prev) => prev.filter((t) => t.id !== task.id))

    const { error } = await supabase.from('tasks').delete().eq('id', task.id)
    if (error) {
      setTasks(previous)
      setError(`Could not delete task: ${error.message}`)
    }
  }

  const updateTaskTag = async (task: Task, nextTag: TaskTag) => {
    if (!supabase) return
    if (task.tag === nextTag) return

    const previous = task
    const optimistic: Task = { ...task, tag: nextTag }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? optimistic : t)))

    const { data, error } = await supabase
      .from('tasks')
      .update({ tag: nextTag })
      .eq('id', task.id)
      .select('*')
      .single()

    if (error) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? previous : t)))
      setError(`Could not update task tag: ${error.message}`)
      return
    }

    const updated = data as DbTaskRow
    setTasks((prev) => prev.map((t) => (t.id === task.id ? toAppTask(updated) : t)))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void addTask()
  }

  const todayKey = toLocalDateKey(new Date())
  const tomorrowKey = toLocalDateKey(addDays(new Date(), 1))
  const nextWeekKey = toLocalDateKey(addDays(new Date(), 7))

  const tasksWithFlags = useMemo(
    () =>
      tasks.map((task) => {
        const dueDateKey = toDueDateKey(task.dueDate)
        const overdue = !task.completed && dueDateKey !== null && dueDateKey < todayKey
        const upcoming =
          !task.completed &&
          dueDateKey !== null &&
          dueDateKey >= tomorrowKey &&
          dueDateKey <= nextWeekKey

        return {
          task,
          overdue,
          upcoming,
        }
      }),
    [tasks, todayKey, tomorrowKey, nextWeekKey],
  )

  const viewCounts = useMemo(
    () => ({
      all: tasksWithFlags.length,
      work: tasksWithFlags.filter(({ task }) => task.tag === 'work').length,
      personal: tasksWithFlags.filter(({ task }) => task.tag === 'personal').length,
      overdue: tasksWithFlags.filter(({ overdue }) => overdue).length,
      upcoming: tasksWithFlags.filter(({ upcoming }) => upcoming).length,
      completed: tasksWithFlags.filter(({ task }) => task.completed).length,
    }),
    [tasksWithFlags],
  )

  const filteredTasksWithFlags = useMemo(
    () =>
      tasksWithFlags.filter(({ task, overdue, upcoming }) => {
        if (view === 'all') return true
        if (view === 'work') return task.tag === 'work'
        if (view === 'personal') return task.tag === 'personal'
        if (view === 'overdue') return overdue
        if (view === 'upcoming') return upcoming
        if (view === 'completed') return task.completed
        return true
      }),
    [tasksWithFlags, view],
  )

  const visibleTasks = useMemo(
    () =>
      filteredTasksWithFlags.map(({ task, overdue }) => ({
        task,
        overdue,
      })),
    [filteredTasksWithFlags],
  )

  if (supabaseConfigError || !supabase) {
    return (
      <div className="app">
        <header className="header">
          <div className="title-row">
            <h1>Personal Task Manager</h1>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
          <p className="build-version">
            Build: {build.sha} | {build.time}
          </p>
        </header>
        <div className="error">{supabaseConfigError ?? 'Supabase is unavailable.'}</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="title-row">
          <h1>Personal Task Manager</h1>
          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
        <p>Simple, synced, and fast.</p>
        <p className="build-version">
          Build: {build.sha} | {build.time}
        </p>
      </header>

      {error && <div className="error">{error}</div>}

      <form className="task-form" onSubmit={onSubmit}>
        <div className="task-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a task..."
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
            aria-label="Task title"
            disabled={saving}
          />
        </div>
        <input
          className="due-input"
          type="date"
          value={newDueDate ?? ''}
          onChange={(event) => setNewDueDate(event.target.value || null)}
          aria-label="Due date"
          disabled={saving}
        />
        <select
          className="compact-select"
          value={newTag ?? 'none'}
          onChange={(event) =>
            setNewTag(event.target.value === 'none' ? null : (event.target.value as Exclude<TaskTag, null>))
          }
          aria-label="Task tag"
          disabled={saving}
        >
          <option value="none">None</option>
          <option value="work">Work</option>
          <option value="personal">Personal</option>
        </select>
        <button type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Add'}
        </button>
      </form>

      <div className="content-layout">
        <aside className="sidebar" aria-label="Task views">
          <button
            type="button"
            className={`sidebar-view ${view === 'all' ? 'active' : ''}`}
            onClick={() => setView('all')}
          >
            <span>All</span>
            <span className="view-count">{viewCounts.all}</span>
          </button>
          <button
            type="button"
            className={`sidebar-view ${view === 'work' ? 'active' : ''}`}
            onClick={() => setView('work')}
          >
            <span>Work</span>
            <span className="view-count">{viewCounts.work}</span>
          </button>
          <button
            type="button"
            className={`sidebar-view ${view === 'personal' ? 'active' : ''}`}
            onClick={() => setView('personal')}
          >
            <span>Personal</span>
            <span className="view-count">{viewCounts.personal}</span>
          </button>
          <button
            type="button"
            className={`sidebar-view ${view === 'overdue' ? 'active' : ''}`}
            onClick={() => setView('overdue')}
          >
            <span>Overdue</span>
            <span className="view-count">{viewCounts.overdue}</span>
          </button>
          <button
            type="button"
            className={`sidebar-view ${view === 'upcoming' ? 'active' : ''}`}
            onClick={() => setView('upcoming')}
          >
            <span>Upcoming</span>
            <span className="view-count">{viewCounts.upcoming}</span>
          </button>
          <button
            type="button"
            className={`sidebar-view ${view === 'completed' ? 'active' : ''}`}
            onClick={() => setView('completed')}
          >
            <span>Completed</span>
            <span className="view-count">{viewCounts.completed}</span>
          </button>
        </aside>

        <section className="main-panel">
          <div className="toolbar">
            <div className="counts">{loading ? 'Loading tasks...' : `${visibleTasks.length} shown`}</div>
          </div>

          <ul className="task-list">
            {loading ? (
              <li className="empty">Loading tasks...</li>
            ) : visibleTasks.length === 0 ? (
              <li className="empty">No tasks to show.</li>
            ) : (
              visibleTasks.map(({ task, overdue }) => (
                <li
                  key={task.id}
                  className={`${task.completed ? 'done' : ''} ${overdue ? 'overdue' : ''}`}
                >
                  <label className="task-item">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => void toggleTask(task)}
                    />
                    <div className="task-text">
                      <span className="task-title">{task.title}</span>
                      <div className="task-meta">
                        <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
                        <span>Due: {task.dueDate ?? 'None'}</span>
                        <select
                          className="tag-chip"
                          value={task.tag ?? 'none'}
                          onChange={(event) =>
                            void updateTaskTag(
                              task,
                              event.target.value === 'none'
                                ? null
                                : (event.target.value as Exclude<TaskTag, null>),
                            )
                          }
                          aria-label={`Tag for ${task.title}`}
                        >
                          <option value="none">None</option>
                          <option value="work">Work</option>
                          <option value="personal">Personal</option>
                        </select>
                        {overdue && <span className="overdue-badge">Overdue</span>}
                      </div>
                    </div>
                  </label>
                  <button type="button" className="delete" onClick={() => void deleteTask(task)}>
                    Delete
                  </button>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default App
