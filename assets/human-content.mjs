const TECHNICAL_KEY = /(?:^|_)(?:id|ids|did|ref|refs|hash|sha256|signature|signature_hex|key_id|kernel_id|node_id|persona_id|environment_id|workspace_id|run_id|bundle_id|artifact_id|record_id|call_id|request_id|schema|url|uri|locator|token)(?:$|_)/i;
const HUMAN_PRIORITY = [
  'message', 'summary', 'answer', 'result', 'outcome', 'description', 'rationale',
  'intent', 'task', 'purpose', 'next_needed_effect', 'status', 'reason', 'detail',
];

const clean = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

const ACTIVITY_HEADLINES = Object.freeze({
  MODEL_CALL: 'Working through a model-assisted step',
  MODEL_SELECTED: 'Prepared a model for the next work step',
  MODEL_CALL_SUCCEEDED: 'Finished a model-assisted work step',
  MODEL_CALL_FAILED: 'A model-assisted work step needs attention',
  LLM_OUTPUT: 'Shared a completed response',
  LLM_LESSON: 'Captured a lesson from the work',
  COGNITION_LESSON: 'Shared a lesson',
  COGNITION_TACTIC: 'Shared an approach',
  COGNITION_PROVEN_FACT: 'Shared a verified finding',
  PROVISIONAL_ASSISTANT_MESSAGE: 'Drafting an update',
  PERSONA_COMMUNICATION_AUTHORED: 'Shared an update',
  PERSONA_COMMUNICATION_INTENT_RECORDED: 'Prepared an update for collaborators',
  PERSONA_COMMUNICATION_DELIVERY_RECORDED: 'Delivered an update to collaborators',
  PERSONA_COGNITIVE_INTENT: 'Chose the next work step',
  PERSONA_WORK_SITUATION_OBSERVED: 'Reviewed the current work situation',
  PERSONA_WORK_STATE_AUTHORED: 'Shared an updated work plan',
  PERSONA_WORK_STATE_SETTLEMENT_PENDING: 'Paused while workspace changes settle',
  PERSONA_WORK_STATE_SETTLEMENT_BOUND: 'Reconciled the work plan with the shared workspace',
  PERSONA_INVITATION_AUTHORED: 'Invited a collaborator',
  PERSONA_INVITATION_RESPONSE_AUTHORED: 'Responded to an invitation',
  PERSONA_BIRTH_NEED_AUTHORED: 'Identified a need for a new specialist',
  PERSONA_RECRUITMENT_SEARCH_RECORDED: 'Checked the network for an existing collaborator',
  PERSONA_BIRTH_PROPOSAL_AUTHORED: 'Proposed a new specialist',
  PERSONA_BIRTH_ADMITTED: 'Welcomed a new specialist',
  PERSONA_BIRTH_REFUSED: 'Decided not to add a specialist',
  PERSONA_DISPLAY_NAME_ADOPTED: 'Chose a public name',
  PERSONA_CHARACTERISTICS_ADOPTED: 'Shared a public self-description',
  PERSONA_CHARACTERISTICS_REVISED: 'Updated a public self-description',
  PERSONA_RASTER_AVATAR_ADMITTED: 'Adopted a public portrait',
  PERSONA_MODEL_CHOICE_RECORDED: 'Selected a model for the next work step',
  PERSONA_RESOURCE_STATE_OBSERVED: 'Reviewed the available execution resources',
  PERSONA_WORKSPACE_STATE_CHANGED: 'Updated the shared workspace',
  PERSONA_TURN_EFFECT_RECEIPT_RECORDED: 'Confirmed the result of a work step',
  MEMBER_JOINED: 'Joined the workspace',
  ENV_MEMBER_ADMITTED: 'Joined the workspace',
  ENV_MEMBER_RE_ADMITTED: 'Rejoined the workspace',
  BLACKBOARD_POST: 'Shared a workspace note',
  GOAL_PROGRESS_REPORTED: 'Reported progress toward the goal',
  CANDIDATE_PRODUCED: 'Produced a candidate answer',
  CANDIDATE_REPAIRED: 'Improved the candidate answer',
  VERIFIER_VERDICT: 'Reviewed the proposed result',
  ANSWER_EVALUATED: 'Evaluated the answer',
  SAFETY_CHECKED: 'Completed a safety review',
  TASK_COMPLETED: 'Completed the task',
  TASK_ACCEPTED: 'Accepted the result',
  TASK_NOT_ACCEPTED: 'Requested another improvement pass',
  PERSONA_ACTION_AUTHORED: 'Planned an action',
  PERSONA_ACTION_COMPLETED: 'Completed an action',
  PERSONA_ACTION_FAILED: 'An action needs attention',
  ENV_MCP_TOOL_INVOKED: 'Used a workspace tool',
  EXTERNAL_CAPABILITY_ACQUIRED: 'Added a new capability',
  CAPABILITY_PROVISIONED: 'Prepared a new capability',
});

