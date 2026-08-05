const healthPayload = {
  service: "trpg-booth-search-preview",
  status: "ok",
  dataMode: "synthetic-fixtures-only",
  liveCollection: false,
  hostedDatabase: false,
} as const;

export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(healthPayload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
