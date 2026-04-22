import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";

export function Login() {
  const { login, user, loading: authLoading } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setSubmitting(true);

    try {
      await login(email, password);
      nav("/dashboard", { replace: true });
    } catch (ex) {
      setErr(ex.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col md:flex-row overflow-hidden">

      {/* 🌊 BACKGROUND */}
      <div className="fixed inset-0 -z-10 overflow-hidden bg-gradient-to-br from-[#751c58] via-[#4a1237] to-black">
        <div className="hidden sm:block">
          {Array.from({ length: 25 }).map((_, i) => (
            <span
              key={i}
              className="bubble"
              style={{
                left: `${Math.random() * 100}%`,
                width: `${10 + Math.random() * 30}px`,
                height: `${10 + Math.random() * 30}px`,
                animationDuration: `${6 + Math.random() * 10}s`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ✅ LOGO TOP LEFT */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
        <img
          src={logo}
          alt="CLIC Logo"
          className="h-24 sm:h-28 md:h-36 w-24 sm:w-28 md:w-36 rounded-full object-cover border-2 border-white shadow-lg animate-pulse hover:scale-110 transition-transform duration-300"
        />
      </div>

      {/* LEFT SIDE */}
      <div className="md:w-1/2 w-full text-white flex flex-col justify-center px-6 sm:px-10 py-10 md:py-0">

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">
          CLIC Campus <br />
          Students Payment Portal
        </h1>

        <p className="mt-3 text-xs sm:text-sm text-pink-200">
          Streamline student payments, track dues, and manage receipts — all in one place.
        </p>
         <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 sm:mt-8">

  {/* 👨‍🎓 Students */}
  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-xl hover:scale-105 transition">
    <h2 className="text-lg sm:text-xl font-bold text-white">Auto Enrolled Tracking</h2>
    <p className="text-[10px] sm:text-xs text-pink-100">Active Students System</p>
  </div>

  {/* 💰 Finance */}
  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-xl hover:scale-105 transition">
    <h2 className="text-lg sm:text-xl font-bold text-white">Monthly Payment Engine</h2>
    <p className="text-[10px] sm:text-xs text-pink-100">Pending Payment Alerts</p>
  </div>

  {/* 🔒 Security */}
  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-xl hover:scale-105 transition">
    <h2 className="text-lg sm:text-xl font-bold text-white">99.9%</h2>
    <p className="text-[10px] sm:text-xs text-pink-100">System Security</p>
  </div>

  {/* ⚡ System */}
  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 sm:p-4 rounded-xl hover:scale-105 transition">
    <h2 className="text-lg sm:text-xl font-bold text-white">24/7</h2>
    <p className="text-[10px] sm:text-xs text-pink-100">Live Monitoring +  Auto Alerts</p>
    <p className="text-[9px] text-gray-200 mt-1"></p>
  </div>

</div>
      </div>

      {/* RIGHT SIDE */}
      <div className="md:w-1/2 w-full flex items-center justify-center bg-gray-100 px-4 py-10">

        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8">

          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
            Welcome back!
          </h2>

          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Login to your account to continue
          </p>

          <form onSubmit={submit} className="mt-5 sm:mt-6 space-y-4">

            {err && (
              <div className="bg-red-100 text-red-700 p-2 rounded text-sm">
                {err}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#751c58]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                className="w-full mt-1 p-2 border rounded-lg focus:ring-2 focus:ring-[#751c58]"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#751c58] text-white py-2 rounded-lg font-semibold hover:bg-[#5e1746] transition"
            >
              {submitting ? "Signing in..." : "Login"}
            </button>

          </form>
        </div>
      </div>

      {/* 🌟 BOTTOM CENTER TEXT (RESPONSIVE FIXED) */}
      <div className="absolute bottom-6 sm:bottom-10 left-90 -translate-x-1/2 z-30 w-full px-4">
        <p className="text-base sm:text-lg md:text-2xl text-white font-medium animate-pulse text-center">
          Enjoy the best in learning
        </p>
      </div>

    </div>
  );
}