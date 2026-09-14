/* Generated from the Rust runtime contract. Run npm run contract. */

export interface ApiTypes {
  action: Action;
  detail: Detail;
  event: Event;
  model: Model;
  network: NetworkInfo;
  operation: Operation;
  request: ModelRequest;
  response: ModelResponse;
  snapshot: Snapshot;
  [k: string]: unknown;
}
export interface Action {
  created: string;
  error?: string | null;
  finished?: string | null;
  request: Operation;
  result: unknown;
  state: string;
  [k: string]: unknown;
}
export interface Operation {
  actor?: string;
  args?: {
    [k: string]: unknown;
  };
  /**
   * Client-generated random 32-character hex identity, reusable only for this exact request.
   */
  id: string;
  kind: string;
  run?: string;
  [k: string]: unknown;
}
export interface Detail {
  actions: Action[];
  record: Record;
  related: Record[];
  revisions: unknown[];
  [k: string]: unknown;
}
/**
 * Persistent entities retain arbitrary persona-authored fields in `data`.
 */
export interface Record {
  created: string;
  data: unknown;
  id: string;
  kind: string;
  revision: number;
  scope: string;
  updated: string;
  [k: string]: unknown;
}
export interface Event {
  data: unknown;
  entity: string;
  kind: string;
  sequence: number;
  time: string;
  [k: string]: unknown;
}
export interface Model {
  capabilities: unknown;
  id: string;
  name: string;
  provider: string;
  [k: string]: unknown;
}
export interface NetworkInfo {
  addresses: string[];
  id: string;
  peers: string[];
  [k: string]: unknown;
}
export interface ModelRequest {
  document_catalog: Record[];
  environment: Record;
  history: Action[];
  messages: Record[];
  models: Model[];
  persona: Record;
  protocol: string;
  run: Record;
  selected_learning: Record[];
  tools: Record[];
  work: Record;
  [k: string]: unknown;
}
export interface ModelResponse {
  actual_model: string;
  decision: Decision;
  usage: Usage;
  [k: string]: unknown;
}
export interface Decision {
  actions: DecisionAction[];
  summary: string;
  [k: string]: unknown;
}
export interface DecisionAction {
  args: unknown;
  kind: string;
  [k: string]: unknown;
}
export interface Usage {
  cached: number;
  input: number;
  known: boolean;
  output: number;
  [k: string]: unknown;
}
export interface Snapshot {
  contract: string;
  records: Record[];
  sequence: number;
  [k: string]: unknown;
}
