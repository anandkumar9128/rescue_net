import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import socket from '../services/socket'

const STATUS_OPTIONS = ['Available', 'En Route', 'On Task', 'Completed', 'Offline']

const STATUS_COLORS = {
  Available: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  'En Route': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  'On Task':  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Completed:  'bg-slate-500/15 text-slate-400 border-slate-500/30',
  Offline:    'bg-red-500/15 text-red-400 border-red-500/30',
  Pending:    'bg-purple-500/15 text-purple-400 border-purple-500/30',
  'Volunteer Assigned': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Cancelled:  'bg-red-500/15 text-red-400 border-red-500/30',
}

const NEED_ICONS = { Medical: '🏥', Food: '🍱', Rescue: '🚁', Shelter: '🏠' }

// ── Task Offer Modal ───────────────────────────────────────────────────────────
function TaskOfferModal({ offer, onAccept, onReject }) {
  const [countdown, setCountdown] = useState(Math.floor((offer.timeout_ms || 120000) / 1000))

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => {
      if (c <= 1) { clearInterval(t); onReject(); }
      return c - 1
    }), 1000)
    return () => clearInterval(t)
  }, [onReject])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card p-8 max-w-sm w-full text-center animate-slide-up border-brand-500/40">
        {/* Urgent ring */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-brand-500 animate-ping-slow opacity-40" />
          <div className="w-20 h-20 rounded-full bg-brand-500/10 border-2 border-brand-500 flex items-center justify-center text-4xl">
            {NEED_ICONS[offer.need_type] || '🚨'}
          </div>
        </div>

        <h2 className="font-display font-bold text-2xl text-white mb-2">Task Incoming!</h2>
        <p className="text-slate-400 text-sm mb-1">{offer.need_type} Emergency</p>
        <p className="text-slate-500 text-xs mb-4">
          👥 {offer.total_people} people · {offer.max_severity} severity
        </p>
        <p className="text-slate-600 text-xs mb-6">
          📍 {offer.location?.lat?.toFixed(4)}, {offer.location?.lng?.toFixed(4)}
        </p>

        {/* Countdown ring */}
        <div className="w-12 h-12 mx-auto mb-6 relative">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="3" />
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f43f5e" strokeWidth="3"
              strokeDasharray={`${(countdown / Math.floor((offer.timeout_ms || 120000) / 1000)) * 100} 100`}
              strokeLinecap="round" />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">{countdown}s</span>
        </div>

        <div className="flex gap-3">
          <button onClick={onReject} className="btn-ghost flex-1 text-sm">Reject</button>
          <button onClick={onAccept} className="btn-primary flex-1 text-sm">Accept Task</button>
        </div>
      </div>
    </div>
  )
}

