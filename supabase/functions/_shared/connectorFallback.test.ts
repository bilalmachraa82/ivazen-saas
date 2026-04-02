import { describe, expect, it } from "vitest";
import {
  shouldPreferFallbackResponse,
  shouldRetryWithCredentialFallback,
  type ConnectorResponse,
} from "./connectorFallback";

function successEmpty(): ConnectorResponse {
  return {
    success: true,
    vendas: {
      success: true,
      totalRecords: 0,
      invoices: [],
    },
  };
}

describe("connectorFallback", () => {
  it("retries fallback for vendas schema faults when fallback username is WFA", () => {
    const primary: ConnectorResponse = {
      success: true,
      vendas: {
        success: false,
        totalRecords: 0,
        errorMessage:
          "particle 2.1: found <TaxPayable> but next item should be LineSummary",
      },
    };

    expect(
      shouldRetryWithCredentialFallback(
        primary,
        "ambos",
        "123456789",
        "123456789/1",
      ),
    ).toBe(true);
  });

  it("retries fallback for connector-level unknown failures", () => {
    const primary: ConnectorResponse = {
      success: false,
      error: "AT connector request failed",
    };

    expect(
      shouldRetryWithCredentialFallback(
        primary,
        "ambos",
        "123456789",
        "123456789/9",
      ),
    ).toBe(true);
  });

  it("does not retry fallback when the primary username is already WFA", () => {
    expect(
      shouldRetryWithCredentialFallback(
        successEmpty(),
        "ambos",
        "123456789/2",
        "123456789/9",
      ),
    ).toBe(false);
  });

  it("prefers a valid empty fallback over a schema-fault primary response", () => {
    const primary: ConnectorResponse = {
      success: true,
      compras: {
        success: true,
        totalRecords: 10,
        invoices: [],
      },
      vendas: {
        success: false,
        totalRecords: 0,
        errorMessage:
          "particle 2.1: found <TaxPayable> but next item should be LineSummary",
      },
    };

    expect(shouldPreferFallbackResponse(primary, successEmpty(), "ambos")).toBe(
      true,
    );
  });

  it("does not prefer fallback when fallback still has auth failure", () => {
    const primary: ConnectorResponse = {
      success: false,
      error: "AT connector request failed",
    };
    const fallback: ConnectorResponse = {
      success: true,
      compras: {
        success: false,
        totalRecords: 0,
        errorMessage: "Ocorreu um erro na autenticacao dos contribuintes.",
      },
      vendas: {
        success: false,
        totalRecords: 0,
        errorMessage: "Ocorreu um erro na autenticacao dos contribuintes.",
      },
    };

    expect(shouldPreferFallbackResponse(primary, fallback, "ambos")).toBe(
      false,
    );
  });

  it("does not replace a healthy primary response with an unnecessary fallback", () => {
    const primary: ConnectorResponse = {
      success: true,
      compras: {
        success: true,
        totalRecords: 5,
        invoices: [],
      },
      vendas: {
        success: true,
        totalRecords: 12,
        invoices: [],
      },
    };

    expect(shouldPreferFallbackResponse(primary, successEmpty(), "ambos")).toBe(
      false,
    );
  });
});
