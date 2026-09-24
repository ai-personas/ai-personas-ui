/* Generated from the Rust runtime contract. Run npm run contract. */

export type Command =
  | {
      kind: "model.catalog";
      args: {};
    }
  | {
      kind: "model.invoke.preview";
      args: {
        invocation: Invocation;
      };
    }
  | {
      kind: "model.invoke";
      args: {
        invocation: Invocation;
      };
    }
  | {
      kind: "deployment.read";
      args: {};
    }
  | {
      kind: "deployment.configure";
      args: {
        host_execution: boolean;
        reason: string;
      };
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
      kind: "invitation.extend";
      args: {
        id: string;
        revision: number;
        additional_calls: number;
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
      kind: "resource.root.amend";
      args: {
        root: string;
        revision: number;
        limits: Limits;
        closeout_calls: number;
        bounds: Bounds;
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
        parent?: string | null;
        related: string[];
      };
    }
  | {
      kind: "fragment.revise";
      args: {
        node: VersionRef;
        draft: FragmentDraft;
        parent?: string | null;
        related: string[];
      };
    }
  | {
      kind: "perspective.write";
      args: {
        /**
         * Omit for a continuing personal interest or relationship. Agendas require work scope.
         */
        work?: string | null;
        id?: string | null;
        revision?: number | null;
        draft: PerspectiveDraft;
      };
    }
  | {
      kind: "experience.review";
      args: {
        observations: EvidenceRef[];
        disposition: ReviewDisposition;
        interpretation: string;
        changes: VersionRef[];
      };
    }
  | {
      kind: "exploration.configure";
      args: {
        persona: string;
        revision: number;
        enabled: boolean;
        environment: string;
        resource_root: string;
        calls_per_episode: number;
        seconds_per_episode: number;
        max_episodes: number;
        expires: string;
        reason: string;
      };
    }
  | {
      kind: "exploration.propose";
      args: {
        policy: VersionRef;
        question: string;
        stopping_condition: string;
        not_before: string;
      };
    }
  | {
      kind: "exploration.cancel";
      args: {
        id: string;
        revision: number;
        reason: string;
      };
    }
  | {
      kind: "exploration.finish";
      args: {
        outcome: ExplorationOutcome;
        reason: string;
        observations: EvidenceRef[];
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
      kind: "operation.describe";
      args: {
        operation: string;
      };
    }
  | {
      kind: "memory.locate";
      args: {
        node: VersionRef;
        arguments_json: string;
      };
    }
  | {
      kind: "memory.browse";
      args: {
        owner: string;
        branch?: string | null;
        after?: number | null;
        limit?: number | null;
        query?: string | null;
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
        profile_seed?: ProfileSeed | null;
        /**
         * Defaults to true. When false, narrative character, traits and substitute profile attributes are operator-controlled; learning and interests remain available.
         */
        self_authorship?: boolean | null;
      };
    }
  | {
      kind: "persona.profile.configure";
      args: {
        id: string;
        revision: number;
        character?: string | null;
        ocean?: Ocean | null;
        vad?: Vad | null;
        self_authorship?: boolean | null;
        reason: string;
      };
    }
  | {
      kind: "persona.orientation.record";
      args: {
        disposition: OrientationDisposition;
        approach: string;
        reason: string;
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
        evidence?: EvidenceRef[] | null;
      };
    }
  | {
      kind: "environment.create";
      args: {
        directory?: string | null;
        tools?: string[] | null;
      };
    }
  | {
      kind: "environment.tools.catalog";
      args: {};
    }
  | {
      kind: "environment.tool.add";
      args: {
        environment: string;
        tool: string;
        revision: number;
      };
    }
  | {
      kind: "environment.tool.remove";
      args: {
        environment: string;
        tool: string;
        revision: number;
      };
    }
  | {
      kind: "browser.search";
      args: {
        query: string;
        limit?: number | null;
        engine?: BrowserSearchEngine | null;
      };
    }
  | {
      kind: "browser.open";
      args: {
        url: string;
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
      kind: "participants.add";
      args: {
        subject: string;
        revision: number;
        persona: string;
        reason: string;
      };
    }
  | {
      kind: "participants.remove";
      args: {
        subject: string;
        revision: number;
        persona: string;
        reason: string;
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
        /**
         * Optional evidence-backed tool version, never a grant ID. Omit or use null for ordinary execution. In isolated mode the runtime selects the scoped execution grant separately.
         */
        capability?: VersionRef | null;
        /**
         * Exact readable artifact versions used by this command. Binds their provenance and verifies their bytes. Isolated execution adds only these files as read-only inputs; host execution uses ordinary account permissions. Omit or use null when no saved files are needed.
         */
        inputs?: VersionRef[] | null;
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
      kind: "context.advance";
      args: {
        continuity: Continuity;
      };
    }
  | {
      kind: "context.select";
      args: {
        /**
         * Retained record IDs, such as messages, documents, submissions and artifacts.
         */
        records: string[];
        /**
         * IDs of your own executed operations from history.request.id. Never record IDs. Keeping large receipts selected keeps them in context; use [] when exact receipts are no longer needed.
         */
        actions: string[];
        /**
         * Your search cue for the next context's fragment/tool previews. Null clears the cue; it does not select search results.
         */
        retrieval_query?: string | null;
      };
    }
  | {
      kind: "context.compact";
      args: {
        summary: string;
        /**
         * An executed operation's history.request.id from this run, not a record ID.
         */
        through: string;
        /**
         * Retained record IDs, such as messages, documents, submissions and artifacts.
         */
        records: string[];
        /**
         * IDs of your own executed operations from history.request.id. Never record IDs. Keeping large receipts selected keeps them in context; use [] when exact receipts are no longer needed.
         */
        actions: string[];
        /**
         * Your search cue for the next context's fragment/tool previews. Null clears the cue; the summary and active lessons also inform discovery.
         */
        retrieval_query?: string | null;
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
        checks?: string[] | null;
      };
    }
  | {
      kind: "request.create";
      args: {
        audience?: RequestAudience | null;
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
        disposition?: StopDisposition | null;
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
export type Capability = "persona_decision" | "choice" | "knowledge";
export type EvidenceRequirement = "reviewed" | "user_judgment";
export type EvidenceRef = VersionRef | ActionEvidence;
export type PerspectiveKind = "agenda" | "relationship" | "interest";
export type ReviewDisposition = "retain" | "revise" | "no_change" | "defer";
export type ExplorationOutcome = "trial_complete" | "unpromising" | "partial";
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
export type OrientationDisposition = "adopted" | "deferred";
export type BrowserSearchEngine = ("bing" | "duckduckgo") | "configured";
export type LearningDisposition = "retain" | "revise" | "organize" | "no_change" | "defer";
export type Verdict = "accepted" | "rejected" | "incomplete";
export type RequestAudience = "work" | "user";
export type WaitCondition =
  | {
      id: string;
      kind: "action";
    }
  | {
      id: string;
      kind: "transfer";
    };
export type StopDisposition =
  | {
      request: VersionRef;
      kind: "outside_dependency";
    }
  | {
      commitment: VersionRef;
      kind: "peer_dependency";
    }
  | {
      opportunity: VersionRef;
      kind: "scheduled";
    }
  | {
      kind: "voluntary_yield";
    }
  | {
      gaps: string;
      kind: "partial_delivery";
    }
  | {
      release: VersionRef;
      kind: "completion";
    }
  | {
      category: Blockage;
      detail: string;
      kind: "blocked";
    };
export type Blockage = "resource" | "tool" | "runtime";
export type Outcome2 = "succeeded" | "failed" | "unknown";
export type Protocol = "responses" | "anthropic" | "gemini";
/**
 * This body is write-only and must never enter the action journal or logs.
 */
export type SettingsChange =
  | {
      revision: string;
      connection: Connection;
      api_key?: string | null;
      action: "save";
    }
  | {
      revision: string;
      provider: string;
      action: "remove";
    }
  | {
      revision: string;
      api_key: string;
      action: "save_typesafe";
    }
  | {
      revision: string;
      action: "remove_typesafe";
    };

export interface ApiTypes {
  attention: Attention;
  environment_tools: ToolDescriptor[];
  work_files: Page;
  command: Command;
  records: Page2;
  inputs: Inbox;
  actions: Page3;
  operation: Operation;
  action: Action;
  event: Event;
  model: Model;
  inference: InferenceCatalog;
  provider_settings: ProviderSettings;
  provider_settings_change: SettingsChange;
  message_delivery: Page4;
  call_progress: CallProgress;
  action_activity: ActionActivity[];
  request: ModelRequest;
  response: ModelResponse;
  network: NetworkInfo;
  [k: string]: unknown;
}
export interface Attention {
  requests: number;
  work: number;
  personas: number;
  environments: number;
  [k: string]: unknown;
}
export interface ToolDescriptor {
  id: string;
  name: string;
  description: string;
  operations: string[];
  default_enabled: boolean;
  adapter: string;
  [k: string]: unknown;
}
/**
 * Cursor pages are bounded transport, not a persona memory policy.
 */
export interface Page {
  items: WorkFile[];
  next?: number | null;
  sequence: number;
  [k: string]: unknown;
}
export interface WorkFile {
  record: Record;
  status: string;
  submissions: VersionRef[];
  adopted_in?: VersionRef | null;
  acceptance_established: boolean;
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
export interface VersionRef {
  id: string;
  revision: number;
}
export interface Invocation {
  target: Selection;
  capability: Capability;
  /**
   * Direct adapter input, or JSON work data to formulate when prepare is set.
   * A string keeps arbitrary JSON out of strict provider output schemas.
   */
  request_json: string;
  prepare?: Selection | null;
}
export interface Selection {
  provider: string;
  model: string;
  effort?: string | null;
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
   * Exact serialized JSON request digest for generic mediated external effects.
   * Optional only with an explicit bounded native TypeSafe choice permission.
   */
  body_digest?: string | null;
  /**
   * Allows changing choice questions only at the exact native TypeSafe
   * destination, with explicit model and exposure bounds. No generic wildcard.
   */
  typesafe_choice?: ChoiceGrant | null;
  reason: string;
}
export interface ExecutionLimits {
  wall_ms: number;
  cpu_seconds: number;
  memory_bytes: number;
  output_bytes: number;
}
/**
 * Explicit authority for a persona to formulate changing choice questions.
 * Absence of this policy NEVER turns an exact-body effect grant into a wildcard.
 * Token reservations are operator-supplied conservative exposure, not undocumented
 * max-token request parameters sent to TypeSafe. Keep their evidence current.
 */
export interface ChoiceGrant {
  models: string[];
  max_questions: number;
  max_options: number;
  max_request_bytes: number;
  input_tokens: number;
  output_tokens: number;
  evidence: string;
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
  /**
   * Optional ceiling on authored content/effect reservations. Model transport
   * is transient and never consumes this allowance. None means no ceiling.
   */
  retained_payload_bytes?: number | null;
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
  /**
   * Node-owned saved credential. Currently only "typesafe", bound to its
   * exact official endpoint; the key never enters this configuration record.
   */
  api_key_ref?: string | null;
  /**
   * True only for an actual remote idempotency contract. Native TypeSafe
   * decisions require false: local replay protection is not remote deduplication.
   */
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
  /**
   * Tentative: useful untested abstraction; observed: own received trial; reported: attributed outside/peer account. None certifies truth.
   */
  basis?: "tentative" | "observed" | "reported";
  title: string;
  /**
   * Your concise description of this prompt part, in your own voice.
   */
  short_description: string;
  /**
   * A reusable prompt part in this persona's own voice, informed by current character and observed experience. Preserve factual accuracy and uncertainty.
   */
  content: string;
  applicability: string;
  limitations: string;
  /**
   * Permit procedural use in later shared work without sharing this private memory record. Restricted source facts are never declassified.
   */
  procedural_reuse?: boolean;
  /**
   * Owner-authored situations, questions or search terms that should recall this prompt fragment.
   */
  retrieval_cues?: string[];
  sources?: EvidenceRef[];
  counterevidence?: EvidenceRef[];
}
export interface ActionEvidence {
  action: string;
  receipt_digest: string;
}
export interface PerspectiveDraft {
  kind: PerspectiveKind;
  subject?: string | null;
  content: string;
  limitations: string;
  sources?: EvidenceRef[];
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
export interface ProfileSeed {
  character?: string | null;
  ocean?: Ocean | null;
  vad?: Vad | null;
  /**
   * Optional reproducible initialization seed. Omit for a fresh random seed.
   */
  random_seed?: string | null;
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
export interface Continuity {
  /**
   * Continue requests another funded decision even with no actions (e.g. navigate memory). Wait yields when this response has no actions; an explicit wait action always stops its batch.
   */
  next?: "continue" | "wait";
  /**
   * Your next intended outcome or uncertainty, not a claim of completion.
   */
  focus: string;
  disposition: LearningDisposition;
  /**
   * Brief reason for retaining, revising, organizing, deferring or making no change.
   */
  learning: string;
  changes: Change[];
  memory: Selection2;
  /**
   * Replace the next context selection; include still-needed record IDs.
   */
  records: string[];
  actions: string[];
  retrieval_query: string;
  /**
   * Compact account for the next decision. Does not remove obligations or source restrictions.
   */
  handoff: string;
}
export interface Change {
  /**
   * Unique local name, referenced as $name elsewhere in this transaction.
   */
  handle: string;
  /**
   * Exact node version to revise/reorganize/retire; null creates a node.
   */
  node?: VersionRef | null;
  /**
   * Your new prompt part, or null to keep this node's current immutable fragment.
   */
  draft?: FragmentDraft | null;
  /**
   * Replace primary parent; null places at root. Node ID or $handle.
   */
  parent?: string | null;
  /**
   * Replace cross-links. Node IDs or $handles; links do not select their content.
   */
  related: string[];
  retire: boolean;
  /**
   * Replace the optional retrieval utility; null removes it. Versioned with this node.
   */
  locator?: Locator | null;
}
export interface Locator {
  description: string;
  /**
   * Python source defining locate(arguments, nodes). Returns only existing node version references; no generated fragment content.
   */
  script: string;
  /**
   * Exact required string arguments chosen by the calling persona.
   */
  parameters: Parameter[];
}
export interface Parameter {
  name: string;
  description: string;
}
export interface Selection2 {
  /**
   * Replace the next call's full prompt parts with these stable node IDs (or $handles created in this response).
   */
  active: string[];
  /**
   * Branch whose short descriptions to show next. Null is the virtual root.
   */
  branch?: string | null;
  after?: number | null;
}
/**
 * Cursor pages are bounded transport, not a persona memory policy.
 */
export interface Page2 {
  items: Record[];
  next?: number | null;
  sequence: number;
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
export interface InferenceCatalog {
  models: Model[];
  /**
   * Separately funded structured-decision capabilities, not chat models.
   */
  decision_models: Model[];
  providers: ProviderStatus[];
  checked: string;
  [k: string]: unknown;
}
export interface ProviderStatus {
  provider: string;
  available: boolean;
  models: number;
  /**
   * Access-safe setup guidance; never raw provider output or credentials.
   */
  message: string;
  [k: string]: unknown;
}
export interface ProviderSettings {
  revision: string;
  connections: SavedConnection[];
  /**
   * Connections supplied by the node launcher cannot be overwritten here.
   */
  host_providers: string[];
  /**
   * Verified model limits, intersected with the account's /models response.
   */
  templates: Connection[];
  /**
   * Separate choice capability; never a persona's primary chat model.
   */
  typesafe?: KeyStatus | null;
  [k: string]: unknown;
}
export interface SavedConnection {
  connection: Connection;
  key_saved: boolean;
  updated: string;
  [k: string]: unknown;
}
export interface Connection {
  provider: string;
  protocol: Protocol;
  config: HttpConfig;
}
export interface HttpConfig {
  /**
   * Exact /responses endpoint. No URL is supplied by a model decision.
   */
  endpoint: string;
  api_key_env?: string | null;
  trust_loopback_http?: boolean;
  models: HttpModel[];
  timeout_ms?: number;
  max_request_bytes?: number;
  /**
   * Decoded response and individual SSE frame limit. Streaming wire bytes
   * have a separate 64x allowance, capped at 128 MiB, and are not buffered.
   */
  max_response_bytes?: number;
  max_actions?: number;
  max_images?: number;
}
export interface HttpModel {
  id: string;
  context_window_tokens: number;
  max_output_tokens: number;
  /**
   * Operator-supplied upper bound for the selected tokenizer. This is not
   * tokenizer discovery. Use a documented byte-level tokenizer bound.
   */
  input_tokens_per_utf8_byte_upper_bound: number;
  /**
   * Accounts for framing/tokenizer overhead not represented by text bytes.
   */
  framing_token_allowance: number;
  vision?: boolean;
  /**
   * Required for vision; a conservative per-image charge, not inferred from
   * the model name, media byte length, or a hard-coded vendor tier.
   */
  image_token_upper_bound?: number | null;
  allowed_reasoning_efforts?: string[];
}
export interface KeyStatus {
  key_saved: boolean;
  updated: string;
  [k: string]: unknown;
}
/**
 * Cursor pages are bounded transport, not a persona memory policy.
 */
export interface Page4 {
  items: MessageDelivery[];
  next?: number | null;
  sequence: number;
  [k: string]: unknown;
}
/**
 * Operator-visible receipts, not a claim of understanding or a promised reply.
 */
export interface MessageDelivery {
  persona: string;
  delivered: boolean;
  acknowledged: boolean;
  /**
   * Exact saved call whose admitted request included this inbox item.
   */
  included_call?: string | null;
  participation?: Record | null;
  funding_root?: string | null;
  [k: string]: unknown;
}
/**
 * Public assistant text is provisional until the entire decision is accepted.
 * This projection excludes private reasoning, raw envelopes and partial actions.
 */
export interface CallProgress {
  messages: ProgressMessage[];
  truncated: boolean;
  status: string;
  done: boolean;
  [k: string]: unknown;
}
export interface ProgressMessage {
  index: number;
  kind: string;
  text: string;
  [k: string]: unknown;
}
/**
 * Bounded recent action receipts for the operator's live activity view.
 */
export interface ActionActivity {
  id: string;
  kind: string;
  state: string;
  created: string;
  finished?: string | null;
  error?: string | null;
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
  continuity: Continuity;
  actions: DecisionAction[];
  [k: string]: unknown;
}
export interface DecisionAction {
  kind: string;
  args: unknown;
  [k: string]: unknown;
}
