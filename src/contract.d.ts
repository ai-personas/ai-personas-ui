/* Generated from the Rust runtime contract. Run npm run contract. */

export interface ApiTypes {
  snapshot: Snapshot;
  detail: Detail;
  operation: Operation;
  action: Action;
  event: Event;
  model: Model;
  request: ModelRequest;
  response: ModelResponse;
  network: NetworkInfo;
  [k: string]: unknown;
}
export interface Snapshot {
  contract: string;
  sequence: number;
  records: Record[];
  [k: string]: unknown;
}
/**
 * Persistent entities retain arbitrary persona-authored fields in `data`.
 */
export interface Record {
  id: string;
  kind: string;
  scope: string;
  revision: number;
  created: string;
  updated: string;
  data: unknown;
  [k: string]: unknown;
}
export interface Detail {
  record: Record;
  revisions: unknown[];
  related: Record[];
  actions: Action[];
  [k: string]: unknown;
}
export interface Action {
  request: Operation;
  state: string;
  created: string;
  finished?: string | null;
  result: unknown;
  error?: string | null;
  [k: string]: unknown;
}
export interface Operation {
  /**
   * Client-generated random 32-character hex identity, reusable only for this exact request.
   */
  id: string;
  kind: string;
  actor?: string;
  run?: string;
  args?: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface Event {
  sequence: number;
  kind: string;
  entity: string;
  time: string;
  data: unknown;
  [k: string]: unknown;
}
export interface Model {
  provider: string;
  id: string;
  name: string;
  capabilities: unknown;
  [k: string]: unknown;
}
export interface ModelRequest {
  persona: Record;
  run: Record;
  work: Record;
  environment: Record;
  selected_learning: Record[];
  document_catalog: Record[];
  messages: Record[];
  tools: Record[];
  models: Model[];
  history: Action[];
  protocol: string;
  [k: string]: unknown;
}
export interface ModelResponse {
  decision: Decision;
  actual_model: string;
  usage: Usage;
  [k: string]: unknown;
}
export interface Decision {
  summary: string;
  actions: DecisionAction[];
  [k: string]: unknown;
}
export interface DecisionAction {
  kind: string;
  args: unknown;
  [k: string]: unknown;
}
export interface Usage {
  known: boolean;
  input: number;
  cached: number;
  output: number;
  [k: string]: unknown;
}
export interface NetworkInfo {
  id: string;
  addresses: string[];
  peers: string[];
  [k: string]: unknown;
}
