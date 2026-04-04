import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const SKILL_TYPES   = ['Medical', 'Food', 'Rescue', 'Shelter', 'General']
const CAPABILITIES  = ['Medical', 'Food', 'Rescue', 'Shelter']

export default function RegisterPage() {
  const [searchParams]        = useSearchParams()
  const defaultRole           = searchParams.get('role') || 'user'
  const { register, loading } = useAuth()
  const navigate              = useNavigate()
  const [error, setError]     = useState('')
  const [role, setRole]       = useState(defaultRole)

  // GPS state for NGO location
  const [gpsState, setGpsState] = useState('idle') // idle | locating | done | error
  const [gpsMsg, setGpsMsg]     = useState('')

  const [form, setForm] = useState({
    name: '', phone: '', email: '', password: '',
    skill_type: 'General',
    ngo: {
      name: '', contact_email: '', contact_phone: '',
      capabilities: ['Rescue'],
      location: { lat: '', lng: '', address: '' },
    },
  })

  const set    = (field, val) => setForm((f) => ({ ...f, [field]: val }))
  const setNgo = (field, val) => setForm((f) => ({ ...f, ngo: { ...f.ngo, [field]: val } }))
  const setNgoLoc = (locPatch) =>
    setForm((f) => ({ ...f, ngo: { ...f.ngo, location: { ...f.ngo.location, ...locPatch } } }))

  const toggleCapability = (cap) => {
    const caps = form.ngo.capabilities.includes(cap)
      ? form.ngo.capabilities.filter((c) => c !== cap)
      : [...form.ngo.capabilities, cap]
    setNgo('capabilities', caps)
  }

  // ── GPS Auto-detect for NGO headquarters ─────────────────────────────────────
  const detectLocation = useCallback(async () => {
    setGpsState('locating')
    setGpsMsg('Detecting your location...')

    if (!navigator.geolocation) {
      setGpsState('error')
      setGpsMsg('Geolocation not supported by your browser.')
      return
    }

    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true,
        })
      )

      const lat = pos.coords.latitude.toFixed(6)
      const lng = pos.coords.longitude.toFixed(6)

      // Try reverse geocoding via a free API (no key needed)
      let address = `${lat}, ${lng}`
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
        )
        const data = await res.json()
        if (data?.display_name) {
          // Shorten to city-level
          const parts = data.display_name.split(',')
          address = parts.slice(0, 3).join(',').trim()
        }
      } catch {
        // Geocoding failed — keep raw coords as address
      }

      setNgoLoc({ lat, lng, address })
      setGpsState('done')
      setGpsMsg(`📍 Location detected: ${address}`)
    } catch (err) {
      setGpsState('error')
      setGpsMsg(
        err.code === 1
          ? 'Location permission denied. Please allow access or enter manually.'
          : 'Could not detect location. Enter manually below.'
      )
    }
  }, [])

  // Auto-trigger geolocation when NGO role is selected
  useEffect(() => {
    if (role === 'ngo_admin' && gpsState === 'idle') {
      detectLocation()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role])

  // ── Form submission ───────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate NGO location
    if (role === 'ngo_admin') {
      if (!form.ngo.location.lat || !form.ngo.location.lng) {
        setError('Please detect or enter your NGO headquarters location.')
        return
      }
    }

    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      password: form.password,
      role,
      ...(role === 'volunteer' && { skill_type: form.skill_type }),
      ...(role === 'ngo_admin' && {
        ngo: {
          ...form.ngo,
          location: {
            lat: parseFloat(form.ngo.location.lat) || 0,
            lng: parseFloat(form.ngo.location.lng) || 0,
            address: form.ngo.location.address,
          },
        },
      }),
    }

    const result = await register(payload)
    if (result.success) {
      navigate(role === 'ngo_admin' ? '/ngo' : role === 'volunteer' ? '/volunteer' : '/')
    } else {
      setError(result.message)
    }
  }

  const roleLabel = {
    user:      '👤 Affected User',
    volunteer: '🙋 Volunteer',
    ngo_admin: '🏥 NGO Admin',
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-xl animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center shadow-xl shadow-brand-500/30 mx-auto mb-4">
            <span className="text-white font-black text-2xl">R</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">Create account</h1>
          <p className="text-slate-400 text-sm mt-2">Join RescueNet today</p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {Object.entries(roleLabel).map(([r, label]) => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition-all duration-200 border
                ${role === r
                  ? 'bg-brand-500 border-brand-500 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              id={`role-${r}`}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          {error && (
            <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-3 text-brand-400 text-sm">
              {error}
            </div>
          )}

          {/* Base fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-xs">Full Name</label>
              <input className="input-field" placeholder="Your name" required
                value={form.name} onChange={(e) => set('name', e.target.value)} id="reg-name" />
            </div>
            <div>
              <label className="label-xs">Phone</label>
              <input className="input-field" type="tel" placeholder="+91 9000000000" required
                value={form.phone} onChange={(e) => set('phone', e.target.value)} id="reg-phone" />
            </div>
          </div>

          <div>
            <label className="label-xs">Email <span className="text-slate-600">(optional)</span></label>
            <input className="input-field" type="email" placeholder="your@email.com"
              value={form.email} onChange={(e) => set('email', e.target.value)} id="reg-email" />
          </div>

          <div>
            <label className="label-xs">Password</label>
            <input className="input-field" type="password" placeholder="Min. 6 characters" required
              value={form.password} onChange={(e) => set('password', e.target.value)} id="reg-password" />
          </div>

          {/* ── Volunteer extra fields ── */}
          {role === 'volunteer' && (
            <div>
              <label className="label-xs">Skill Type</label>
              <select className="select-field" value={form.skill_type}
                onChange={(e) => set('skill_type', e.target.value)} id="reg-skill">
                {SKILL_TYPES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* ── NGO extra fields ── */}
          {role === 'ngo_admin' && (
            <div className="space-y-4 border-t border-slate-700 pt-5">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-widest">NGO Details</p>

              <input className="input-field" placeholder="NGO / Organization Name" required
                value={form.ngo.name} onChange={(e) => setNgo('name', e.target.value)} id="ngo-name" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-xs">Contact Email</label>
                  <input className="input-field" type="email" placeholder="ngo@example.com" required
                    value={form.ngo.contact_email} onChange={(e) => setNgo('contact_email', e.target.value)} id="ngo-email" />
                </div>
                <div>
                  <label className="label-xs">Contact Phone</label>
                  <input className="input-field" type="tel" placeholder="+91 9000000000" required
                    value={form.ngo.contact_phone} onChange={(e) => setNgo('contact_phone', e.target.value)} id="ngo-phone" />
                </div>
              </div>

              {/* ── GPS Location Detector ── */}
              <div>
                <label className="label-xs">Headquarters Location</label>

                {/* Status / Re-detect button */}
                <button type="button" onClick={detectLocation}
                  disabled={gpsState === 'locating'}
                  id="ngo-detect-location"
                  className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border-2
                    text-sm font-semibold transition-all duration-200
                    ${gpsState === 'done'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                      : gpsState === 'error'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400 hover:bg-orange-500/15'
                      : 'border-brand-500/50 bg-brand-500/5 text-brand-300'
                    }`}
                >
                  {gpsState === 'locating' ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Detecting your location...
                    </>
                  ) : gpsState === 'done' ? (
                    <>✅ Location detected — click to re-detect</>
                  ) : gpsState === 'error' ? (
                    <>🔄 Retry auto-detect</>
                  ) : (
                    <>📡 Detecting location...</>
                  )}
                </button>

                {/* GPS feedback message */}
                {gpsMsg && (
                  <p className={`text-xs mt-2 ${
                    gpsState === 'done' ? 'text-emerald-400'
                    : gpsState === 'error' ? 'text-orange-400'
                    : 'text-slate-400'
                  }`}>
                    {gpsMsg}
                  </p>
                )}

                {/* Read-only coords display — shown after successful detection */}
                {gpsState === 'done' && (
                  <div className="mt-3 grid grid-cols-2 gap-2 animate-fade-in">
                    <div className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-emerald-500/30">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Latitude</p>
                      <p className="text-sm text-emerald-300 font-mono">{form.ngo.location.lat}</p>
                    </div>
                    <div className="px-3 py-2.5 rounded-xl bg-slate-800/60 border border-emerald-500/30">
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Longitude</p>
                      <p className="text-sm text-emerald-300 font-mono">{form.ngo.location.lng}</p>
                    </div>
                  </div>
                )}

                {/* Manual fallback — shown only when geolocation fails */}
                {gpsState === 'error' && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    <p className="text-slate-500 text-xs">Enter coordinates manually:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">Latitude</label>
                        <input className="input-field text-sm py-2 mt-1" type="number" step="any" placeholder="e.g. 28.6139" id="ngo-lat"
                          value={form.ngo.location.lat}
                          onChange={(e) => setNgoLoc({ lat: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase tracking-wider">Longitude</label>
                        <input className="input-field text-sm py-2 mt-1" type="number" step="any" placeholder="e.g. 77.2090" id="ngo-lng"
                          value={form.ngo.location.lng}
                          onChange={(e) => setNgoLoc({ lng: e.target.value })} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Address input — always shown */}
                <input className="input-field mt-3" placeholder="NGO address / landmark (optional)"
                  value={form.ngo.location.address}
                  onChange={(e) => setNgoLoc({ address: e.target.value })} id="ngo-address" />
              </div>

              {/* Capabilities */}
              <div>
                <label className="label-xs mb-2 block">What can your NGO handle?</label>
                <div className="flex flex-wrap gap-2">
                  {CAPABILITIES.map((cap) => (
                    <button key={cap} type="button" onClick={() => toggleCapability(cap)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150
                        ${form.ngo.capabilities.includes(cap)
                          ? 'bg-brand-500 border-brand-500 text-white shadow-md shadow-brand-500/20'
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading} id="register-submit">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link to="/" className="text-slate-600 text-xs hover:text-slate-400 transition-colors">
            ← Back to Home
          </Link>
        </p>
      </div>
    </div>
  )
}
