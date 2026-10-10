import { describe, expect, it } from "vitest";

import { ProofStatus } from "../../../generated/prisma/client";
import { canTransitionProofStatus } from "../../services/proofs/proof-lifecycle";

describe("canTransitionProofStatus", () => {
  it("allows the valid Proof lifecycle transitions", () => {
    const validTransitions = [
      [ProofStatus.DRAFT, ProofStatus.AWAITING_APPROVAL],
      [ProofStatus.DRAFT, ProofStatus.CANCELED],
      [ProofStatus.AWAITING_APPROVAL, ProofStatus.CHANGES_REQUESTED],
      [ProofStatus.AWAITING_APPROVAL, ProofStatus.APPROVED],
      [ProofStatus.AWAITING_APPROVAL, ProofStatus.CANCELED],
      [ProofStatus.CHANGES_REQUESTED, ProofStatus.DRAFT],
      [ProofStatus.CHANGES_REQUESTED, ProofStatus.CANCELED],
    ] as const;

    for (const [from, to] of validTransitions) {
      expect(canTransitionProofStatus(from, to)).toBe(true);
    }
  });

  it("rejects every other Proof status transition", () => {
    const statuses = Object.values(ProofStatus);

    const validTransitions = new Set([
      `${ProofStatus.DRAFT}:${ProofStatus.AWAITING_APPROVAL}`,
      `${ProofStatus.DRAFT}:${ProofStatus.CANCELED}`,
      `${ProofStatus.AWAITING_APPROVAL}:${ProofStatus.CHANGES_REQUESTED}`,
      `${ProofStatus.AWAITING_APPROVAL}:${ProofStatus.APPROVED}`,
      `${ProofStatus.AWAITING_APPROVAL}:${ProofStatus.CANCELED}`,
      `${ProofStatus.CHANGES_REQUESTED}:${ProofStatus.DRAFT}`,
      `${ProofStatus.CHANGES_REQUESTED}:${ProofStatus.CANCELED}`,
    ]);

    for (const from of statuses) {
      for (const to of statuses) {
        const transition = `${from}:${to}`;

        if (!validTransitions.has(transition)) {
          expect(canTransitionProofStatus(from, to)).toBe(false);
        }
      }
    }
  });
});
