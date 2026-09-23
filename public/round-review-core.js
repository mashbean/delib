import {sessionCounts,correctionImpact} from './operations-core.js';
import {openParticipation,roundFollowups} from './facilitation-core.js';
import {nativeRestrictions} from './workspace-import-core.js';

// A live, local reading of recorded evidence. No inferred identities or consensus score.
export function roundReview(project,roundId=project.view.roundId) {
  const round=project.rounds.find(r=>r.id===roundId);
  if(!round)throw Error('Unknown round / 找不到輪次');
  const records=project.rounds.flatMap(r=>r.artifacts),known=new Map(records.map(r=>[r.id,r]));
  const prior=new Set(project.rounds.slice(0,project.rounds.indexOf(round)+1).map(r=>r.id));
  const operations=project.operations||{},withdrawn=nativeRestrictions(project).withdrawn;
  const corrections=(operations.corrections||[]).filter(c=>prior.has(c.roundId)&&c.history.at(-1).status==='requested').map(c=>({
    ...c.history.at(-1),id:c.id,recordId:c.recordId,roundId:c.roundId,text:known.get(c.recordId).text,
    affectedRefs:correctionImpact(project,c.recordId)
  }));
  const sessions=(operations.sessions||[]).filter(s=>s.roundId===round.id).map(s=>{
    const e=s.history.at(-1),counts=sessionCounts(s);
    return {...e,id:s.id,counts,feedbackMissing:e.status==='planned'?null:counts.attended-e.evaluations.length,
      // Missing scores remain missing; the denominator is shown independently for each question.
      scores:Object.fromEntries(['heard','understood','fair'].map(key=>{
        const values=e.evaluations.map(v=>v[key]).filter(v=>v!==null);
        return [key,{responses:values.length,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null}];
      })),barriers:e.observations.filter(v=>v.barrier.trim())};
  });
  const progressions=(operations.progressions||[]).filter(g=>prior.has(g.roundId)&&(g.roundId===round.id||g.history.at(-1).stage!=='reviewed')).map(g=>{
    const e=g.history.at(-1),proposal=known.get(g.proposalRef),dependencies=new Set([g.proposalRef,...e.evidenceRefs]);
    const checks={
      correction:corrections.some(c=>c.affectedRefs.some(id=>dependencies.has(id))),
      superseded:records.some(r=>r.supersedes===g.proposalRef),
      withdrawn:[...withdrawn].some(id=>correctionImpact(project,id).some(ref=>dependencies.has(ref))),
      review:!proposal.review.checked,evidence:e.evidenceRefs.length===0,
      quorum:e.support+e.oppose+e.abstain<g.quorum,support:e.support<g.minSupport
    };
    return {...g,current:e,text:proposal.text,checks,attention:Object.keys(checks).filter(k=>checks[k])};
  });
  return {roundId:round.id,title:round.title,simulated:project.simulated,corrections,sessions,progressions,
    gaps:openParticipation(round).map(g=>({...g.history.at(-1),id:g.id})),
    carryRefs:roundFollowups(project,round).map(r=>r.id)};
}

export function roundReviewSuggestion(review,lang='zh') {
  const L=(zh,en)=>lang==='en'?en:zh,parts=[];
  const barriers=review.sessions.reduce((n,s)=>n+s.barriers.length,0);
  const active=review.progressions.filter(g=>g.current.stage!=='reviewed');
  if(review.corrections.length)parts.push(L(`處理 ${review.corrections.length} 筆更正，重查受影響的資料。`,`Corrections to resolve: ${review.corrections.length}. Recheck affected evidence.`));
  if(review.gaps.length||barriers)parts.push(L(`補接 ${review.gaps.length} 筆參與缺口與 ${barriers} 筆場次障礙紀錄，確認適合的參與方式。`,`Follow up ${review.gaps.length} participation gaps and ${barriers} recorded session barriers; agree on accessible ways to participate.`));
  const missing=review.sessions.reduce((n,s)=>n+(s.feedbackMissing||0),0);
  if(missing)parts.push(L(`邀請補充 ${missing} 筆尚未收到的會後回饋；不填補缺值。`,`Invite ${missing} missing session responses without inventing feedback.`));
  if(active.length)parts.push(L(`回看 ${active.length} 項提案的少數意見與推進條件；對照輪次回顧逐項討論。`,`Proposals to revisit: ${active.length}. Review minority views and advancement conditions.`));
  if(!parts.length)parts.push(L('先確認待追蹤資料是否仍有未解問題，再決定下一輪安排。','Review carried records for unresolved questions before planning another round.'));
  return {text:parts.join('\n'),phase:review.gaps.length||barriers?'recruit':review.corrections.length?'learn':active.length?'deliberate':'respond'};
}

