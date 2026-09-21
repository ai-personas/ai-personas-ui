/** Local line icons: decorative only, never portraits or evidence of runtime activity. */
const paths = {
  Work: 'M4 7h16v13H4z M8 7V4h8v3 M4 12h16 M10 12v3h4v-3',
  Personas: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
  Environments: 'M3 10l9-7 9 7v11H3z M9 21v-8h6v8',
  Learning: 'M12 5v16 M12 5C8 2 5 3 2 4v16c3-1 6-2 10 1 4-3 7-2 10-1V4c-3-1-6-2-10 1',
  File: 'M14 2H5v20h14V7z M14 2v6h5 M8 12h8 M8 16h8',
  Folder: 'M3 6h7l2 3h9v11H3z M3 6V4h7l2 2h7v3',
  Tools: 'M14 6a5 5 0 0 0-6 6L2 18l4 4 6-6a5 5 0 0 0 6-6l-3 3-4-4 3-3z',
  Network: 'M8 5h13 M17 1l4 4-4 4 M16 19H3 M7 15l-4 4 4 4',
  Funding: 'M3 6h18v14H3z M3 10h18 M15 14h6 M6 6V3h12v3',
  Search: 'M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16 M17 17l5 5',
  Attention: 'M12 3l10 18H2z M12 9v5 M12 17v1',
  Arrow: 'M5 12h14 M13 6l6 6-6 6',
  Shield: 'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6',
} as const;
export default function Icon({ name }: { name: keyof typeof paths }) {
  return <svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