// ── Task Card ──────────────────────────────────────────────────────────────────
function TaskCard({ task, onStatusUpdate }) {
  const [updating, setUpdating] = useState(false)
  const cluster = task.cluster_id

  const NEXT_STATUS = {
    'Volunteer Assigned': 'En Route',
    'En Route': 'On Task',
    'On Task': 'Completed',
  }

  const handleNext = async () => {
    const next = NEXT_STATUS[task.status]
    if (!next) return
    setUpdating(true)
    try {
      await api.patch(`/volunteers/assignments/${task._id}/status`, { status: next })
      onStatusUpdate(task._id, next)
    } catch (err) {
      console.error('Status update failed:', err)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className={`glass-card p-5 space-y-4 ${task.status !== 'Completed' && task.status !== 'Cancelled' ? 'border-brand-500/20' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center text-xl">
            {NEED_ICONS[cluster?.need_type] || '📍'}
          </div>
          <div>
            <div className="font-semibold text-white">{cluster?.need_type || 'Unknown'}</div>
            <div className="text-slate-500 text-xs">{task.ngo_id?.name}</div>
          </div>
        </div>
        <span className={`badge border ${STATUS_COLORS[task.status] || 'badge bg-slate-500/15 text-slate-400'}`}>
          {task.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
        <div>👥 {cluster?.total_people || 0} people</div>
        <div>⚠️ {cluster?.max_severity || 'Unknown'}</div>
        <div className="col-span-2">
          📍 {cluster?.location?.address || `${cluster?.location?.lat?.toFixed(4)}, ${cluster?.location?.lng?.toFixed(4)}`}
        </div>
      </div>

      {NEXT_STATUS[task.status] && (
        <button onClick={handleNext} disabled={updating}
          className="btn-primary w-full text-sm py-2.5">
          {updating ? '⏳ Updating...' : `Mark: ${NEXT_STATUS[task.status]} →`}
        </button>
      )}
    </div>
  )
}

// ── Main Volunteer Dashboard ───────────────────────────────────────────────────
export default function VolunteerDashboard() {
  const { user, logout } = useAuth()
  const navigate          = useNavigate()
  const [tasks, setTasks]         = useState([])
  const [myStatus, setMyStatus]   = useState('Available')
  const [volunteerId, setVolId]   = useState(null)
  const [hasNGO, setHasNGO]       = useState(true)  // assume true until loaded
  const [offer, setOffer]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // ── Load volunteer data ──────────────────────────────────────────────────────
  const loadMyData = useCallback(async () => {
    if (!user) return
    try {
      const { data: meRes } = await api.get('/volunteers/me')
      const vol = meRes.data
      setVolId(vol._id)
      setMyStatus(vol.status)
      // If volunteer has no NGO, redirect to selection page
      if (!vol.ngo_id) {
        setHasNGO(false)
        navigate('/volunteer/join')
        return
      }
      setHasNGO(true)

      const { data: taskRes } = await api.get('/volunteers/me/tasks')
      setTasks(taskRes.data || [])
    } catch (err) {
      console.error('Failed to load volunteer data:', err)
    } finally {
      setLoading(false)
    }
  }, [user, navigate])

  useEffect(() => { loadMyData() }, [loadMyData])

  // Redirect when approved in real-time (from NGO selection page flow)
  useEffect(() => {
    socket.on('join_request_response', ({ status }) => {
      if (status === 'approved') loadMyData()
    })
    return () => socket.off('join_request_response')
  }, [loadMyData])

  // ── Socket: listen for task offers ──────────────────────────────────────────
  useEffect(() => {
    socket.on('task_offer', (offerData) => {
      setOffer(offerData)
    })
    socket.on('task_taken', () => {
      setOffer(null) // Another volunteer accepted it
    })
    return () => {
      socket.off('task_offer')
      socket.off('task_taken')
    }
  }, [])

  // ── Accept task ──────────────────────────────────────────────────────────────
  const handleAccept = async () => {
    if (!offer || !volunteerId) return
    try {
      await api.post('/volunteers/accept-task', {
        assignment_id: offer.assignment_id,
        volunteer_id: volunteerId,
      })
      setOffer(null)
      await loadMyData()
    } catch (err) {
      console.error('Accept failed:', err)
      setOffer(null)
    }
  }

  const handleReject = async () => {
    if (!offer || !volunteerId) return
    try {
      await api.post('/volunteers/reject-task', {
        assignment_id: offer.assignment_id,
        volunteer_id: volunteerId,
      })
    } catch {}
    setOffer(null)
  }

  // ── Update my status ─────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (!volunteerId) return
    setStatusUpdating(true)
    try {
      await api.patch(`/volunteers/${volunteerId}/status`, { status: newStatus })
      setMyStatus(newStatus)
    } catch (err) {
      console.error('Status update failed:', err)
    } finally {
      setStatusUpdating(false)
    }
  }

  // ── Task status update ───────────────────────────────────────────────────────
  const handleTaskStatusUpdate = (taskId, newStatus) => {
    setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: newStatus } : t))
    if (newStatus === 'Completed') setMyStatus('Available')
  }

  const activeTasks   = tasks.filter((t) => !['Completed', 'Cancelled'].includes(t.status))
  const completedTasks = tasks.filter((t) => t.status === 'Completed')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Task Offer Modal */}
      {offer && (
        <TaskOfferModal offer={offer} onAccept={handleAccept} onReject={handleReject} />
      )}

      {/* ── Topbar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow shadow-brand-500/30">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm">RescueNet</div>
            <div className="text-slate-500 text-xs">Volunteer Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm hidden md:block">{user?.name}</span>
          <button onClick={logout} className="btn-ghost text-xs py-2">Sign out</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* ── Status Control Panel ── */}
        <div className="glass-card p-6">
          <h2 className="font-display font-semibold text-white mb-4">My Status</h2>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button key={s} onClick={() => handleStatusChange(s)}
                disabled={statusUpdating}
                className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all duration-200
                  ${myStatus === s
                    ? `${STATUS_COLORS[s]} border-current scale-105 shadow-md`
                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
                  }`}
                id={`status-${s}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Live status indicator */}
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-800">
            <div className={`w-3 h-3 rounded-full ${
              myStatus === 'Available' ? 'bg-emerald-500 animate-pulse' :
              myStatus === 'En Route'  ? 'bg-blue-500' :
              myStatus === 'On Task'   ? 'bg-yellow-500' : 'bg-slate-500'
            }`} />
            <span className="text-slate-300 text-sm font-medium">Currently: {myStatus}</span>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active',    value: activeTasks.length,    color: 'text-brand-400' },
            { label: 'Completed', value: completedTasks.length, color: 'text-emerald-400' },
            { label: 'Total',     value: tasks.length,          color: 'text-slate-300' },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Active Tasks ── */}
        <div>
          <h3 className="font-display font-semibold text-white mb-3">
            Active Tasks {activeTasks.length > 0 && <span className="badge bg-brand-500/20 text-brand-400 ml-2">{activeTasks.length}</span>}
          </h3>
          {loading ? (
            <div className="text-slate-500 text-sm text-center py-8">Loading tasks...</div>
          ) : activeTasks.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <div className="text-4xl mb-3">🎯</div>
              <div className="text-slate-400 text-sm">No active tasks</div>
              <div className="text-slate-600 text-xs mt-1">Set your status to Available to receive tasks</div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTasks.map((t) => (
                <TaskCard key={t._id} task={t} onStatusUpdate={handleTaskStatusUpdate} />
              ))}
            </div>
          )}
        </div>

        {/* ── Completed Tasks ── */}
        {completedTasks.length > 0 && (
          <div>
            <h3 className="font-display font-semibold text-white mb-3 text-sm text-slate-400">Completed Tasks</h3>
            <div className="space-y-3">
              {completedTasks.slice(0, 5).map((t) => (
                <div key={t._id} className="glass-card p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{NEED_ICONS[t.cluster_id?.need_type] || '📍'}</span>
                      <span className="text-slate-300 text-sm">{t.cluster_id?.need_type}</span>
                    </div>
                    <span className="badge bg-emerald-500/15 text-emerald-400">Completed ✓</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
