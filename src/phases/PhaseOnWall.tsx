import { useEffect, useRef, useState } from 'react';
import { endBroadcast, fakeSwitch, isFirebaseConfigured, subscribeDock } from '../lib/firebase';
import { EMPHASIS_MS, EMPHASIS_SEC } from '../lib/wall';
import { isDevMode } from '../lib/stage';
import { pick, useLang } from '../lib/lang';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
    /* 개발용 버튼(?dev=1)이라 참여자는 못 본다 */
    test: { ko: '폰을 뺐어요', en: "I've taken the phone out" },
    count: { ko: '남은 발화 시간', en: 'Speaking time left' }
};

interface Props {
    /**
     * 파이가 잰 꽂힌 순간. **벽도 같은 값에서 센다.**
     *
     * 전에는 이 화면이 제가 떠오른 시각부터 30초를 셌다. 벽은 벽대로 제가
     * 신호를 알아챈 시각부터 셌고, 둘 다 3초에 한 번 확인하던 터라 같은
     * 발화의 남은 시간이 두 화면에서 최대 3초 어긋났다.
     */
    startedAt: number;
    /** 이 참여의 이름표. 벽에 떠 있는 것이 아직 내 글인지 가른다 */
    session: string;
    onDone: (pulled: boolean) => void;
}
/**
 * 눈이 숫자 쪽으로 기우는 시각.
 *
 * 30초 내내 같은 얼굴이면 화면이 그냥 타이머다. 끝이 가까워졌다는 것을
 * 숫자가 아니라 **몸짓**이 먼저 말하게 한다 — 열을 남기고 눈이 숫자를
 * 쳐다본다. 남은 시간을 읽지 않아도 '이제 곧'이 전해진다.
 */
const KEEN_SEC = 10;

/** 뺐는지만 보면 되면 느슨해도 되지만, 폰을 빼고 화면을 보는 자리라
 *  늦으면 그대로 보인다. 길어야 30초 도는 화면이라 부담도 작다 */
const POLL_MS = 500;

/**
 * 남은 시간. 위아래로 자른다.
 *
 * 아래는 0이고 위는 30초다 — 폰의 시계가 파이보다 조금 뒤처져 있으면
 * 뺄셈이 30을 넘겨 '31초 남음'이 찍힌다. 상한이 첫 숫자로 보이는 화면이라
 * 그 한 자리가 곧 거짓말이 된다.
 */
function remain(startedAt: number): number {
    return Math.max(0, Math.min(EMPHASIS_SEC, EMPHASIS_SEC - (Date.now() - startedAt) / 1000));
}

export default function PhaseOnWall({ startedAt, session, onDone }: Props) {
    const doneRef = useRef(false);
    const lang = useLang();

    /** 끝나는 길은 하나다 — 누가 끝냈든 여기로 모인다.
     *  `at`이 0이면 벽에 알리지 않는다(이미 끝났거나, 내 송출이 아니다) */
    function finish(pulled: boolean, at: number) {
        if (doneRef.current) return;
        doneRef.current = true;
        if (at > 0) void endBroadcast(at);
        onDone(pulled);
    }

    useEffect(() => {
        if (!isFirebaseConfigured()) return;
        const unsub = subscribeDock(
            (s) => {
                if (doneRef.current) return;
                // 벽에 떠 있는 것이 더 이상 내 글이 아니다. 내 차례는 끝났고,
                // 끝냈다고 벽에 알릴 자격도 없다 — 남의 송출을 접게 된다.
                if (s.startSession && s.startSession !== session) return finish(true, 0);
                if (s.endedAt > 0) return finish(true, 0);
                // 뺐다. 꽂힘이 풀렸고 그 시각이 내 꽂음보다 뒤다 —
                // 앞사람이 남긴 옛 기록이 아니라는 뜻이다.
                if (!s.plugged && s.switchAt > startedAt) finish(true, s.switchAt);
            },
            () => {
                /* 잠깐 못 읽는 것으로 발화를 끊지 않는다. 아래 상한이 받쳐 준다 */
            },
            () => POLL_MS
        );
        return unsub;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** 파이가 없는 자리에서 뺌을 흉내 낸다. 07의 '꽂았어요'와 대칭이라
     *  가는 길도 같다 — 꽂힘을 내려 두지 않으면 다음 사람의 07에
     *  "앞의 폰이 아직 꽂혀 있어요"가 뜬 채로 남는다 */
    function handleTestRelease() {
        if (!isFirebaseConfigured()) return finish(true, Date.now());
        void fakeSwitch(false);
    }

    const [left, setLeft] = useState(() => remain(startedAt));
    useEffect(() => {
        const id = window.setInterval(() => {
            const r = remain(startedAt);
            setLeft(r);
            // 상한. 사람이 뺀 신호가 늦거나 아예 오지 않아도 여기서 끝난다.
            if (r <= 0) {
                clearInterval(id);
                finish(false, startedAt + EMPHASIS_MS);
            }
        }, 100);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startedAt]);

    return <div className="onwall-screen">
 {isDevMode() && <div className="onwall"><button className="onwall-release" onClick={handleTestRelease}>{pick(T.test, lang)}</button></div>}
 {/* 바닥 한 줄 — 왼쪽에 눈, 오른쪽에 남은 초.
     '최대 30초'는 걷어냈다. 숫자가 이만큼 커지면 그게 무엇인지는 줄어드는
     것만 봐도 알고, 상한은 이미 첫 숫자가 말하고 있다. */}
 <div className={'onwall-floor' + (left <= KEEN_SEC ? ' is-keen' : '')}>
  <Eye/>
  <div className="onwall-count" aria-label={pick(T.count, lang)}>{Math.ceil(left)}</div>
 </div>
</div>;
}

/**
 * 눈 하나.
 *
 * 도형은 작가의 것을 그대로 가져왔다 (`by_moomiryu/Renewal_v1/Character/eye/eye_general.svg`,
 * `eye_twinkle.svg`). 화판이 412.12×172.43에 눈이 둘이라, 왼쪽 눈 한 짝만
 * 172.43 정사각으로 잘라 쓴다 — 좌표는 원본 그대로다(가운데 86.21, 반지름 86.21).
 *
 * 깜빡임은 눈을 **누르는** 것이 아니라 **갈아 끼우는** 것이다. 동그란
 * 눈동자(general)가 아래로 굽은 활(twinkle)로 한 순간 바뀌었다 돌아온다.
 * 세로로 눌러 감으면 눈이 감긴 게 아니라 도형이 납작해진 것으로 보인다.
 *
 * 흰자는 흰색 붙박이, 눈동자는 화면 색이다 — 눈동자가 뚫린 자리처럼 보여야
 * 이 화면(빨강) 위에 얹힌 한 짝의 눈으로 읽힌다.
 */
function Eye() {
    return <svg className="onwall-eye" viewBox="0 0 172.43 172.43" aria-hidden focusable="false">
  <circle className="onwall-eye-white" cx="86.21" cy="86.21" r="86.21"/>
  <g className="onwall-eye-pupil">
   <circle className="onwall-eye-open" cx="86.21" cy="86.21" r="52.48"/>
   <path className="onwall-eye-shut" d="M129.96,86.21c5.01,0,8.77,4.55,7.87,9.48-4.46,24.46-25.87,43-51.63,43s-47.16-18.54-51.62-43c-.9-4.93,2.86-9.48,7.87-9.48h0c3.86,0,7.17,2.76,7.86,6.56,3.1,17,18.01,29.92,35.88,29.92s32.79-12.92,35.89-29.92c.69-3.8,4-6.56,7.86-6.56h0Z"/>
  </g>
 </svg>;
}
