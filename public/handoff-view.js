import { icon } from './icons.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// The same reading order and visual language in the process map and the simulation.
export function renderHandoff(input, output, language) {
  const en = language === 'en';
  return `<div class="handoff-flow" role="group" aria-label="${en ? 'Input to output' : '輸入到產出'}">
    <div class="handoff-port handoff-input"><div class="handoff-label">${icon('file')}<strong>IN</strong><span>${en ? 'Input' : '輸入'}</span></div><p>${escape(input)}</p></div>
    <div class="handoff-connector" aria-hidden="true">${icon('arrow')}</div>
    <div class="handoff-port handoff-output"><div class="handoff-label">${icon('layers')}<strong>OUT</strong><span>${en ? 'Output' : '產出'}</span></div><p>${escape(output)}</p></div>
  </div>`;
}
