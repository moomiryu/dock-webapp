import { useEffect, useState } from 'react';
import AdminWall from './admin/AdminWall';
import WallSimulation from './admin/WallSimulation';
import PhaseHome from './phases/PhaseHome';
import Phase04Write from './phases/Phase04Write';
import Phase05Tone from './phases/Phase05Tone';
import Phase05bDock from './phases/Phase05bDock';
import Phase06Submit from './phases/Phase06Submit';
import PhaseZ0Voice from './phases/PhaseZ0Voice';
import PhaseZ1Glyph from './phases/PhaseZ1Glyph';
import PhaseZ2Compose from './phases/PhaseZ2Compose';
import {
  clearDraft,
  loadDraft,
  newDraft,
  updateDraftText,
  updateDraftTone
} from './lib/draft';
import { clearStageFromUrl, getStageFromUrl } from './lib/stage';
import type { Draft, ToneState } from './types';

type Screen = 'home' | 'write' | 'tone' | 'z-0' | 'z-1' | 'z-2' | 'dock' | 'submit';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

function isZMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'z';
}

function pickInitialScreen(stage: ReturnType<typeof getStageFromUrl>, draft: Draft | null): Screen {
  if (stage === 'submit') return 'submit';
  const z = isZMode();
  if (stage === 'enter') {
    // NFC arrival — bypass home, go straight to writing.
    // Z mode: voice intro first (skippable) → Z1 → Z2.
    // If there's already a draft with tone, jump directly into Z2 (resume).
    if (z) {
      if (draft && draft.tone && draft.text) return 'z-2';
      return 'z-0';
    }
    if (draft && draft.tone && draft.text) return 'tone';
    return 'write';
  }
  // No stage param — direct URL visit. Show home page.
  return 'home';
}

export default function App() {
  const [draft, setDraft] = useState<Draft | null>(() => loadDraft());
  const [screen, setScreen] = useState<Screen>(() => pickInitialScreen(getStageFromUrl(), loadDraft()));
  const [zPartialTone, setZPartialTone] = useState<PartialTone | null>(() => {
    const d = loadDraft();
    if (!d?.tone) return null;
    const { paletteIdx, graphicIdx, ...rest } = d.tone;
    void paletteIdx;
    void graphicIdx;
    return rest;
  });

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

  function handleNextFromWrite(text: string) {
    const updated = updateDraftText(text);
    setDraft(updated);
    setScreen('tone');
  }

  function handleSubmitFromTone(text: string, tone: ToneState) {
    const cur = loadDraft() ?? newDraft(text);
    const updated: Draft = { ...cur, text, tone };
    // persist both at once
    updateDraftText(text);
    const final = updateDraftTone(tone);
    setDraft(final ?? updated);
    setScreen('dock');
  }

  function handleHomeStart() {
    setScreen(isZMode() ? 'z-0' : 'write');
  }

  function handleVoiceDone(voicePartial: PartialTone | null) {
    if (voicePartial) {
      // Voice analysis preset → seeds Z1's tone
      setZPartialTone({
        font: voicePartial.font,
        wght: voicePartial.wght,
        tone: voicePartial.tone,
        slnt: voicePartial.slnt,
        size: voicePartial.size
      });
    }
    setScreen('z-1');
  }

  function handleZ1Next(text: string, partial: PartialTone) {
    const updated = updateDraftText(text);
    setDraft(updated);
    setZPartialTone(partial);
    setScreen('z-2');
  }

  function handleZ2Back() {
    setScreen('z-1');
  }

  function handleZ2Submit(text: string, tone: ToneState) {
    handleSubmitFromTone(text, tone);
  }

  function handleRestart() {
    clearDraft();
    setDraft(null);
    setScreen('write');
  }

  switch (screen) {
    case 'home':
      return <PhaseHome onStartWrite={handleHomeStart} />;

    case 'write':
      return <Phase04Write initialText={draft?.text ?? ''} onNext={handleNextFromWrite} />;

    case 'tone':
      return (
        <Phase05Tone
          initialText={draft?.text ?? ''}
          initialTone={draft?.tone ?? null}
          onSubmit={handleSubmitFromTone}
        />
      );

    case 'z-0':
      return <PhaseZ0Voice onDone={handleVoiceDone} />;

    case 'z-1':
      return (
        <PhaseZ1Glyph
          initialText={draft?.text ?? ''}
          initialTone={
            draft?.tone ??
            (zPartialTone
              ? { ...zPartialTone, paletteIdx: 0, graphicIdx: -1 }
              : null)
          }
          onNext={handleZ1Next}
        />
      );

    case 'z-2':
      if (!zPartialTone || !draft?.text) {
        // Shouldn't happen — fall back to z-1 if state is missing
        return (
          <PhaseZ1Glyph
            initialText={draft?.text ?? ''}
            initialTone={draft?.tone ?? null}
            onNext={handleZ1Next}
          />
        );
      }
      return (
        <PhaseZ2Compose
          text={draft.text}
          partialTone={zPartialTone}
          initialPaletteIdx={draft.tone?.paletteIdx}
          initialGraphicIdx={draft.tone?.graphicIdx}
          onBack={handleZ2Back}
          onSubmit={handleZ2Submit}
        />
      );

    case 'dock':
      return <Phase05bDock onSimulateTap={() => setScreen('submit')} />;

    case 'submit':
      return <Phase06Submit draft={draft} onRestart={handleRestart} />;
  }
}
