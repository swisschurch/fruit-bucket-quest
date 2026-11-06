# Zurich Fruit Bucket Quest 설정 안내

6개 팀이 바구니를 모으는 실시간 게임입니다. 게임 화면은 모두 영어로 되어 있습니다. 참여자는 QR을 찍고 로그인 없이 휴대폰으로 참여하고, 교실 앞 대형 스크린에서 모든 팀의 바구니가 실시간으로 쌓입니다.

## 화면 3개

| 화면 | 주소 | 누가 |
|---|---|---|
| 참여자 | https://swisschurch.github.io/fruit-bucket-quest/ | 참여자 휴대폰 (로그인 없음) |
| 대형 스크린 | https://swisschurch.github.io/fruit-bucket-quest/#screen | 진행자 노트북 → 프로젝터 |
| 진행자 | https://swisschurch.github.io/fruit-bucket-quest/#admin | 진행자 (팀 이름·할당량 설정, 기록 확인·삭제, 초기화) |

## 먼저 미리 보기 (데모 모드)

`config.js`의 `firebase`가 `null`이면 데모 모드입니다. 바로 GitHub에 올려도 화면을 확인할 수 있어요.
같은 컴퓨터에서 탭 세 개(`/`, `#screen`, `#admin`)를 열고, 진행자 화면의 **Add 30 sample buckets**를 누르면 대형 스크린에 사과가 떨어지는 모습을 볼 수 있습니다.
데모 모드는 그 브라우저 안에서만 저장되므로 실제 게임에는 아래 Firebase 설정이 필요합니다.

## 1. Firebase 만들기 (약 15분, 무료)

1. https://console.firebase.google.com 에서 **프로젝트 추가** → 이름 입력 (애널리틱스는 꺼도 됨)
2. 왼쪽 메뉴 **빌드 > Firestore Database** → **데이터베이스 만들기** → 위치 `europe-west6 (Zürich)` 또는 가까운 곳 → **프로덕션 모드**
3. **빌드 > Authentication** → **시작하기** → 로그인 방법에서 **Google** 사용 설정
4. **Firestore > 규칙** 탭에 `firestore.rules` 내용을 통째로 붙여 넣고, `YOUR_EMAIL@gmail.com`을 진행자 구글 이메일로 바꾼 뒤 **게시**
5. **프로젝트 설정(톱니바퀴) > 일반 > 내 앱 > 웹(</>)** 으로 앱 등록 → 나오는 `firebaseConfig` 값을 `config.js`의 `firebase:` 자리에 붙여 넣기

## 2. GitHub Pages로 올리기

1. GitHub에서 새 저장소 생성 (Public)
2. 이 폴더의 파일 전부(`index.html`, `app.js`, `config.js`, `assets/` 폴더)를 업로드
3. 저장소 **Settings > Pages** → Source: `Deploy from a branch`, Branch: `main` / `(root)` → Save
4. 1~2분 뒤 https://swisschurch.github.io/fruit-bucket-quest/ 로 접속
5. Firebase 콘솔 **Authentication > 설정 > 승인된 도메인**에 `<아이디>.github.io` 추가 (구글 로그인용)

## 3. 게임 당일 순서

1. 진행자 화면(`#admin`)에서 구글 로그인 → 팀 이름, 할당량, 구역 이름 입력 후 **Save settings**
2. 대형 스크린(`#screen`)을 프로젝터에 띄우고 로그인 (화면에 참여 QR이 나옴)
3. 참여자는 QR → 팀·구역·이름 선택 → 바구니 이름과 관계 입력
4. 끝나면 진행자 화면에서 **Download CSV**로 기록 보관, 필요하면 **Reset game** (칸에 RESET 입력)

> 게임 중에는 대형 스크린을 계속 켜 두세요. 대형 스크린이 바구니를 집계해 참여자 휴대폰에 보낼 요약본을 만듭니다.

## 개인정보 처리 방식

- 바구니 이름(실제 사람 이름)과 관계는 **진행자만** 볼 수 있습니다. 보안 규칙상 참여자는 기록을 새로 쓰기만 하고 읽을 수 없습니다.
- 대형 스크린과 휴대폰 공개 요약본에는 바구니 이름이 `김*수`, `A**a K****r`처럼 가려져서 나옵니다.
- 참여자 본인이 담은 바구니의 전체 이름은 그 사람의 휴대폰 안에만 저장되어 "My buckets"에 보입니다.
- 행사가 끝나면 Reset game으로 기록을 지우는 것을 권장합니다.

## 무료 요금제 한도

Firestore 무료(Spark) 요금제는 하루 읽기 5만 회까지입니다. 240명이 1시간 참여하면:
- 휴대폰은 30초마다 요약 문서 1개만 읽음 → 약 2만 9천 회
- 대형 스크린·진행자 화면은 바구니 수만큼만 읽음

그래서 한 번의 게임은 무료 한도 안에 들어갑니다. 같은 날 리허설까지 여러 번 돌리거나, 휴대폰 숫자도 더 자주 바뀌게 하고 싶다면 `config.js`의 `pollSeconds`를 조절하거나 Blaze(종량제)로 바꾸세요. 이 규모에서는 비용이 몇십 원 수준입니다.

## 바꾸고 싶을 때

- 팀은 6개, 구역은 팀마다 4개로 고정되어 있습니다 (`app.js`의 `TEAM_IDS`, `ZONE_IDS`, 그리고 `firestore.rules`의 팀·구역 목록을 함께 바꾸면 늘릴 수 있음).
- 그림은 `assets/tree.jpg`(대형 스크린 배경), `assets/squirrel.jpg`(휴대폰 캐릭터)를 같은 이름으로 바꿔 넣으면 됩니다.
