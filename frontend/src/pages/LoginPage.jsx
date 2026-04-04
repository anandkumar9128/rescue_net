import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const result = await login(form.phone, form.password);
    if (result.success) {
      const role = result.user.role;
      navigate(
        role === "ngo_admin"
          ? "/ngo"
          : role === "volunteer"
            ? "/volunteer"
            : "/",
      );
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center shadow-xl shadow-brand-500/30 mx-auto mb-4">
            <span className="text-white font-black text-2xl">R</span>
          </div>
          <h1 className="font-display font-bold text-3xl text-white">
            Welcome back
          </h1>
          <p className="text-slate-400 text-sm mt-2">Sign in to RescueNet</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-8 space-y-5">
          {error && (
            <div className="bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-3 text-brand-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              className="input-field"
              placeholder="+91 9000000000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              id="login-phone"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              id="login-password"
            />
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={loading}
            id="login-submit"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-slate-500 text-sm mt-6">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            Register
          </Link>
        </p>
        <p className="text-center mt-3">
          <Link
            to="/"
            className="text-slate-600 text-xs hover:text-slate-400 transition-colors"
          >
            ← Back to Home
          </Link>
        </p>
      </div>
    </div>
  );
}
