/** Decode the received transport for synthetic browser providers.
 * These fixtures exercise the real Node; they do not implement runtime policy.
 */
export function decisionContext(input) {
  const context = JSON.parse(input.input[0].content[0].text);
  const values = context.context_values || [];
  const expand = value => {
    if (Array.isArray(value)) return value.map(expand);
    if (value && typeof value === 'object') {
      if (Object.keys(value).length === 1 && Number.isInteger(value.$v)) return expand(values[value.$v]);
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, expand(child)]));
    }
    return value;
  };
  return expand(context);
}

/** Discover contracts from the actual response schema, not a diagnostic copy. */
export function offeredActions(input, actions) {
  const schema = input.tools?.find(tool => tool.type === 'function' && tool.name === 'submit_decision')?.parameters || input.text?.format?.schema;
  if (!schema) throw new Error('The provider request did not include a decision contract.');
  const resolve = value => value?.$ref ? resolve(schema.$defs[value.$ref.slice('#/$defs/'.length)]) : value;
  const variants = resolve(resolve(schema.properties.actions).items).anyOf;
  const loaded = variants.map(variant => resolve(resolve(variant).properties.kind).enum[0]);
  const missing = [...new Set(actions.map(action => action.kind).filter(kind => !loaded.includes(kind)))];
  return missing.length ? missing.map(operation => ({ kind: 'operation.describe', args: { operation } })) : actions;
}

/** Match the actual submission transport requested by the runtime. */
export function decisionOutput(input, argumentsJSON, id = 'fixture-decision') {
  const submission = input.tools?.find(tool => tool.type === 'function' && tool.name === 'submit_decision');
  return submission
    ? { type: 'function_call', id, call_id: id + '-call', name: submission.name, status: 'completed', arguments: argumentsJSON }
    : { type: 'message', role: 'assistant', status: 'completed', phase: 'final_answer', content: [{ type: 'output_text', text: argumentsJSON }] };
}
