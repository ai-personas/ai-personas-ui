import { data, label, type Entity } from './api';
import { fields, text } from './workspace';
import { fileFormat as describeFile } from './files/formats';

const LABELS: Record<string, string> = {
  request_resolution: 'Question conclusion', run: 'Persona activity', call: 'Model activity', fragment: 'Learning note', document: 'Document', artifact: 'File',
  submission: 'Submitted version', finding: 'Assessment', resource_root: 'Funding allowance',
  work_entry: 'Work update', work_mandate: 'Work brief', work_release: 'Release', response: 'Answer', request: 'Question',
  resource_charge: 'Call usage', budget_charge: 'Resource usage',
  offered_to: 'Offered to', from: 'From', to: 'To', persona: 'Persona', owner: 'Author / owner', author: 'Author',
  content: 'Content', brief: 'The request', purpose: 'Question', instructions: 'Instructions', findings: 'Review findings',
  applicability: 'Applies when', limitations: 'Limitations', evidence_required: 'Evidence requested',
  resource_root_id: 'Funding allowance', media_type: 'File format', created: 'Created', updated: 'Updated',
};
export function humanLabel(value: string): string {
  return LABELS[value] || value.replaceAll('_', ' ').replaceAll('.', ' › ').replace(/^./, c => c.toUpperCase());
}
export function recordTitle(record: Entity): string {
  const d = data(record), draft = fields(d.draft);
  if (!text(d.name) && !text(d.title) && !text(d.purpose)) {
    if (record.kind === 'work_entry') return ({ assumption: 'Assumption to check', decision: 'Decision', proposal: 'Proposed approach', change: 'Proposed change', handoff: 'Handoff', question: 'Open question' } as Record<string, string>)[text(d.entry_kind || draft.kind)] || 'Work update';
    if (record.kind === 'commitment' && text(draft.description)) return excerpt(draft.description, 100);
    if (record.kind === 'work_mandate') return 'Agreed scope';
    if (record.kind === 'message') return 'Message';
  }
  if (record.kind === 'experience_review') return ({ retain:'Retained learning', revise:'Reconsidered learning', no_change:'Observation without lasting change', defer:'Interpretation deferred' } as Record<string,string>)[text(d.disposition)] || 'Experience interpretation';
  if (record.kind === 'exploration_opportunity') return excerpt(d.question, 100) || 'Personal exploration';
  if (record.kind === 'exploration_policy') return 'Exploration permission';
  const title = label(record);
  return title === record.kind ? humanLabel(record.kind) : title;
}
export function actionTitle(kind: string): string {
  const titles: Record<string, string> = {
    'record.read': 'Read saved information', 'record.list': 'Find saved information', 'history.read': 'Read earlier activity',
    'message.send': 'Send a message', 'request.create': 'Ask for input', 'request.respond': 'Answer a question', 'request.resolve': 'Record a conclusion',
    'persona.profile.configure': 'Change character settings', 'persona.orientation.record': 'Record an initial approach', 'experience.review': 'Interpret an observation', 'exploration.propose': 'Propose personal exploration', 'exploration.configure': 'Configure exploration permission', 'exploration.finish': 'Conclude an exploration episode', 'exploration.cancel': 'Cancel scheduled exploration',
    'profile.update': 'Update persona profile', 'persona.update': 'Update persona profile', 'environment.update': 'Update the shared environment',
    'document.create': 'Write a document', 'document.revise': 'Revise a document', 'document.update': 'Update a document', 'document.read': 'Read a document',
    'fragment.create': 'Save a learning note', 'fragment.revise': 'Refine a learning note', 'artifact.publish': 'Save a file',
    'submission.create': 'Submit work', 'work.submit': 'Submit work', 'work.entry.create': 'Propose a work update', 'work.entry.append': 'Add a work update',
    'commitment.offer': 'Offer responsibility', 'commitment.accept': 'Accept responsibility', 'commitment.update': 'Update a responsibility',
    'invitation.respond': 'Respond to an invitation', 'work.invitation.respond': 'Respond to an invitation',
    'model.choose': 'Choose a model', 'context.compact': 'Update retained context', 'context.advance': 'Choose learning and next focus',
    'exec': 'Run a tool', 'job.read': 'Read tool output', 'job.cancel': 'Stop a tool', 'image.observe': 'Inspect an image',
    'run.pause': 'Pause decisions', 'run.resume': 'Resume work', 'run.cancel': 'Cancel work',
    'document.write': 'Write a document', 'fragment.write': 'Save a learning note',
    'submit': 'Submit work', 'assess': 'Record an assessment', 'review.start': 'Request a review', 'wait': 'Wait for input',
    'input.acknowledge': 'Acknowledge new input', 'context.select': 'Select context for future work', 'context.discard': 'Discard retained context',
    'work.create': 'Start work', 'work.amend': 'Update the work scope', 'work.archive': 'Archive work', 'work.summary': 'Check work progress', 'work.mandate.adopt': 'Adopt the work scope',
    'work.entry.dispose': 'Respond to a work update', 'commitment.respond': 'Respond to a responsibility offer',
    'commitment.handoff.offer': 'Offer a handoff', 'commitment.handoff.respond': 'Respond to a handoff',
    'agreement.propose': 'Propose an agreement', 'agreement.endorse': 'Endorse an agreement', 'feedback.open': 'Give feedback', 'feedback.dispose': 'Respond to feedback',
    'assembly.adopt': 'Choose a work version', 'evidence.bind': 'Link supporting evidence', 'release.commit': 'Release a work version',
    'participants.add': 'Invite a persona', 'participants.remove': 'Remove a persona', 'persona.create': 'Create a persona', 'persona.retire': 'Retire a persona', 'persona.activate': 'Activate a persona',
    'environment.create': 'Create an environment', 'environment.tool.add': 'Add a shared tool', 'environment.tool.remove': 'Remove a shared tool', 'browser.search': 'Search the web', 'browser.open': 'Read a source page', 'invitation.extend': 'Extend orientation', 'request.cancel': 'Close a question', 'invitation.offer': 'Invite a persona',
    'action.read': 'Read action details', 'artifact.inspect': 'Inspect a saved file', 'artifact.capture': 'Save a file', 'tool.register': 'Register a tool',
    'resource.summary': 'Check available funding', 'resource.root.create': 'Create a funding allowance', 'resource.root.amend': 'Update funding limits',
    'information.policy': 'Update sharing settings', 'information.withdraw': 'Withdraw shared information', 'information.erase': 'Erase selected content',
  };
  return titles[kind] || 'Activity update';
}
export function excerpt(value: unknown, limit = 260): string {
  if (typeof value !== 'string') return '';
  const plain = value.replace(/^\s{0,3}#{1,6}\s+.+$/gm, '').replace(/!?(\[([^\]]+)\])\([^)]*\)/g, '$2')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/gm, '')
    .replace(/[*_`~]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > limit ? plain.slice(0, limit).trimEnd() + '…' : plain;
}
export function recordExcerpt(record: Entity): string {
  const d = data(record), draft = fields(d.draft);
  return excerpt([d.summary, d.description, d.content, d.text, draft.text, draft.description, d.brief, d.purpose, d.note].find(v => typeof v === 'string' && v.trim()));
}
export function fileSize(bytes: unknown): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return 'Size not recorded';
  if (bytes < 1024) return `${bytes.toLocaleString()} bytes`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / 1024 ** 2).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB`;
}
export function fileFormat(media: unknown, name?: unknown): string {
  return describeFile(typeof name === 'string' ? name : '', typeof media === 'string' ? media : '').label;
}
