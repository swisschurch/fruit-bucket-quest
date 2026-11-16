# The Ripening Quest

이 저장소는 2차 게임 **The Ripening Quest**를 운영합니다: https://swisschurch.github.io/fruit-bucket-quest/ripening-quest/

| 화면 | 주소 |
|---|---|
| 참여자 | …/ripening-quest/ |
| 대형 스크린 | …/ripening-quest/#screen |
| 진행자 | …/ripening-quest/#admin |

- 기본 주소(`/fruit-bucket-quest/`)와 `ripen.html`은 Ripening Quest로 연결됩니다.
- Firebase 설정은 `config.js`, 보안 규칙은 `firestore.rules`에 있습니다 (콘솔에 게시된 내용과 같음).

## 1차 게임 종료 기록

Zurich Fruit Bucket Quest(1차 게임, 2026년 11월 7–13일)는 종료되었습니다.
- 2026년 11월 16일: Firestore의 바구니 기록 175건, `public/summary`, `public/keys` 삭제
- 같은 날: `/baskets` 보안 규칙 삭제, 1차 게임 화면(`app.js`, 기존 `index.html`) 삭제
- 결과는 이름 없는 숫자만 담은 최종 보고서(PDF)로 보관합니다.
