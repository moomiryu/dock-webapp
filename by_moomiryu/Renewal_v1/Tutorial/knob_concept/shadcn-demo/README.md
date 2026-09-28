# shadcn/ui 노브 비교 시안

본 앱과 분리된 Vite + React 시안. `npm install`, `npm run dev` 후 http://127.0.0.1:5188 에서 확인합니다. `npm run build`로 빌드합니다.

공식 shadcn/ui new-york 레지스트리에서 Slider·Button 원본을 가져와 수동 설치했습니다. Slider의 Thumb에 접근 가능한 이름과 값 설명을 전달하는 부분을 추가했습니다. 스타일 색상은 본 앱의 tokens.css를 참조합니다. 회전 노브는 별도로 만든 커스텀 컴포넌트이며 shadcn 기본 컴포넌트가 아닙니다.

- https://ui.shadcn.com/docs/installation/vite
- https://ui.shadcn.com/docs/components/radix/slider
- https://ui.shadcn.com/r/styles/new-york/slider.json
- https://ui.shadcn.com/r/styles/new-york/button.json

눈금 터치, 노브 위아래 드래그, 방향키 및 Home/End 지원. Slider와 노브는 동일한 상태를 공유합니다. 빠르기는 실제 애니메이션 대신 기울기만 보여주는 시안입니다. 앱에 연결하거나 배포하지 않았습니다.
