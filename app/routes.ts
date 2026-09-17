import {
  type RouteConfig,
  index,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("auth/login", "routes/auth.login.ts"),
  route("auth/callback", "routes/auth.callback.ts"),
  route("app", "routes/app.tsx"),
  route("app/onboarding", "routes/app.onboarding.tsx"),
] satisfies RouteConfig;