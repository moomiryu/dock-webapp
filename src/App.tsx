import { useEffect, useState } from 'react';
import AdminWall from './admin/AdminWall';
import WallSimulation from './admin/WallSimulation';
import PhaseSplash from './phases/PhaseSplash';
import PhaseHome from './phases/PhaseHome';
import PhaseGlyph from './phases/PhaseGlyph';
import PhaseCompose from './phases/PhaseCompose';
import PhasePreview from './phases/PhasePreview';
import PhaseSubmit from './phases/PhaseSubmit';
import {
  clearDraft,
  loadDraft,
  newDraft,
  updateDraftText,
  updateDraftTone
} from './lib/draft';
import { clearStageFromUrl, getStageFromUrl } from './lib/stage';
import type { Draft, ToneState } from './types';

type Screen =
  | 'home'     // 01 Intro
  | 'glyph'    // 02 자형
  | 'compose'  // 03 메시지 (입력 = 미리보기) + 색
  | 'preview'  // 04 최종 미리보기
  | 'submit';  // 05 전송 중 → 06 도킹

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

function toPartial(tone: ToneState): PartialTone {
  const { paletteIdx, graphicIdx, ...rest } = tone;
  void paletteIdx;
  void graphicIdx;
  return rest;
}

function pickInitialScreen(stage: ReturnType<typeof getStageFromUrl>, draft: Draft | null): Screen {
  if (stage === 'submit') return 'submit';
  if (stage === 'enter') {
    // NFC arrival — bypass home. Resume at preview if a full draft exists.
    if (draft && draft.tone && draft.text) return 'preview';
    return 'glyph';
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    clearStageFromUrl();
  }, []);

  // 웹폰트가 준비될 때까지 splash. 자형이 이 앱의 내용이라 폰트가 늦으면
  // 첫 화면이 다른 글씨로 한 번 깜빡인다.
  // 최소 2초를 지키는 건 로딩 때문이 아니라 도입을 위해서다 — 폰을 대자마자
  // 화면이 튀어나오면 시작한 줄 모른다. 폰트가 영영 오지 않는 경우엔 상한이 끊는다.
  useEffect(() => {
    let live = true;
    const settle = () => live && setReady(true);
    const floor = new Promise<void>((r) => setTimeout(r, 2000));
    Promise.all([document.fonts.ready, floor]).then(settle);
    const cap = window.setTimeout(settle, 4000);
    return () => {
      live = false;
      clearTimeout(cap);
    };
  }, []);

  if (window.location.pathname.startsWith('/wall')) {
    return <WallSimulation />;
  }

  if (window.location.pathname.startsWith('/admin')) {
    return <AdminWall />;
  }

  // 00 — 입력 앱에만. 외벽·관리 화면은 곧바로 뜬다.
  if (!ready) {
    return <PhaseSplash />;
  }

  function handleStart() {
    setScreen('glyph');
  }

  function handleGlyphNext(partial: PartialTone) {
    setGlyphTone(partial);
    setScreen('compose');
  }

  function handleComposeBack() {
    setScreen('glyph');
  }

  function handleComposeSubmit(text: string, tone: ToneState) {
    const cur = loadDraft() ?? newDraft(text);
    const updated: Draft = { ...cur, text, tone };
    updateDraftText(text);
    const final = updateDraftTone(tone);
    setDraft(final ?? updated);
    setScreen('preview');
  }

  function handlePreviewConfirm() {
    setScreen('submit');
  }

  function handlePreviewBack() {
    setScreen('compose');
  }

  function handleRestart() {
    clearDraft();
    setDraft(null);
    setGlyphTone(null);
    setScreen('home');
  }

  switch (screen) {
    case 'home':
      return <PhaseHome onStart={handleStart} />;

    case 'glyph':
      return (
        <PhaseGlyph
          initialTone={draft?.tone ? toPartial(draft.tone) : glyphTone}
          onBack={() => setScreen('home')}
          onNext={handleGlyphNext}
        />
      );

    case 'compose': {
      const partial = glyphTone ?? (draft?.tone ? toPartial(draft.tone) : null);
      if (!partial) {
        // No glyph tone yet — fall back to the glyph step.
        return (
          <PhaseGlyph
            initialTone={null}
            onBack={() => setScreen('home')}
            onNext={handleGlyphNext}
          />
        );
      }
      return (
        <PhaseCompose
          initialText={draft?.text ?? ''}
          partialTone={partial}
          initialPaletteIdx={draft?.tone?.paletteIdx}
          onBack={handleComposeBack}
          onSubmit={handleComposeSubmit}
        />
      );
    }

    case 'preview':
      if (!draft?.text || !draft.tone) {
        // 되살릴 초안이 없으면 플로우 첫 단계로.
        return (
          <PhaseGlyph
            initialTone={glyphTone}
            onBack={() => setScreen('home')}
            onNext={handleGlyphNext}
          />
        );
      }
      return (
        <PhasePreview
          text={draft.text}
          tone={draft.tone}
          onConfirm={handlePreviewConfirm}
          onBack={handlePreviewBack}
        />
      );

    case 'submit':
      return <PhaseSubmit draft={draft} onRestart={handleRestart} />;
  }
}
