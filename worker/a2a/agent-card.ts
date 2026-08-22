import type { AgentCard } from "./types";

export const AGENT_CARD_ETAG = 'W/"t-bud-agent-card-0.2.0"';

export function createAgentCard(origin: string): AgentCard {
  return {
    name: "T-Bud Merchant Booking Agent",
    description:
      "Prepares human-controlled Manali trek quotes with authoritative prices, atomic capacity checks at hold time and explicit itinerary and seat-hold approval gates. Payment collection is disabled in the current pilot.",
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
    version: "0.2.0",
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
          "Finds an eligible departure, proposes bounded pickup and meal add-ons and returns a versioned quote for human approval. It never holds seats autonomously and payment collection is unavailable in this pilot.",
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
