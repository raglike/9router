"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Button, Input } from "@/shared/components";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [bootstrapping, setBootstrapping] = useState(false);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({ username: "", email: "", password: "", displayName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        setStatus(data);
        if (data.authenticated && data.user) {
          router.push("/dashboard/platform");
          router.refresh();
          return;
        }
        if ((data.userCount || 0) === 0) {
          setMode("register");
          setBootstrapping(true);
        }
      } catch {
        setStatus({ registrationEnabled: true, userCount: 0 });
        setMode("register");
      }
    }
    loadStatus();
  }, [router]);

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const payload = mode === "register"
        ? form
        : { username: form.username, password: form.password };
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "认证失败");
      router.push("/dashboard/platform");
      router.refresh();
    } catch (e) {
      setError(e.message || "认证失败");
    } finally {
      setLoading(false);
    }
  };

  const handleOidcLogin = () => {
    window.location.href = "/api/auth/oidc/start";
  };

  const oidcAvailable = status?.oidcConfigured && ["oidc", "both"].includes(status?.authMode);
  const passwordAvailable = status?.authMode !== "oidc" || !status?.oidcConfigured;

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-4">
        <div className="text-center">
          <div className="inline-block size-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-4 text-text-muted">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg p-4">
      <div className="landing-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-1 text-3xl font-bold text-primary">能力集市</h1>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">API Capability Marketplace</p>
          <p className="text-sm text-text-muted">
            {mode === "register"
              ? bootstrapping ? "创建第一个管理员账号" : "注册普通用户账号"
              : "登录后使用模型服务平台"}
          </p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            {oidcAvailable && mode === "login" && (
              <Button type="button" variant="primary" className="w-full" onClick={handleOidcLogin}>
                {status.oidcLoginLabel || "Sign in with OIDC"}
              </Button>
            )}

            {oidcAvailable && passwordAvailable && mode === "login" && <div className="h-px bg-border/60" />}

            {passwordAvailable && (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-main">用户名</label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username"
                    required
                    autoFocus
                  />
                </div>

                {mode === "register" && (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-text-main">邮箱</label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="name@example.com"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium text-text-main">显示名称</label>
                      <Input
                        value={form.displayName}
                        onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                        placeholder="可选"
                      />
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-text-main">密码</label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={mode === "register" ? "至少 8 位" : "输入密码"}
                    required
                  />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </div>

                <Button type="submit" variant="primary" className="w-full" loading={loading}>
                  {mode === "register" ? "注册并进入" : "登录"}
                </Button>
              </form>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
              <span>{mode === "register" ? "已有账号？" : "没有账号？"}</span>
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  setError("");
                  setMode(mode === "register" ? "login" : "register");
                }}
              >
                {mode === "register" ? "去登录" : "立即注册"}
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
