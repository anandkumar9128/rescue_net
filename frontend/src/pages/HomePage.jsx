import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'

// ── Severity badge colors ──────────────────────────────────────────────────────
const SEVERITY_COLORS = {
  Low:      'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  Medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  High:     'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Critical: 'bg-brand-500/20 text-brand-400 border-brand-500/30',
}

export default function HomePage() {
  const navigate          = useNavigate()
  const { user }          = useAuth()
  const { t }             = useTranslation()
  const [sosState, setSosState] = useState('idle') // idle | locating | sending | sent | error
  const [sosMsg, setSosMsg]     = useState('')
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Background location pre-fetch so we have a fallback if they go offline
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          localStorage.setItem('rn_last_loc', JSON.stringify({
            lat: pos.coords.latitude.toFixed(5),
            lng: pos.coords.longitude.toFixed(5),
            ts: Date.now()
          }))
        },
        () => {}, // ignore errors silently
        { maximumAge: 60000, timeout: 5000, enableHighAccuracy: true }
      )
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── SMS Fallback Handler ────────────────────────────────────────────────────
  const handleSmsFallback = useCallback(async () => {
    let lat = ''
    let lng = ''
    try {
      const p = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, enableHighAccuracy: true })
      )
      lat = p.coords.latitude.toFixed(5)
      lng = p.coords.longitude.toFixed(5)
      localStorage.setItem('rn_last_loc', JSON.stringify({ lat, lng, ts: Date.now() }))
    } catch {
      console.warn('Geolocation failed for SMS, using localStorage fallback')
      try {
        const lastLoc = JSON.parse(localStorage.getItem('rn_last_loc'))
        if (lastLoc && lastLoc.lat) {
          lat = lastLoc.lat
          lng = lastLoc.lng
        }
      } catch (e) {}
    }
    const message = `SOS|R|${lat}|${lng}|HIGH`
    // Use the custom Android Hub phone number instead of Twilio
    const forwarderNumber = import.meta.env.VITE_FORWARDER_PHONE_NUMBER || '+919128171568'
    window.location.href = `sms:${forwarderNumber}?body=${encodeURIComponent(message)}`
  }, [])

  // ── SOS Handler ─────────────────────────────────────────────────────────────
  const handleSOS = useCallback(async () => {
    if (sosState === 'sending' || sosState === 'sent') return
    setSosState('locating')
    setSosMsg('Getting your location...')

    // 1. Get GPS
    let coords
    try {
      coords = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          (e) => reject(e),
          { timeout: 8000, enableHighAccuracy: true }
        )
      )
      localStorage.setItem('rn_last_loc', JSON.stringify({ 
        lat: coords.lat.toFixed(5), 
        lng: coords.lng.toFixed(5), 
        ts: Date.now() 
      }))
    } catch {
      // Fallback to localStorage if live GPS fails
      try {
        const lastLoc = JSON.parse(localStorage.getItem('rn_last_loc'))
        if (lastLoc && lastLoc.lat) {
          coords = { lat: parseFloat(lastLoc.lat), lng: parseFloat(lastLoc.lng) }
        } else {
          coords = { lat: 28.6139, lng: 77.2090 } // hard fallback
        }
      } catch (e) {
        coords = { lat: 28.6139, lng: 77.2090 }
      }
    }

    setSosState('sending')
    setSosMsg('Sending SOS alert...')

    try {
      await api.post('/requests', {
        need_type: 'Rescue',
        people_count: 1,
        severity: 'High',
        is_sos: true,
        location: coords,
        description: 'SOS — one-tap emergency alert',
        submitter_name: user?.name || 'Anonymous',
        submitter_phone: user?.phone || '',
      })
      setSosState('sent')
      setSosMsg('✅ SOS sent! Help is on the way.')
      setTimeout(() => setSosState('idle'), 5000)
    } catch (err) {
      setSosState('error')
      setSosMsg('⚠️ Network Error: Tap "Send via SMS" as fallback')
      setTimeout(() => setSosState('idle'), 5000)
    }
  }, [sosState, user])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-5 border-b border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <span className="text-white font-black text-lg">R</span>
          </div>
          <span className="font-display font-bold text-xl text-white">RescueNet</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <button onClick={() => navigate(user.role === 'ngo_admin' ? '/ngo' : '/volunteer')}
              className="btn-ghost text-xs">
              Dashboard →
            </button>
          ) : (
            <>
              <button onClick={() => navigate('/login')} className="btn-ghost text-xs">Login</button>
              <button onClick={() => navigate('/register')} className="btn-primary text-xs px-4 py-2">Register</button>
            </>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center animate-fade-in">
        {/* Live indicator */}
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 mb-8">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          <span className="text-brand-400 text-xs font-semibold tracking-widest uppercase">Live Disaster Response</span>
        </div>

        <h1 className="font-display font-black text-5xl md:text-7xl text-white leading-tight mb-6">
          Coordinate<br />
          <span className="text-gradient">Disaster Relief</span><br />
          in Real-Time
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mb-14 leading-relaxed">
          Connecting affected communities with NGOs and volunteers instantly.
          One tap to request help. Zero bureaucracy.
        </p>

        {/* ── Action Buttons ── */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
          {/* SOS */}
          <div className="relative w-full sm:w-auto">
            {(sosState === 'idle' || sosState === 'sending') && (
              <>
                <div className="absolute inset-0 rounded-2xl bg-brand-500/40 sos-ring" />
                <div className="absolute inset-0 rounded-2xl bg-brand-500/20 sos-ring" style={{ animationDelay: '0.5s' }} />
              </>
            )}
            <button
              onClick={handleSOS}
              disabled={sosState === 'sending' || sosState === 'sent'}
              className="btn-sos w-full sm:w-auto relative z-10"
              id="sos-button"
            >
              {sosState === 'locating' ? '📡' : sosState === 'sending' ? '⏳' : sosState === 'sent' ? '✅' : '🚨'}
              {sosState === 'idle' ? t('sos') : sosState === 'sent' ? 'SOS Sent!' : 'Sending...'}
            </button>
          </div>

          {/* Manual Request */}
          <button
            onClick={() => navigate('/request')}
            className="btn-ghost w-full sm:w-auto text-base py-4 px-6"
            id="manual-request-button"
          >
            📝 {t('manual_request')}
          </button>
        </div>

        {/* Offline SMS Fallback Button */}
        <button
          onClick={handleSmsFallback}
          className={`btn-ghost w-full max-w-md mt-4 py-4 border border-brand-500/30 text-brand-300 hover:bg-brand-500/10 ${isOffline ? 'animate-pulse ring-2 ring-brand-500 bg-brand-500/10' : ''}`}
          id="sms-fallback-button"
        >
          {isOffline ? '📶 Offline: Tap to Send SMS SOS' : '📱 Send SOS via Text Message'}
        </button>

        {/* SOS feedback message */}
        {sosMsg && (
          <p className={`mt-4 text-sm font-medium animate-fade-in ${
            sosState === 'sent' ? 'text-emerald-400' : 'text-slate-400'
          }`}>
            {sosMsg}
          </p>
        )}

        {/* ── Divider ── */}
        <div className="flex items-center gap-4 my-12 w-full max-w-md">
          <div className="flex-1 h-px bg-slate-800" />
          <span className="text-slate-600 text-xs uppercase tracking-widest">or join as</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {/* ── Role Register Buttons ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
          <button
            onClick={() => navigate('/register?role=volunteer')}
            className="glass-card p-5 text-left hover:border-brand-500/40 transition-all duration-200 hover:bg-slate-700/40 group"
            id="volunteer-register-button"
          >
            <div className="text-2xl mb-2">🙋</div>
            <div className="font-semibold text-white group-hover:text-brand-300 transition-colors">{t('login_volunteer')}</div>
            <div className="text-slate-500 text-xs mt-1">Join a local NGO response team</div>
          </button>

          <button
            onClick={() => navigate('/register?role=ngo_admin')}
            className="glass-card p-5 text-left hover:border-brand-500/40 transition-all duration-200 hover:bg-slate-700/40 group"
            id="ngo-register-button"
          >
            <div className="text-2xl mb-2">🏥</div>
            <div className="font-semibold text-white group-hover:text-brand-300 transition-colors">{t('login_ngo')}</div>
            <div className="text-slate-500 text-xs mt-1">Manage resources and volunteers</div>
          </button>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="border-t border-slate-800/50 py-6 px-8">
        <div className="flex items-center justify-center gap-10 flex-wrap">
          {[
            { label: 'Active NGOs', value: '3+' },
            { label: 'Volunteers', value: '7+' },
            { label: 'Response Time', value: '<15min' },
            { label: 'Coverage', value: '50km' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="font-display font-bold text-2xl text-brand-400">{s.value}</div>
              <div className="text-slate-500 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
