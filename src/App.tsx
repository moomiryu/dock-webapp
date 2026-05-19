import { useEffect, useState } from 'react';
import AdminWall from './admin/AdminWall';
import WallSimulation from './admin/WallSimulation';
import PhaseHome from './phases/PhaseHome';
import Phase04Write from './phases/Phase04Write';
import Phase05Tone from './phases/Phase05Tone';
import Phase05bDock from './phases/Phase05bDock';
import Phase06Submit from './phases/Phase06Submit';
import PhaseZ0Voice from './phases/PhaseZ0Voice';
import PhaseZ1Write from './phases/PhaseZ1Write';
import PhaseZ2Glyph from './phases/PhaseZ2Glyph';
import PhaseZ3Compose from './phases/PhaseZ3Compose';
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
  | 'home'
  | 'write'   // main flow (legacy) — Phase 04
  | 'tone'    // main flow (legacy) — Phase 05
  | 'z-0'     // Z mode — voice intro
  | 'z-1'     // Z mode — write text
  | 'z-2'     // Z mode — tune glyph (자형)
  | 'z-3'     // Z mode — compose color+graphic
  | 'dock'
  | 'submit';

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
    // Z mode: voice intro → write → glyph → compose. If draft+tone exists, resume at z-3.
    if (z) {
      if (draft && draft.tone && draft.text) return 'z-3';
      return 'z-0';
    }
    if (draft && draft.tone && draft.text) return 'tone';
    return 'write';
  }
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

  function handleZ1Next(text: string) {
    const updated = updateDraftText(text);
    setDraft(updated);
    setScreen('z-2');
  }

  function handleZ2Back() {
    setScreen('z-1');
  }

  function handleZ2Next(partial: PartialTone) {
    setZPartialTone(partial);
    setScreen('z-3');
  }

  function handleZ3Back() {
    setScreen('z-2');
  }

  function handleZ3Submit(text: string, tone: ToneState) {
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
        <PhaseZ1Write
          initialText={draft?.text ?? ''}
          voicePreset={zPartialTone ? { font: zPartialTone.font, wght: zPartialTone.wght } : null}
          onNext={handleZ1Next}
        />
      );

    case 'z-2':
      if (!draft?.text) {
        // Shouldn't happen — fall back to z-1 if no text yet
        return (
          <PhaseZ1Write
            initialText={draft?.text ?? ''}
            voicePreset={zPartialTone ? { font: zPartialTone.font, wght: zPartialTone.wght } : null}
            onNext={handleZ1Next}
          />
        );
      }
      return (
        <PhaseZ2Glyph
          text={draft.text}
          initialTone={
            draft.tone ??
            (zPartialTone ? { ...zPartialTone, paletteIdx: 0, graphicIdx: -1 } : null)
          }
          onBack={handleZ2Back}
          onNext={handleZ2Next}
        />
      );

    case 'z-3':
      if (!zPartialTone || !draft?.text) {
        return (
          <PhaseZ1Write
            initialText={draft?.text ?? ''}
            voicePreset={zPartialTone ? { font: zPartialTone.font, wght: zPartialTone.wght } : null}
            onNext={handleZ1Next}
          />
        );
      }
      return (
        <PhaseZ3Compose
          text={draft.text}
          partialTone={zPartialTone}
          initialPaletteIdx={draft.tone?.paletteIdx}
          initialGraphicIdx={draft.tone?.graphicIdx}
          onBack={handleZ3Back}
          onSubmit={handleZ3Submit}
        />
      );

    case 'dock':
      return <Phase05bDock onSimulateTap={() => setScreen('submit')} />;

    case 'submit':
      return <Phase06Submit draft={draft} onRestart={handleRestart} />;
  }
}
