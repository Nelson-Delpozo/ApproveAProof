// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ProofStatus } from "../../../generated/prisma/client";
import { db } from "../../lib/db.server";
import { cancelProofForOrganization } from "../../services/proofs/proof.server";

const ORG_A_SLUG = "cancel-proof-org-a";
const ORG_B_SLUG = "cancel-proof-org-b";

describe("cancelProofForOrganization", () => {
  beforeEach(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          in: [ORG_A_SLUG, ORG_B_SLUG],
        },
      },
    });
  });

  afterAll(async () => {
    await db.organization.deleteMany({
      where: {
        slug: {
          in: [ORG_A_SLUG, ORG_B_SLUG],
        },
      },
    });

    await db.$disconnect();
  });

  it.each([
    ProofStatus.DRAFT,
    ProofStatus.AWAITING_APPROVAL,
    ProofStatus.CHANGES_REQUESTED,
  ])("cancels an owned Proof from %s", async (status) => {
    const organization = await db.organization.create({
      data: {
        name: "Cancel Proof Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Cancelable Proof",
        status,
      },
    });

    const result = await cancelProofForOrganization(organization.id, proof.id);

    expect(result.status).toBe(ProofStatus.CANCELED);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.CANCELED);
  });

  it("does not allow another organization to cancel the Proof", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Cancel Proof Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Cancel Proof Organization B",
        slug: ORG_B_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organizationA.id,
        recipientName: "Customer A",
        title: "Organization A Proof",
      },
    });

    await expect(
      cancelProofForOrganization(organizationB.id, proof.id),
    ).rejects.toThrow();

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: {
        id: proof.id,
      },
    });

    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
  });

  it.each([ProofStatus.APPROVED, ProofStatus.CANCELED])(
    "rejects cancellation from %s",
    async (status) => {
      const organization = await db.organization.create({
        data: {
          name: "Cancel Proof Organization A",
          slug: ORG_A_SLUG,
        },
      });

      const proof = await db.proof.create({
        data: {
          organizationId: organization.id,
          recipientName: "Customer A",
          title: "Non-cancelable Proof",
          status,
        },
      });

      await expect(
        cancelProofForOrganization(organization.id, proof.id),
      ).rejects.toThrow();

      const persistedProof = await db.proof.findUniqueOrThrow({
        where: {
          id: proof.id,
        },
      });

      expect(persistedProof.status).toBe(status);
    },
  );
});