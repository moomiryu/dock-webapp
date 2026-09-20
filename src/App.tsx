import { useEffect, useState } from 'react';
import AdminWall from './admin/AdminWall';
import WallSimulation from './admin/WallSimulation';
import PhaseHome from './phases/PhaseHome';
import PhaseGlyph from './phases/PhaseGlyph';
import PhaseTone from './phases/PhaseTone';
import PhaseCompose from './phases/PhaseCompose';
import PhaseColor from './phases/PhaseColor';
import PhaseSubmit from './phases/PhaseSubmit';
import PhaseOnWall from './phases/PhaseOnWall';
import PhaseDone from './phases/PhaseDone';
import { DRAFT_COLORS } from './lib/messageStyle';
import {
  clearDraft,
  loadDraft,
  updateDraftText,
  updateDraftTone
} from './lib/draft';
import { clearStageFromUrl, getStageFromUrl } from './lib/stage';
import type { Draft, ToneState } from './types';

/**
 * ── 순서를 뒤집었다 (2026-09-19) ──────────────────────────────────────
 *
 * 그전까지는 성격 → 조율 → 한 줄이었다. 발화자가 '발화' 두 글자라는 **남의
 * 글**로 형식을 먼저 정하고, 그다음에 제 말을 그 틀에 부어 넣는 순서였다.
 *
 * 이제 한 줄 → 성격 → 조율이다. 재료를 먼저 준비하고 그다음에 요리한다.
 * 얻는 것이 셋이다 — 성격 카드가 성격 이름 대신 **내 문장**을 보여줄 수 있고
 * (네 서체의 차이가 두 글자에서는 안 보인다), 조율의 견본이 내 글이 되고,
 * 형식 없는 맨 글이 생겨서 그게 '원본'이 된다.
 */
type Screen =
  | 'home'     // 홈
  | 'compose'  // 1/5 한 줄 — 형식 없는 맨 글
  | 'glyph'    // 2/5 성격
  | 'tone'     // 3/5 조율
  | 'color'    // 4/5 색
  | 'preview'  // 5/5 미리보기
  | 'submit'   // 전송 중 → 도킹 안내
  | 'onwall'   // 벽에 떠 있는 동안
  | 'done';    // 완료 — 폰을 가져가는 자리

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

function toPartial(tone: ToneState): PartialTone {
  const { paletteIdx, graphicIdx, ...rest } = tone;
  void paletteIdx;
  void graphicIdx;
  return rest;
}

function pickInitialScreen(stage: ReturnType<typeof getStageFromUrl>, draft: Draft | null): Screen {
  if (stage === 'enter') {
    // NFC arrival — bypass home. Resume at preview if a full draft exists.
    if (draft && draft.tone && draft.text) return 'preview';
    return 'compose';
  }
  return 'home';
}

