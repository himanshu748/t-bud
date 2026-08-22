import { Hono } from "hono";
import { createAgentCard } from "../a2a/agent-card";
import { D1BookingRepository } from "../data/repository";
import type { Env } from "../env";
import type { SecurityVariables } from "./security";

type AppContext = { Bindings: Env; Variables: SecurityVariables };

const webmcpTools = [
  "search_treks",
  "get_availability",
  "quote_bundle",
  "request_hold"
];

export const merchantRoutes = new Hono<AppContext>();

merchantRoutes.get("/overview", async (context) => {
  const repository = new D1BookingRepository(context.env.DB);
  const [catalog, tasks, holds, audit] = await Promise.all([
    repository.listDepartureOverview(),
    repository.listRecentTasks(),
    repository.listActiveHolds(),
    repository.listRecentAudit()
  ]);
  const departures = await Promise.all(
    catalog.map(async (departure) => {
      const stub = context.env.DEPARTURE_HOLD.getByName(departure.id);
      await stub.configure({ capacity: departure.capacity });
      const availability = await stub.getAvailability();
      return { ...departure, available: availability.available };
    })
  );
  const origin = new URL(context.req.url).origin;
  const card = createAgentCard(origin);
  return context.json({
    agentCard: {
      protocolVersion: "1.0",
      skills: card.skills.map((skill) => ({ id: skill.id, name: skill.name }))
    },
    webmcpTools,
    paymentsEnabled: false,
    departures,
    tasks: tasks.map((task) => ({
      id: task.id,
      state: task.state,
      updatedAt: task.updatedAt
    })),
    holds: holds.map((hold) => ({
      id: hold.id,
      partySize: hold.partySize,
      expiresAt: hold.expiresAt,
      status: hold.status
    })),
    audit: audit.map((event) => ({
      id: event.id,
      actor: event.actor,
      action: event.action,
      result: event.result,
      createdAt: event.createdAt
    }))
  });
});
