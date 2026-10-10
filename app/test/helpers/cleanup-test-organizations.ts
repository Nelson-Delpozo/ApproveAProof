
import type { PrismaClient } from "../../../generated/prisma/client";

/**
 * Removes test fixtures belonging to the specified organizations.
 *
 * TEST USE ONLY.
 *
 * This helper intentionally deletes historical proof records so integration
 * tests can reset their fixtures. Production application code must never
 * import or use this helper.
 *
 * All deletions are scoped to the supplied organization slugs and executed
 * in a transaction.
 */
export async function cleanupTestOrganizations(
  db: PrismaClient,
  slugs: readonly string[],
): Promise<void> {
  if (slugs.length === 0 || slugs.some((slug) => !slug.trim())) {
    throw new Error("At least one non-empty test organization slug is required.");
  }

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  const databaseUrl = process.env.DATABASE_URL;

  if (!testDatabaseUrl || !databaseUrl || databaseUrl !== testDatabaseUrl) {
    throw new Error(
      "Test organization cleanup requires DATABASE_URL to match TEST_DATABASE_URL.",
    );
  }

  await db.$transaction(async (tx) => {
    const organizations = await tx.organization.findMany({
      where: {
        slug: {
          in: [...slugs],
        },
      },
      select: {
        id: true,
      },
    });

    const organizationIds = organizations.map((organization) => organization.id);

    if (organizationIds.length === 0) {
      return;
    }

    const scope = {
      organizationId: {
        in: organizationIds,
      },
    };

    await tx.proofDispatch.deleteMany({ where: scope });
    await tx.proofActivity.deleteMany({ where: scope });
    await tx.proofResponse.deleteMany({ where: scope });

    await tx.proof.updateMany({
      where: scope,
      data: {
        currentRevisionId: null,
      },
    });

    await tx.revision.deleteMany({ where: scope });
    await tx.proof.deleteMany({ where: scope });

    await tx.organization.deleteMany({
      where: {
        id: {
          in: organizationIds,
        },
      },
    });
  });
}