export const reviewCheckLabel=(key,lang='zh')=>({
  correction:['來源仍有待處理更正','Unresolved source correction'],superseded:['提案已有新修訂，請另建推進流程','Proposal superseded; start a new progression'],
  withdrawn:['來源已撤回','Source withdrawn'],review:['提案尚未覆核','Proposal not reviewed'],evidence:['尚無佐證紀錄','No evidence recorded'],
  quorum:['表態人數未達門檻','Response threshold not met'],support:['支持人數未達門檻','Support threshold not met']
})[key]?.[lang==='en'?1:0]||key;

export function roundReviewMarkdown(project,roundId=project.view.roundId) {
  const r=roundReview(project,roundId),clean=v=>String(v??'').replace(/[\r\n]+/g,' ').replace(/[\\`*_{}\[\]<>#!|]/g,'\\$&');
  const line=v=>`- ${clean(v)}`;
  const sections=['zh','en'].map(lang=>{
    const L=(a,b)=>lang==='en'?b:a;
    return [`## ${L('輪次回顧','Round review')} · ${clean(r.title)}`,
      L('私人本機工作紀錄；含原文、代稱與主持註記。分享前請自行刪除不宜公開的內容。','Private local working record, including source text, aliases and facilitator notes. Remove sensitive content before sharing.'),
      L('中英介面各一份；使用者填入的原文維持原語言，未自動翻譯。','Chinese and English report labels; user-entered source text stays in its original language.'),
      L('這是匯出時的現況，不是過去輪次的歷史快照。','This is the current state at export, not a historical round snapshot.'),
      r.simulated?L('虛構演練，不是真實參與或決定。','Fictional rehearsal, not actual participation or decisions.'):L('未核實身分或外部承諾。','Identities and external commitments have not been verified.'),
      `### ${L('待處理更正（含前輪未結案）','Open corrections (including earlier rounds)')}`,
      ...r.corrections.map(c=>line(`${c.text} — ${c.reason} · ${c.owner} · ${c.due} · ref: ${c.recordId}`)),
      `### ${L('參與缺口','Participation gaps')}`,...r.gaps.map(g=>line(`${g.group} — ${g.barrier} → ${g.action} · ${g.owner} · ${g.reviewOn}`)),
      `### ${L('本輪場次','Sessions in this round')}`,
      ...r.sessions.flatMap(s=>[
        line(`${s.title} · ${s.date} · ${s.mode} · ${s.status} · ${s.owner}`),
        line(L(`受邀／出席／發言／表態：${Object.values(s.counts).join(' / ')}；收到回饋 ${s.evaluations.length} / ${s.counts.attended}`,`Invited / attended / spoke / voted: ${Object.values(s.counts).join(' / ')}; feedback ${s.evaluations.length} / ${s.counts.attended}`)),
        ...s.barriers.map(v=>line(`${L('障礙','Barrier')} · ${v.participant}: ${v.barrier}`)),
        ...Object.entries(s.scores).map(([key,v])=>line(`${({heard:L('被聽見','Heard'),understood:L('理解議題','Understood'),fair:L('程序公平','Fair process')})[key]}: ${v.mean===null?L('尚無分數','No score'):v.mean.toFixed(1)+' / 5'} · n=${v.responses}`)),
        ...s.evaluations.filter(v=>v.note).map(v=>line(`${L('回饋','Feedback')} · ${v.participant}: ${v.note}`))
      ]),
      L('各場分開計數；未跨場辨識身分。缺值不算 0 分；回饋分數不代表共識或代表性。','Counts are per session, without cross-session identity matching. Missing scores are not zero; ratings do not establish consensus or representativeness.'),
      `### ${L('提案與少數意見','Proposals and minority views')}`,
      ...r.progressions.flatMap(g=>[line(`${g.text} · ${g.current.stage} · ${g.owner} · ref: ${g.proposalRef}`),line(g.rule),line(`${L('支持／反對／棄權／合資格','Support / oppose / abstain / eligible')}: ${g.current.support} / ${g.current.oppose} / ${g.current.abstain} / ${g.current.eligible}`),line(`${L('少數與未解意見','Minority and unresolved views')}: ${g.current.minorityNote}`),line(g.attention.length?g.attention.map(k=>reviewCheckLabel(k,lang)).join('; '):L('目前紀錄符合檢查條件；推進仍需主持人確認。','Recorded checks pass; a facilitator must still confirm advancement.'))]),
      `### ${L('下一輪討論草稿','Draft for next-round discussion')}`,roundReviewSuggestion(r,lang).text,
      `### ${L('待承接紀錄索引','Carry-forward record references')}`,...r.carryRefs.map(line)
    ].join('\n\n');
  });
  return `# ${clean(project.title)}\n\n${new Date().toISOString()}\n\n${sections.join('\n\n---\n\n')}\n`;
}
