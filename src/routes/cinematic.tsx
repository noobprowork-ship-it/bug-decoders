import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/cinematic")({
  beforeLoad: () => { throw redirect({ to: "/dashboard" }); },
  component: () => null,
});
