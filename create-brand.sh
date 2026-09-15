#!/bin/bash

set -e

cd "$(dirname "$0")"

DEFAULT_RENDER_URL="https://fynd-cnd.onrender.com"

echo ""
read -r -p "현재 FYND-CND 서비스 주소 [$DEFAULT_RENDER_URL]: " SITE_URL

if [ -z "$SITE_URL" ]; then
  SITE_URL="$DEFAULT_RENDER_URL"
fi

python3 scripts/create_brand.py --base-url "$SITE_URL"

echo ""
echo "업체 사진을 assets/brands/<slug>/ 폴더에 넣은 뒤 아래 명령을 실행하세요."
echo "python3 scripts/create_brand.py --build-all --base-url \"$SITE_URL\""
