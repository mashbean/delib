// Original stroke icons. Every control keeps a visible text label.
const paths = {
  route:'M4 5h8a4 4 0 0 1 0 8H8a3 3 0 0 0 0 6h12M17 16l3 3-3 3',
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  voice:'M21 11a8 8 0 0 1-8 8H8l-5 3v-7a8 8 0 1 1 18-4M7 8h10M7 12h7',
  layers:'m12 3 10 5-10 5L2 8l10-5M2 12l10 5 10-5M2 16l10 5 10-5',
  reply:'m9 5-6 6 6 6M3 11h10a7 7 0 0 1 7 7v2',
  loop:'M20 7a9 9 0 0 0-15-2L2 8M2 2v6h6M4 17a9 9 0 0 0 15 2l3-3M22 22v-6h-6',
  check:'m5 12 4 4L19 6',
  edit:'m15 4 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15v6',
  file:'M14 2H4v20h16V8l-6-6v6h6M8 13h8M8 17h6',
  link:'m10 13 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload:'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  play:'m7 3 14 9-14 9V3',
  pause:'M8 4v16M16 4v16',
  arrow:'M4 12h16m-6-6 6 6-6 6',
  back:'M20 12H4m6-6-6 6 6 6',
  lock:'M5 10h14v12H5V10M8 10V6a4 4 0 0 1 8 0v4M12 15v3',
  clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M12 6v6l4 2',
  branch:'M6 3v18M6 15c8 0 12-3 12-12M3 3h6M3 21h6M15 3h6',
  search:'M19 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0m-2 5 6 6',
  compass:'m16 8-3 5-5 3 3-5 5-3M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
export function icon(name) { return `<svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[name] || paths.file}"/></svg>`; }
export const kindIcon = kind => ({statement:'voice',question:'voice',theme:'layers',proposal:'edit',reply:'reply',decision:'check',feedback:'loop',brief:'file'})[kind] || 'file';
