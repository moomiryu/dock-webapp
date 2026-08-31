import { useEffect, useState } from 'react';
import AdminWall from './admin/AdminWall';
import WallSimulation from './admin/WallSimulation';
import ArchiveView from './archive/ArchiveView';
import PhaseHome from './phases/PhaseHome';
import PhaseVoice from './phases/PhaseVoice';
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
  | 'home'     // START
  | 'voice'    // 음성으로 시작 (skip 가능)
  | 'glyph'    // 자형 — 한 글자와 형태
  | 'compose'  // 효과 — 풀 문장 작성 + 색·그래픽
  | 'preview'  // 미리보기 — 확인 / 다시
  | 'submit';  // 로딩 → 완료

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
  const [voicePreset, setVoicePreset] = useState<Pick<ToneState, 'font' | 'wght'> | null>(null);
  // 자형 화면에 어디서 들어왔는지 — 뒤로 가기가 온 길로 되돌아가야 한다.
  const [glyphOrigin, setGlyphOrigin] = useState<'home' | 'voice'>('home');

  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    clearStageFromUrl();
  }, []);

  if (window.location.pathname.startsWith('/wall')) {
    return <WallSimulation />;
  }

  if (window.location.pathname.startsWith('/admin')) {
    return <AdminWall />;
  }

  if (window.location.pathname.startsWith('/archive')) {
    return <ArchiveView />;
  }

  // 기본 진입은 자형부터. 음성은 홈에서 고르는 선택지.
  function handleStart() {
    setGlyphOrigin('home');
    setScreen('glyph');
  }

  function handleStartVoice() {
    setScreen('voice');
  }

  function handleVoiceDone(voicePartial: PartialTone | null) {
    if (voicePartial) {
      setVoicePreset({ font: voicePartial.font, wght: voicePartial.wght });
      setGlyphTone(voicePartial);
    } else {
      setVoicePreset(null);
    }
    setGlyphOrigin('voice');
    setScreen('glyph');
  }

  function handleGlyphBack() {
    setScreen(glyphOrigin);
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
    setVoicePreset(null);
    setGlyphOrigin('home');
    setScreen('home');
  }

  const glyphBackLabel = glyphOrigin === 'voice' ? '음성 다시' : '처음으로';

  switch (screen) {
    case 'home':
      return <PhaseHome onStartWrite={handleStart} onStartVoice={handleStartVoice} />;

    case 'voice':
      return <PhaseVoice onDone={handleVoiceDone} onHome={() => setScreen('home')} />;

    case 'glyph':
      return (
        <PhaseGlyph
          initialTone={draft?.tone ? toPartial(draft.tone) : glyphTone}
          voicePreset={voicePreset}
          backLabel={glyphBackLabel}
          onBack={handleGlyphBack}
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
            voicePreset={voicePreset}
            backLabel={glyphBackLabel}
            onBack={handleGlyphBack}
            onNext={handleGlyphNext}
          />
        );
      }
      return (
        <PhaseCompose
          initialText={draft?.text ?? ''}
          partialTone={partial}
          initialPaletteIdx={draft?.tone?.paletteIdx}
          initialGraphicIdx={draft?.tone?.graphicIdx}
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
            voicePreset={voicePreset}
            backLabel={glyphBackLabel}
            onBack={handleGlyphBack}
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
