# Public Voice and rounded messages

- English supporting labels: About / Step / On the wall / Afterwards; phase headers use Step and English role names.
- Voice question: 어떤 발화를 시작해볼까요? / 마음에 드는 성격을 하나 골라주세요.
- Smaller two-line specimen: 발화 / Public Voice, Latin in Lineal VF.
- Ratio caption: 실제 스크린 비율이에요.
- Writing, color selection, animated preview and wall projection keep the screen black. The chosen background and text colors belong to a rounded message container.
- Black-background palette entries are inverted to colored containers with black type so the container is visible against the black wall. Existing palette indices are retained.
- Containers use rounded ends with 0.5em vertical and 1em horizontal padding; these are local message-art adaptations, not a claim of canonical TDS pill dimensions.
- Home wordmark now uses container-relative sizing to avoid font-loading measurement races; wght 1150 remains unchanged.
- Verified build, mobile widths 320/390/480, state preservation, and mock wall rendering.
