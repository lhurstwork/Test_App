import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Task = {
  id: string
  title: string
  completed: boolean
  createdAt: string
  dueDate: string | null
}

type Filter = 'all' | 'active' | 'completed'
type Theme = 'light' | 'dark'

const STORAGE_KEY = 'task-manager.tasks'
const THEME_KEY = 'theme'

function App() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [theme, setTheme] = useState<Theme>('light')

  const isValidTask = (value: unknown): value is Task => {
    if (!value || typeof value !== 'object') return false
    const task = value as Task
    return (
      typeof task.id === 'string' &&
      typeof task.title === 'string' &&
      typeof task.completed === 'boolean' &&
      typeof task.createdAt === 'string' &&
      (typeof task.dueDate === 'string' || task.dueDate === null)
    )
  }

  const toTask = (value: unknown): Task | null => {
    if (!value || typeof value !== 'object') return null
    const raw = value as Partial<Task>
    if (typeof raw.id !== 'string' || typeof raw.title !== 'string') return null
    const completed = typeof raw.completed === 'boolean' ? raw.completed : false
    const createdAt =
      typeof raw.createdAt === 'string' && raw.createdAt.length > 0
        ? raw.createdAt
        : new Date().toISOString()
    const dueDate = typeof raw.dueDate === 'string' ? raw.dueDate : null
    return { id: raw.id, title: raw.title, completed, createdAt, dueDate }
  }

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const safeTasks = parsed
            .map(toTask)
            .filter((task): task is Task => task !== null && isValidTask(task))
          setTasks(safeTasks)
        }
      } catch {
        // Ignore corrupted data and start fresh
      }
    }
    setHydrated(true)
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
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [hydrated, tasks])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredTasks = useMemo(() => {
    if (filter === 'active') {
      return tasks.filter((t) => !t.completed)
    }
    if (filter === 'completed') {
      return tasks.filter((t) => t.completed)
    }
    return tasks
  }, [filter, tasks])

  const totalCount = tasks.length
  const completedCount = tasks.filter((t) => t.completed).length
  const activeCount = totalCount - completedCount

  const addTask = () => {
    const trimmed = title.trim()
    if (!trimmed) {
      setError('Task title cannot be empty.')
      return
    }
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate,
    }
    setTasks((prev) => [newTask, ...prev])
    setTitle('')
    setDueDate(null)
    setError(null)
  }

  const toggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    )
  }

  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const clearCompleted = () => {
    setTasks((prev) => prev.filter((t) => !t.completed))
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    addTask()
  }

  return (
    <div className="app">
      <header className="header">
        <div className="title-row">
          <h1>Task Manager</h1>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
        <p>Simple, local, and fast.</p>
      </header>

      <form className="task-form" onSubmit={onSubmit}>
        <div className="task-input">
          <input
            ref={inputRef}
            type="text"
            placeholder="Add a task..."
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (error) setError(null)
            }}
            aria-label="Task title"
          />
          {error && <span className="inline-error">{error}</span>}
        </div>
        <input
          className="due-input"
          type="date"
          value={dueDate ?? ''}
          onChange={(e) => setDueDate(e.target.value || null)}
          aria-label="Due date"
        />
        <button type="submit">Add</button>
      </form>

      <div className="toolbar">
        <div className="filters" role="tablist" aria-label="Task filters">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            className={filter === 'active' ? 'active' : ''}
            onClick={() => setFilter('active')}
          >
            Active
          </button>
          <button
            type="button"
            className={filter === 'completed' ? 'active' : ''}
            onClick={() => setFilter('completed')}
          >
            Completed
          </button>
        </div>
        <div className="counts">
          {activeCount} active / {totalCount} total
        </div>
      </div>

      <ul className="task-list">
        {filteredTasks.length === 0 ? (
          <li className="empty">No tasks to show.</li>
        ) : (
          filteredTasks.map((task) => {
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
                  onChange={() => toggleTask(task.id)}
                />
                <div className="task-text">
                  <span>{task.title}</span>
                  <div className="task-meta">
                    <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
                    <span>
                      Due: {task.dueDate ? task.dueDate : 'None'}
                    </span>
                    {overdue && <span className="overdue-badge">Overdue</span>}
                  </div>
                </div>
              </label>
              <button
                type="button"
                className="delete"
                onClick={() => deleteTask(task.id)}
                aria-label={`Delete ${task.title}`}
              >
                Delete
              </button>
            </li>
            )
          })
        )}
      </ul>

      {completedCount > 0 && (
        <button type="button" className="clear" onClick={clearCompleted}>
          Clear completed
        </button>
      )}
    </div>
  )
}

export default App
