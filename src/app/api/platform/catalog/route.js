import { NextResponse } from "next/server";
import { getDisabledModels, getModelAliases, getPricingForModel, getProviderNodes } from "@/lib/db/index.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";
import { AI_MODELS } from "@/shared/constants/config";
import { AI_PROVIDERS, getProviderAlias } from "@/shared/constants/providers";
import { PRICING_BILLING_MODES } from "@/shared/constants/pricing.js";

export const dynamic = "force-dynamic";

const CREDIT_UNIT_USD = 1;
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_CACHE_TTL = 10 * 60 * 1000;

if (!globalThis.__platformOpenRouterCache) {
  globalThis.__platformOpenRouterCache = { expiresAt: 0, models: new Map() };
}

function normalizeModelName(value) {
  return String(value || "").toLowerCase().replace(/^openai\//, "").replace(/[^a-z0-9]+/g, "");
}

function toPerMillionCredits(perTokenUsd) {
  const usd = Number(perTokenUsd || 0) * 1_000_000;
  return usd > 0 ? Number((usd / CREDIT_UNIT_USD).toFixed(6)) : 0;
}

function toCreditsFromUsd(usd) {
  const value = Number(usd || 0);
  return value > 0 ? Number((value / CREDIT_UNIT_USD).toFixed(6)) : 0;
}

function perMillionUsdToCredits(perMillionUsd) {
  const value = Number(perMillionUsd || 0);
  return value > 0 ? Number((value / CREDIT_UNIT_USD).toFixed(6)) : 0;
}

async function getOpenRouterPriceMap() {
  const cache = globalThis.__platformOpenRouterCache;
  if (cache.expiresAt > Date.now()) return cache.models;
  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const payload = await res.json();
    const map = new Map();
    for (const item of payload?.data || []) {
      const pricing = item.pricing || {};
      const input = toPerMillionCredits(pricing.prompt);
      const output = toPerMillionCredits(pricing.completion);
      if (!input && !output) continue;
      const value = {
        id: item.id,
        name: item.name || item.id,
        pricing: { input, output },
        usd: {
          input: Number(pricing.prompt || 0) * 1_000_000,
          output: Number(pricing.completion || 0) * 1_000_000,
        },
      };
      map.set(normalizeModelName(item.id), value);
    }
    cache.models = map;
    cache.expiresAt = Date.now() + OPENROUTER_CACHE_TTL;
  } catch (error) {
    console.warn("[platform/catalog] OpenRouter pricing unavailable:", error.message);
    cache.expiresAt = Date.now() + 60 * 1000;
  }
  return cache.models;
}

function findOpenRouterPrice(map, provider, model) {
  const candidates = [
    `${provider}/${model}`,
    model,
    `openai/${model}`,
  ].map(normalizeModelName);
  for (const key of candidates) {
    if (map.has(key)) return map.get(key);
  }
  return null;
}

function ratioOf(platformValue, openRouterValue) {
  const platform = Number(platformValue || 0);
  const openRouter = Number(openRouterValue || 0);
  if (!platform || !openRouter) return null;
  return Number((platform / openRouter).toFixed(4));
}

function buildPriceComparison(item, pricing, openRouter) {
  if (!pricing || pricing.billingMode === PRICING_BILLING_MODES.PER_CALL || !openRouter?.pricing) return null;
  const inputRatio = ratioOf(pricing.input, openRouter.pricing.input);
  const outputRatio = ratioOf(pricing.output, openRouter.pricing.output);
  const ratios = [inputRatio, outputRatio].filter((value) => Number.isFinite(value));
  const ratio = ratios.length ? Number((ratios.reduce((sum, value) => sum + value, 0) / ratios.length).toFixed(4)) : null;
  return {
    provider: "OpenRouter",
    modelId: openRouter.id,
    pricing: openRouter.pricing,
    usd: openRouter.usd,
    ratio,
  };
}

function toCatalogPricing(pricing) {
  if (!pricing) return null;
  if (pricing.billingMode === PRICING_BILLING_MODES.PER_CALL) {
    return {
      billingMode: PRICING_BILLING_MODES.PER_CALL,
      perCallPriceUsd: Number(pricing.perCallPriceUsd || 0),
      perCallUnit: Number(pricing.perCallUnit || 1),
      perCallLabel: pricing.perCallLabel || "次",
      perCallCredits: toCreditsFromUsd(pricing.perCallPriceUsd || 0),
    };
  }
  return {
    billingMode: PRICING_BILLING_MODES.TOKEN,
    input: Number(pricing.input || 0),
    output: Number(pricing.output || 0),
    cached: Number(pricing.cached || 0),
    reasoning: Number(pricing.reasoning || 0),
    cache_creation: Number(pricing.cache_creation || 0),
    credits: {
      input: perMillionUsdToCredits(pricing.input),
      output: perMillionUsdToCredits(pricing.output),
      cached: perMillionUsdToCredits(pricing.cached),
      reasoning: perMillionUsdToCredits(pricing.reasoning),
      cache_creation: perMillionUsdToCredits(pricing.cache_creation),
    },
  };
}

export async function GET(request) {
  try {
    const { response } = await requirePlatformUser();
    if (response) return response;
    const { searchParams } = new URL(request.url);
    const q = String(searchParams.get("q") || "").trim().toLowerCase();
    const providerFilter = String(searchParams.get("provider") || "").trim();
    const typeFilter = String(searchParams.get("type") || "").trim();
    const priceMax = searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : null;
    const [aliases, disabled, nodes, openRouterPrices] = await Promise.all([
      getModelAliases(),
      getDisabledModels(),
      getProviderNodes(),
      getOpenRouterPriceMap(),
    ]);

    const nodeMap = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const models = [];

    for (const item of AI_MODELS) {
      if (providerFilter && item.provider !== providerFilter) continue;
      const alias = getProviderAlias(item.provider) || item.provider;
      const disabledList = disabled[alias] || disabled[item.provider] || [];
      if (disabledList.includes(item.model)) continue;

      const fullModel = `${item.provider}/${item.model}`;
      const modelType = item.type || "llm";
      const pricing = await getPricingForModel(item.provider, item.model);
      const openRouter = findOpenRouterPrice(openRouterPrices, item.provider, item.model);
      if (priceMax !== null && pricing?.billingMode !== PRICING_BILLING_MODES.PER_CALL && Number(pricing?.output || 0) > priceMax) continue;
      const provider = AI_PROVIDERS[item.provider] || nodeMap[item.provider] || {};
      const row = {
        id: `${fullModel}:${modelType}`,
        provider: item.provider,
        providerName: provider.name || item.provider,
        model: item.model,
        alias: aliases[fullModel] || item.model,
        displayName: item.name || aliases[fullModel] || item.model,
        type: modelType,
        tags: item.tags || [],
        context: item.context || item.contextWindow || null,
        description: item.description || provider.notice?.text || "",
        pricing: toCatalogPricing(pricing),
        comparison: buildPriceComparison(item, pricing, openRouter),
      };
      if (typeFilter && row.type !== typeFilter) continue;
      if (q) {
        const text = `${row.providerName} ${row.model} ${row.alias} ${row.displayName} ${row.description}`.toLowerCase();
        if (!text.includes(q)) continue;
      }
      models.push(row);
    }

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Error fetching platform catalog:", error);
    return NextResponse.json({ error: "Failed to fetch platform catalog" }, { status: 500 });
  }
}
