import type { Entity } from './api';
import { fields, inputRequestCount, isRecordID } from './workspace';
import Icon from './Icon';

export function InputBadge({ record }: { record: Entity }) {
  const count = inputRequestCount(record);
  if (count > 0 && record.kind === 'request' && fields(record.data).audience === 'work') return <span class="input-badge"><Icon name="Attention"/>Shared question needs an answer</span>;
  return count > 0 ? <span class="input-badge"><Icon name="Attention"/>{count} {count === 1 ? 'request needs' : 'requests need'} your input</span> : null;
}

export function InputNotice({ record, open }: { record: Entity; open: (id: string) => void }) {
  if (!inputRequestCount(record)) return null;
  const id = record.kind === 'request' ? record.id : fields(record.data).input_request;
  return <div class="input-notice"><InputBadge record={record}/>{isRecordID(id) && <button class="input-action" onClick={() => open(id)}>Respond now <Icon name="Arrow"/></button>}</div>;
}
