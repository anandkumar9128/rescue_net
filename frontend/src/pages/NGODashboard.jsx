import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import socket from '../services/socket'

// ── Sub-components ─────────────────────────────────────────────────────────────

const SEVERITY_BADGE = {
  Low:      'badge bg-emerald-500/15 text-emerald-400',
  Medium:   'badge bg-yellow-500/15 text-yellow-400',
  High:     'badge bg-orange-500/15 text-orange-400',
  Critical: 'badge bg-brand-500/15 text-brand-400',
}

const STATUS_BADGE = {
  Open:         'badge bg-blue-500/15 text-blue-400',
  Assigned:     'badge bg-purple-500/15 text-purple-400',
  'In Progress':'badge bg-yellow-500/15 text-yellow-400',
  Resolved:     'badge bg-emerald-500/15 text-emerald-400',
  Pending:      'badge bg-slate-500/15 text-slate-400',
  Completed:    'badge bg-emerald-500/15 text-emerald-400',
  Cancelled:    'badge bg-red-500/15 text-red-400',
}

const VOL_STATUS = {
  Available: 'bg-emerald-500',
  'En Route':'bg-blue-500',
  'On Task':  'bg-yellow-500',
  Completed:  'bg-slate-500',
  Offline:    'bg-red-500',
}

const NEED_ICONS = { Medical: '🏥', Food: '🍱', Rescue: '🚁', Shelter: '🏠' }

// ── Cluster Card ───────────────────────────────────────────────────────────────
function ClusterCard({ cluster }) {
  return (
    <div className="glass-card p-4 hover:border-brand-500/30 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{NEED_ICONS[cluster.need_type] || '📍'}</span>
          <div>
            <div className="font-semibold text-white text-sm">{cluster.need_type}</div>
            <div className="text-slate-500 text-xs">{cluster.request_ids?.length || 0} requests merged</div>
          </div>
        </div>
        <span className={STATUS_BADGE[cluster.status] || 'badge bg-slate-500/15 text-slate-400'}>
          {cluster.status}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={SEVERITY_BADGE[cluster.max_severity]}>{cluster.max_severity}</span>
        <span className="text-slate-400 text-xs">👥 {cluster.total_people} people</span>
        <span className="text-slate-400 text-xs">🎯 Score: {cluster.priority_score?.toFixed(1)}</span>
      </div>
      <div className="text-slate-600 text-xs mt-2">
        📍 {cluster.location?.lat?.toFixed(4)}, {cluster.location?.lng?.toFixed(4)}
      </div>
    </div>
  )
}

// ── Volunteer Row ──────────────────────────────────────────────────────────────
function VolunteerRow({ vol }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-800/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
          {vol.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div className="text-white text-sm font-medium">{vol.name}</div>
          <div className="text-slate-500 text-xs">{vol.skill_type}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`status-dot ${VOL_STATUS[vol.status] || 'bg-slate-500'}`} />
        <span className="text-slate-400 text-xs">{vol.status}</span>
      </div>
    </div>
  )
}

