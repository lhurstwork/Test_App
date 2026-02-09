import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import './App.css'
import { supabase, supabaseConfigError } from './lib/supabaseClient'

type Priority = 'low' | 'medium' | 'high'
type Status = 'open' | 'in_progress' | 'blocked' | 'completed'

type Task = {
  id: string
  title: string
  completed: boolean
  createdAt: string
  dueDate: string | null
  priority: Priority
  status: Status
}

type DbTaskRow = {
  id: string
  user_id: string
  text: string
  completed: boolean
  created_at: string
  due_date: string | null
  priority: Priority
  status: Status
}

type ImportableTask = {
  title: string
  completed: boolean
  createdAt: string
  dueDate: string | null
  priority: Priority
  status: Status
}

type TaskView = 'all_tasks' | 'my_day' | 'upcoming' | 'overdue' | 'completed'
type Theme = 'light' | 'dark'
type StatusFilter = 'all_statuses' | Status
type SortBy = 'due_date' | 'priority' | 'created_desc'

const STORAGE_KEY = 'task-manager.tasks'
const THEME_KEY = 'theme'

const PRIORITY_RANK: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
}

const isPriority = (value: unknown): value is Priority =>
  value === 'low' || value === 'medium' || value === 'high'

const isStatus = (value: unknown): value is Status =>
  value === 'open' || value === 'in_progress' || value === 'blocked' || value === 'completed'

const isStatusFilter = (value: unknown): value is StatusFilter =>
  value === 'all_statuses' || isStatus(value)

const isSortBy = (value: unknown): value is SortBy =>
  value === 'due_date' || value === 'priority' || value === 'created_desc'

const toLocalDateKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const normalizeTaskState = (
  completed: boolean,
  status: Status,
): { completed: boolean; status: Status } => {
  if (completed) return { completed: true, status: 'completed' }
  if (status === 'completed') return { completed: false, status: 'open' }
  return { completed: false, status }
}

const toAppTask = (row: DbTaskRow): Task => {
  const normalized = normalizeTaskState(row.completed, row.status)
  return {
    id: row.id,
    title: row.text,
    completed: normalized.completed,
    createdAt: row.created_at,
    dueDate: row.due_date,
    priority: row.priority,
    status: normalized.status,
  }
}

