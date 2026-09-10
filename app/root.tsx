import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import { env } from "./services/env.server";
import "./app.css";

export function loader() {
  void env;

  return null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>

      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found";
      message = "The page you're looking for doesn't exist.";
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

        <p className="mt-3 text-gray-600">{message}</p>

        {stack ? (
          <pre className="mt-6 overflow-x-auto rounded-lg bg-gray-100 p-4 text-sm">
            <code>{stack}</code>
          </pre>
        ) : null}
      </div>
    </main>
  );
}
