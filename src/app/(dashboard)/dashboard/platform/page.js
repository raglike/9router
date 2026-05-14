"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, SegmentedControl } from "@/shared/components";

const ADMIN_TABS = [
  { value: "catalog", label: "模型广场" },
  { value: "subscribers", label: "订阅管理" },
  { value: "ledger", label: "费用日志" },
];

const USER_TABS = [
  { value: "overview", label: "概览" },
  { value: "analytics", label: "数据看板" },
  { value: "keys", label: "API 密钥" },
  { value: "logs", label: "使用日志" },
  { value: "wallet", label: "钱包" },
  { value: "profile", label: "个人资料" },
  { value: "catalog", label: "模型广场" },
];

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 });
const PLATFORM_CREDIT_UNIT_USD = 0.001;

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "请求失败");
  return data;
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatMoney(cents = 0, currency = "CNY") {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format((cents || 0) / 100);
}

function formatUsd(value = 0) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(value || 0));
}

function creditsToUsd(credits, benchmark) {
  const usdPerCredit = Number(benchmark?.usdPerCredit || PLATFORM_CREDIT_UNIT_USD);
  return Number(credits || 0) * usdPerCredit;
}

function maskApiKey(key) {
  if (!key) return "-";
  if (key.length <= 14) return `${key.slice(0, 3)}******${key.slice(-3)}`;
  return `${key.slice(0, 10)}********${key.slice(-6)}`;
}

export default function PlatformPage() {
  return (
    <Suspense fallback={<div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-muted">Loading...</div>}>
      <PlatformPageContent />
    </Suspense>
  );
}

function PlatformPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState(null);
  const [overview, setOverview] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogMeta, setCatalogMeta] = useState(null);
  const [redemptions, setRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");

  const isAdmin = me?.user?.permissions?.platformAdmin === true;
  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;
  const requestedTab = searchParams.get("tab");
  const activeTab = tabs.some((item) => item.value === requestedTab) ? requestedTab : (isAdmin ? "catalog" : "overview");

  const changeTab = (tab) => {
    router.replace(`/dashboard/platform?tab=${encodeURIComponent(tab)}`, { scroll: false });
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const auth = await api("/api/auth/me");
      setMe(auth);

      const catalogReq = api("/api/platform/catalog");
      if (auth.user?.permissions?.platformAdmin) {
        const [overviewData, plansData, subscribersData, ledgerData, catalogData, redemptionData] = await Promise.all([
          api("/api/platform/overview"),
          api("/api/platform/plans"),
          api("/api/platform/subscribers"),
          api("/api/platform/ledger?limit=200"),
          catalogReq,
          api("/api/platform/redemptions").catch(() => ({ codes: [] })),
        ]);
        setOverview(overviewData);
        setPlans(plansData.plans || []);
        setSubscribers(subscribersData.subscribers || []);
        setLedger(ledgerData.ledger || []);
        setCatalog(catalogData.models || []);
        setCatalogMeta(catalogData.benchmark || null);
        setRedemptions(redemptionData.codes || []);
      } else {
        const [platformMe, catalogData] = await Promise.all([api("/api/platform/me"), catalogReq]);
        setOverview(platformMe.overview);
        setPlans(platformMe.plans || []);
        setSubscribers(platformMe.subscriber ? [platformMe.subscriber] : []);
        setLedger(platformMe.ledger || []);
        setCatalog(catalogData.models || []);
        setCatalogMeta(catalogData.benchmark || null);
        setRedemptions([]);
      }
    } catch (e) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const copyKey = async (key) => {
    await navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 1400);
  };

  const planOptions = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);
  const subscriber = subscribers[0] || null;

  return (
    <div className="flex min-w-0 flex-col gap-5 px-1 sm:px-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-main">模型服务平台</h1>
          <p className="text-sm text-text-muted">
            {isAdmin ? "订阅、积分、费用与模型访问统一管理" : "管理你的 API Key、钱包、用量与模型调用方式"}
          </p>
        </div>
        <Button variant="secondary" icon="refresh" onClick={load} loading={loading}>刷新</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <Overview overview={overview} subscriber={subscriber} isAdmin={isAdmin} />
      <SegmentedControl options={tabs} value={activeTab} onChange={changeTab} className="w-full sm:w-auto" />

      {activeTab === "overview" && (
        <>
          <UserOverview overview={overview} subscriber={subscriber} />
          <Analytics overview={overview} />
        </>
      )}
      {activeTab === "analytics" && <Analytics overview={overview} />}
      {activeTab === "keys" && <ApiKeys subscriber={subscriber} copiedKey={copiedKey} onCopyKey={copyKey} onReload={load} />}
      {activeTab === "logs" && <Ledger rows={ledger} compact />}
      {activeTab === "wallet" && <Wallet subscriber={subscriber} plans={plans} ledger={ledger} onReload={load} />}
      {activeTab === "profile" && <Profile key={`${me?.user?.id || "user"}-${me?.user?.updatedAt || ""}`} user={me?.user} onReload={load} />}
      {activeTab === "catalog" && <Catalog models={catalog} benchmark={catalogMeta} loading={loading} />}
      {activeTab === "subscribers" && (
        <Subscriptions
          plans={plans}
          planOptions={planOptions}
          subscribers={subscribers}
          redemptions={redemptions}
          onReload={load}
          onCopyKey={copyKey}
          copiedKey={copiedKey}
        />
      )}
      {activeTab === "ledger" && <Ledger rows={ledger} />}
    </div>
  );
}