const toImportableTask = (value: unknown): ImportableTask | null => {
  if (!value || typeof value !== 'object') return null
  const raw = value as Record<string, unknown>
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (title.length === 0) return null

  const completed = typeof raw.completed === 'boolean' ? raw.completed : false
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt.length > 0
      ? raw.createdAt
      : new Date().toISOString()
  const dueDate =
    typeof raw.dueDate === 'string' &&
    !Number.isNaN(new Date(`${raw.dueDate}T00:00:00`).getTime())
      ? raw.dueDate
      : null
  const priority = isPriority(raw.priority) ? raw.priority : 'medium'
  const status = isStatus(raw.status) ? raw.status : completed ? 'completed' : 'open'
  const normalized = normalizeTaskState(completed, status)

  return {
    title,
    completed: normalized.completed,
    createdAt,
    dueDate,
    priority,
    status: normalized.status,
  }
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [priority, setPriority] = useState<Priority>('medium')
  const [status, setStatus] = useState<Status>('open')
  const [view, setView] = useState<TaskView>('all_tasks')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all_statuses')
  const [sortBy, setSortBy] = useState<SortBy>('created_desc')
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>('light')
  const [session, setSession] = useState<Session | null>(null)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [importCandidates, setImportCandidates] = useState<ImportableTask[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    document.title = "Layne's Task Manager"
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

  const loadTasks = useCallback(async (userId: string) => {
    if (!supabase) return
    setTasksLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    setTasksLoading(false)
    if (error) {
      setError(`Could not load tasks: ${error.message}`)
      return
    }

    const rows = (data ?? []) as DbTaskRow[]
    setTasks(rows.map(toAppTask))
  }, [])

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
      })
      .catch(() => {
        if (isMounted) {
          setError('Could not restore session.')
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthMessage(null)
      setError(null)
    })

    return () => {
      isMounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user.id) {
      setTasks([])
      setImportCandidates([])
      return
    }

    loadTasks(session.user.id)

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      setImportCandidates([])
      return
    }
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        setImportCandidates([])
        return
      }
      const safe = parsed
        .map(toImportableTask)
        .filter((task): task is ImportableTask => task !== null)
      setImportCandidates(safe)
    } catch {
      setImportCandidates([])
    }
  }, [loadTasks, session?.user.id])

  useEffect(() => {
    if (session) {
      inputRef.current?.focus()
    }
  }, [session])

  const visibleTasks = useMemo(() => {
    const today = new Date()
    const todayKey = toLocalDateKey(today)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowKey = toLocalDateKey(tomorrow)
    const plusSeven = new Date(today)
    plusSeven.setDate(plusSeven.getDate() + 7)
    const plusSevenKey = toLocalDateKey(plusSeven)

    const viewFiltered = tasks.filter((task) => {
      if (view === 'all_tasks') return true
      if (view === 'completed') return task.completed
      if (task.completed || !task.dueDate) return false
      if (view === 'overdue') return task.dueDate < todayKey
      if (view === 'my_day') return task.dueDate === todayKey || task.dueDate < todayKey
      if (view === 'upcoming') return task.dueDate >= tomorrowKey && task.dueDate <= plusSevenKey
      return true
    })

    const statusFiltered =
      statusFilter === 'all_statuses'
        ? viewFiltered
        : viewFiltered.filter((t) => t.status === statusFilter)

    return [...statusFiltered].sort((a, b) => {
      if (sortBy === 'due_date') {
        if (!a.dueDate && !b.dueDate) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        }
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        const dueDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        if (dueDiff !== 0) return dueDiff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }

      if (sortBy === 'priority') {
        const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
        if (priorityDiff !== 0) return priorityDiff
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [sortBy, statusFilter, tasks, view])

  const totalCount = tasks.length
  const completedCount = tasks.filter((t) => t.completed).length

  const resetNewTaskInputs = () => {
    setTitle('')
    setDueDate(null)
    setPriority('medium')
    setStatus('open')
  }

  const onSignIn = async () => {
    if (!supabase) return
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthMessage('Email and password are required.')
      return
    }
    setAuthLoading(true)
    setAuthMessage(null)
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    })
    setAuthLoading(false)
    if (error) {
      setAuthMessage(error.message)
      return
    }
    setAuthPassword('')
  }

  const onSignUp = async () => {
    if (!supabase) return
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthMessage('Email and password are required.')
      return
    }
    setAuthLoading(true)
    setAuthMessage(null)
    const { data, error } = await supabase.auth.signUp({
      email: authEmail.trim(),
      password: authPassword,
    })
    setAuthLoading(false)
    if (error) {
      setAuthMessage(error.message)
      return
    }
    setAuthPassword('')
    if (!data.session) {
      setAuthMessage('Account created. Check your email to confirm before signing in.')
    }
  }

  const onSignOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(`Could not sign out: ${error.message}`)
    }
  }

  const addTask = async () => {
    if (!supabase || !session?.user.id) return
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Task title cannot be empty.')
      return
    }

    const normalized = normalizeTaskState(status === 'completed', status)
    setError(null)

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: session.user.id,
        text: trimmed,
        completed: normalized.completed,
        created_at: new Date().toISOString(),
        due_date: dueDate,
        priority,
        status: normalized.status,
      })
      .select('*')
      .single()

    if (error) {
      setError(`Could not add task: ${error.message}`)
      return
    }

    const inserted = data as DbTaskRow
    setTasks((prev) => [toAppTask(inserted), ...prev])
    resetNewTaskInputs()
  }

  const updateTask = async (
    id: string,
    changes: Partial<Pick<Task, 'completed' | 'status' | 'dueDate' | 'priority'>>,
  ) => {
    if (!supabase || !session?.user.id) return
    const current = tasks.find((task) => task.id === id)
    if (!current) return

    const nextCompleted = changes.completed ?? current.completed
    const nextStatus = changes.status ?? current.status
    const normalized = normalizeTaskState(nextCompleted, nextStatus)

    const { data, error } = await supabase
      .from('tasks')
      .update({
        completed: normalized.completed,
        status: normalized.status,
        due_date: changes.dueDate ?? current.dueDate,
        priority: changes.priority ?? current.priority,
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('*')
      .single()

    if (error) {
      setError(`Could not update task: ${error.message}`)
      return
    }

    const updated = data as DbTaskRow
    setTasks((prev) => prev.map((task) => (task.id === id ? toAppTask(updated) : task)))
  }

  const deleteTask = async (id: string) => {
    if (!supabase || !session?.user.id) return
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id)
    if (error) {
      setError(`Could not delete task: ${error.message}`)
      return
    }
    setTasks((prev) => prev.filter((task) => task.id !== id))
  }

  const clearCompleted = async () => {
    if (!supabase || !session?.user.id) return
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', session.user.id)
      .eq('completed', true)

    if (error) {
      setError(`Could not clear completed tasks: ${error.message}`)
      return
    }
    setTasks((prev) => prev.filter((task) => !task.completed))
  }

  const importLocalTasks = async () => {
    if (!supabase || !session?.user.id || importCandidates.length === 0) return
    setImportLoading(true)
    setError(null)

    const payload = importCandidates.map((task) => ({
      user_id: session.user.id,
      text: task.title,
      completed: task.completed,
      created_at: task.createdAt,
      due_date: task.dueDate,
      priority: task.priority,
      status: task.status,
    }))

    const { error } = await supabase.from('tasks').insert(payload)
    setImportLoading(false)
    if (error) {
      setError(`Could not import local tasks: ${error.message}`)
      return
    }

    localStorage.removeItem(STORAGE_KEY)
    setImportCandidates([])
    await loadTasks(session.user.id)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void addTask()
  }

  if (supabaseConfigError) {
    return (
      <div className="app">
        <header className="header">
          <div className="title-row">
            <h1>Task Manager</h1>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>
        <div className="error">{supabaseConfigError}</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="app">
        <header className="header">
          <div className="title-row">
            <h1>Task Manager</h1>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
          <p>Sign in to sync tasks across devices.</p>
        </header>

        <form
          className="auth-card"
          onSubmit={(event) => {
            event.preventDefault()
            void onSignIn()
          }}
        >
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <div className="auth-actions">
            <button type="submit" disabled={authLoading}>
              {authLoading ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" className="clear" onClick={() => void onSignUp()} disabled={authLoading}>
              Create account
            </button>
          </div>
          {authMessage && <div className="auth-message">{authMessage}</div>}
          {error && <div className="error">{error}</div>}
        </form>
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
            <button type="button" className="clear" onClick={() => void onSignOut()}>
              Sign out
            </button>
          </div>
        </div>
        <p>Simple, synced, and fast.</p>
      </header>

      {importCandidates.length > 0 && (
        <div className="import-banner">
          <span>{importCandidates.length} local task(s) found.</span>
          <button type="button" className="clear" onClick={() => void importLocalTasks()} disabled={importLoading}>
            {importLoading ? 'Importing...' : 'Import local tasks'}
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <form className="task-form" onSubmit={onSubmit}>
        <div className="task-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a task..."
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              if (error) setError(null)
            }}
            aria-label="Task title"
          />
        </div>
        <input
          className="due-input"
          type="date"
          value={dueDate ?? ''}
          onChange={(event) => setDueDate(event.target.value || null)}
          aria-label="Due date"
        />
        <select
          className="compact-select"
          value={priority}
          onChange={(event) => {
            const value = event.target.value
            if (isPriority(value)) setPriority(value)
          }}
          aria-label="Priority"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select
          className="compact-select"
          value={status}
          onChange={(event) => {
            const value = event.target.value
            if (isStatus(value)) setStatus(value)
          }}
          aria-label="Status"
        >
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="blocked">Blocked</option>
          <option value="completed">Completed</option>
        </select>
        <button type="submit">Add</button>
      </form>

      <div className="toolbar">
        <div className="filters" role="tablist" aria-label="Task views">
          <button
            type="button"
            className={view === 'all_tasks' ? 'active' : ''}
            onClick={() => setView('all_tasks')}
          >
            All Tasks
          </button>
          <button
            type="button"
            className={view === 'my_day' ? 'active' : ''}
            onClick={() => setView('my_day')}
          >
            My Day
          </button>
          <button
            type="button"
            className={view === 'upcoming' ? 'active' : ''}
            onClick={() => setView('upcoming')}
          >
            Upcoming
          </button>
          <button
            type="button"
            className={view === 'overdue' ? 'active' : ''}
            onClick={() => setView('overdue')}
          >
            Overdue
          </button>
          <button
            type="button"
            className={view === 'completed' ? 'active' : ''}
            onClick={() => setView('completed')}
          >
            Completed
          </button>
        </div>
        <div className="toolbar-controls">
          <select
            className="compact-select"
            value={statusFilter}
            onChange={(event) => {
              const value = event.target.value
              if (isStatusFilter(value)) setStatusFilter(value)
            }}
            aria-label="Status filter"
          >
            <option value="all_statuses">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
          <select
            className="compact-select"
            value={sortBy}
            onChange={(event) => {
              const value = event.target.value
              if (isSortBy(value)) setSortBy(value)
            }}
            aria-label="Sort tasks"
          >
            <option value="due_date">Due date (asc)</option>
            <option value="priority">Priority (high to low)</option>
            <option value="created_desc">Created date (newest)</option>
          </select>
        </div>
        <div className="counts">
          Showing {visibleTasks.length} of {totalCount} tasks
        </div>
      </div>

      {tasksLoading ? (
        <div className="empty">Loading tasks...</div>
      ) : (
        <ul className="task-list">
          {visibleTasks.length === 0 ? (
            <li className="empty">No tasks to show.</li>
          ) : (
            visibleTasks.map((task) => {
              const overdue =
                !task.completed &&
                task.dueDate !== null &&
                new Date() > new Date(`${task.dueDate}T23:59:59.999`)

              return (
                <li
                  key={task.id}
                  className={`${task.completed ? 'done' : ''} ${overdue ? 'overdue' : ''}`}
                >
                  <label className="task-item">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => void updateTask(task.id, { completed: !task.completed })}
                    />
                    <div className="task-text">
                      <span className="task-title">{task.title}</span>
                      <div className="task-meta">
                        <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
                        <input
                          className="inline-control"
                          type="date"
                          value={task.dueDate ?? ''}
                          onChange={(event) => void updateTask(task.id, { dueDate: event.target.value || null })}
                          aria-label={`Due date for ${task.title}`}
                        />
                        <select
                          className="inline-control"
                          value={task.priority}
                          onChange={(event) => {
                            const value = event.target.value
                            if (isPriority(value)) {
                              void updateTask(task.id, { priority: value })
                            }
                          }}
                          aria-label={`Priority for ${task.title}`}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                        <select
                          className="inline-control"
                          value={task.status}
                          onChange={(event) => {
                            const value = event.target.value
                            if (isStatus(value)) {
                              void updateTask(task.id, { status: value })
                            }
                          }}
                          aria-label={`Status for ${task.title}`}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="completed">Completed</option>
                        </select>
                        <span className={`badge priority-${task.priority}`}>{task.priority}</span>
                        <span className={`badge status-${task.status}`}>{task.status.replace('_', ' ')}</span>
                        {overdue && <span className="overdue-badge">Overdue</span>}
                      </div>
                    </div>
                  </label>
                  <button type="button" className="delete" onClick={() => void deleteTask(task.id)}>
                    Delete
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}

      {completedCount > 0 && (
        <button type="button" className="clear" onClick={() => void clearCompleted()}>
          Clear completed
        </button>
      )}
    </div>
  )
}

export default App
