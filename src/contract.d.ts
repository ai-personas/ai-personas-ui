/* Generated from the Rust runtime contract. Run npm run contract. */

export type Command =
  | {
      kind: "record.read";
      args: {
        id: string;
      };
    }
  | {
      kind: "record.list";
      args: {
        kind?: string | null;
        scope?: string | null;
        owner?: string | null;
        status?: string | null;
        query?: string | null;
        after?: number | null;
        limit?: number | null;
      };
    }
  | {
      kind: "history.read";
      args: {
        after?: number | null;
        limit?: number | null;
        run?: string | null;
      };
    }
  | {
      kind: "artifact.inspect";
      args: {
        id: string;
      };
    }
  | {
      kind: "image.observe";
      args: {
        artifact: string;
        purpose: string;
      };
    }
  | {
      kind: "persona.create";
      args: {
        provider: string;
        model: string;
        effort?: string | null;
      };
    }
  | {
      kind: "persona.update";
      args: {
        revision: number;
        name?: string | null;
        character?: string | null;
        portrait?: string | null;
        ocean?: Ocean | null;
        vad?: Vad | null;
        attributes?: unknown;
        reason?: string | null;
        evidence?: string[] | null;
      };
    }
  | {
      kind: "environment.create";
      args: {
        directory?: string | null;
      };
    }
  | {
      kind: "environment.update";
      args: {
        id: string;
        revision: number;
        name?: string | null;
        description?: string | null;
        image?: string | null;
      };
    }
  | {
      kind: "work.create";
      args: {
        title: string;
        brief: string;
        environment: string;
        personas: string[];
      };
    }
  | {
      kind: "run.resume";
      args: {
        id: string;
      };
    }
  | {
      kind: "run.pause";
      args: {
        id: string;
      };
    }
  | {
      kind: "run.cancel";
      args: {
        id: string;
      };
    }
  | {
      kind: "exec";
      args: {
        command: string;
        directory?: string | null;
        background?: boolean | null;
      };
    }
  | {
      kind: "job.read";
      args: {
        id: string;
        offset?: number | null;
        limit?: number | null;
      };
    }
  | {
      kind: "job.cancel";
      args: {
        id: string;
      };
    }
  | {
      kind: "document.write";
      args: {
        id?: string | null;
        parents?: string[] | null;
        title: string;
        content: string;
        environment?: string | null;
      };
    }
  | {
      kind: "document.read";
      args: {
        version: string;
      };
    }
  | {
      kind: "context.select";
      args: {
        records: string[];
        actions: string[];
      };
    }
  | {
      kind: "context.compact";
      args: {
        summary: string;
        through: string;
        records: string[];
        actions: string[];
      };
    }
  | {
      kind: "input.acknowledge";
      args: {
        through: number;
      };
    }
  | {
      kind: "model.choose";
      args: {
        provider: string;
        model: string;
        effort?: string | null;
      };
    }
  | {
      kind: "tool.register";
      args: {
        name: string;
        command: string;
        description: string;
        acquisition: string;
      };
    }
  | {
      kind: "message.send";
      args: {
        to: string;
        work?: string | null;
        text: string;
        environment?: string | null;
      };
    }
  | {
      kind: "artifact.publish";
      args: {
        path: string;
        name?: string | null;
        media_type?: string | null;
      };
    }
  | {
      kind: "submit";
      args: {
        summary: string;
        artifacts: string[];
        documents: string[];
      };
    }
  | {
      kind: "review.start";
      args: {
        submission: string;
        persona: string;
        instructions: string;
      };
    }
  | {
      kind: "assess";
      args: {
        verdict: Verdict;
        findings: string;
        checks: string[];
      };
    }
  | {
      kind: "request.create";
      args: {
        purpose: string;
        instructions: string;
        evidence_required: string;
        artifacts: string[];
      };
    }
  | {
      kind: "request.respond";
      args: {
        request: string;
        text: string;
        artifacts: string[];
      };
    }
  | {
      kind: "request.resolve";
      args: {
        request: string;
        conclusion: string;
        evidence: string[];
      };
    }
  | {
      kind: "request.cancel";
      args: {
        request: string;
        reason: string;
      };
    }
  | {
      kind: "wait";
      args: {
        reason: string;
      };
    }
  | {
      kind: "network.read";
      args: {};
    }
  | {
      kind: "peer.connect";
      args: {
        address: string;
      };
    }
  | {
      kind: "transfer.start";
      args: {
        peer: string;
        artifact: string;
        digest: string;
        size: number;
        name: string;
      };
    }
  | {
      kind: "transfer.cancel";
      args: {
        id: string;
      };
    }
  | {
      kind: "peer.message";
      args: {
        peer: string;
        to: string;
        text: string;
      };
    }
  | {
      kind: "continuity.export";
      args: {};
    }
  | {
      kind: "continuity.import";
      args: {
        artifact: string;
      };
    }
  | {
      kind: "continuity.handoff";
      args: {
        peer: string;
      };
    }
  | {
      kind: "action.resolve";
      args: {
        id: string;
        outcome: Outcome;
        evidence: string;
      };
    };
export type Verdict = "accepted" | "rejected" | "incomplete";
export type Outcome = "succeeded" | "failed" | "unknown";

export interface ApiTypes {
  command: Command;
  records: Page;
  inputs: Page2;
  actions: Page3;
  operation: Operation;
  action: Action;
  event: Event;
  model: Model;
  request: ModelRequest;
  response: ModelResponse;
  network: NetworkInfo;
  [k: string]: unknown;
}
export interface Ocean {
  openness?: number | null;
  conscientiousness?: number | null;
  extraversion?: number | null;
  agreeableness?: number | null;
  neuroticism?: number | null;
}
export interface Vad {
  valence?: number | null;
  arousal?: number | null;
  dominance?: number | null;
}
/**
 * Cursor pages are bounded transport, not a persona memory policy.
 */
export interface Page {
  items: Record[];
  next?: number | null;
  sequence: number;
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
/**
 * Cursor pages are bounded transport, not a persona memory policy.
 */
export interface Page2 {
  items: Input[];
  next?: number | null;
  sequence: number;
  [k: string]: unknown;
}
export interface Input {
  sequence: number;
  key: string;
  persona: string;
  run: string;
  kind: string;
  entity: string;
  created: string;
  [k: string]: unknown;
}
/**
 * Cursor pages are bounded transport, not a persona memory policy.
 */
export interface Page3 {
  items: Action[];
  next?: number | null;
  sequence: number;
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
  /**
   * Assigned by the application: api or the originating model call identity.
   */
  source?: string;
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
  node: NetworkInfo;
  persona: Record;
  run: Record;
  work: Record;
  environment: Record;
  selected_learning: Record[];
  selected_records: Record[];
  inputs: Page2;
  images: ImageInput[];
  context_bytes: number;
  messages: Record[];
  tools: Record[];
  models: Model[];
  history: Action[];
  protocol: string;
  operation_schema: unknown;
  [k: string]: unknown;
}
export interface NetworkInfo {
  id: string;
  addresses: string[];
  peers: string[];
  [k: string]: unknown;
}
export interface ImageInput {
  observation: string;
  artifact: string;
  digest: string;
  media_type: string;
  path: string;
  purpose: string;
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
