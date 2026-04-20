import { assertEquals } from "jsr:@std/assert";

import { partitionPortalFallbackRecords } from "./index.ts";

Deno.test("partitionPortalFallbackRecords keeps only recibo-verde document types", () => {
  const result = partitionPortalFallbackRecords([
    {
      documentNumber: "FR 1",
      documentType: "FR",
      documentDate: "2026-03-01",
      customerNif: "123456789",
      customerName: "Cliente FR",
      grossTotal: 100,
      taxPayable: 23,
      netTotal: 77,
      status: "validated",
      atcud: "ATCUD-FR",
    },
    {
      documentNumber: "FT 1",
      documentType: "FT",
      documentDate: "2026-03-02",
      customerNif: "123456789",
      customerName: "Cliente FT",
      grossTotal: 200,
      taxPayable: 46,
      netTotal: 154,
      status: "validated",
      atcud: "ATCUD-FT",
    },
    {
      documentNumber: "FS/FR 1",
      documentType: "FS/FR",
      documentDate: "2026-03-03",
      customerNif: "123456789",
      customerName: "Cliente FSFR",
      grossTotal: 300,
      taxPayable: 69,
      netTotal: 231,
      status: "validated",
      atcud: "ATCUD-FSFR",
    },
    {
      documentNumber: "ND 1",
      documentType: "ND",
      documentDate: "2026-03-04",
      customerNif: "123456789",
      customerName: "Cliente ND",
      grossTotal: 50,
      taxPayable: 0,
      netTotal: 50,
      status: "validated",
      atcud: "ATCUD-ND",
    },
  ]);

  assertEquals(
    result.acceptedRecords.map((record) => record.documentNumber),
    ["FR 1", "FS/FR 1"],
  );
  assertEquals(result.rejectedCount, 2);
  assertEquals(result.rejectedDocumentTypes, { FT: 1, ND: 1 });
});

Deno.test("partitionPortalFallbackRecords treats missing document types as rejected", () => {
  const result = partitionPortalFallbackRecords([
    {
      documentNumber: "SEM-TIPO",
      documentType: "",
      documentDate: "2026-03-05",
      customerNif: "123456789",
      customerName: "Cliente sem tipo",
      grossTotal: 10,
      taxPayable: 0,
      netTotal: 10,
      status: "validated",
      atcud: "ATCUD-EMPTY",
    },
  ]);

  assertEquals(result.acceptedRecords.length, 0);
  assertEquals(result.rejectedCount, 1);
  assertEquals(result.rejectedDocumentTypes, { UNKNOWN: 1 });
});
