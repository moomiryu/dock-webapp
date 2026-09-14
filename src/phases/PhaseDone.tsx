import MegafontFrame from '../components/MegafontFrame';
import { STAY_DAYS } from '../lib/wall';
interface Props {
    stillDocked: boolean;
    onRestart: () => void;
}
export default function PhaseDone({ onRestart }: Props) {
    return <MegafontFrame phaseLabel="완료"><div className="done done-simple"><h1>발화 종료</h1><p className="done-after">벽 속에 메아리로 {STAY_DAYS}일 동안 남아있어요.</p><button className="done-home-link" onClick={onRestart}>한 줄 더 쓰기</button></div></MegafontFrame>;
}