// Persona actions are open vocabulary, but the built-in action surface has
// stable names. Translate those names into work a person can understand while
// leaving the exact signed action available in the verification disclosure.
const ACTION_HEADLINES = Object.freeze({
  command_exec: 'Ran a workspace command',
  code_exec: 'Ran code in the workspace',
  managed_process_launch: 'Started a workspace process',
  managed_process_inspect: 'Checked a running workspace process',
  managed_process_write: 'Sent input to a workspace process',
  managed_process_wait: 'Waited for a workspace process',
  managed_process_signal: 'Signalled a workspace process',
  managed_process_stop: 'Stopped a workspace process',
  inspect_workspace_file: 'Inspected a workspace file',
  inspect_execution_capabilities: 'Checked available engineering tools',
  discover_mcp_capabilities: 'Looked for a needed tool',
  acquire_mcp_candidate: 'Acquired a new tool',
  author_provisioning_recipe: 'Prepared a reusable tool setup',
  discover_coordination_definitions: 'Reviewed available collaboration patterns',
  discover_coordination_actions: 'Checked available collaboration actions',
  author_coordination_definition: 'Created a reusable collaboration pattern',
  author_coordination_action: 'Recorded a collaboration step',
  record_persona_state: 'Recorded the current working state',
  persona_schedule_wake: 'Scheduled a follow-up check',
  discover_personas: 'Looked for collaborators',
  persona_message: 'Messaged a collaborator',
  propose_persona_birth: 'Proposed a new specialist',
  record_persona_work_state: 'Shared the current understanding and next work step',
  declare_artifact: 'Published a deliverable',
  declare_observation: 'Recorded an evidence-backed observation',
  record_outcome_disposition: 'Recorded the work outcome',
  goal_progress: 'Updated progress toward the goal',
  blackboard_post: 'Shared a workspace note',
  request_external_artifact: 'Requested an external artifact',
  inspect_external_artifact_state: 'Checked an external artifact request',
  admit_persona_avatar: 'Adopted a public portrait',
  adopt_persona_display_name: 'Adopted a public name',
  adopt_persona_characteristics: 'Described how I work',
});

const PURPOSE_CONTEXT = Object.freeze({
  candidate: 'developing a candidate answer',
  repair: 'improving the candidate answer',
  judge: 'evaluating the proposed result',
  safety: 'checking the result for safety',
  objective: 'clarifying the goals',
  classifier: 'understanding the task',
  optimize_tactics: 'improving the working approach',
  answer: 'developing the answer',
  verifier: 'checking the result independently',
  artifact_review: 'reviewing the deliverables',
  artifact_generation: 'creating the deliverables',
  artifact_revision: 'improving the deliverables',
  model: 'working through the task',
});

export function isTechnicalKey(key) {
  return TECHNICAL_KEY.test(String(key || ''));
}

