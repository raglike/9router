import { NextResponse } from "next/server";
import { getPricing, updatePricing, resetPricing, resetAllPricing } from "@/lib/localDb.js";
import { getDefaultPricing, PRICING_BILLING_MODES, normalizePricing } from "@/shared/constants/pricing.js";
import { requirePlatformUser } from "@/lib/auth/platformSession.js";
import { PLATFORM_ROLES } from "@/lib/db/index.js";

/**
 * GET /api/pricing
 * Get current pricing configuration (merged user + defaults)
 */
export async function GET() {
  try {
    const { response } = await requirePlatformUser();
    if (response) return response;
    const pricing = await getPricing();
    return NextResponse.json(pricing);
  } catch (error) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch pricing" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/pricing
 * Update pricing configuration
 * Body: { provider: { model: { input: number, output: number, cached: number, ... } } }
 */
export async function PATCH(request) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const body = await request.json();

    // Validate body structure
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid pricing data format" },
        { status: 400 }
      );
    }

    // Validate pricing structure
    for (const [provider, models] of Object.entries(body)) {
      if (typeof models !== "object" || models === null) {
        return NextResponse.json(
          { error: `Invalid pricing for provider: ${provider}` },
          { status: 400 }
        );
      }

      for (const [model, pricing] of Object.entries(models)) {
        if (typeof pricing !== "object" || pricing === null) {
          return NextResponse.json(
            { error: `Invalid pricing for model: ${provider}/${model}` },
            { status: 400 }
          );
        }

        const mode = pricing.billingMode || PRICING_BILLING_MODES.TOKEN;
        if (![PRICING_BILLING_MODES.TOKEN, PRICING_BILLING_MODES.PER_CALL].includes(mode)) {
          return NextResponse.json(
            { error: `Invalid billingMode for ${provider}/${model}` },
            { status: 400 }
          );
        }

        if (mode === PRICING_BILLING_MODES.TOKEN) {
          const validFields = ["billingMode", "input", "output", "cached", "reasoning", "cache_creation"];
          for (const [key, value] of Object.entries(pricing)) {
            if (!validFields.includes(key)) {
              return NextResponse.json(
                { error: `Invalid pricing field: ${key} for ${provider}/${model}` },
                { status: 400 }
              );
            }
            if (key === "billingMode") continue;
            if (typeof value !== "number" || isNaN(value) || value < 0) {
              return NextResponse.json(
                { error: `Invalid pricing value for ${key} in ${provider}/${model}: must be non-negative number` },
                { status: 400 }
              );
            }
          }
        } else {
          const validFields = ["billingMode", "perCallPriceUsd", "perCallUnit", "perCallLabel"];
          for (const [key, value] of Object.entries(pricing)) {
            if (!validFields.includes(key)) {
              return NextResponse.json(
                { error: `Invalid pricing field: ${key} for ${provider}/${model}` },
                { status: 400 }
              );
            }
          }
          if (typeof pricing.perCallPriceUsd !== "number" || isNaN(pricing.perCallPriceUsd) || pricing.perCallPriceUsd < 0) {
            return NextResponse.json(
              { error: `Invalid perCallPriceUsd for ${provider}/${model}` },
              { status: 400 }
            );
          }
          if (!Number.isInteger(pricing.perCallUnit) || pricing.perCallUnit < 1) {
            return NextResponse.json(
              { error: `Invalid perCallUnit for ${provider}/${model}: must be a positive integer` },
              { status: 400 }
            );
          }
          if (pricing.perCallLabel !== undefined && typeof pricing.perCallLabel !== "string") {
            return NextResponse.json(
              { error: `Invalid perCallLabel for ${provider}/${model}` },
              { status: 400 }
            );
          }
        }
      }
    }

    const normalized = {};
    for (const [provider, models] of Object.entries(body)) {
      normalized[provider] = {};
      for (const [model, pricing] of Object.entries(models)) {
        normalized[provider][model] = normalizePricing(pricing);
      }
    }

    const updatedPricing = await updatePricing(normalized);
    return NextResponse.json(updatedPricing);
  } catch (error) {
    console.error("Error updating pricing:", error);
    return NextResponse.json(
      { error: "Failed to update pricing" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pricing
 * Reset pricing to defaults
 * Query params: ?provider=xxx&model=yyy (optional)
 */
export async function DELETE(request) {
  try {
    const { response } = await requirePlatformUser(PLATFORM_ROLES.ADMIN);
    if (response) return response;
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get("provider");
    const model = searchParams.get("model");

    if (provider && model) {
      // Reset specific model
      await resetPricing(provider, model);
    } else if (provider) {
      // Reset entire provider
      await resetPricing(provider);
    } else {
      // Reset all pricing
      await resetAllPricing();
    }

    const pricing = await getPricing();
    return NextResponse.json(pricing);
  } catch (error) {
    console.error("Error resetting pricing:", error);
    return NextResponse.json(
      { error: "Failed to reset pricing" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pricing/defaults
 * Get default pricing configuration
 */
export async function GET_DEFAULTS() {
  try {
    const defaultPricing = getDefaultPricing();
    return NextResponse.json(defaultPricing);
  } catch (error) {
    console.error("Error fetching default pricing:", error);
    return NextResponse.json(
      { error: "Failed to fetch default pricing" },
      { status: 500 }
    );
  }
}
