import type { AgentCard } from "./types";

export const AGENT_CARD_ETAG = 'W/"t-bud-agent-card-0.1.0"';

export function createAgentCard(origin: string): AgentCard {
  return {
    name: "T-Bud Merchant Booking Agent",
    description:
      "Prepares human-controlled Manali trek bookings with authoritative prices, capacity checks and explicit itinerary and payment approval gates.",
    supportedInterfaces: [
      {
        url: `${origin}/a2a/v1`,
        protocolBinding: "JSONRPC",
        protocolVersion: "1.0"
      }
    ],
    provider: {
      organization: "T-Bud",
      url: origin
    },
    version: "0.1.0",
    documentationUrl: `${origin}/#protocol`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false
    },
    securitySchemes: {},
    securityRequirements: [],
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    skills: [
      {
        id: "book_manali_trek",
        name: "Prepare a Manali trek booking",
        description:
          "Finds an eligible departure, proposes bounded pickup and meal add-ons and returns a versioned quote for human approval. It never holds seats or starts payment autonomously.",
        tags: ["trekking", "Manali", "booking", "human-in-the-loop"],
        examples: [
          "Prepare a 2-day Manali trek for four friends under ₹20,000 with pickup and upgraded meals."
        ],
        inputModes: ["text/plain", "application/json"],
        outputModes: ["text/plain", "application/json"]
      }
    ]
  };
}
