import { describe, expect, it } from "vitest";
import {
  agoraIsoUtc,
  DataInvalidaError,
  dataLocalSp,
  hojeLocalSp,
  resolverDataLocal,
} from "../src/lib/datas.js";

describe("datas duplas (INFRA-03)", () => {
  it("02:50 UTC ainda é o dia anterior em America/Sao_Paulo", () => {
    expect(dataLocalSp("2026-09-24T02:50:00Z")).toBe("2026-09-23");
  });

  it("03:10 UTC já é o mesmo dia em America/Sao_Paulo", () => {
    expect(dataLocalSp("2026-09-24T03:10:00Z")).toBe("2026-09-24");
  });

  it("agoraIsoUtc retorna ISO-8601 UTC", () => {
    const agora = agoraIsoUtc();
    expect(agora).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(agora.endsWith("Z")).toBe(true);
  });

  it("hojeLocalSp retorna YYYY-MM-DD", () => {
    expect(hojeLocalSp()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  describe("resolverDataLocal (REG-05)", () => {
    it("data informada é usada como está (retroativo)", () => {
      expect(resolverDataLocal("2026-09-20")).toBe("2026-09-20");
    });

    it("data vazia/ausente cai no hoje local", () => {
      expect(resolverDataLocal(undefined)).toBe(hojeLocalSp());
      expect(resolverDataLocal("")).toBe(hojeLocalSp());
    });

    it("formato inválido é rejeitado", () => {
      expect(() => resolverDataLocal("20/09/2026")).toThrow(DataInvalidaError);
      expect(() => resolverDataLocal("2026-9-20")).toThrow(DataInvalidaError);
    });
  });
});
