import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import socket from '../services/socket'

const CAPABILITY_ICONS = { Medical: '🏥', Food: '🍱', Rescue: '🚁', Shelter: '🏠' }
const SKILL_COLORS = {
  Medical: 'bg-red-500/15 text-red-400 border-red-500/30',
  Food:    'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  Rescue:  'bg-blue-500/15 text-blue-400 border-blue-500/30',
  Shelter: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  General: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
}

export default function NGOSelectionPage() {
  const navigate         = useNavigate()
  const { user, logout } = useAuth()

  const [ngos, setNgos]           = useState([])
  const [myRequests, setMyRequests] = useState([]) // { ngo_id, status }
  const [loading, setLoading]     = useState(true)
  const [sending, setSending]     = useState(null)  // ngo._id currently being requested
  const [toast, setToast]         = useState(null)

  const showToast = (msg, type = 'info') => {
    const id = Date.now()
    setToast({ id, msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    try {
      const [ngoRes, myRes] = await Promise.all([
        api.get('/ngos'),
        api.get('/join-requests/my'),
      ])
      setNgos(ngoRes.data.data)
      setMyRequests(myRes.data.data)
    } catch (err) {
      console.error('Load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Listen for real-time approval / rejection
  useEffect(() => {
    socket.on('join_request_response', ({ status, message }) => {
      showToast(message, status === 'approved' ? 'success' : 'warning')
      load()
      if (status === 'approved') {
        // Redirect to volunteer dashboard after a moment
        setTimeout(() => navigate('/volunteer'), 1500)
      }
    })
    return () => socket.off('join_request_response')
  }, [load, navigate])

  const requestStatus = (ngoId) => {
    const found = myRequests.find((r) => String(r.ngo_id?._id || r.ngo_id) === String(ngoId))
    return found?.status || null
  }

  const handleRequest = async (ngo) => {
    if (sending) return
    setSending(ngo._id)
    try {
      await api.post('/join-requests', { ngo_id: ngo._id })
      showToast(`✅ Request sent to ${ngo.name}! Waiting for approval.`, 'success')
      load()
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to send request'
      showToast(`⚠️ ${msg}`, 'error')
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50 sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center shadow shadow-brand-500/30">
            <span className="text-white font-black text-sm">R</span>
          </div>
          <div>
            <div className="font-display font-bold text-white text-sm">RescueNet</div>
            <div className="text-slate-500 text-xs">Join an NGO</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400 text-sm hidden md:block">👋 {user?.name}</span>
          <button onClick={logout} className="btn-ghost text-xs py-2">Sign out</button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-20 right-6 z-50 glass-card px-5 py-3 text-sm font-medium animate-slide-up max-w-sm
          ${toast.type === 'success' ? 'border-emerald-500/40 text-emerald-300'
          : toast.type === 'error' ? 'border-brand-500/40 text-brand-300'
          : 'border-yellow-500/40 text-yellow-300'}`}>
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-10 animate-slide-up">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
            <span className="text-brand-400 text-xs font-semibold tracking-widest uppercase">Step 2 of 2</span>
          </div>
          <h1 className="font-display font-black text-4xl text-white mb-3">
            Choose your <span className="text-gradient">NGO</span>
          </h1>
          <p className="text-slate-400 text-base max-w-lg mx-auto">
            Select an NGO to join as a volunteer. Your request will be reviewed by their admin.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <svg className="w-5 h-5 animate-spin mr-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading NGOs...
          </div>
        ) : ngos.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-500">
            <div className="text-4xl mb-3">🏥</div>
            <p>No NGOs registered yet. Check back soon.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ngos.map((ngo) => {
              const status = requestStatus(ngo._id)
              return (
                <div key={ngo._id}
                  className="glass-card p-6 flex flex-col gap-4 hover:border-brand-500/30 transition-all duration-200">
                  {/* NGO header */}
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-xl shrink-0">
                      🏥
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-white text-sm leading-tight truncate">{ngo.name}</div>
                      {ngo.location?.address && (
                        <div className="text-slate-500 text-xs mt-0.5 truncate">📍 {ngo.location.address}</div>
                      )}
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div className="flex flex-wrap gap-1.5">
                    {ngo.capabilities?.map((cap) => (
                      <span key={cap}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border bg-slate-800/60 border-slate-700 text-slate-400">
                        {CAPABILITY_ICONS[cap] || '⚙️'} {cap}
                      </span>
                    ))}
                  </div>

                  {/* Contact */}
                  <div className="text-xs text-slate-500 space-y-0.5">
                    {ngo.contact_email && <div>✉️ {ngo.contact_email}</div>}
                    {ngo.contact_phone && <div>📞 {ngo.contact_phone}</div>}
                  </div>

                  {/* Action */}
                  <div className="mt-auto">
                    {status === 'approved' ? (
                      <div className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                        ✅ Member
                      </div>
                    ) : status === 'pending' ? (
                      <div className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-center bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                        ⏳ Request Pending
                      </div>
                    ) : status === 'rejected' ? (
                      <button
                        onClick={() => handleRequest(ngo)}
                        disabled={sending === ngo._id}
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15 transition-all duration-200">
                        {sending === ngo._id ? '⏳ Sending...' : '🔄 Re-apply'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRequest(ngo)}
                        disabled={sending === ngo._id}
                        id={`request-ngo-${ngo._id}`}
                        className="btn-primary w-full py-2.5 text-xs">
                        {sending === ngo._id ? '⏳ Sending...' : '📩 Request to Join'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Skip link */}
        <div className="text-center mt-8">
          <button onClick={() => navigate('/volunteer')} className="text-slate-600 text-xs hover:text-slate-400 transition-colors">
            Skip for now — join later →
          </button>
        </div>
      </div>
    </div>
  )
}
