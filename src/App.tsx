import { useEffect, useState } from 'react';
import AdminWall from './admin/AdminWall';
import Phase04Write from './phases/Phase04Write';
import Phase05Tone from './phases/Phase05Tone';
import Phase05bDock from './phases/Phase05bDock';
import Phase06Submit from './phases/Phase06Submit';
import PhaseZUnified from './phases/PhaseZUnified';
import {
  clearDraft,
  loadDraft,
  newDraft,
  updateDraftText,
  updateDraftTone
} from './lib/draft';
import { clearStageFromUrl, getStageFromUrl } from './lib/stage';
import type { Draft, ToneState } from './types';

type Screen = 'write' | 'tone' | 'z-unified' | 'dock' | 'submit';

function isZMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('mode') === 'z';
}

function pickInitialScreen(stage: ReturnType<typeof getStageFromUrl>, draft: Draft | null): Screen {
  if (stage === 'submit') return 'submit';
  const z = isZMode();
  if (stage === 'enter') {
    if (z) return 'z-unified';
    if (draft && draft.tone && draft.text) return 'tone'; // resume mid-flow
    return 'write';
  }
  // No stage param — dev default
  return z ? 'z-unified' : 'write';
}

export default function App() {
  const [draft, setDraft] = useState<Draft | null>(() => loadDraft());
  const [screen, setScreen] = useState<Screen>(() => pickInitialScreen(getStageFromUrl(), loadDraft()));

  useEffect(() => {
    if (window.location.pathname.startsWith('/admin')) return;
    clearStageFromUrl();
  }, []);

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

  function handleSubmitFromZ(text: string, tone: ToneState) {
    handleSubmitFromTone(text, tone);
  }

  function handleRestart() {
    clearDraft();
    setDraft(null);
    setScreen('write');
  }

  switch (screen) {
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

    case 'z-unified':
      return (
        <PhaseZUnified
          initialText={draft?.text ?? ''}
          initialTone={draft?.tone ?? null}
          onSubmit={handleSubmitFromZ}
        />
      );

    case 'dock':
      return <Phase05bDock />;

    case 'submit':
      return <Phase06Submit draft={draft} onRestart={handleRestart} />;
  }
}