function Overview({ overview, subscriber, isAdmin }) {
  const cards = isAdmin ? [
    { label: "活跃订阅", value: overview ? `${overview.subscribers.active}/${overview.subscribers.total}` : "-" },
    { label: "剩余积分", value: overview ? number.format(overview.subscribers.remainingCredits || 0) : "-" },
    { label: "已消耗积分", value: overview ? number.format(overview.usage.consumedCredits || 0) : "-" },
    { label: "模型成本", value: overview ? money.format(overview.usage.billedCost || 0) : "-" },
  ] : [
    { label: "当前余额", value: subscriber ? number.format(subscriber.creditBalance || 0) : "-" },
    { label: "订阅状态", value: subscriber?.status || "-" },
    { label: "请求数", value: overview ? number.format(overview.usage.requests || 0) : "-" },
    { label: "已消耗积分", value: overview ? number.format(overview.usage.consumedCredits || 0) : "-" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs font-medium text-text-muted">{card.label}</div>
          <div className="mt-2 text-2xl font-semibold text-text-main">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function UserOverview({ overview, subscriber }) {
  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">账户状态</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Metric label="订阅者" value={subscriber?.name || "-"} />
          <Metric label="套餐" value={subscriber?.planName || "未分配"} />
          <Metric label="积分余额" value={number.format(subscriber?.creditBalance || 0)} />
          <Metric label="周期结束" value={formatTime(subscriber?.periodEnd)} />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">调用摘要</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Metric label="请求数" value={number.format(overview?.usage?.requests || 0)} />
          <Metric label="输入 Token" value={number.format(overview?.usage?.promptTokens || 0)} />
          <Metric label="输出 Token" value={number.format(overview?.usage?.completionTokens || 0)} />
          <Metric label="估算成本" value={money.format(overview?.usage?.billedCost || 0)} />
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">模型使用方式</h2>
        <div className="mt-4 space-y-3 text-sm">
          <Metric label="Base URL" value="/v1" />
          <Metric label="鉴权方式" value="Authorization: Bearer <API Key>" />
          <Metric label="模型参数" value="provider/model_alias" />
          <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs leading-5 text-text-main">
{`curl /v1/chat/completions \\
  -H "Authorization: Bearer <API Key>" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'`}
          </pre>
        </div>
      </div>
    </section>
  );
}

function Analytics({ overview }) {
  const byModel = overview?.charts?.byModel || [];
  const daily = overview?.charts?.daily || [];
  const maxCredits = Math.max(...byModel.map((row) => row.credits), 1);

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">模型消耗</h2>
        <div className="mt-4 flex flex-col gap-3">
          {byModel.length ? byModel.map((row) => (
            <div key={row.model}>
              <div className="mb-1 flex justify-between gap-3 text-xs">
                <span className="truncate text-text-main">{row.model}</span>
                <span className="text-text-muted">{number.format(row.credits)} 积分</span>
              </div>
              <div className="h-2 rounded bg-surface-2">
                <div className="h-2 rounded bg-primary" style={{ width: `${Math.max(4, (row.credits / maxCredits) * 100)}%` }} />
              </div>
            </div>
          )) : <Empty text="暂无模型消耗数据" />}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">近期趋势</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-left text-xs text-text-muted">
              <tr><th className="py-2">日期</th><th>请求</th><th>积分</th><th>成本</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {daily.length ? daily.map((row) => (
                <tr key={row.date}>
                  <td className="py-2 text-text-main">{row.date}</td>
                  <td className="text-text-muted">{number.format(row.requests)}</td>
                  <td className="text-text-muted">{number.format(row.credits)}</td>
                  <td className="text-text-muted">{money.format(row.cost || 0)}</td>
                </tr>
              )) : <tr><td colSpan={4}><Empty text="暂无趋势数据" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function ApiKeys({ subscriber, copiedKey, onCopyKey, onReload }) {
  const [creating, setCreating] = useState(false);

  const createKey = async () => {
    if (!subscriber) return;
    setCreating(true);
    try {
      await api(`/api/platform/subscribers/${subscriber.id}`, {
        method: "POST",
        body: JSON.stringify({ name: `${subscriber.name} API Key` }),
      });
      await onReload();
    } finally {
      setCreating(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-text-main">API 密钥</h2>
        <Button size="sm" icon="add" onClick={createKey} loading={creating}>新建 Key</Button>
      </div>
      <div className="p-4">
        {subscriber?.apiKeys?.length ? (
          <div className="flex flex-col gap-2">
            {subscriber.apiKeys.map((key) => (
              <button key={key.id} title="点击复制完整 API Key" onClick={() => onCopyKey(key.key)} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-left">
                <span className="truncate font-mono text-xs text-text-main">{copiedKey === key.key ? "已复制" : maskApiKey(key.key)}</span>
                <span className="material-symbols-outlined text-[18px] text-text-muted">content_copy</span>
              </button>
            ))}
          </div>
        ) : <Empty text="暂无 API Key" />}
      </div>
    </section>
  );
}

function Wallet({ subscriber, plans, ledger, onReload }) {
  const [redeemCode, setRedeemCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const buy = async () => {
    try {
      await api("/api/platform/payments/orders", { method: "POST", body: JSON.stringify({}) });
    } catch (e) {
      alert(e.message);
    }
  };

  const redeem = async () => {
    if (!redeemCode.trim()) return;
    setRedeeming(true);
    try {
      await api("/api/platform/redemptions/redeem", { method: "POST", body: JSON.stringify({ code: redeemCode }) });
      setRedeemCode("");
      await onReload();
    } catch (e) {
      alert(e.message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">钱包</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="余额" value={`${number.format(subscriber?.creditBalance || 0)} 积分`} />
          <Metric label="状态" value={subscriber?.status || "-"} />
          <Metric label="支付方式" value="手动发放 / 支付预留" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="兑换码"
            className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-main outline-none focus:border-brand-500"
          />
          <Button variant="secondary" icon="redeem" onClick={redeem} loading={redeeming}>兑换积分</Button>
        </div>
        <Button className="mt-4" variant="secondary" icon="payments" onClick={buy}>在线支付入口</Button>
      </section>
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-base font-semibold text-text-main">可选套餐</h2>
        <div className="mt-4 flex flex-col gap-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="font-semibold text-text-main">{plan.name}</div>
              <div className="text-sm text-text-muted">{formatMoney(plan.priceCents, plan.currency)} / 月</div>
              <div className="mt-2 text-xs text-text-muted">{number.format(plan.monthlyCredits)} 积分</div>
            </div>
          ))}
        </div>
      </section>
      <Ledger rows={ledger} compact />
    </div>
  );
}

function Profile({ user, onReload }) {
  const [form, setForm] = useState({ displayName: user?.displayName || "", email: user?.email || "", password: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/auth/me", { method: "PATCH", body: JSON.stringify(form) });
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-xl rounded-lg border border-border bg-surface p-4">
      <h2 className="text-base font-semibold text-text-main">个人资料</h2>
      <Field label="显示名称" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
      <Field label="邮箱" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <Field label="新密码" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="留空则不修改" />
      <Button type="submit" loading={saving}>保存资料</Button>
    </form>
  );
}

function Catalog({ models, benchmark, loading }) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("");
  const [type, setType] = useState("");
  const [priceUnit, setPriceUnit] = useState("credits");
  const [selected, setSelected] = useState(null);

  const providers = useMemo(() => [...new Set(models.map((model) => model.provider))].sort(), [models]);
  const types = useMemo(() => [...new Set(models.map((model) => model.type || "llm"))].sort(), [models]);
  const filtered = models.filter((model) => {
    const text = `${model.providerName} ${model.model} ${model.alias} ${model.description || ""}`.toLowerCase();
    return (!query || text.includes(query.trim().toLowerCase()))
      && (!provider || model.provider === provider)
      && (!type || model.type === type);
  });

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="grid gap-3 border-b border-border px-4 py-3 lg:grid-cols-[1fr_180px_160px_150px]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索模型、供应商或说明" className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-main outline-none focus:border-brand-500" />
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-main">
          <option value="">全部供应商</option>
          {providers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-main">
          <option value="">全部类型</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <SegmentedControl
          options={[{ value: "credits", label: "积分" }, { value: "usd", label: "美元" }]}
          value={priceUnit}
          onChange={setPriceUnit}
          className="h-9"
        />
      </div>
      {benchmark && (
        <div className="border-b border-border px-4 py-2 text-xs text-text-muted">
          GPT 基准比价：1 平台积分约等于 {formatUsd(benchmark.usdPerCredit)}，基于 {benchmark.sampleSize} 个 {benchmark.basedOn === "gpt" ? "GPT" : "可对比"} 模型样本。
        </div>
      )}
      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? <Empty text="加载中..." /> : filtered.slice(0, 240).map((model) => (
          <button key={model.id} onClick={() => setSelected(model)} className="rounded-lg border border-border bg-surface-2 p-4 text-left transition hover:border-primary/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-text-main">{model.displayName}</div>
                <div className="text-xs text-text-muted">{model.providerName}</div>
              </div>
              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">{model.type}</span>
            </div>
            <p className="mt-3 line-clamp-2 min-h-[40px] text-sm text-text-muted">{model.description || "暂无模型说明"}</p>
            <div className="mt-3 font-mono text-xs text-text-main">{model.provider}/{model.alias}</div>
            <CompactPricing pricing={model.pricing} comparison={model.comparison} benchmark={benchmark} unit={priceUnit} />
          </button>
        ))}
        {!loading && filtered.length === 0 && <Empty text="暂无匹配模型" />}
      </div>
      {selected && <ModelDetail model={selected} benchmark={benchmark} priceUnit={priceUnit} onClose={() => setSelected(null)} />}
    </section>
  );
}

function ModelDetail({ model, benchmark, priceUnit, onClose }) {
  const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/v1` : "http://localhost:20128/v1";
  const curl = `curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer <你的 API Key>" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${model.provider}/${model.alias}","messages":[{"role":"user","content":"Hello"}]}'`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-bg p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-text-main">{model.displayName}</h2>
            <p className="text-sm text-text-muted">{model.providerName} · {model.type}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-text-muted hover:bg-surface-2">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <InfoBlock title="模型说明">{model.description || "暂无模型说明"}</InfoBlock>
          <InfoBlock title="调用参数">
            <div className="space-y-1 font-mono text-xs">
              <div>Base URL: {baseUrl}</div>
              <div>Model: {model.provider}/{model.alias}</div>
              <div>Authorization: Bearer &lt;API Key&gt;</div>
            </div>
          </InfoBlock>
          <PricingPanel pricing={model.pricing} comparison={model.comparison} benchmark={benchmark} unit={priceUnit} />
          <InfoBlock title="curl 示例">
            <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs text-text-main">{curl}</pre>
          </InfoBlock>
        </div>
      </aside>
    </div>
  );
}

function PriceValue({ value, compact = false, unit = "credits", benchmark = null }) {
  const credits = Number(value || 0);
  const displayValue = unit === "usd" ? formatUsd(creditsToUsd(credits, benchmark)) : number.format(credits);
  const valueClass = compact
    ? "font-mono text-lg font-bold tabular-nums leading-none text-text-main"
    : "font-mono text-base font-semibold tabular-nums leading-none text-text-main";
  if (unit === "usd") {
    return (
      <span className="inline-flex items-baseline gap-1 whitespace-nowrap leading-none">
        <span className={valueClass}>{displayValue}</span>
        <span className="text-[11px] font-semibold text-text-muted">/ 1M</span>
      </span>
    );
  }
  if (unit === "credits") {
    return (
      <span className="inline-flex items-baseline gap-1 whitespace-nowrap leading-none">
        <span className="text-[11px] font-semibold text-text-muted">积分</span>
        <span className={valueClass}>{displayValue}</span>
        <span className="text-[11px] font-semibold text-text-muted">/ 1M</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap leading-none">
      <span className="text-[11px] font-semibold text-text-muted">积分</span>
      <span className={valueClass}>{number.format(Number(value || 0))}</span>
      <span className="text-[11px] font-semibold text-text-muted">/ 1M</span>
    </span>
  );
}

function ComparisonBadge({ comparison, unit = "credits" }) {
  if (!comparison?.pricing) return null;
  const input = unit === "usd" ? formatUsd(comparison.usd?.input || 0) : `${number.format(comparison.pricing.input || 0)} 积分`;
  const output = unit === "usd" ? formatUsd(comparison.usd?.output || 0) : `${number.format(comparison.pricing.output || 0)} 积分`;
  const ratio = comparison.ratio ? `平台约 ${comparison.ratio}x` : "可对比";
  return (
    <div className="col-span-2 mt-2 rounded-md border border-primary/20 bg-primary/5 px-2 py-1.5 text-[11px] leading-5 text-text-muted">
      <span className="font-semibold text-primary">OpenRouter</span>
      <span className="ml-1">{ratio}</span>
      <div>入 {input} / 出 {output}</div>
    </div>
  );
}

function CompactPricing({ pricing, comparison, benchmark = null, unit = "credits" }) {
  if (!pricing) return <div className="mt-3 text-xs text-text-muted">暂无价格</div>;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="mb-1 text-[11px] font-medium text-text-muted">输入</div>
        <PriceValue value={pricing.input} compact unit={unit} benchmark={benchmark} />
      </div>
      <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="mb-1 text-[11px] font-medium text-text-muted">输出</div>
        <PriceValue value={pricing.output} compact unit={unit} benchmark={benchmark} />
      </div>
      <ComparisonBadge comparison={comparison} unit={unit} />
    </div>
  );
}

function PricingPanel({ pricing, comparison, benchmark = null, unit = "credits" }) {
  if (!pricing) {
    return (
      <InfoBlock title="定价">
        <div className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-text-muted">暂无价格</div>
      </InfoBlock>
    );
  }

  const groupRows = [
    { group: "default", ratio: "1x", input: pricing.input, output: pricing.output, cached: pricing.cached, cacheCreation: pricing.cache_creation },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text-main">定价</h3>
      <div className="mt-4 text-sm font-semibold text-text-muted">基础价格</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="mb-1 text-xs text-text-muted">输入</div>
          <PriceValue value={pricing.input} unit={unit} benchmark={benchmark} />
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="mb-1 text-xs text-text-muted">输出</div>
          <PriceValue value={pricing.output} unit={unit} benchmark={benchmark} />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-border bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm text-text-muted">缓存输入</span>
          <PriceValue value={pricing.cached ?? pricing.input} unit={unit} benchmark={benchmark} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 py-1">
          <span className="text-sm text-text-muted">缓存写入</span>
          <PriceValue value={pricing.cache_creation ?? pricing.input} unit={unit} benchmark={benchmark} />
        </div>
        {pricing.reasoning !== undefined && (
          <div className="mt-2 flex items-center justify-between gap-3 py-1">
            <span className="text-sm text-text-muted">推理输出</span>
            <PriceValue value={pricing.reasoning} unit={unit} benchmark={benchmark} />
          </div>
        )}
      </div>

      <div className="mt-5 text-sm font-semibold text-text-muted">按分组定价</div>
      <div className="mt-2 text-xs text-text-muted">自动分组链 → <span className="font-semibold text-primary">default</span></div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-text-muted">
            <tr>
              <th className="px-2 py-2">分组</th>
              <th className="px-2 py-2">倍率</th>
              <th className="px-2 py-2">输入</th>
              <th className="px-2 py-2">输出</th>
              <th className="px-2 py-2">缓存</th>
              <th className="px-2 py-2">缓存写入</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groupRows.map((row) => (
              <tr key={row.group}>
                <td className="px-2 py-3 font-semibold text-primary">• {row.group}</td>
                <td className="px-2 py-3 text-text-muted">{row.ratio}</td>
                <td className="px-2 py-3"><PriceValue value={row.input} unit={unit} benchmark={benchmark} /></td>
                <td className="px-2 py-3"><PriceValue value={row.output} unit={unit} benchmark={benchmark} /></td>
                <td className="px-2 py-3"><PriceValue value={row.cached ?? row.input} unit={unit} benchmark={benchmark} /></td>
                <td className="px-2 py-3"><PriceValue value={row.cacheCreation ?? row.input} unit={unit} benchmark={benchmark} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-xs text-text-muted">价格显示单位为 1M tokens，默认按平台积分展示，可切换为美元估算。</div>
      <ComparisonBadge comparison={comparison} unit={unit} />
    </div>
  );
}

function Subscriptions({ plans, planOptions, subscribers, redemptions, onReload, onCopyKey, copiedKey }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-5">
        <RedemptionCodePanel codes={redemptions} onSaved={onReload} />
        <PlanForm onSaved={onReload} />
        <SubscriberForm plans={planOptions} onSaved={onReload} />
      </div>
      <div className="flex flex-col gap-5">
        <PlanList plans={plans} onReload={onReload} />
        <SubscriberList subscribers={subscribers} plans={planOptions} onReload={onReload} onCopyKey={onCopyKey} copiedKey={copiedKey} />
      </div>
    </div>
  );
}

function RedemptionCodePanel({ codes, onSaved }) {
  const [form, setForm] = useState({ credits: 1000, maxRedemptions: 1, expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api("/api/platform/redemptions", {
        method: "POST",
        body: JSON.stringify({
          credits: Number(form.credits),
          maxRedemptions: Number(form.maxRedemptions),
          expiresAt: form.expiresAt || null,
        }),
      });
      if (res.code?.code) {
        await navigator.clipboard.writeText(res.code.code);
        setCopied(res.code.code);
      }
      setForm({ credits: 1000, maxRedemptions: 1, expiresAt: "" });
      await onSaved();
    } finally {
      setSaving(false);
      setTimeout(() => setCopied(""), 1400);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-base font-semibold text-text-main">兑换码</h2>
      <form onSubmit={submit} className="space-y-3">
        <Field label="积分" type="number" value={form.credits} onChange={(v) => setForm({ ...form, credits: Number(v) })} />
        <Field label="可兑换次数" type="number" value={form.maxRedemptions} onChange={(v) => setForm({ ...form, maxRedemptions: Number(v) })} />
        <Field label="过期时间" type="datetime-local" value={form.expiresAt} onChange={(v) => setForm({ ...form, expiresAt: v })} />
        <Button type="submit" fullWidth loading={saving}>{copied ? "已复制兑换码" : "生成兑换码"}</Button>
      </form>
      <div className="mt-4 flex max-h-[240px] flex-col gap-2 overflow-y-auto">
        {(codes || []).map((code) => (
          <div key={code.id} className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
            <div className="font-mono text-text-main">{code.maskedCode}</div>
            <div className="mt-1 text-xs text-text-muted">
              {number.format(code.credits)} 积分 / {code.redeemedCount}/{code.maxRedemptions}
            </div>
          </div>
        ))}
        {!(codes || []).length && <Empty text="暂无兑换码" />}
      </div>
    </section>
  );
}

function PlanForm({ onSaved }) {
  const [form, setForm] = useState({ name: "", priceCents: 1900, currency: "CNY", monthlyCredits: 20000, maxRequestsPerDay: 1000 });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/platform/plans", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", priceCents: 1900, currency: "CNY", monthlyCredits: 20000, maxRequestsPerDay: 1000 });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-base font-semibold text-text-main">新增套餐</h2>
      <Field label="名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
      <Field label="价格（分）" type="number" value={form.priceCents} onChange={(v) => setForm({ ...form, priceCents: Number(v), currency: "CNY" })} />
      <Field label="月积分" type="number" value={form.monthlyCredits} onChange={(v) => setForm({ ...form, monthlyCredits: Number(v) })} />
      <Field label="日请求上限" type="number" value={form.maxRequestsPerDay} onChange={(v) => setForm({ ...form, maxRequestsPerDay: Number(v) })} />
      <Button type="submit" fullWidth loading={saving}>保存套餐</Button>
    </form>
  );
}

function SubscriberForm({ plans, onSaved }) {
  const [form, setForm] = useState({ name: "", email: "", planId: "", creditBalance: "", createApiKey: true });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/platform/subscribers", {
        method: "POST",
        body: JSON.stringify({ ...form, creditBalance: form.creditBalance === "" ? undefined : Number(form.creditBalance) }),
      });
      setForm({ name: "", email: "", planId: "", creditBalance: "", createApiKey: true });
      await onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-4 text-base font-semibold text-text-main">新增订阅者</h2>
      <Field label="名称" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
      <Field label="邮箱" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <label className="mb-3 block">
        <span className="mb-1 block text-xs font-medium text-text-muted">套餐</span>
        <select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })} className="h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-main">
          <option value="">不绑定套餐</option>
          {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
        </select>
      </label>
      <Field label="初始积分（可空）" type="number" value={form.creditBalance} onChange={(v) => setForm({ ...form, creditBalance: v })} />
      <Button type="submit" fullWidth loading={saving}>创建订阅者</Button>
    </form>
  );
}

