export interface AuditEvent {
  id: string;
  taskId: string;
  actor: "buyer_agent" | "merchant_agent" | "human" | "system";
  action: string;
  target: string;
  payload: Record<string, unknown>;
  result: "accepted" | "rejected" | "recorded";
  createdAt: string;
}

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}
