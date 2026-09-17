import { useLoaderData, type LoaderFunctionArgs } from "react-router";

import { requireOrganization } from "../services/organizations/require-organization.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { user, organization, membership } = await requireOrganization(request);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    membership: {
      role: membership.role,
    },
  };
}

export default function App() {
  const { user, organization, membership } = useLoaderData<typeof loader>();

  return (
    <main>
      <h1>{organization.name}</h1>

      <p>Signed in as {user.email}</p>
      <p>Role: {membership.role}</p>

      <p>ApproveAProof application workspace.</p>
    </main>
  );
}