// ── Assignment Row ─────────────────────────────────────────────────────────────
function AssignmentRow({ a, ngoId, onOverride, volunteers }) {
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [selectedVol, setSelectedVol]   = useState('')
  const [submitting, setSubmitting]      = useState(false)

  const handleOverride = async () => {
    if (!selectedVol) return
    setSubmitting(true)
    await onOverride(a._id, selectedVol)
    setSubmitting(false)
    setOverrideOpen(false)
  }

  const cluster = a.cluster_id
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{NEED_ICONS[cluster?.need_type] || '📍'}</span>
            <span className="font-semibold text-white text-sm">{cluster?.need_type || 'Unknown'}</span>
          </div>
          <div className="text-slate-500 text-xs mt-0.5">
            👥 {cluster?.total_people || 0} people · {cluster?.location?.address || `${cluster?.location?.lat?.toFixed(3)}, ${cluster?.location?.lng?.toFixed(3)}`}
          </div>
        </div>
        <span className={STATUS_BADGE[a.status] || 'badge bg-slate-500/15 text-slate-400'}>{a.status}</span>
      </div>

      {a.volunteer_id && (
        <div className="text-xs text-slate-400">
          👤 Volunteer: <span className="text-slate-200 font-medium">{a.volunteer_id?.name || 'Assigned'}</span>
          {a.volunteer_id?.status && <span className="ml-2 text-slate-500">({a.volunteer_id.status})</span>}
        </div>
      )}

      {/* Override button */}
      {['Pending', 'Volunteer Assigned'].includes(a.status) && (
        <div>
          <button onClick={() => setOverrideOpen(!overrideOpen)}
            className="text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors">
            {overrideOpen ? '✕ Cancel' : '↺ Override Volunteer'}
          </button>
          {overrideOpen && (
            <div className="mt-2 flex gap-2 animate-fade-in">
              <select className="select-field flex-1 py-2 text-xs" value={selectedVol}
                onChange={(e) => setSelectedVol(e.target.value)}>
                <option value="">Select volunteer...</option>
                {volunteers.filter(v => v.status === 'Available').map(v => (
                  <option key={v._id} value={v._id}>{v.name} ({v.skill_type})</option>
                ))}
              </select>
              <button onClick={handleOverride} disabled={submitting || !selectedVol}
                className="btn-primary py-2 px-4 text-xs">
                {submitting ? '...' : 'Assign'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Skill type columns config ──────────────────────────────────────────────────
const SKILL_COLS = [
  { key: 'Medical',  icon: '🏥', color: 'border-red-500/30    bg-red-500/5    text-red-400' },
  { key: 'Food',     icon: '🍱', color: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400' },
  { key: 'Rescue',   icon: '🚁', color: 'border-blue-500/30   bg-blue-500/5   text-blue-400' },
  { key: 'Shelter',  icon: '🏠', color: 'border-purple-500/30 bg-purple-500/5 text-purple-400' },
  { key: 'General',  icon: '⚙️', color: 'border-slate-500/30  bg-slate-500/5  text-slate-400' },
]

// ── Main NGO Dashboard ─────────────────────────────────────────────────────────
export default function NGODashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]               = useState('overview')
  const [data, setData]             = useState({ assignments: [], volunteers: [], clusters: [] })
  const [joinRequests, setJoinReqs] = useState([])
  const [loading, setLoading]       = useState(true)
  const [liveAlerts, setAlerts]     = useState([])
  const [respondingId, setRespondingId] = useState(null) // request ID being approved/rejected

  const ngoId = user?.ngo_id
  const [newClusterCount, setNewClusterCount] = useState(0)

  // ── Load dashboard data ──────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!ngoId) return
    try {
      const [dashRes, joinRes] = await Promise.all([
        api.get(`/ngos/${ngoId}/dashboard`),
        api.get('/join-requests/incoming'),
      ])
      setData(dashRes.data.data)
      setJoinReqs(joinRes.data.data)
    } catch (err) {
      console.error('Dashboard load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [ngoId])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  // ── Real-time updates ────────────────────────────────────────────────────────
  useEffect(() => {
    socket.connect()

    const addAlert = (msg, type = 'info') => {
      const id = Date.now()
      setAlerts((prev) => [{ id, msg, type }, ...prev.slice(0, 4)])
      setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), 6000)
    }

    socket.on('new_assignment', (data) => {
      addAlert(`🆕 New ${data.need_type} request — ${data.total_people} people`, 'new')
      loadDashboard()
    })
    socket.on('new_cluster', (data) => {
      addAlert(`📍 New cluster: ${data.need_type} (${data.total_people} people)`, 'new')
      setNewClusterCount((n) => n + 1)  // ← increment notification badge
      loadDashboard()
    })
    socket.on('volunteer_accepted',        () => { loadDashboard() })
    socket.on('assignment_status_update',  (data) => {
      addAlert(`📋 Assignment ${data.status}`, 'update')
      loadDashboard()
    })
    socket.on('volunteer_status_update',   (data) => {
      addAlert(`🙋 ${data.name}: ${data.status}`, 'update')
      loadDashboard()
    })
    socket.on('assignment_timeout', () => {
      addAlert(`⚠️ No volunteer accepted — manual assignment needed`, 'warning')
    })
    socket.on('join_request_new', (data) => {
      addAlert(`🙋 ${data.volunteer_name} (${data.skill_type}) wants to join!`, 'new')
      loadDashboard()
    })

    return () => {
      socket.off('new_assignment')
      socket.off('new_cluster')
      socket.off('volunteer_accepted')
      socket.off('assignment_status_update')
      socket.off('volunteer_status_update')
      socket.off('assignment_timeout')
      socket.off('join_request_new')
    }
  }, [loadDashboard])

  // ── Override volunteer ───────────────────────────────────────────────────────
  const handleOverride = async (assignmentId, volunteerId) => {
    try {
      await api.patch(`/ngos/${ngoId}/assignments/${assignmentId}/override`, { volunteer_id: volunteerId })
      loadDashboard()
    } catch (err) {
      console.error('Override failed:', err)
    }
  }

  // ── Respond to join request ───────────────────────────────────────────────────
  const handleJoinResponse = async (requestId, action) => {
    setRespondingId(requestId)
    try {
      await api.patch(`/join-requests/${requestId}`, { action })
      loadDashboard()
    } catch (err) {
      console.error('Join response failed:', err)
    } finally {
      setRespondingId(null)
    }
  }

  // ── Computed stats ────────────────────────────────────────────────────────────
  const pendingJoins = joinRequests.filter(r => r.status === 'pending').length

  const stats = {
    active:        data.assignments.filter(a => !['Completed', 'Cancelled'].includes(a.status)).length,
    completed:     data.assignments.filter(a => a.status === 'Completed').length,
    available:     data.volunteers.filter(v => v.status === 'Available').length,
    total_vol:     data.volunteers.length,
    open_clusters: data.clusters.length,
  }

  const TABS = [
    { id: 'overview',      label: '📊 Overview' },
    { id: 'assignments',   label: '📋 Assignments' },
    { id: 'volunteers',    label: '🙋 Volunteers' },
    { id: 'join_requests', label: '🔔 Join Requests', badge: pendingJoins, badgeColor: 'bg-brand-500' },
    { id: 'clusters',      label: '🗺 Clusters',      badge: newClusterCount, badgeColor: 'bg-red-500', pulse: true },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* ── Topbar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow shadow-brand-500/30">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm">RescueNet</div>
            <div className="text-slate-500 text-xs">NGO Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">Live</span>
          </div>
          <span className="text-slate-400 text-sm hidden md:block">{user?.name}</span>
          <button onClick={logout} className="btn-ghost text-xs py-2">Sign out</button>
        </div>
      </header>

      {/* ── Live Alerts ── */}
      {liveAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm w-full pointer-events-none">
          {liveAlerts.map((a) => (
            <div key={a.id} className={`glass-card px-4 py-3 text-sm font-medium animate-slide-up pointer-events-auto
              ${a.type === 'warning' ? 'border-orange-500/40 text-orange-300' : a.type === 'new' ? 'border-brand-500/40 text-brand-300' : 'text-slate-200'}`}>
              {a.msg}
            </div>
          ))}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Active Tasks',   value: stats.active,        icon: '⚡', color: 'text-brand-400' },
            { label: 'Completed',      value: stats.completed,     icon: '✅', color: 'text-emerald-400' },
            { label: 'Available Vols', value: stats.available,     icon: '🙋', color: 'text-blue-400' },
            { label: 'Total Vols',     value: stats.total_vol,     icon: '👥', color: 'text-slate-300' },
            { label: 'Open Clusters',  value: stats.open_clusters, icon: '🗺',  color: 'text-purple-400' },
          ].map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`font-display font-bold text-2xl ${s.color}`}>{s.value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => {
                setTab(t.id)
                if (t.id === 'clusters') setNewClusterCount(0)  // clear badge on open
              }}
              className={`nav-item whitespace-nowrap relative ${tab === t.id ? 'active' : ''}`}>
              {t.label}
              {t.badge > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full ${
                  t.badgeColor || 'bg-brand-500'
                } text-white text-[10px] font-bold ${t.pulse ? 'animate-pulse' : ''}`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {loading ? (
          <div className="text-slate-500 text-center py-12">Loading dashboard...</div>
        ) : (
          <>
            {/* Overview */}
            {tab === 'overview' && (
              <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
                <div className="glass-card p-6">
                  <h3 className="font-display font-bold text-white mb-4">Recent Assignments</h3>
                  <div className="space-y-3">
                    {data.assignments.slice(0, 5).map((a) => (
                      <AssignmentRow key={a._id} a={a} ngoId={ngoId} onOverride={handleOverride} volunteers={data.volunteers} />
                    ))}
                    {data.assignments.length === 0 && <div className="text-slate-500 text-sm">No assignments yet</div>}
                  </div>
                </div>
                <div className="glass-card p-6">
                  <h3 className="font-display font-bold text-white mb-4">Volunteer Status</h3>
                  <div>
                    {data.volunteers.map((v) => <VolunteerRow key={v._id} vol={v} />)}
                    {data.volunteers.length === 0 && <div className="text-slate-500 text-sm">No volunteers registered</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Assignments */}
            {tab === 'assignments' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-white">All Assignments ({data.assignments.length})</h3>
                  <button onClick={loadDashboard} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
                </div>
                {data.assignments.map((a) => (
                  <AssignmentRow key={a._id} a={a} ngoId={ngoId} onOverride={handleOverride} volunteers={data.volunteers} />
                ))}
                {data.assignments.length === 0 && (
                  <div className="glass-card p-8 text-center text-slate-500">No assignments yet — waiting for incoming requests</div>
                )}
              </div>
            )}

            {/* Volunteers — grouped by skill type in columns */}
            {tab === 'volunteers' && (
              <div className="animate-fade-in space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-white">Volunteers ({data.volunteers.length})</h3>
                  <span className="text-slate-500 text-xs">Grouped by skill type</span>
                </div>
                {data.volunteers.length === 0 ? (
                  <div className="glass-card p-10 text-center text-slate-500">
                    <div className="text-4xl mb-3">🙋</div>
                    <p>No volunteers yet. Approve join requests to see them here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {SKILL_COLS.map(({ key, icon, color }) => {
                      const group = data.volunteers.filter(v => v.skill_type === key)
                      return (
                        <div key={key} className={`rounded-2xl border p-4 ${color}`}>
                          {/* Column header */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-xl">{icon}</span>
                            <div>
                              <div className="font-semibold text-sm">{key}</div>
                              <div className="text-[11px] opacity-70">{group.length} volunteer{group.length !== 1 ? 's' : ''}</div>
                            </div>
                          </div>
                          {/* Member rows */}
                          {group.length === 0 ? (
                            <div className="text-[11px] opacity-50 italic">No members</div>
                          ) : (
                            <div className="space-y-3">
                              {group.map(v => (
                                <div key={v._id} className="bg-slate-900/60 rounded-xl px-3 py-2.5 space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                                        {v.name?.[0]?.toUpperCase()}
                                      </div>
                                      <span className="text-white text-xs font-medium truncate max-w-[80px]">{v.name}</span>
                                    </div>
                                    <span className={`status-dot ${VOL_STATUS[v.status] || 'bg-slate-500'}`} />
                                  </div>
                                  <div className="text-[11px] text-slate-500 pl-8">{v.phone}</div>
                                  <div className="text-[11px] text-slate-600 pl-8">✅ {v.completed_tasks || 0} tasks</div>
                                  <div className="pl-8">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400">
                                      {v.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Join Requests */}
            {tab === 'join_requests' && (
              <div className="animate-fade-in space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-white">
                    Join Requests
                    {pendingJoins > 0 && (
                      <span className="ml-2 badge bg-brand-500/20 text-brand-400 border border-brand-500/30">
                        {pendingJoins} pending
                      </span>
                    )}
                  </h3>
                  <button onClick={loadDashboard} className="btn-ghost text-xs py-1.5 px-3">↻ Refresh</button>
                </div>

                {joinRequests.length === 0 ? (
                  <div className="glass-card p-10 text-center text-slate-500">
                    <div className="text-4xl mb-3">📬</div>
                    <p>No join requests yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {joinRequests.map(req => {
                      const vol = req.volunteer_id
                      const isPending = req.status === 'pending'
                      return (
                        <div key={req._id}
                          className={`glass-card p-5 flex items-start justify-between gap-4 ${
                            isPending ? 'border-brand-500/20' : 'opacity-60'
                          }`}>
                          {/* Volunteer info */}
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-slate-700 flex items-center justify-center font-bold text-slate-300 shrink-0">
                              {vol?.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white text-sm">{vol?.name}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{vol?.phone}</div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                                  {vol?.skill_type}
                                </span>
                                <span className="text-[11px] text-slate-600">✅ {vol?.completed_tasks || 0} tasks done</span>
                              </div>
                              {req.message && (
                                <p className="text-slate-500 text-xs mt-1.5 italic">"{req.message}"</p>
                              )}
                            </div>
                          </div>

                          {/* Action / Status */}
                          <div className="shrink-0">
                            {isPending ? (
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => handleJoinResponse(req._id, 'approve')}
                                  disabled={respondingId === req._id}
                                  id={`approve-${req._id}`}
                                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                                  {respondingId === req._id ? '...' : '✅ Approve'}
                                </button>
                                <button
                                  onClick={() => handleJoinResponse(req._id, 'reject')}
                                  disabled={respondingId === req._id}
                                  id={`reject-${req._id}`}
                                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15 transition-all disabled:opacity-50">
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className={`badge border text-xs ${
                                req.status === 'approved'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-red-500/15 text-red-400 border-red-500/30'
                              }`}>
                                {req.status === 'approved' ? '✅ Approved' : '✕ Rejected'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Clusters */}
            {tab === 'clusters' && (
              <div className="animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-white">Active Clusters ({data.clusters.length})</h3>
                  <span className="text-slate-500 text-xs">Sorted by priority score</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  {data.clusters.map((c) => <ClusterCard key={c._id} cluster={c} />)}
                  {data.clusters.length === 0 && (
                    <div className="glass-card p-8 text-center text-slate-500 col-span-2">No active clusters</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
