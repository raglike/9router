import { describe, expect, it } from "vitest";
import {
  PRICING_BILLING_MODES,
  normalizePricing,
  calculateCostFromTokens,
  calculatePerCallCost,
} from "../../src/shared/constants/pricing.js";

describe("platform pricing normalization", () => {
  it("treats legacy pricing objects as token billing", () => {
    const pricing = normalizePricing({ input: 2.5, output: 10, cached: 1.25 });
    expect(pricing).toEqual({
      billingMode: PRICING_BILLING_MODES.TOKEN,
      input: 2.5,
      output: 10,
      cached: 1.25,
      reasoning: 0,
      cache_creation: 0,
    });
  });

  it("normalizes per-call pricing fields", () => {
    const pricing = normalizePricing({
      billingMode: PRICING_BILLING_MODES.PER_CALL,
      perCallPriceUsd: 0.6,
      perCallUnit: 3,
      perCallLabel: "次",
    });
    expect(pricing).toEqual({
      billingMode: PRICING_BILLING_MODES.PER_CALL,
      perCallPriceUsd: 0.6,
      perCallUnit: 3,
      perCallLabel: "次",
    });
  });
});

describe("platform pricing cost calculation", () => {
  it("keeps token-based cost calculation unchanged", () => {
    const cost = calculateCostFromTokens(
      {
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
      {
        input: 2,
        output: 8,
      },
    );
    expect(cost).toBeCloseTo(0.006);
  });

  it("ignores token calculation for per-call pricing", () => {
    const cost = calculateCostFromTokens(
      {
        prompt_tokens: 1000,
        completion_tokens: 500,
      },
      {
        billingMode: PRICING_BILLING_MODES.PER_CALL,
        perCallPriceUsd: 1.2,
        perCallUnit: 2,
      },
    );
    expect(cost).toBe(0);
  });

  it("calculates per-call cost by unit count", () => {
    const cost = calculatePerCallCost(
      {
        billingMode: PRICING_BILLING_MODES.PER_CALL,
        perCallPriceUsd: 1.2,
        perCallUnit: 2,
      },
      1,
    );
    expect(cost).toBeCloseTo(0.6);
  });
});
