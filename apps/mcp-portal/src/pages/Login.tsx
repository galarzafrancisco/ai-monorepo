import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../context/SessionContext";
import { Card } from "../components/Card";
import { CardContent } from "../components/CardContent";
import { getApiBaseUrl } from "../config/api";

async function handleLogin(email: string, password: string) {
  const res = await fetch(`${getApiBaseUrl()}/api/v1/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) throw new Error("bad creds");
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/home";
  const navigate = useNavigate();

  const { session, loading: sessionLoading } = useSession();

  useEffect(() => {
    if (!sessionLoading && session) {
      navigate(redirectPath, { replace: true });
    }
  }, [session, sessionLoading, navigate, redirectPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    setError("");
    e.preventDefault();
    setLoading(true);
    try {
      await handleLogin(email, password);
      window.location.href = redirectPath;
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-[#0b1220] to-[#0e0f19] text-white overflow-hidden">
      <Card>
        <CardContent>
          <div className="flex flex-col items-center gap-2 mb-6">
            <h1 className="text-2xl font-bold">
              Welcome to&nbsp;
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-teal-400">
                MCP&nbsp;Portal
              </span>
            </h1>
            <p className="text-sm text-white/60">
              Sign&nbsp;in to manage your workspace
            </p>
          </div>

          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm text-white/70">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white/10 focus:bg-white/15 placeholder:text-white/40 px-3 py-2 rounded-md"
              />
            </div>
            <div className="flex-col gap-2">
              <label htmlFor="password" className="text-sm text-white/70">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white/10 focus:bg-white/15 placeholder:text-white/40 px-3 py-2 rounded-md"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2 rounded-md bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 text-white disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Login"}
            </button>
            {error && (
              <p className="text-center text-sm text-red-400" role="alert">
                {error}
              </p>
            )}
            <p className="text-center text-xs text-white/50">
              Authorized access only
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