export function humanizeMachineKey(key) {
  const words = String(key || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return words ? words[0].toUpperCase() + words.slice(1) : 'Detail';
}

export function isMachineIdentifier(value) {
  const text = clean(value);
  if (!text) return false;
  if (/^(?:did:|sha256:|kernel:|persona:|env:|run[-:]|workspace[-:]|bundle[-:]|artifact[-:]|record[-:])/i.test(text)) return true;
  if (/^[0-9a-f]{32,}$/i.test(text) || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(text)) return true;
  if (/^[A-Z0-9_-]{24,}$/i.test(text) && /\d/.test(text)) return true;
  return false;
}

export function friendlyDuration(value) {
  const ms=Number(value);
  if(!Number.isFinite(ms)||ms<0) return '';
  if(ms<1000) return 'less than a second';
  const seconds=Math.round(ms/1000);
  if(seconds<60) return `${seconds} second${seconds===1?'':'s'}`;
  const minutes=Math.floor(seconds/60), remainder=seconds%60;
  if(minutes<60) return `${minutes} minute${minutes===1?'':'s'}${remainder?` ${remainder} second${remainder===1?'':'s'}`:''}`;
  const hours=Math.floor(minutes/60), minuteRemainder=minutes%60;
  return `${hours} hour${hours===1?'':'s'}${minuteRemainder?` ${minuteRemainder} minute${minuteRemainder===1?'':'s'}`:''}`;
}

export function humanActivityPresentation(kind, provenance = {}) {
  const machineKind=String(kind||'').trim().toUpperCase();
  const purpose=String(provenance?.purpose||'').trim();
  const context=PURPOSE_CONTEXT[purpose]||'';
  const duration=friendlyDuration(provenance?.latencyMs);
  const authoredAction=clean(provenance?.action);
  const actionUsable=authoredAction&&!isMachineIdentifier(authoredAction)
    &&!/^[_A-Z0-9:-]+$/.test(authoredAction)&&authoredAction.length<=180;
  const knownAction=ACTION_HEADLINES[authoredAction.toLowerCase()]||'';
  const authoredPurpose=clean(provenance?.actionPurpose);
  const purposeUsable=authoredPurpose&&!isMachineIdentifier(authoredPurpose)
    &&authoredPurpose.length<=600;
  const headline=(knownAction||(actionUsable?authoredAction:ACTIVITY_HEADLINES[machineKind]))
    ||humanizeMachineKey(machineKind||'activity');
  const summary=purposeUsable
    ?`${authoredPurpose}${/[.!?]$/.test(authoredPurpose)?'':'.'}`
    :context
    ?`${context[0].toUpperCase()}${context.slice(1)}.`:'';
  return Object.freeze({headline,summary,duration,context});
}

function scalar(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  const text = clean(value);
  return text && !isMachineIdentifier(text) ? text : '';
}

function parseInput(input) {
  if (input && typeof input === 'object') {
    return { parsed: input, raw: JSON.stringify(input, null, 2) };
  }
  const raw = String(input ?? '').trim();
  if (!raw || !/^[{[]/.test(raw)) return { parsed: null, raw };
  try { return { parsed: JSON.parse(raw), raw }; } catch (_) { return { parsed: null, raw }; }
}

function pushUnique(target, value, limit) {
  const text = clean(value);
  if (!text || target.includes(text) || target.length >= limit) return;
  target.push(text);
}

/**
 * Convert arbitrary model/operator JSON into a bounded, human-first projection.
 * Technical identifiers remain available through `raw`, but never become the
 * headline, prose, facts, or list items.
 */
export function structuredContentProjection(input) {
  const { parsed, raw } = parseInput(input);
  if (parsed === null) {
    return { parsed: false, headline: '', paragraphs: raw ? [raw] : [], facts: [], items: [], raw };
  }

  const paragraphs = [], facts = [], items = [];
  let headline = '';
  const visited = new Set();

  const visit = (value, depth = 0, parent = '') => {
    if (value === null || value === undefined || depth > 3) return;
    if (typeof value !== 'object') {
      const text = scalar(value);
      if (text && !headline) headline = text;
      else pushUnique(paragraphs, text, 4);
      return;
    }
    if (visited.has(value)) return;
    visited.add(value);

    if (Array.isArray(value)) {
      for (const entry of value.slice(0, 12)) {
        const text = scalar(entry);
        if (text) pushUnique(items, text, 12);
        else if (entry && typeof entry === 'object') visit(entry, depth + 1, parent);
      }
      return;
    }

    const entries = Object.entries(value);
    const ordered = [
      ...HUMAN_PRIORITY.flatMap((key) => entries.filter(([candidate]) => candidate === key)),
      ...entries.filter(([key]) => !HUMAN_PRIORITY.includes(key)),
    ];
    for (const [key, entry] of ordered) {
      if (isTechnicalKey(key) || entry === null || entry === undefined) continue;
      const label = humanizeMachineKey(key);
      const text = scalar(entry);
      if (text) {
        if (HUMAN_PRIORITY.includes(key) && !headline && text.length <= 300) headline = text;
        else if (HUMAN_PRIORITY.includes(key) && text.length > 80) pushUnique(paragraphs, text, 4);
        else if (facts.length < 10) facts.push({ label, value: text });
        continue;
      }
      if (Array.isArray(entry)) {
        const before = items.length;
        visit(entry, depth + 1, key);
        if (items.length > before && parent && facts.length < 10) {
          facts.push({ label, value: `${entry.length} item${entry.length === 1 ? '' : 's'}` });
        }
      } else if (entry && typeof entry === 'object') {
        visit(entry, depth + 1, key);
      }
    }
  };

  visit(parsed);
  if (!headline) {
    if (items.length) headline = `${items.length} item${items.length === 1 ? '' : 's'} returned`;
    else if (facts.length) headline = 'Structured response';
    else headline = 'Technical response received';
  }
  const meaningfulFacts = facts.filter(({ value }) => value !== headline && !isMachineIdentifier(value));
  return { parsed: true, headline, paragraphs, facts: meaningfulFacts, items, raw };
}

export function operatorResponseText(body, status = 0) {
  const projection = structuredContentProjection(body);
  const ok = status >= 200 && status < 300;
  const lines = [ok ? 'Request succeeded.' : status ? `Request failed (HTTP ${status}).` : 'No response from the node.'];
  if (projection.headline) lines.push(projection.headline);
  for (const paragraph of projection.paragraphs.slice(0, 2)) {
    if (paragraph !== projection.headline) lines.push(paragraph);
  }
  for (const fact of projection.facts.slice(0, 8)) lines.push(`${fact.label}: ${fact.value}`);
  for (const item of projection.items.slice(0, 8)) lines.push(`• ${item}`);
  return [...new Set(lines.filter(Boolean))].join('\n');
}
