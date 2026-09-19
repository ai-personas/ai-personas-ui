/* Generated from the Rust runtime contract. Run npm run contract. */

export type Command =
  | {
      kind: "deployment.read";
      args: {};
    }
  | {
      kind: "grant.issue";
      args: {
        draft: GrantDraft;
      };
    }
  | {
      kind: "grant.revoke";
      args: {
        id: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "resource.bounds.configure";
      args: {
        root: string;
        revision: number;
        bounds: Bounds;
      };
    }
  | {
      kind: "resource.bounds.reallocate";
      args: {
        root: string;
        revision: number;
        closeout_tokens: number;
        closeout_cost_units: number;
        reason: string;
      };
    }
  | {
      kind: "information.policy";
      args: {
        subject: string;
        revision: number;
        readers: string[];
        allow_export: boolean;
        expires?: string | null;
        reason: string;
      };
    }
  | {
      kind: "information.withdraw";
      args: {
        subject: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "information.erase";
      args: {
        subject: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "context.discard";
      args: {
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "invitation.offer";
      args: {
        work: string;
        to: string;
        preview: string;
        seed: VersionRef[];
        orientation_calls: number;
      };
    }
  | {
      kind: "invitation.respond";
      args: {
        id: string;
        revision: number;
        accept: boolean;
        reason: string;
      };
    }
  | {
      kind: "persona.retire";
      args: {
        id: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "persona.activate";
      args: {
        id: string;
        revision: number;
        root: string;
        reason: string;
      };
    }
  | {
      kind: "capability.acquire";
      args: {
        id: string;
        revision: number;
        check: string;
        limitations: string;
      };
    }
  | {
      kind: "capability.retire";
      args: {
        id: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "effect.destination.configure";
      args: {
        config: Destination;
      };
    }
  | {
      kind: "effect.destination.revoke";
      args: {
        id: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "effect.dispatch";
      args: {
        destination: string;
        body: unknown;
      };
    }
  | {
      kind: "effect.reconcile";
      args: {
        action: string;
        evidence: VersionRef;
      };
    }
  | {
      kind: "artifact.capture";
      args: {
        job: string;
        name: string;
        media_type: string;
      };
    }
  | {
      kind: "resource.root.create";
      args: {
        limits: Limits;
        closeout_calls: number;
        reason: string;
      };
    }
  | {
      kind: "resource.bind";
      args: {
        work: string;
        revision: number;
        root: string;
        reason: string;
      };
    }
  | {
      kind: "resource.closeout.assign";
      args: {
        run: string;
        revision: number;
        commitment: VersionRef;
        reason: string;
      };
    }
  | {
      kind: "resource.reallocate";
      args: {
        root: string;
        revision: number;
        closeout_calls: number;
        reason: string;
      };
    }
  | {
      kind: "resource.revoke";
      args: {
        root: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "resource.usage.resolve";
      args: {
        charge: string;
        revision: number;
        usage: Usage;
        evidence: string;
      };
    }
  | {
      kind: "resource.summary";
      args: {
        root: string;
      };
    }
  | {
      kind: "work.mandate.adopt";
      args: {
        work: string;
        revision: number;
        mandate: Mandate;
      };
    }
  | {
      kind: "work.amend";
      args: {
        work: string;
        revision: number;
        title: string;
        mandate: Mandate;
      };
    }
  | {
      kind: "work.archive";
      args: {
        work: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "fragment.write";
      args: {
        draft: FragmentDraft;
      };
    }
  | {
      kind: "fragment.revise";
      args: {
        version: VersionRef;
        draft: FragmentDraft;
      };
    }
  | {
      kind: "perspective.write";
      args: {
        work: string;
        id?: string | null;
        revision?: number | null;
        draft: PerspectiveDraft;
      };
    }
  | {
      kind: "work.entry.append";
      args: {
        work: string;
        draft: EntryDraft;
      };
    }
  | {
      kind: "work.entry.dispose";
      args: {
        id: string;
        revision: number;
        disposition: EntryDisposition;
        reason: string;
        evidence: VersionRef[];
      };
    }
  | {
      kind: "agreement.propose";
      args: {
        work: string;
        terms: string;
        parties: string[];
        supersedes?: VersionRef | null;
      };
    }
  | {
      kind: "agreement.endorse";
      args: {
        agreement: VersionRef;
        accept: boolean;
        reason: string;
      };
    }
  | {
      kind: "commitment.offer";
      args: {
        work: string;
        draft: CommitmentDraft;
      };
    }
  | {
      kind: "commitment.respond";
      args: {
        id: string;
        revision: number;
        accept: boolean;
        reason: string;
      };
    }
  | {
      kind: "commitment.update";
      args: {
        id: string;
        revision: number;
        status: CommitmentStatus;
        note: string;
        evidence: VersionRef[];
      };
    }
  | {
      kind: "commitment.handoff.offer";
      args: {
        id: string;
        revision: number;
        to: string;
        reason: string;
      };
    }
  | {
      kind: "commitment.handoff.respond";
      args: {
        id: string;
        revision: number;
        accept: boolean;
        reason: string;
      };
    }
  | {
      kind: "feedback.open";
      args: {
        work: string;
        subject: VersionRef;
        commitment?: string | null;
        blocking: boolean;
        message: string;
      };
    }
  | {
      kind: "feedback.dispose";
      args: {
        id: string;
        revision: number;
        disposition: FeedbackDisposition;
        reason: string;
        evidence: VersionRef[];
      };
    }
  | {
      kind: "assembly.adopt";
      args: {
        work: string;
        revision: number;
        submission: VersionRef;
        inputs: VersionRef[];
        assumptions: VersionRef[];
      };
    }
  | {
      kind: "evidence.bind";
      args: {
        work: string;
        draft: EvidenceDraft;
      };
    }
  | {
      kind: "release.commit";
      args: {
        work: string;
        revision: number;
        draft: ReleaseDraft;
      };
    }
  | {
      kind: "work.summary";
      args: {
        work: string;
      };
    }
  | {
      kind: "record.read";
      args: {
        id: string;
      };
    }
  | {
      kind: "action.read";
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
        /**
         * Operator's explicit funding for a founder. Descendants inherit the caller's root and reserve initialization; they cannot choose a new allowance.
         */
        resource_root?: string | null;
        need?: string | null;
        seed?: VersionRef[] | null;
      };
    }
  | {
      kind: "persona.update";
      args: {
        revision: number;
        name?: string | null;
        character?: string | null;
        /**
         * Artifact ID returned by artifact.publish for your existing portrait file. Omit until published; an empty string clears it. Image descriptions and filesystem paths are not artifact IDs.
         */
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
        /**
         * Artifact ID returned by artifact.publish for the existing environment image. Omit until published; an empty string clears it. Image descriptions and filesystem paths are not artifact IDs.
         */
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
        /**
         * Optional operator-authored initial scope, adopted atomically before invitations can run.
         */
        mandate?: Mandate | null;
        /**
         * Optional operator-selected shared allowance. Persona-created work inherits its controlling root automatically; descendants cannot escape it.
         */
        resource_root?: string | null;
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
        capability?: VersionRef | null;
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
        condition?: WaitCondition | null;
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
        outcome: Outcome2;
        evidence: string;
      };
    };
export type EvidenceRequirement = "reviewed" | "user_judgment";
export type PerspectiveKind = "agenda" | "relationship";
export type EntryKind = "observation" | "opportunity" | "decision" | "assumption";
export type EntryDisposition =
  | "exploring"
  | "adopted"
  | "rejected"
  | "deferred"
  | "superseded"
  | "authorized_for_exploration"
  | "confirmed_by_evidence"
  | "contradicted"
  | "withdrawn";
export type DependencyMode = "final_acceptance" | "version_ready";
export type CommitmentStatus = "working" | "blocked" | "submitted" | "closed" | "cancelled";
export type FeedbackDisposition = "repair_proposed" | "disputed" | "escalated" | "resolved" | "deferred" | "waived";
export type ReleaseDisposition = "delivered" | "delivered_with_conditions" | "partial_delivered";
export type Verdict = "accepted" | "rejected" | "incomplete";
export type WaitCondition =
  | {
      id: string;
      kind: "action";
    }
  | {
      id: string;
      kind: "transfer";
    };
export type Outcome2 = "succeeded" | "failed" | "unknown";

export interface ApiTypes {
  command: Command;
  records: Page;
  inputs: Inbox;
  actions: Page2;
  operation: Operation;
  action: Action;
  event: Event;
  model: Model;
  request: ModelRequest;
  response: ModelResponse;
  network: NetworkInfo;
  [k: string]: unknown;
}
export interface GrantDraft {
  actor: string;
  work: string;
  /**
   * Exact operation names. No wildcard or implied permission.
   */
  operations: string[];
  expires: string;
  max_operations: number;
  parent?: VersionRef | null;
  execution?: ExecutionLimits | null;
  /**
   * Exact configured external destination identity, if external effects are allowed.
   */
  destination?: string | null;
  /**
   * Optional SHA-256 of the exact shell command; descendants cannot remove it.
   */
  command_digest?: string | null;
  /**
   * Exact serialized JSON request digest for mediated external effects.
   */
  body_digest?: string | null;
  reason: string;
}
export interface VersionRef {
  id: string;
  revision: number;
}
export interface ExecutionLimits {
  wall_ms: number;
  cpu_seconds: number;
  memory_bytes: number;
  output_bytes: number;
}
export interface Bounds {
  expires: string;
  tokens: number;
  closeout_tokens: number;
  cost_units: number;
  closeout_cost_units: number;
  currency: string;
  prices: Price[];
  remote_calls: number;
  retained_payload_bytes: number;
  cpu_seconds: number;
  effect_operations: number;
  concurrent_memory_bytes: number;
  births_per_window: number;
  birth_window_seconds: number;
  reason: string;
}
export interface Price {
  provider: string;
  model: string;
  input_units_per_million: number;
  output_units_per_million: number;
  evidence: string;
}
export interface Destination {
  endpoint: string;
  api_key_env?: string | null;
  idempotency_supported: boolean;
  timeout_ms: number;
  max_request_bytes: number;
  max_response_bytes: number;
  trust_loopback_http?: boolean;
  reason: string;
  evidence: string;
}
export interface Limits {
  /**
   * Total admitted inference attempts, including initialization and closeout.
   */
  calls: number;
  /**
   * Total identities created under this root, including funded founders.
   */
  births: number;
  /**
   * Founder depth is zero; descendants cannot exceed this depth.
   */
  max_depth: number;
  /**
   * Concurrent locally pending provider decisions, not provider-side jobs.
   */
  concurrent_calls: number;
}
export interface Usage {
  known: boolean;
  input: number;
  cached: number;
  output: number;
  [k: string]: unknown;
}
export interface Mandate {
  clarifications?: string[];
  outcomes: Outcome[];
  constraints?: string[];
  preferences?: string[];
  unresolved_inputs?: string[];
  completion_agreement: string;
  /**
   * Narrow delegation for adopting a candidate assembly/proposal, not grants
   * to spend money, create personas, edit user constraints or run host code.
   */
  assembly_editors?: string[];
  non_contributor_review: boolean;
  scope_coverage_review_required: boolean;
}
export interface Outcome {
  /**
   * An authored key within this mandate, not a runtime profession or record ID.
   */
  key: string;
  description: string;
  criterion: string;
  required: boolean;
  evidence: EvidenceRequirement;
  conditional_allowed: boolean;
  outside_validation_required: boolean;
}
export interface FragmentDraft {
  title: string;
  content: string;
  applicability: string;
  limitations: string;
  sources?: VersionRef[];
  counterevidence?: VersionRef[];
}
export interface PerspectiveDraft {
  kind: PerspectiveKind;
  subject?: string | null;
  content: string;
  limitations: string;
  sources?: VersionRef[];
}
export interface EntryDraft {
  kind: EntryKind;
  text: string;
  sources?: VersionRef[];
  affected_outcomes?: string[];
  alternatives?: string[];
  expected_result?: string;
  possible_regressions?: string;
  check?: string;
  reconsider_if?: string;
}
export interface CommitmentDraft {
  offered_to: string;
  outcome?: string | null;
  continuation: boolean;
  description: string;
  criterion: string;
  dependencies?: Dependency[];
}
export interface Dependency {
  commitment: string;
  mode: DependencyMode;
  input?: VersionRef | null;
  /**
   * Required for provisional input; permission to explore is not final truth.
   */
  limitations: string;
}
export interface EvidenceDraft {
  assembly: VersionRef;
  finding: VersionRef;
  outcomes: string[];
  conditional: boolean;
  scope_coverage_review: boolean;
  limitations: string;
}
export interface ReleaseDraft {
  assembly: VersionRef;
  evidence?: VersionRef[];
  /**
   * Only outcomes whose adopted criterion is explicitly user_judgment.
   */
  user_judgment_outcomes?: string[];
  disposition: ReleaseDisposition;
  limitations: string;
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
 * Delivered input identities and the exact cursor the persona may acknowledge.
 */
export interface Inbox {
  items: Input[];
  next?: number | null;
  through: number;
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
export interface Page2 {
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
  models: Model[];
  protocol: string;
  operation_schema: unknown;
  /**
   * Earlier actions precede selected context and newly delivered facts in model input.
   */
  history: Action[];
  selected_learning: Record[];
  selected_records: Record[];
  inputs: Inbox;
  images: ImageInput[];
  context_bytes: number;
  messages: Record[];
  tools: Record[];
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
