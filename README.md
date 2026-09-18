# FYND-CND 서비스웹

FYND × 영진관광이 입점 업체의 대표 상품과 브랜드 스토리를 소개하고,
각 업체의 공식 스마트스토어로 연결하는 모바일 우선 브랜드 플랫폼입니다.

## 현재 구성

- 메인에는 공개 상태인 입점 업체가 모두 카드로 표시됩니다.
- 업체 카드를 누르면 해당 업체의 소개, 대표 상품 한 가지, 브랜드 스토리, 공식 판매처 링크가 열립니다.
- 브랜드명·상품명·지역·카테고리 검색과 카테고리 필터를 지원합니다.
- 페이지를 열 때 전체 브랜드 카드 순서가 공정하게 무작위로 정해집니다.
- 이후 10초마다 전체 브랜드 순서가 다시 섞이며, 카드를 보고 있거나 검색·필터를 사용하는 동안에는 잠시 멈춥니다.
- 카카오맵에는 정확한 사업장 주소가 아닌 브랜드에 등록된 지역의 중심 위치를 표시합니다.
- 각 업체는 독립적인 상세 주소(`/brands/<slug>/`)와 검색용 메타 정보를 가집니다.
- 전화번호가 없는 업체는 전화 버튼이 비활성화되며 임의 번호를 표시하지 않습니다.
- 실제 정보와 공식 공개 채널을 확인한 업체만 서비스에 노출합니다.

## 새 업체 추가

터미널에서 실행:

```bash
cd /Users/jungjuhyeok/yeongjin
./create-brand.sh
```

질문에 따라 업체 정보를 입력하면 아래 파일이 자동으로 생성·갱신됩니다.

```text
data/brands/<slug>.json
data/brands/index.json
brands/<slug>/index.html
sitemap.xml
```

업체가 준 원본 사진은 다음 위치에 넣습니다.

```text
assets/brands/<slug>/main.jpg
assets/brands/<slug>/story-1.jpg
assets/brands/<slug>/story-2.jpg
```

데이터 형식 참고 파일:

```text
data/brands/brand.example.json
```

기존 데이터로 페이지와 사이트맵만 다시 만들기:

```bash
python3 scripts/create_brand.py --build-all
```

메인 카드 노출 순서를 사람이 지정하는 필드는 없습니다. `sortOrder`는 데이터 파일과
사이트맵을 안정적으로 생성하기 위한 관리용 값이며, 실제 화면은 `app.js`의
편향 없는 Fisher–Yates 무작위 섞기를 사용합니다.

## 검색 노출

- `robots.txt`: 모든 공개 페이지 수집 허용
- `sitemap.xml`: 메인과 공개 브랜드 상세 페이지 등록
- 메인에 WebSite·ItemList, 업체 상세에 Product·Brand 구조화 데이터 제공
- 각 페이지에 canonical, Open Graph 및 검색 설명 제공

네이버 노출 현황을 직접 확인하려면 배포 후 네이버 서치어드바이저에
`https://fynd-cnd.onrender.com`을 등록하고 `sitemap.xml`을 제출합니다.

## 로컬 확인

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000`으로 접속합니다.

## 배포

`main` 브랜치에 푸시하면 Render의 `fynd-cnd` 정적 사이트가 자동 배포됩니다.
