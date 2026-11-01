import { describe, expect, it } from "vitest";

import { renderTable } from "../src/lib/table";

describe("table rendering", () => {
  it("renders empty string for empty item list", () => {
    expect(renderTable([], [{ key: "a", header: "A" }])).toBe("");
  });

  it("renders formatted ASCII table with headers and rows", () => {
    const data = [
      { id: "1", name: "Xiaomi Watch S3", battery: "85%" },
      { id: "2", name: "Band 8 Pro", battery: "100%" },
    ];

    const result = renderTable(data, [
      { key: "id", header: "ID", width: 4 },
      { key: "name", header: "Device", width: 16 },
      { key: "battery", header: "Battery", width: 8 },
    ]);

    expect(result).toContain("ID");
    expect(result).toContain("Device");
    expect(result).toContain("Battery");
    expect(result).toContain("Xiaomi Watch S3");
    expect(result).toContain("Band 8 Pro");
  });
});
