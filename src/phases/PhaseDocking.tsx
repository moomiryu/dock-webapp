import { useEffect, useRef, useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import {
  PI_STALE_MS,
  claimWait,
  clearWait,
  fakeSwitch,
  isFirebaseConfigured,
  startBroadcast,
  subscribeDock,
  waitIsFree,
  type DockState
} from '../lib/firebase';
import { isDevMode } from '../lib/stage';
import { EMPHASIS_MS } from '../lib/wall';

interface Props {
  /** 방금 보낸 글의 id — 벽이 '어느 글을 띄울지' 알아야 한다 */
  messageId: string;
  /**
   * 홈에 꽂혀 송출이 **확정된** 순간. 넘어오는 시각은 폰의 시계가 아니라
   * 파이가 잰 꽂힌 순간이다 — 08과 벽이 같은 곳에서 30초를 센다.
   *
   * 확정되기 전에는 부르지 않는다. 벽이 모르는데 폰만 '발화 중'이라고
   * 말하는 것이 이 화면이 막아야 할 일이다.
   */
  onDocked: (startedAt: number, session: string) => void;
  /**
   * 머리줄 왼쪽 '처음으로'. 다른 화면에서 '이전'이 서는 그 자리다.
   *
   * 여기엔 뒤가 없다 — 글은 이미 벽으로 갔다. 전에는 이 자리가 '이전'이라
   * 미리보기로 돌아갈 수 있었고, 거기서 '준비됐어요'를 다시 누르면 같은 글이
   * 한 번 더 올라갔다. 05에 "마지막 단계"라고 말로만 적어 두었던 것을
   * 이제 문 자체가 지킨다.
   */
  onHome?: () => void;
}

/** 이 화면에 선 동안의 확인 간격. 꽂고서 화면이 바뀌기를 기다리는 자리라 짧다 */
const POLL_MS = 500;

/** 대기 자리를 붙잡아 두는 간격. 유효기간(15초)의 3분의 1이라 한 번 걸러도 안 놓친다 */
const CLAIM_EVERY_MS = 5000;

/**
 * 화면 아래 한 줄. **왜 아직 안 넘어가는지**를 말한다.
 *
 * 없으면 사람은 자기가 잘못 꽂았다고 생각하고 폰을 뺐다 꽂기를 되풀이한다.
 * 넷 다 "기다리면 된다"로 끝나는 이유는, 여기서 사람이 할 수 있는 일이
 * 실제로 없기 때문이다 — 앞사람이 빼거나, 앞 차례가 끝나거나, 연결이
 * 돌아오면 저절로 넘어간다.
 */
const NOTES = {
  occupied: '앞의 폰이 아직 꽂혀 있어요. 빠지면 바로 꽂을 수 있어요.',
  queued: '다른 분이 먼저 기다리고 있어요. 곧 차례가 와요.',
  offline: '설치물과 연결이 안 돼요. 계속 다시 걸어볼게요.',
  failed: '벽에 닿지 못했어요. 다시 걸어볼게요.'
} as const;

type Note = keyof typeof NOTES | null;

/**
 * 꽂힌 순간으로 쓸 시각.
 *
 * 파이의 시계를 쓰는 것이 원칙이다 — 벽은 파이가 띄운 브라우저라 둘의 시계가
 * 같고, 그래야 두 화면의 30초가 한 곳에서 출발한다.
 *
 * 다만 파이에는 시계 배터리가 없어 NTP가 맞춰 주기 전에는 시각이 엉뚱하다.
 * 그 값을 그대로 쓰면 08의 남은 시간이 처음부터 0이 되어 화면이 스쳐 지나간다.
 * 차이가 상한(30초)을 넘으면 파이를 믿지 않고 제 시계를 쓴다 — 두 화면이
 * 어긋나지만 적어도 양쪽 다 30초를 센다. `switch.py`도 반대편에서 같은 것을
 * 막는다(시계가 맞을 때까지 기다렸다 시작한다).
 */
function sensibleStart(switchAt: number, now: number): number {
  return switchAt > 0 && Math.abs(now - switchAt) < EMPHASIS_MS ? switchAt : now;
}

/**
 * 한 참여를 가리키는 이름표.
 *
 * `crypto.randomUUID`는 안전한 주소(https)에서만 있다 — 개발 중 폰으로
 * 접속할 때는 없어서 화면이 통째로 죽는다. 시각과 난수면 한 설치물 앞의
 * 몇 명을 가르는 데 충분하다.
 */
function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 07 Docking — 화면 밖으로 사용자를 내보내는 자리.
//
// 지시만 하고 끝내면 사용자는 꽂은 뒤 무슨 일이 생기는지 모른 채 서 있게 된다.
// 그래서 '무엇을 하라'와 '그러면 무엇이 일어난다'를 한 화면에 같이 둔다.
//
// 이 화면이 실제로 하는 일은 셋이다.
//   1. 대기 자리에 이름을 올린다 — 꽂힘이 **누구의 것인지** 정해 둔다
//   2. 홈의 스위치를 지켜본다 — 내가 온 뒤에 생긴 꽂음만 내 것이다
//   3. 그 둘이 맞으면 송출 시작을 확정하고, 확정된 뒤에만 넘어간다
export default function PhaseDocking({ messageId, onDocked, onHome }: Props) {
  const [note, setNote] = useState<Note>(null);
  const firedRef = useRef(false);
  const sessionRef = useRef('');
  if (!sessionRef.current) sessionRef.current = newSessionId();

  useEffect(() => {
    // Firestore가 없는 자리(`?mock=1`)에는 파이도 벽도 없다. 아래 개발용
    // 버튼이 이 일을 대신한다.
    if (!isFirebaseConfigured()) return;

    const session = sessionRef.current;
    // 파이가 없는 것이 정상인 자리(개발·왕복 검사)에서는 끊김을 말하지 않는다.
    // 아래 '꽂았어요'가 파이 몫을 대신하고 있으므로 끊긴 것이 아니다.
    const dev = isDevMode();

    /**
     * 내가 이 화면에 왔을 때의 꽂음 번호.
     *
     * 이미 꽂혀 있는 채로 들어왔다면 그건 **앞사람이 안 뺀 것**이지 내가
     * 꽂은 게 아니다. 그걸 내 꽂음으로 읽으면 화면에 닿자마자 넘어간다.
     * 그래서 첫 값은 판정이 아니라 기준선으로만 쓴다.
     */
    let baseline: string | null = null;
    let lastClaim = 0;
    let inFlight = false;

    async function handle(s: DockState) {
      const now = Date.now();
      if (baseline === null) baseline = s.switchId;

      const piAlive = s.piAt > 0 && now - s.piAt <= PI_STALE_MS;

      // 이 꽂음으로 이미 남의 송출이 만들어졌나. 대기 자리가 내게 넘어와도
      // 앞사람이 꽂아 둔 그 꽂음까지 내 것이 되지는 않는다.
      const takenByOther =
        !!s.switchId &&
        s.startId.startsWith(`${s.switchId}:`) &&
        s.startSession !== session;

      // ── 차례 ──────────────────────────────────────────────
      const mine = s.waitSession === session;
      if (!mine && !waitIsFree(s, now)) {
        setNote(piAlive || dev ? 'queued' : 'offline');
        return;
      }
      if (!mine || now - lastClaim > CLAIM_EVERY_MS) {
        const got = await claimWait(session, messageId, s);
        if (got) lastClaim = now;
        if (!mine) {
          // 방금 자리를 잡았다. 꽂음 판정은 다음 바퀴에 — 지금 넘어가면
          // 등록되기 전의 꽂음을 내 것으로 세게 된다.
          setNote(got ? null : 'queued');
          return;
        }
      }

      // ── 여기부터는 내가 대기 자리의 주인이다 ──────────────
      const newPress = s.plugged && !!s.switchId && s.switchId !== baseline && !takenByOther;
      if (newPress) {
        const started = await startBroadcast({
          session,
          messageId,
          startedAt: sensibleStart(s.switchAt, now),
          switchId: s.switchId
        });
        if (started) {
          firedRef.current = true;
          onDocked(started.startedAt, session);
        } else {
          // 다음 바퀴에 다시 건다. 같은 꽂음이면 사건 번호도 같아서
          // 재시도가 벽에 두 번째 등장을 만들지 않는다.
          setNote('failed');
        }
        return;
      }

      if (!piAlive && !dev) return setNote('offline');
      if (s.plugged) return setNote('occupied');
      setNote(null);
    }

    const unsub = subscribeDock(
      (s) => {
        if (firedRef.current || inFlight) return;
        inFlight = true;
        void handle(s).finally(() => {
          inFlight = false;
        });
      },
      () => {
        if (!dev) setNote('offline');
      },
      () => POLL_MS
    );

    return () => {
      unsub();
      // 넘어간 뒤에는 startBroadcast가 이미 자리를 비웠다. 여기서 도는 것은
      // 사람이 '처음으로'로 나갔거나 화면을 닫은 경우다 — 자리를 쥔 채
      // 사라지면 뒷사람이 15초를 기다린다.
      if (!firedRef.current) void clearWait(session);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dev = isDevMode();

  /** 파이가 없는 자리에서 꽂음을 흉내 낸다. 가는 길은 실제와 같다 */
  function handleTestDock() {
    if (!isFirebaseConfigured()) {
      if (firedRef.current) return;
      firedRef.current = true;
      onDocked(Date.now(), sessionRef.current);
      return;
    }
    void fakeSwitch(true);
  }

  return (
    <MegafontFrame phaseLabel="도킹" onHome={onHome}>
      <div className="guide-hero docking-simple">
        <h1>앞쪽 홈에 폰을 꽂으면 발화가 시작됩니다.</h1>
        <p>세로로, 윗부분을 먼저 넣어주세요.</p>
        <DockGuide />
        {note && (
          <p className="dock-note" role="status">
            {NOTES[note]}
          </p>
        )}
        {dev && (
          <button className="dock-test-link" onClick={handleTestDock}>
            꽂았어요
          </button>
        )}
      </div>
    </MegafontFrame>
  );
}

// 폰 → 홈. 말로 설명하기 어려운 동작이라 그림이 대신한다.
// 그리는 순서가 곧 앞뒤다: 폰을 먼저 두고 본체를 바탕색으로 덮어,
// 내려간 폰이 본체 뒤로 사라지게 한다 — 페이드 없이 '들어갔다'가 읽힌다.
function DockGuide() {
  return (
    <div className="dock-guide" aria-hidden>
      {/* 폰이 어디까지 들어가는지가 이 그림의 전부다.
          끝까지 삼켜지면 '기계가 가져간다'로 읽히고, 조금만 들어가면
          덜 꽂힌 것처럼 보인다. 정확히 반 — 폰의 한가운데가 홈 선에
          걸린 채 멈춘다. 07·08이 아래 절반만 쓰는 것도 같은 사실이다.

          그리기 순서가 곧 앞뒤다: 화살표를 먼저 깔아 내려오는 폰이 덮게 하고,
          본체를 폰보다 나중에 바탕색으로 그려 들어간 절반을 가린다. */}
      <svg viewBox="0 0 140 190" width="112" height="152">
        {/* 방향 — 폰이 지나갈 자리라 폰보다 먼저 그린다 */}
        <g className="dock-arrow" stroke="currentColor" strokeWidth="1.5" fill="none">
          <line x1="70" y1="92" x2="70" y2="112" />
          <polyline points="63,105 70,112 77,105" />
        </g>

        {/* 내려가는 폰 — 세로로, 위쪽(스피커 쪽)이 아래를 향한다.
            높이 76, 한가운데가 y=46. 홈 선(y=124)까지 78만큼 내려간다. */}
        <g className="dock-phone">
          <rect
            x="50"
            y="8"
            width="40"
            height="76"
            rx="6"
            fill="var(--paper)"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          {/* 스피커 — 이게 아래에 있다는 게 '거꾸로 잡는다'는 표시.
              꽂히면 본체 안으로 들어가 보이지 않는다. */}
          <rect x="62" y="74" width="16" height="2.6" rx="1.3" fill="currentColor" />
          {/* 홈 인디케이터 — 폰의 진짜 아랫변. 꽂은 뒤 밖에 남는 절반이
              이것 때문에 '폰의 아랫부분'으로 읽힌다. */}
          <rect x="59" y="15" width="22" height="2.6" rx="1.3" fill="currentColor" />
        </g>

        {/* 본체 — 바탕색으로 채워 들어간 절반을 가린다 */}
        <rect
          x="14"
          y="124"
          width="112"
          height="62"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="1.5"
        />

        {/* 홈(슬롯) — 본체 윗선에 걸친 입구. 폰이 여기서 반으로 나뉜다 */}
        <rect x="44" y="120" width="52" height="8" rx="4" fill="currentColor" />
      </svg>
    </div>
  );
}