function PlanList({ plans, onReload }) {
  const toggle = async (plan) => {
    await api(`/api/platform/plans/${plan.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !plan.isActive }) });
    await onReload();
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3"><h2 className="text-base font-semibold text-text-main">套餐</h2></div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border border-border bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div><div className="font-semibold text-text-main">{plan.name}</div><div className="text-sm text-text-muted">{formatMoney(plan.priceCents, plan.currency)} / 月</div></div>
              <button onClick={() => toggle(plan)} className="rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">{plan.isActive ? "启用" : "停用"}</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="月积分" value={number.format(plan.monthlyCredits)} />
              <Metric label="日上限" value={plan.maxRequestsPerDay ? number.format(plan.maxRequestsPerDay) : "不限"} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SubscriberList({ subscribers, plans, onReload, onCopyKey, copiedKey }) {
  const adjustCredits = async (subscriber, amount) => {
    await api(`/api/platform/subscribers/${subscriber.id}/credits`, {
      method: "POST",
      body: JSON.stringify({ amount, description: amount > 0 ? "手动加积分" : "手动扣积分" }),
    });
    await onReload();
  };

  const createKey = async (subscriber) => {
    await api(`/api/platform/subscribers/${subscriber.id}`, { method: "POST", body: JSON.stringify({ name: `${subscriber.name} API Key` }) });
    await onReload();
  };

  const updatePlan = async (subscriber, planId) => {
    await api(`/api/platform/subscribers/${subscriber.id}`, { method: "PATCH", body: JSON.stringify({ planId }) });
    await onReload();
  };

  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3"><h2 className="text-base font-semibold text-text-main">订阅者</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-text-muted">
            <tr><th className="px-4 py-3">订阅者</th><th className="px-4 py-3">套餐</th><th className="px-4 py-3">积分</th><th className="px-4 py-3">周期结束</th><th className="px-4 py-3">API Key</th><th className="px-4 py-3">操作</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id} className="hover:bg-surface-2/60">
                <td className="px-4 py-3"><div className="font-medium text-text-main">{subscriber.name}</div><div className="text-xs text-text-muted">{subscriber.email || "-"}</div></td>
                <td className="px-4 py-3">
                  <select value={subscriber.planId || ""} onChange={(e) => updatePlan(subscriber, e.target.value || null)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text-main">
                    <option value="">无</option>
                    {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 font-semibold text-text-main">{number.format(subscriber.creditBalance)}</td>
                <td className="px-4 py-3 text-text-muted">{formatTime(subscriber.periodEnd)}</td>
                <td className="px-4 py-3">
                  <div className="flex max-w-[260px] flex-col gap-1">
                    {subscriber.apiKeys.length ? subscriber.apiKeys.map((key) => (
                      <button key={key.id} title="点击复制完整 API Key" onClick={() => onCopyKey(key.key)} className="truncate rounded-md bg-surface-2 px-2 py-1 text-left font-mono text-xs text-text-main hover:bg-primary/10">
                        {copiedKey === key.key ? "已复制" : maskApiKey(key.key)}
                      </button>
                    )) : <span className="text-text-muted">-</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => adjustCredits(subscriber, 1000)}>+1000</Button>
                    <Button size="sm" variant="secondary" onClick={() => adjustCredits(subscriber, -1000)}>-1000</Button>
                    <Button size="sm" variant="outline" onClick={() => createKey(subscriber)}>新 Key</Button>
                  </div>
                </td>
              </tr>
            ))}
            {!subscribers.length && <tr><td className="px-4 py-8 text-center text-text-muted" colSpan={6}>暂无订阅者</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Ledger({ rows, compact = false }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3"><h2 className="text-base font-semibold text-text-main">{compact ? "近期使用日志" : "费用日志"}</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-2 text-left text-xs uppercase text-text-muted">
            <tr><th className="px-4 py-3">时间</th><th className="px-4 py-3">订阅者</th><th className="px-4 py-3">类型</th><th className="px-4 py-3">积分变化</th><th className="px-4 py-3">余额</th><th className="px-4 py-3">成本</th><th className="px-4 py-3">模型</th><th className="px-4 py-3">Token</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-surface-2/60">
                <td className="px-4 py-3 text-text-muted">{formatTime(row.createdAt)}</td>
                <td className="px-4 py-3 text-text-main">{row.subscriberName || row.subscriberId}</td>
                <td className="px-4 py-3 text-text-muted">{row.type}</td>
                <td className={`px-4 py-3 font-semibold ${row.amount < 0 ? "text-red-500" : "text-green-600"}`}>{number.format(row.amount)}</td>
                <td className="px-4 py-3 text-text-main">{number.format(row.balanceAfter)}</td>
                <td className="px-4 py-3 text-text-muted">{money.format(row.cost || 0)}</td>
                <td className="px-4 py-3 text-text-muted">{row.provider ? `${row.provider}/${row.model}` : "-"}</td>
                <td className="px-4 py-3 text-text-muted">{number.format((row.promptTokens || 0) + (row.completionTokens || 0))}</td>
              </tr>
            ))}
            {!rows.length && <tr><td className="px-4 py-8 text-center text-text-muted" colSpan={8}>暂无费用日志</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", required = false, placeholder = "" }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>
      <input type={type} required={required} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-main outline-none focus:border-brand-500" />
    </label>
  );
}

function Metric({ label, value }) {
  return <div><div className="text-xs text-text-muted">{label}</div><div className="font-semibold text-text-main">{value}</div></div>;
}

function InfoBlock({ title, children }) {
  return <div><h3 className="mb-2 text-sm font-semibold text-text-main">{title}</h3><div className="text-sm text-text-muted">{children}</div></div>;
}

function Empty({ text }) {
  return <div className="py-8 text-center text-sm text-text-muted">{text}</div>;
}
