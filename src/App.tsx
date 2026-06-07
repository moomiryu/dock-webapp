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
    return 'voice';
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

  function handleStart() {
    setScreen('voice');
  }

  function handleVoiceDone(voicePartial: PartialTone | null) {
    if (voicePartial) {
      setVoicePreset({ font: voicePartial.font, wght: voicePartial.wght });
      setGlyphTone(voicePartial);
    } else {
      setVoicePreset(null);
    }
    setScreen('glyph');
  }

  function handleGlyphBack() {
    setScreen('voice');
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
    setScreen('home');
  }

  switch (screen) {
    case 'home':
      return <PhaseHome onStartWrite={handleStart} />;

    case 'voice':
      return <PhaseVoice onDone={handleVoiceDone} />;

    case 'glyph':
      return (
        <PhaseGlyph
          initialTone={draft?.tone ? toPartial(draft.tone) : glyphTone}
          voicePreset={voicePreset}
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
        return <PhaseVoice onDone={handleVoiceDone} />;
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
