# Home and color step revision

- MegaFont. wordmark uses Lineal VF with font-variation-settings: 'wght' 1150. CSS font-weight remains 900 because CSS weights stop at 1000; the explicit variation setting controls the actual font axis.
- Wordmark fits the available phone width after font loading and resizing; top padding is 16px or the safe area.
- Subtitle: 밤에만 보이는 조용한 공공발화.
- Removed the first-time question; red primary buttons now have white text as requested.
- Flow: voice → tuning → writing → color → wall preview (5 steps).
- Color page title: 어떤 색으로 발화를 남겨볼까요?
- Split-circle swatches show the existing background/text pairs. Native radios support touch and arrow keys. Selected colors persist when returning to writing or from preview.
- Verified build and mobile widths 320/390/480; regression: scripts/verify-split-tone.mjs.
