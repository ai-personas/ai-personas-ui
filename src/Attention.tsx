import type { Entity } from './api';
import { fields, inputRequestCount, isRecordID } from './workspace';
import Icon from './Icon';

export function InputBadge({ record }: { record: Entity }) {
  const count = inputRequestCount(record);
  if (record.kind === 'request' && fields(record.data).status === 'open' && fields(record.data).audience === 'work') return <span class="shared-question-badge">Open to peers · your reply is optional</span>;
  return count > 0 ? <span class="input-badge"><Icon name="Attention"/>{count} {count === 1 ? 'request needs' : 'requests need'} your input</span> : null;
}

export function InputNotice({ record, open }: { record: Entity; open: (id: string) => void }) {
  const shared = record.kind === 'request' && fields(record.data).status === 'open' && fields(record.data).audience === 'work';
  if (!inputRequestCount(record) && !shared) return null;
  const id = record.kind === 'request' ? record.id : fields(record.data).input_request;
  return <div class={shared ? "shared-question-notice" : "input-notice"}><InputBadge record={record}/>{isRecordID(id) && <button class="input-action" onClick={() => open(id)}>{shared ? 'Add a reply' : 'Respond now'} <Icon name="Arrow"/></button>}</div>;
}
