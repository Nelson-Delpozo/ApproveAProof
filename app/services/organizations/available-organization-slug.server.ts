import { db } from "../../lib/db.server";
import { createOrganizationSlug } from "./organization-slug";

export async function createAvailableOrganizationSlug(
  name: string,
): Promise<string> {
  const baseSlug = createOrganizationSlug(name);

  if (!baseSlug) {
    throw new Error("Organization name cannot produce a valid slug");
  }

  const existingOrganizations = await db.organization.findMany({
    where: {
      OR: [
        {
          slug: baseSlug,
        },
        {
          slug: {
            startsWith: `${baseSlug}-`,
          },
        },
      ],
    },
    select: {
      slug: true,
    },
  });

  const existingSlugs = new Set(
    existingOrganizations.map((organization) => organization.slug),
  );

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;

  while (existingSlugs.has(`${baseSlug}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseSlug}-${suffix}`;
}