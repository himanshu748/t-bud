export interface AgentCard {
  name: string;
  description: string;
  supportedInterfaces: Array<{
    url: string;
    protocolBinding: "JSONRPC";
    protocolVersion: "1.0";
  }>;
  provider: { organization: string; url: string };
  version: string;
  documentationUrl: string;
  capabilities: {
    streaming: false;
    pushNotifications: false;
    extendedAgentCard: false;
  };
  securitySchemes: Record<string, never>;
  securityRequirements: [];
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples: string[];
    inputModes: string[];
    outputModes: string[];
  }>;
}

export type A2ATaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED";

export interface A2ATask {
  id: string;
  contextId: string;
  status: {
    state: A2ATaskState;
    timestamp: string;
    message?: {
      messageId: string;
      role: "ROLE_AGENT";
      parts: Array<{ text: string }>;
    };
  };
  artifacts?: Array<{
    artifactId: string;
    name: string;
    description: string;
    parts: Array<{ data: Record<string, unknown> }>;
  }>;
}

export interface JsonRpcSuccess<T> {
  jsonrpc: "2.0";
  id: string | number;
  result: T;
}

export interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: Array<Record<string, unknown>>;
  };
}
