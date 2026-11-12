# Zurich Fruit Bucket Quest 설정 안내

7개 팀(TH · MG · WG · YG T1~T4)이 바구니를 모으는 실시간 게임입니다. 게임 화면은 모두 영어로 되어 있습니다. 참여자는 QR을 찍고 로그인 없이 휴대폰으로 참여하고, 교실 앞 대형 스크린에서 모든 팀의 바구니가 실시간으로 쌓입니다.

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

1. 진행자 화면(`#admin`)에서 구글 로그인 → 팀 이름, 할당량, 셀(Cell) 이름 입력 후 **Save settings**
2. 대형 스크린(`#screen`)을 프로젝터에 띄우고 로그인 (화면에 참여 QR이 나옴)
3. 참여자는 QR → 팀·셀·이름 선택 → 바구니 이름과 관계 입력
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

- 팀은 7개이고, 셀은 팀마다 1~4개입니다. 진행자 화면에서 팀마다 셀 이름을 쉼표로 적어요 (예: `Cell 1, Cell 2`). 팀 수를 바꾸려면 `app.js`의 `TEAM_IDS`·`DEFAULT_TEAMS`와 `firestore.rules`의 팀 목록을 함께 바꿔야 합니다.
- 그림은 `assets/picnic.jpg`(대형 스크린 배경), `assets/picnic-banner.jpg`(휴대폰 위쪽 그림), `assets/squirrel-picnic.jpg`(휴대폰 캐릭터)를 같은 이름으로 바꿔 넣으면 됩니다.


---

# 게임 2: The Ripening Quest (빨간 열매 만들기)

**규칙은 하나예요.** 사람 한 명을 떠올리고 → 4가지 체크리스트(💧 Water=성격, 🌱 Nourish=믿음의 배경, ☀️ Sunlight=환경과 가능성, 🐞 Catch bugs=특별사항)를 하나씩 모두 체크하면 → 초록 열매가 빨갛게 익어 **팀에 빨간 열매 +1**. 체크 내용은 휴대폰 안에만 있고 서버에는 단계 완료만 저장됩니다. 팀별 목표 수를 먼저 채우는 팀이 이깁니다.

| 화면 | 주소 |
|---|---|
| 참여자 | `https://swisschurch.github.io/fruit-bucket-quest/ripening-quest/` |
| 대형 스크린 | `https://swisschurch.github.io/fruit-bucket-quest/ripening-quest/#screen` |
| 진행자 | `https://swisschurch.github.io/fruit-bucket-quest/ripening-quest/#admin` |

- 대형 스크린: 배경은 다람쥐 영상(`assets/ripen.mp4`). 평소에는 마지막 장면(익은 나무)에 멈춰 있고, 누군가 물·양분·햇빛을 하나 줄 때마다 처음부터 다시 재생됩니다. 열매가 빨갛게 익으면 그 팀 이름 위에 "Fruit is ripened!"가 뜨고 팀 숫자가 올라갑니다.
- 왼쪽 소식판에는 누가 물·양분·햇빛을 주었는지 실시간으로 나옵니다 (예: "Anna Keller gave water to M***o R***i").
- 팀마다 목표 수만큼 초록 사과가 있고, 하나씩 빨갛게 바뀝니다. 목표를 채우면 축하 화면.
- 팀·셀은 1번 게임 설정을 그대로 씁니다. 목표 수 기본값은 1번 게임 할당량이고, 진행자 화면에서 바꿀 수 있어요.
- 1번 게임을 한 휴대폰이면 팀·셀·이름이 자동으로 이어지고, 내 바구니 이름이 추천 버튼으로 나옵니다.
- 사람 이름은 진행자만 볼 수 있고, 대형 스크린에는 가려서(`M***o R***i`) 나옵니다.

## 설정 (한 번만)
1. `firestore.rules` 전체를 Firebase 콘솔 **Firestore > 규칙**에 다시 붙여 넣고 **게시** (`redfruits`, `care2` 규칙이 들어 있음).
2. `ripening-quest/#admin`에서 로그인 → 팀별 목표 확인 → **Save settings**.
3. 게임 중에는 `ripening-quest/#screen`을 진행자 계정으로 켜 두세요.

(예전 주소 `ripen.html`로 들어와도 새 주소로 자동으로 넘어갑니다.)
