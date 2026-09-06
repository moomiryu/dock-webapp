import type { ToneState } from '../types';

// 예시 발화.
//
// 데모용 시드(/wall)와 04 미리보기의 풍경이 같은 목록을 쓴다. 미리보기에서
// 본 이웃이 실제 벽의 이웃과 다르면 미리보기가 예고가 아니라 장식이 된다.
export interface SampleMessage {
  text: string;
  tone: ToneState;
}

export const SAMPLE_MESSAGES: SampleMessage[] = [
  {
    text: '저는 과기대를 사랑하는데 총장님은 아니신가봐요',
    tone: { font: 'ttoryeot', tone: 1.0, wght: 700, slnt: 0, size: 56, paletteIdx: 0, graphicIdx: 0 }
  },
  {
    text: '등록금 어디 쓰는지 알려줘',
    tone: { font: 'chabun', tone: 0.7, wght: 700, slnt: -8, size: 48, paletteIdx: 1, graphicIdx: 3 }
  },
  {
    text: '내일 비 온대',
    tone: { font: 'doran', tone: 1.3, wght: 400, slnt: 0, size: 44, paletteIdx: 2, graphicIdx: 1 }
  },
  {
    text: '오늘 못 한 말',
    tone: { font: 'ttoryeot', tone: 1.0, wght: 700, slnt: 0, size: 52, paletteIdx: 4, graphicIdx: 4 }
  },
  {
    text: '여기에 누가 있다',
    tone: { font: 'deulseok', tone: 1.0, wght: 500, slnt: 0, size: 48, paletteIdx: 3, graphicIdx: -1 }
  },
  {
    text: '졸업하면 뭐 할 거야',
    tone: { font: 'doran', tone: 1.0, wght: 500, slnt: -4, size: 46, paletteIdx: 6, graphicIdx: -1 }
  }
];
