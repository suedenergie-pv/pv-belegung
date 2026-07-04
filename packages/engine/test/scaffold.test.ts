import { describe, expect, it } from "vitest";
import { ENGINE_STATUS } from "../src/index";

describe("Gerüst", () => {
  it("Tooling läuft (vitest + TS-Imports)", () => {
    expect(ENGINE_STATUS).toBe("BLOCKED_AWAITING_SPEC");
  });
});

// Platzhalter für die echten Suiten — erst mit vorliegender SPEC befüllbar:
describe.todo("Katalog-Datenmodell + Seed (SPEC §5.1, §6)");
describe.todo("Temperaturkorrektur (SPEC §7)");
describe.todo("Regeln R1–R11: je min. 1 Pass- und 1 Fail-Test (SPEC §7)");
describe.todo("Testrunner Kalibrierungsfälle (kalibrierung.md, SPEC §14)");
