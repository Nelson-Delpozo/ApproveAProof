export function meta() {
  return [
    { title: "ApproveAProof" },
    {
      name: "description",
      content: "Simple, documented proof approvals for custom-production businesses.",
    },
  ];
}

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          ApproveAProof
        </p>

        <h1 className="text-4xl font-semibold tracking-tight text-gray-950 sm:text-5xl">
          Proof approval, without the email confusion.
        </h1>

        <p className="mt-6 text-lg leading-8 text-gray-600">
          A better way for custom-production businesses to send proofs, collect revision requests,
          and document exactly what customers approved.
        </p>

        <p className="mt-8 text-sm text-gray-400">ApproveAProof is currently in development.</p>
      </div>
    </main>
  );
}
