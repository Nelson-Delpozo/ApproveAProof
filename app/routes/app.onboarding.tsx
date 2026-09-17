import {
  Form,
  redirect,
  useActionData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";

import { requireUser } from "../services/auth/require-user.server";
import { createAvailableOrganizationSlug } from "../services/organizations/available-organization-slug.server";
import { createOrganizationForUser } from "../services/organizations/create-organization.server";
import { getUserMemberships } from "../services/organizations/user-membership.server";

type ActionData = {
  error: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request);
  const memberships = await getUserMemberships(user.id);

  if (memberships.length > 0) {
    throw redirect("/app");
  }

  return null;
}

export async function action({ request }: ActionFunctionArgs): Promise<ActionData | Response> {
  const user = await requireUser(request);
  const memberships = await getUserMemberships(user.id);

  if (memberships.length > 0) {
    throw redirect("/app");
  }

  const formData = await request.formData();
  const organizationName = formData.get("organizationName");

  if (typeof organizationName !== "string" || organizationName.trim().length === 0) {
    return {
      error: "Organization name is required.",
    };
  }

  const name = organizationName.trim();

  if (name.length > 100) {
    return {
      error: "Organization name must be 100 characters or fewer.",
    };
  }

  let slug: string;

  try {
    slug = await createAvailableOrganizationSlug(name);
  } catch {
    return {
      error: "Enter an organization name containing letters or numbers.",
    };
  }

  await createOrganizationForUser({
    userId: user.id,
    name,
    slug,
  });

  throw redirect("/app");
}

export default function OrganizationOnboarding() {
  const actionData = useActionData<typeof action>();

  return (
    <main>
      <h1>Create your organization</h1>

      <p>Set up the organization that will own your proofs, customers, and revisions.</p>

      <Form method="post">
        <label htmlFor="organizationName">Organization name</label>

        <input
          id="organizationName"
          name="organizationName"
          type="text"
          required
          maxLength={100}
          autoComplete="organization"
        />

        {actionData?.error ? <p role="alert">{actionData.error}</p> : null}

        <button type="submit">Create organization</button>
      </Form>
    </main>
  );
}
