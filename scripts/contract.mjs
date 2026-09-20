import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { compile } from 'json-schema-to-typescript';
const binary = process.env.PERSONAS_BIN || new URL('../../ai-personas/target/debug/personas', import.meta.url).pathname;
const schemaPath = new URL('../api.schema.json', import.meta.url).pathname;
execFileSync(binary, ['contract','--out',schemaPath]);
const contract=JSON.parse(readFileSync(schemaPath,'utf8'));
writeFileSync(new URL('../src/contract.d.ts',import.meta.url),await compile(contract.types,'ApiTypes',{bannerComment:'/* Generated from the Rust runtime contract. Run npm run contract. */'}));
function type(s){if(s===true)return 'JSON value';if(s.$ref)return s.$ref.split('/').at(-1);if(s.anyOf)return s.anyOf.map(type).join(' or ');if(s.type==='array')return type(s.items)+'[]';return Array.isArray(s.type)?s.type.join(' or '):(s.type||'JSON value');}
const operations=contract.command.oneOf.map(v=>{
  const name=v.properties.kind.const;const args=v.properties.args;const fields=Object.entries(args.properties||{}).map(([name,s])=>`| \`${name}\` | ${type(s)} | ${(args.required||[]).includes(name)?'Required':'Optional'} | ${s.description||''} |`).join('\n');
  return '### `'+name+'`\n\n'+v.description+'\n\n'+(fields?'| Argument | Type | Presence | Meaning |\n|---|---|---|---|\n'+fields:'No arguments.')+'\n';
}).join('\n');
const authentication=contract.authentication || 'Application operations require the node bearer token. Browser file reads can use the session cookie established with bearer authentication.';
const md='# Generated HTTP contract\n\nContract: `'+contract.contract+'`\n\n'+authentication+' The node records its execution profile. Restricted execution requires scoped grants and enforced limits; the unrestricted compatibility profile requires explicit operator opt-in.\n\n| Method | Path | Behavior |\n|---|---|---|\n'+contract.routes.map(([m,p,d])=>`| ${m} | \`${p}\` | ${d} |`).join('\n')+'\n\n## Operations\n\nSend an Operation with random 32-character hex `id`, `kind`, `actor`, `run` and typed `args`. The server assigns `source` to `api`; model actions carry their originating call identity. An identical retry returns the saved result, while a changed request with that identity is rejected.\n\n'+operations+'\nThe machine schema includes OCEAN ranges [0,1], VAD ranges [-1,1], nullable unauthored values and extensible attributes. Server validation applies the same Rust Command definition.\n';
writeFileSync(new URL('../API.md',import.meta.url),md);
