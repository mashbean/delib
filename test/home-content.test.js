import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { stages, nativeTools, methods, suggestReturn } from '../public/home-content.js';

describe('round-first tool guidance', () => {
  it('connects every recommendation to an actual station and preserves the eight stages', async () => {
    const stations=JSON.parse(await readFile(new URL('../public/data/tool-stations.json',import.meta.url),'utf8'));
    const slugs=new Set(stations.flatMap(s=>[s.slug,...s.aliases]));
    expect(stages.map(s=>s.id)).toEqual(['frame','recruit','sortition','learn','listen','deliberate','respond','feedback']);
    for(const tool of nativeTools) expect(slugs.has(tool.id)).toBe(true);
    for(const stage of stages){
      expect(stage.tools.every(id=>nativeTools.some(t=>t.id===id))).toBe(true);
      expect(methods.some(m=>m.id===stage.source)).toBe(true);
      for(const key of ['title','short','online','offline','input','output','gate','next']){
        expect(stage[key].zh.length).toBeGreaterThan(0);
        expect(stage[key].en.length).toBeGreaterThan(0);
      }
    }
    expect(stages.filter(s=>s.optional).map(s=>s.id)).toEqual(['sortition']);
  });
  it('sends gaps to the relevant return point rather than restarting every round',()=>{
    expect(stages[suggestReturn('voices')].id).toBe('recruit');
    expect(stages[suggestReturn('evidence')].id).toBe('learn');
    expect(stages[suggestReturn('options')].id).toBe('deliberate');
    expect(stages[suggestReturn('accountability')].id).toBe('respond');
    expect(stages[suggestReturn('unknown')].id).toBe('frame');
  });
});
