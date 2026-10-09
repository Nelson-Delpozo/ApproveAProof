// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { ProofStatus } from "../../../generated/prisma/client";
import { db } from "../../lib/db.server";
import { createRevisionForProof } from "../../services/proofs/revision.server";

const ORG_A_SLUG = "create-revision-org-a";
const ORG_B_SLUG = "create-revision-org-b";

function revisionInput(suffix: string) {
  return {
    fileKey: `proofs/test-${suffix}.pdf`,
    fileName: `test-${suffix}.pdf`,
    fileType: "application/pdf",
    fileSize: 1024,
    fileHash: `sha256-test-${suffix}`,
  };
}

describe("createRevisionForProof", () => {
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

  it("creates the first Revision as number 1 and makes it current", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Create Revision Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "First Revision Proof",
      },
    });

    const revision = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("first"),
    );

    expect(revision.organizationId).toBe(organization.id);
    expect(revision.proofId).toBe(proof.id);
    expect(revision.number).toBe(1);
    expect(revision.fileName).toBe("test-first.pdf");

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(persistedProof.currentRevisionId).toBe(revision.id);
    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
  });

  it("allocates successive Revision numbers and preserves earlier revisions", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Create Revision Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Sequential Revision Proof",
      },
    });

    const first = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("sequential-1"),
    );

    const second = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("sequential-2"),
    );

    const third = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("sequential-3"),
    );

    expect([first.number, second.number, third.number]).toEqual([1, 2, 3]);

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });
    const persistedRevisions = await db.revision.findMany({
      where: { proofId: proof.id },
      orderBy: { number: "asc" },
    });

    expect(persistedProof.currentRevisionId).toBe(third.id);
    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
    expect(persistedRevisions.map((revision) => revision.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ]);
    expect(persistedRevisions.map((revision) => revision.fileHash)).toEqual([
      "sha256-test-sequential-1",
      "sha256-test-sequential-2",
      "sha256-test-sequential-3",
    ]);
  });

  it("does not allow another organization to create a Revision for the Proof", async () => {
    const organizationA = await db.organization.create({
      data: {
        name: "Create Revision Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const organizationB = await db.organization.create({
      data: {
        name: "Create Revision Organization B",
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
      createRevisionForProof(
        organizationB.id,
        proof.id,
        revisionInput("cross-tenant"),
      ),
    ).rejects.toThrow();

    const revisions = await db.revision.findMany({
      where: { proofId: proof.id },
    });
    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(revisions).toHaveLength(0);
    expect(persistedProof.currentRevisionId).toBeNull();
    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
  });

  it("allocates distinct sequential numbers and selects the last committed concurrent Revision", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Create Revision Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Concurrent Revision Proof",
      },
    });

    const revisions = await Promise.all([
      createRevisionForProof(
        organization.id,
        proof.id,
        revisionInput("concurrent-1"),
      ),
      createRevisionForProof(
        organization.id,
        proof.id,
        revisionInput("concurrent-2"),
      ),
    ]);

    expect(
      revisions.map((revision) => revision.number).sort((a, b) => a - b),
    ).toEqual([1, 2]);

    const persistedRevisions = await db.revision.findMany({
      where: { proofId: proof.id },
      orderBy: { number: "asc" },
    });
    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    expect(persistedRevisions).toHaveLength(2);
    expect(persistedRevisions.map((revision) => revision.number)).toEqual([1, 2]);
    expect(persistedProof.currentRevisionId).toBe(persistedRevisions[1].id);
    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
  });

  it("creates a new current Revision and returns CHANGES_REQUESTED to DRAFT", async () => {
    const organization = await db.organization.create({
      data: {
        name: "Create Revision Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Requested Changes Proof",
      },
    });

    const first = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("changes-original"),
    );

    await db.proof.update({
      where: { id: proof.id },
      data: { status: ProofStatus.CHANGES_REQUESTED },
    });

    const second = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("changes-updated"),
    );

    const persistedProof = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });
    const persistedRevisions = await db.revision.findMany({
      where: { proofId: proof.id },
      orderBy: { number: "asc" },
    });

    expect(second.number).toBe(2);
    expect(persistedProof.currentRevisionId).toBe(second.id);
    expect(persistedProof.status).toBe(ProofStatus.DRAFT);
    expect(persistedRevisions.map((revision) => revision.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it.each([
    ProofStatus.AWAITING_APPROVAL,
    ProofStatus.APPROVED,
    ProofStatus.CANCELED,
  ])("rejects creation from %s without changing existing data", async (status) => {
    const organization = await db.organization.create({
      data: {
        name: "Create Revision Organization A",
        slug: ORG_A_SLUG,
      },
    });

    const proof = await db.proof.create({
      data: {
        organizationId: organization.id,
        recipientName: "Customer A",
        title: "Protected Revision Proof",
      },
    });

    const original = await createRevisionForProof(
      organization.id,
      proof.id,
      revisionInput("protected-original"),
    );

    await db.proof.update({
      where: { id: proof.id },
      data: { status },
    });

    const before = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });

    await expect(
      createRevisionForProof(
        organization.id,
        proof.id,
        revisionInput(`rejected-${status}`),
      ),
    ).rejects.toThrow();

    const after = await db.proof.findUniqueOrThrow({
      where: { id: proof.id },
    });
    const persistedRevisions = await db.revision.findMany({
      where: { proofId: proof.id },
    });

    expect(after.currentRevisionId).toBe(original.id);
    expect(after.status).toBe(status);
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(persistedRevisions).toHaveLength(1);
    expect(persistedRevisions[0].id).toBe(original.id);
  });
});