export default function App() {
  const [draft, setDraft] = useState<Draft | null>(() => loadDraft());
  const [screen, setScreen] = useState<Screen>(() => pickInitialScreen(getStageFromUrl(), loadDraft()));
  const [glyphTone, setGlyphTone] = useState<PartialTone | null>(() => {
    const d = loadDraft();
    return d?.tone ? toPartial(d.tone) : null;
  });
  // 벽에서 폰을 직접 뺐는지 — 완료 화면이 화면 전체를 쓸지 아래 절반만 쓸지 가른다
  const [pulled, setPulled] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);

  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    clearStageFromUrl();
  }, []);

  /* 2026-09-20: 00 Splash를 걷어냈다.
     '글꼴을 준비하고 있어요' 막대를 2.6초 보여 주고, 그 뒤 빨강 막이
     캐릭터 자리로 내려앉는 900ms가 더 붙어 있었다 — 홈이 보이기까지 3.5초다.
     폰을 대고 그만큼 기다리게 하는 값이 아니었다. 이제 곧바로 홈이다.

     그 화면이 웹폰트를 기다리던 몫은 없어진다. 자형이 이 앱의 내용이라
     늦게 오는 서체가 있으면 첫 화면이 한 번 다른 글씨로 깜빡일 수 있다. */

  if (window.location.pathname.startsWith('/wall')) {
    return <WallSimulation />;
  }

  if (window.location.pathname.startsWith('/admin')) {
    return <AdminWall />;
  }

  /**
   * 글만 먼저 저장된다. 형식은 아직 없다 — Draft.tone은 null을 허용한다.
   *
   * newDraft()로 만들어 상태에만 넣었더니 **저장소에 안 남았다.** 그 함수는
   * 만들기만 하고 쓰지 않는다. 다음 화면에서 loadDraft()가 null을 돌려주고,
   * 글 없는 형식이 저장되어 색 화면이 첫 단계로 되돌아갔다.
   */
  function saveText(text: string) {
    setDraft(updateDraftText(text));
  }

  /** 조율까지 끝난 형식을 글에 얹는다. 색은 아직 안 골랐으니 작업용 바탕이다 */
  function saveTone(partial: PartialTone) {
    setGlyphTone(partial);
    const cur = loadDraft();
    const tone: ToneState = {
      ...partial,
      paletteIdx: cur?.tone?.paletteIdx ?? 0,
      graphicIdx: -1,
      ...(cur?.tone?.backgroundColor ? null : DRAFT_COLORS)
    };
    setDraft(updateDraftTone(tone));
  }

  /** 색 화면이 돌려주는 완성된 형식 */
  function saveFull(text: string, tone: ToneState) {
    setGlyphTone(toPartial(tone));
    updateDraftText(text);
    setDraft(updateDraftTone(tone));
  }

  function handleRestart() {
    clearDraft();
    setDraft(null);
    setGlyphTone(null);
    setScreen('home');
  }

  const text = draft?.text ?? '';

  switch (screen) {
    case 'home':
      return (
        <PhaseHome onStart={() => setScreen('compose')} />
      );

    case 'compose':
      return (
        <PhaseCompose
          initialText={text}
          onBack={(t) => { saveText(t); setScreen('home'); }}
          onSubmit={(t) => { saveText(t); setScreen('glyph'); }}
        />
      );

    case 'glyph':
      return (
        <PhaseGlyph
          text={text}
          initialTone={glyphTone ?? (draft?.tone ? toPartial(draft.tone) : null)}
          onBack={() => setScreen('compose')}
          onNext={(partial) => { setGlyphTone(partial); setScreen('tone'); }}
        />
      );

    case 'tone': {
      const partial = glyphTone ?? (draft?.tone ? toPartial(draft.tone) : null);
      if (!partial) {
        // 성격을 아직 안 골랐으면 그 화면으로 물러선다
        return (
          <PhaseGlyph
            text={text}
            initialTone={null}
            onBack={() => setScreen('compose')}
            onNext={(p) => { setGlyphTone(p); setScreen('tone'); }}
          />
        );
      }
      return (
        <PhaseTone
          text={text}
          initialTone={partial}
          onBack={(p) => { setGlyphTone(p); setScreen('glyph'); }}
          onNext={(p) => { saveTone(p); setScreen('color'); }}
        />
      );
    }

    case 'color':
    case 'preview':
      if (!draft?.text || !draft.tone) {
        // 되살릴 초안이 없으면 플로우 첫 단계로.
        return (
          <PhaseCompose
            initialText={text}
            onBack={(t) => { saveText(t); setScreen('home'); }}
            onSubmit={(t) => { saveText(t); setScreen('glyph'); }}
          />
        );
      }
      if (screen === 'color') {
        return <PhaseColor text={draft.text} tone={draft.tone}
          onBack={(tone) => { saveFull(draft.text, tone); setScreen('tone'); }}
          onNext={(tone) => { saveFull(draft.text, tone); setScreen('preview'); }} />;
      }
      return (
        <PhaseSubmit draft={draft} onDocked={() => setScreen('onwall')} onEdit={() => setScreen('color')} onRestart={handleRestart} />
      );

    case 'submit':
      return (
        <PhaseSubmit
          draft={draft}
          onDocked={() => setScreen('onwall')}
          onEdit={() => setScreen('color')}
          onRestart={handleRestart}
        />
      );

    case 'onwall':
      return (
        <PhaseOnWall
          onDone={(didPull) => {
            setPulled(didPull);
            setScreen('done');
          }}
        />
      );

    case 'done':
      return <PhaseDone stillDocked={!pulled} onRestart={handleRestart} />;
  }
}
