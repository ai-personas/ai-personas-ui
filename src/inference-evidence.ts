/** Read only recognized receipt shapes. Missing evidence is not a zero count,
 * and pre-dispatch admission is not proof of model receipt or learning benefit. */
type ObjectValue = Record<string, unknown>;
const object = (value: unknown): ObjectValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as ObjectValue : {};
const count = (value: unknown): number | undefined => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const list = (value: unknown): unknown[] | undefined => Array.isArray(value) && value.length <= 512 ? value : undefined;
export type EvidenceReference = { id: string; revision: number };
export type StoppedActionReference = { id: string; call: string; run: string; actor: string };
export function stoppedActionReference(value: unknown): StoppedActionReference | undefined {
  const call = object(value), d = object(call.data);
  const ids = [d.stopped_after, call.id, call.scope, d.owner];
  return call.kind === 'call' && ids.every(id => typeof id === 'string' && /^[a-fA-F0-9]{32}$/.test(id))
    ? { id: ids[0] as string, call: ids[1] as string, run: ids[2] as string, actor: ids[3] as string } : undefined;
}
export function actionBelongsToCall(value: unknown, ref: StoppedActionReference): boolean {
  const action = object(value), request = object(action.request);
  return request.id === ref.id && request.run === ref.run && request.actor === ref.actor && request.source === 'call:' + ref.call;
}
function reference(value: unknown): EvidenceReference | undefined {
  const v = object(value), revision = count(v.revision);
  return typeof v.id === 'string' && /^[a-fA-F0-9]{32}$/.test(v.id) && revision !== undefined && revision > 0
    ? { id: v.id, revision } : undefined;
}
function references(value: unknown, field?: string): EvidenceReference[] | undefined {
  const values = list(value); if (!values) return undefined;
  const result = values.map(item => reference(field ? object(item)[field] : item));
  return result.every(item => item !== undefined) ? result as EvidenceReference[] : undefined;
}
function receipt(value: unknown, schema: string): ObjectValue | undefined {
  const v = object(value);
  const stage = schema === 'context-recovery/1' || (v.stage === 'admitted_request' && v.transport_boundary === 'pre_dispatch');
  return v.schema === schema && stage ? v : undefined;
}
function transport(value: unknown, call: ObjectValue) {
  const v = object(value);
  if (v.schema !== 'provider-observation/1' || v.source !== 'adapter_transport_receipt' || v.raw_payload_retained !== false
    || typeof call.provider !== 'string' || !call.provider || v.provider !== call.provider
    || typeof call.requested_model !== 'string' || !call.requested_model || v.requested_model !== call.requested_model) return undefined;
  const categories: Record<string, string> = { authentication: 'Authentication rejected', rate_limit: 'Rate limited', unavailable: 'Provider unavailable', http_failure: 'HTTP request failed', transport: 'Connection interrupted or unavailable', response_limit: 'Response exceeded the configured limit', malformed_output: 'Response did not satisfy the required format', cancelled: 'Call cancelled' };
  const outcomes: Record<string, string> = { not_dispatched: 'Not dispatched', in_flight: 'Awaiting a complete response when recorded', completed: 'Response validated', failed: 'Failed' };
  const status = count(v.http_status);
  return { dispatched: typeof v.dispatched === 'boolean' ? v.dispatched : undefined,
    status: status !== undefined && status >= 100 && status <= 599 ? status : undefined,
    category: typeof v.error_category === 'string' && Object.hasOwn(categories, v.error_category) ? categories[v.error_category] : undefined,
    outcome: typeof v.outcome === 'string' && Object.hasOwn(outcomes, v.outcome) ? outcomes[v.outcome] : undefined };
}
export function inferenceEvidence(value: unknown) {
  const d = object(value), recovery = receipt(d.context_recovery, 'context-recovery/1');
  const discovery = receipt(d.discovery_context, 'discovery-context/1');
  const memory = receipt(d.memory_context, 'memory-context/1');
  const learning = receipt(d.learning_context, 'learning-context/1');
  const questions = receipt(d.question_context, 'question-context-receipt/1');
  const offered = discovery ? references(discovery.offered, 'version') : undefined;
  const active = learning ? references(learning.active, 'fragment') : undefined;
  const memoryOffered = memory ? references(memory.offered, 'node') : undefined;
  const corrections = learning ? references(learning.correction_notices) : undefined;
  const admission = object(d.context_admission);
  const exposure = admission.measured_usage === false && admission.byte_count_is_token_count === false
    ? { input: count(admission.input_exposure_upper_tokens), output: count(admission.output_exposure_upper_tokens), bytes: count(admission.request_bytes) } : undefined;
  const usage = object(d.usage), input = count(usage.input), output = count(usage.output), cached = count(usage.cached);
  const measured = usage.known === true && input !== undefined && output !== undefined && cached !== undefined
    && cached <= input && Number.isSafeInteger(input + output) ? { input, output, cached } : undefined;
  const questionList = questions ? list(questions.questions) : undefined;
  const questionRefs = questionList ? references(questionList, 'question') : undefined;
  const replies = questionList?.map(q => count(object(q).visible_reply_count));
  const replyCount = replies?.every(n => n !== undefined) ? replies.reduce<number>((a, b) => a + b!, 0) : undefined;
  const breakdown = object(d.context_breakdown);
  const contextParts = breakdown.unit === 'serialized_utf8_bytes' && breakdown.not_token_usage === true ? [
    ['Instructions', 'instructions'], ['Operation descriptions', 'operation_schema'], ['Current work and obligations', 'mandatory_work'],
    ['Memory fragment descriptions', 'memory_descriptions'], ['Selected records', 'selected_records'], ['Selected lessons', 'selected_learning'], ['Action history', 'history'],
    ['Unread inputs', 'unread_inputs'], ['Media descriptions', 'media_descriptors'],
  ].map(([label, key]) => ({ label, bytes: count(breakdown[key]) })).filter(part => part.bytes !== undefined) : undefined;
  return {
    transport: transport(d.provider_observation, d),
    contextParts, maintenance: d.decision_mode === 'context_maintenance',
    state: typeof d.status === 'string' ? d.status.slice(0, 96) : 'Not recorded',
    contextBytes: count(d.context_bytes) ?? exposure?.bytes, measured, exposure,
    recovery: recovery ? {
      history: list(recovery.omitted_history)?.length,
      commands: list(recovery.projected_commands)?.length,
      diagnostics: list(recovery.projected_diagnostics)?.length,
      previews: count(recovery.omitted_discovery_candidates),
      retention: count(recovery.omitted_retention_opportunities),
      originalBytes: count(recovery.original_request_bytes),
    } : undefined,
    memory: memory ? { offered: memoryOffered,
      previewsSuspended: memory.preview_status === 'suspended_by_persona' && memory.preview_limit === 0 && memoryOffered?.length === 0 } : undefined,
    discovery: discovery ? { offered } : undefined,
    learning: learning ? { active, corrections } : undefined,
    questions: questions ? { references: questionRefs, replies: replyCount !== undefined && Number.isSafeInteger(replyCount) ? replyCount : undefined } : undefined,
  };
}

export function learningKind(kind: string): string {
  return kind === 'fragment' ? 'Retained lesson — usefulness not established'
    : kind === 'document' ? 'Document — not a retained lesson'
    : kind === 'tool' ? 'Registered tool — see acquisition evidence'
    : 'Saved content';
}
