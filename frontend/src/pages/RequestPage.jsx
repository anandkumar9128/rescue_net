import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

const NEED_TYPES  = ['Medical', 'Food', 'Rescue', 'Shelter']
const SEVERITIES  = ['Low', 'Medium', 'High', 'Critical']

const SEVERITY_COLORS = {
  Low:      'border-emerald-500 text-emerald-400 bg-emerald-500/10',
  Medium:   'border-yellow-500 text-yellow-400 bg-yellow-500/10',
  High:     'border-orange-500 text-orange-400 bg-orange-500/10',
  Critical: 'border-brand-500 text-brand-400 bg-brand-500/10',
}

const NEED_ICONS = { Medical: '🏥', Food: '🍱', Rescue: '🚁', Shelter: '🏠' }

export default function RequestPage() {
  const navigate       = useNavigate()
  const { user }       = useAuth()
  const [status, setStatus] = useState('idle') // idle | locating | submitting | success | error
  const [msg, setMsg]       = useState('')

  // ── Geolocation pre-detection ─────────────────────────────────────────────
  const [gpsState, setGpsState]   = useState('detecting') // detecting | ready | failed
  const [detectedLoc, setDetectedLoc] = useState(null)   // { lat, lng, address }
  const detectedRef = useRef(null) // always-current ref used in submit

  useEffect(() => {
    let cancelled = false
    const detect = async () => {
      if (!navigator.geolocation) {
        setGpsState('failed')
        return
      }
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000, enableHighAccuracy: true })
        )
        if (cancelled) return
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude

        // Reverse geocode via Nominatim (no key needed)
        let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
          )
          const d = await r.json()
          if (d?.display_name) {
            address = d.display_name.split(',').slice(0, 3).join(',').trim()
          }
        } catch { /* keep raw coords */ }

        const loc = { lat, lng, address }
        detectedRef.current = loc
        setDetectedLoc(loc)
        setGpsState('ready')
      } catch {
        if (!cancelled) setGpsState('failed')
      }
    }
    detect()
    return () => { cancelled = true }
  }, [])

  const [form, setForm] = useState({
    need_type: 'Rescue',
    people_count: 1,
    severity: 'Medium',
    description: '',
    submitter_name: user?.name || '',
    submitter_phone: user?.phone || '',
    manual_lat: '',
    manual_lng: '',
    manual_address: '',
  })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    setMsg('')

    // Use pre-detected location; fall back to manual if GPS failed
    let location = detectedRef.current
    if (!location) {
      if (!form.manual_lat || !form.manual_lng) {
        setStatus('error')
        setMsg('Location not detected. Please enter coordinates manually.')
        return
      }
      location = {
        lat: parseFloat(form.manual_lat),
        lng: parseFloat(form.manual_lng),
        address: form.manual_address || '',
      }
    }

    try {
      const { data } = await api.post('/requests', {
        need_type: form.need_type,
        people_count: parseInt(form.people_count),
        severity: form.severity,
        description: form.description,
        location,
        submitter_name: form.submitter_name || user?.name || 'Anonymous',
        submitter_phone: form.submitter_phone || user?.phone || '',
        is_sos: false,
      })

      setStatus('success')
      setMsg(`Request submitted! Cluster ID: ${data.cluster_id}`)
    } catch (err) {
      const fallback = err.response?.data?.fallback
      setStatus('error')
      setMsg(
        fallback === 'sms'
          ? '⚠️ API unavailable. Emergency SMS sent to nearby NGO.'
          : fallback === 'offline_queue'
          ? '📦 Offline. Request queued — will send when connectivity restores.'
          : err.response?.data?.message || 'Failed to submit request.'
      )
    }
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="glass-card p-10 max-w-md w-full text-center animate-slide-up">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">Request Sent!</h2>
          <p className="text-slate-400 text-sm mb-6">{msg}</p>
          <p className="text-slate-500 text-xs mb-8">Help has been dispatched. An NGO will coordinate with you shortly.</p>
          <div className="flex gap-3">
            <button onClick={() => { setStatus('idle'); setMsg('') }} className="btn-ghost flex-1">New Request</button>
            <button onClick={() => navigate('/')} className="btn-primary flex-1">← Home</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 py-12 px-4">
      <div className="max-w-xl mx-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
            ← Back
          </button>
          <div>
            <h1 className="font-display font-bold text-2xl text-white">Request Help</h1>
            <p className="text-slate-500 text-sm">Fill in the details — we'll dispatch the nearest team</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Need Type */}
          <div className="glass-card p-6">
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
              What do you need?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {NEED_TYPES.map((type) => (
                <button key={type} type="button"
                  onClick={() => set('need_type', type)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-left
                    ${form.need_type === type
                      ? 'border-brand-500 bg-brand-500/10 text-white'
                      : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600'
                    }`}
                  id={`need-${type}`}
                >
                  <span className="text-2xl">{NEED_ICONS[type]}</span>
                  <span className="font-semibold text-sm">{type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Severity + People */}
          <div className="glass-card p-6 space-y-5">
            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
                Severity
              </label>
              <div className="flex gap-2 flex-wrap">
                {SEVERITIES.map((s) => (
                  <button key={s} type="button"
                    onClick={() => set('severity', s)}
                    className={`px-4 py-2 rounded-xl border text-xs font-bold transition-all duration-200
                      ${form.severity === s ? SEVERITY_COLORS[s] + ' border-current' : 'border-slate-700 text-slate-500 hover:border-slate-600'}`}
                    id={`severity-${s}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
                People Affected
              </label>
              <input type="number" min="1" max="10000" className="input-field w-32"
                value={form.people_count}
                onChange={(e) => set('people_count', e.target.value)}
                id="people-count"
              />
            </div>
          </div>

          {/* Description */}
          <div className="glass-card p-6">
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">
              Description <span className="text-slate-600">(optional)</span>
            </label>
            <textarea className="input-field resize-none" rows={3}
              placeholder="Describe the situation — injuries, accessibility, landmarks..."
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              id="description"
            />
          </div>

          {/* Location — auto-detected */}
          <div className="glass-card p-6 space-y-3">
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
              📍 Your Location
            </label>

            {/* Detecting spinner */}
            {gpsState === 'detecting' && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700">
                <svg className="w-4 h-4 animate-spin text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-slate-400 text-sm">Detecting your location...</span>
              </div>
            )}

            {/* Location detected — read-only card */}
            {gpsState === 'ready' && detectedLoc && (
              <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/30 px-4 py-3 space-y-2 animate-fade-in">
                <p className="text-emerald-400 text-sm font-medium">✅ Location detected</p>
                <p className="text-slate-300 text-xs leading-relaxed">{detectedLoc.address}</p>
                <div className="flex gap-3 mt-1">
                  <div className="flex-1 bg-slate-800/60 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Latitude</p>
                    <p className="text-xs text-emerald-300 font-mono mt-0.5">{detectedLoc.lat.toFixed(6)}</p>
                  </div>
                  <div className="flex-1 bg-slate-800/60 rounded-lg px-3 py-1.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Longitude</p>
                    <p className="text-xs text-emerald-300 font-mono mt-0.5">{detectedLoc.lng.toFixed(6)}</p>
                  </div>
                </div>
                <a
                  href={`https://maps.google.com/?q=${detectedLoc.lat},${detectedLoc.lng}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-block text-[11px] text-brand-400 hover:text-brand-300 transition-colors mt-1"
                >
                  🗺 View on Google Maps →
                </a>
              </div>
            )}

            {/* GPS failed — manual fallback */}
            {gpsState === 'failed' && (
              <div className="space-y-3 animate-fade-in">
                <p className="text-orange-400 text-xs">⚠️ Location could not be detected. Enter manually:</p>
                <input className="input-field" placeholder="Address / Landmark" id="manual-address"
                  value={form.manual_address} onChange={(e) => set('manual_address', e.target.value)} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Latitude</label>
                    <input className="input-field text-sm mt-1" type="number" step="any" placeholder="e.g. 28.6139" id="manual-lat"
                      value={form.manual_lat} onChange={(e) => set('manual_lat', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-wider">Longitude</label>
                    <input className="input-field text-sm mt-1" type="number" step="any" placeholder="e.g. 77.2090" id="manual-lng"
                      value={form.manual_lng} onChange={(e) => set('manual_lng', e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Contact info */}
          <div className="glass-card p-6 space-y-4">
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider">
              Your Contact
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input className="input-field" placeholder="Your name" id="contact-name"
                value={form.submitter_name} onChange={(e) => set('submitter_name', e.target.value)} />
              <input className="input-field" type="tel" placeholder="Phone number" id="contact-phone"
                value={form.submitter_phone} onChange={(e) => set('submitter_phone', e.target.value)} />
            </div>
          </div>

          {msg && status === 'error' && (
            <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-3 text-brand-400 text-sm">
              {msg}
            </div>
          )}

          <button type="submit" className="btn-primary w-full py-4 text-base"
            disabled={status === 'submitting' || gpsState === 'detecting'} id="submit-request">
            {status === 'submitting' ? '⏳ Submitting...'
              : gpsState === 'detecting' ? '📡 Detecting location...'
              : '🚀 Submit Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
