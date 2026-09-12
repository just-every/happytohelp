export type Workspace = { id: string; name: string; path?: string };
export type Agent = {
  id: string;
  name: string;
  workspaceIds: string[];
  revokedAt?: string | null;
  lastSeenAt?: string | null;
};
export type RequestRecord = {
  id: string;
  workspaceId: string;
  subject: string;
  customerEmail: string;
  body: string;
  status: string;
  createdAt: string;
};
export type Mode = "investigate" | "resolve" | "resolve_reply";
export type Result = {
  summary: string;
  verified: boolean;
  question?: string;
  actions?: { description: string; evidence: string }[];
  replies?: { id: string; title: string; body: string }[];
  reply_draft?: string;
  attachment_ids?: string[];
};
export type Job = {
  id: string;
  requestId: string;
  agentId?: string;
  mode: Mode;
  instructions: string;
  status: string;
  runId?: string;
  result?: Result;
  createdAt: string;
};
export type Event = {
  id: string;
  jobId: string;
  kind: string;
  message?: string;
  payload?: unknown;
  createdAt: string;
};
export type Reply = {
  jobId: string;
  id: string;
  body: string;
  status: string;
  error?: string;
  providerId?: string;
};
export type Detail = {
  request: RequestRecord;
  jobs: Job[];
  events: Event[];
  replies: Reply[];
};
export type Session = {
  authenticated: boolean;
  bootstrapRequired: boolean;
  operator?: { name: string; email: string };
  email?: string;
};
export const modeLabels: Record<Mode, string> = {
  investigate: "Investigate",
  resolve: "Resolve",
  resolve_reply: "Resolve and reply",
};
export const modeDescriptions: Record<Mode, string> = {
  investigate: "Read and analyze. Propose changes and replies for review.",
  resolve: "Make only the scoped changes. Keep customer replies as proposals.",
  resolve_reply:
    "Make the scoped changes and send one verified reply through HappyToHelp.",
};
