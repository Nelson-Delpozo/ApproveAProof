// @vitest-environment node

import { afterAll, beforeEach, describe, expect, it } from "vitest";

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

  it("creates the first Revision as number 1", async () => {
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
  });

  it("allocates successive Revision numbers on the server", async () => {
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
      where: {
        proofId: proof.id,
      },
    });

    expect(revisions).toHaveLength(0);
  });

  it("allocates distinct sequential numbers for concurrent Revision creation", async () => {
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
      where: {
        proofId: proof.id,
      },
      orderBy: {
        number: "asc",
      },
    });

    expect(persistedRevisions).toHaveLength(2);
    expect(persistedRevisions.map((revision) => revision.number)).toEqual([
      1, 2,
    ]);
  });
});