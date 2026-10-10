import { ProofStatus } from "../../../generated/prisma/client";

const allowedTransitions: Readonly<Record<ProofStatus, ReadonlySet<ProofStatus>>> = {
  [ProofStatus.DRAFT]: new Set([ProofStatus.AWAITING_APPROVAL, ProofStatus.CANCELED]),

  [ProofStatus.AWAITING_APPROVAL]: new Set([
    ProofStatus.CHANGES_REQUESTED,
    ProofStatus.APPROVED,
    ProofStatus.CANCELED,
  ]),

  [ProofStatus.CHANGES_REQUESTED]: new Set([ProofStatus.DRAFT, ProofStatus.CANCELED]),

  [ProofStatus.APPROVED]: new Set(),

  [ProofStatus.CANCELED]: new Set(),
};

export function canTransitionProofStatus(from: ProofStatus, to: ProofStatus): boolean {
  return allowedTransitions[from].has(to);
}
