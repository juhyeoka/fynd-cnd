#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import re
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlparse


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "brands"
ASSET_DIR = BASE_DIR / "assets" / "brands"
PAGE_DIR = BASE_DIR / "brands"
QR_DIR = BASE_DIR / "qrcodes"
DEFAULT_BASE_URL = "https://fynd-cnd.onrender.com"

CATEGORY_MAP = {
    "농산": "agriculture",
    "축산": "livestock",
    "수산": "seafood",
    "카페": "cafe",
    "식당": "restaurant",
    "건강": "health",
    "생활": "lifestyle",
}


def ask(label: str, default: str = "", required: bool = False) -> str:
    while True:
        suffix = f" [{default}]" if default else ""
        value = input(f"{label}{suffix}: ").strip() or default
        if required and not value:
            print("필수 입력값입니다.")
            continue
        return value


def ask_yes_no(label: str, default: bool = True) -> bool:
    default_label = "Y/n" if default else "y/N"
    value = input(f"{label} [{default_label}]: ").strip().lower()
    if not value:
        return default
    return value in {"y", "yes", "예", "네"}


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9가-힣_-]+", "-", value)
    value = re.sub(r"-+", "-", value).strip("-")
    if not value:
        raise ValueError("브랜드 주소용 slug를 만들 수 없습니다.")
    return value


def validate_url(value: str) -> str:
    if not value:
        return ""
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"올바르지 않은 URL입니다: {value}")
    return value


def read_brand_files() -> list[dict]:
    brands: list[dict] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name in {"index.json", "brand.example.json"}:
            continue
        brands.append(json.loads(path.read_text(encoding="utf-8")))

    # 축제나 협력사처럼 외부 페이지로 바로 연결되는 항목은 index.json에서
    # 직접 관리합니다. 새 브랜드를 빌드해도 이 항목들이 사라지지 않게 보존합니다.
    source_slugs = {brand["slug"] for brand in brands}
    index_path = DATA_DIR / "index.json"
    if index_path.exists():
        indexed_brands = json.loads(index_path.read_text(encoding="utf-8"))
        brands.extend(
            brand
            for brand in indexed_brands
            if brand.get("externalUrl") and brand.get("slug") not in source_slugs
        )
    return brands


def optional_action(url: str, label: str, class_name: str = "") -> str:
    if not url:
        return ""
    return (
        f"""
      <a class="brand-detail-action {class_name}" href="{escape(url)}"
         target="_blank" rel="noopener noreferrer">
        {escape(label)} <span>↗</span>
      </a>
    """.strip()
        + "\n"
    )


def build_detail_html(brand: dict, base_url: str) -> str:
    name = escape(brand["name"])
    product = escape(brand["product"])
    region = escape(brand["region"])
    category = escape(brand["category"])
    headline = escape(brand["headline"])
    description = escape(brand["description"])
    address = escape(brand.get("address") or "")
    quantity = escape(brand.get("quantity") or "공식 판매처에서 확인")
    image = escape(
        brand.get("images", {}).get("main")
        or "/assets/brands/brand-placeholder.svg"
    )
    page_url = f"{base_url}/brands/{escape(brand['slug'])}/"
    image_url = image if image.startswith("http") else f"{base_url}{image}"
    is_demo = bool(brand.get("demo"))
    robots_value = (
        "noindex, nofollow, noarchive"
        if is_demo
        else "index, follow, max-image-preview:large"
    )
    sample_label = " · 샘플 브랜드" if is_demo else ""
    structured_data = json.dumps(
        {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": f"{brand['name']} {brand['product']}",
            "image": image_url,
            "description": brand["description"],
            "category": brand["category"],
            "brand": {"@type": "Brand", "name": brand["name"]},
            "url": page_url,
        },
        ensure_ascii=False,
    )

    shop_url = brand.get("shopUrl", "")
    shop_action_label = (
        "공식 스마트스토어 방문"
        if "smartstore.naver.com" in shop_url
        else "공식 판매처 방문"
    )
    actions = "".join(
        [
            optional_action(shop_url, shop_action_label, "primary"),
            optional_action(brand.get("traceUrl", ""), "생산 정보 확인하기"),
            optional_action(brand.get("homepageUrl", ""), "공식 홈페이지"),
            optional_action(brand.get("placeUrl", ""), "카카오맵에서 보기"),
            optional_action(brand.get("instagramUrl", ""), "인스타그램 보기"),
        ]
    )

    address_row = (
        f"<div><dt>주소</dt><dd>{address}</dd></div>" if address else ""
    )

    phone = re.sub(r"[^\d+]", "", brand.get("phone", ""))
    if phone:
        actions += f"""
          <a class="brand-detail-action phone" href="tel:{escape(phone)}">
            전화 문의 {escape(brand['phone'])} <span>☎</span>
          </a>
        """

    if is_demo:
        actions = """
          <div class="brand-detail-sample-notice">
            <strong>화면 확인용 샘플 브랜드입니다.</strong>
            <span>실제 업체 입점 시 공식 판매처 정보로 교체됩니다.</span>
          </div>
        """

    shop_action = ""
    mobile_shop_action = ""
    if brand.get("shopUrl"):
        shop_label = (
            "네이버 스마트스토어에서 보기"
            if "smartstore.naver.com" in brand["shopUrl"]
            else "공식 판매처에서 보기"
        )
        shop_action = f"""
          <a href="{escape(brand['shopUrl'])}" target="_blank" rel="noopener noreferrer">
            {shop_label} <span>↗</span>
          </a>
        """.strip()
        mobile_shop_action = f"""
  <a class="brand-detail-mobile-action" href="{escape(brand['shopUrl'])}"
     target="_blank" rel="noopener noreferrer">
    공식 판매처 방문
  </a>
        """.strip()
    mobile_shop_block = f"\n\n  {mobile_shop_action}" if mobile_shop_action else ""

    gallery_items: list[str] = []
    for gallery_image in brand.get("images", {}).get("gallery", []):
        if not gallery_image:
            continue
        local_path = BASE_DIR / gallery_image.lstrip("/")
        if gallery_image.startswith(("http://", "https://")) or local_path.exists():
            gallery_items.append(
                f"""
          <figure>
            <img src="{escape(gallery_image)}" alt="{name} 브랜드 스토리 사진" loading="lazy">
          </figure>
                """.strip()
            )
    gallery_html = ""
    if gallery_items:
        gallery_html = (
            '<div class="brand-detail-gallery">'
            + "".join(gallery_items)
            + "</div>"
        )
    gallery_block = f"\n      {gallery_html}" if gallery_html else ""

    story_sections: list[str] = []
    story_character_count = len(brand.get("storyDescription") or "")
    for index, section in enumerate(brand.get("storySections", []), start=1):
        section_title = escape(section.get("title") or "")
        raw_paragraphs = section.get("paragraphs") or []
        if isinstance(raw_paragraphs, str):
            raw_paragraphs = [raw_paragraphs]
        paragraphs = [paragraph for paragraph in raw_paragraphs if paragraph]
        if not section_title or not paragraphs:
            continue
        story_character_count += len(section.get("title") or "")
        story_character_count += sum(len(paragraph) for paragraph in paragraphs)
        paragraph_html = "".join(
            f"<p>{escape(paragraph)}</p>" for paragraph in paragraphs
        )
        story_sections.append(
            f"""
        <article class="brand-detail-story-section">
          <small>{index:02d}</small>
          <div><h3>{section_title}</h3>{paragraph_html}</div>
        </article>
            """.strip()
        )
    story_article = ""
    reading_time = ""
    if story_sections:
        reading_minutes = max(2, round(story_character_count / 350))
        reading_time = (
            '<p class="brand-detail-story-meta">BRAND NOTE'
            f'<span>약 {reading_minutes}분 읽기</span></p>'
        )
        story_article = (
            '<div class="brand-detail-story-article">'
            + "".join(story_sections)
            + "</div>"
        )

    return f"""<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{name} {product} | FYND</title>
  <meta name="description" content="{headline}">
  <meta name="keywords" content="{name}, {product}, {region}, FYND, 충남 지역 브랜드">
  <meta name="robots" content="{robots_value}">
  <meta name="theme-color" content="#ffffff">
  <link rel="canonical" href="{page_url}">
  <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css?v=service-editorial-10">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="FYND">
  <meta property="og:title" content="{name} {product} | FYND">
  <meta property="og:description" content="{headline}">
  <meta property="og:url" content="{page_url}">
  <meta property="og:image" content="{image_url}">
  <script type="application/ld+json">
  {structured_data}
  </script>
</head>
<body class="brand-detail-body">
  <header class="site-header">
    <div class="header-inner brand-detail-header">
      <a class="brand-detail-fynd-home" href="/" aria-label="FYND 홈"><img src="/assets/brand/fynd-logo-transparent.png" alt="FYND"></a>
      <a class="brand-detail-back" href="/">← 브랜드 목록</a>
    </div>
  </header>

  <main class="brand-detail-main">
    <p class="brand-detail-breadcrumb">소상공인 이야기{sample_label} · {category} · {region}</p>
    <section class="brand-detail-hero">
      <div class="brand-detail-visual">
        <img src="{image}" alt="{name} {product}" fetchpriority="high">
        <span>{name}</span>
      </div>
      <div class="brand-detail-copy">
        <p class="section-kicker">MEET THE BRAND</p>
        <h1>{headline}</h1>
        <p>{description}</p>
        <dl>
          <div><dt>브랜드</dt><dd>{name}</dd></div>
          <div><dt>대표 상품</dt><dd>{product}</dd></div>
          <div><dt>상품 구성</dt><dd>{quantity}</dd></div>
          <div><dt>지역</dt><dd>{region}</dd></div>
          {address_row}
        </dl>
        <div class="brand-detail-actions">{actions}</div>
      </div>
    </section>

    <section class="brand-detail-product">
      <p class="section-kicker">REPRESENTATIVE PRODUCT</p>
      <h2>대표 상품</h2>
      <div class="brand-detail-product-card">
        <img src="{image}" alt="{name} {product} 대표 상품" loading="lazy">
        <div class="brand-detail-product-copy">
          <strong>{name} {product}</strong>
          <p>{headline}</p>
          <p>상품 구성: {quantity}</p>
{shop_action if shop_action else ""}
        </div>
      </div>
    </section>

    <section class="brand-detail-story">
      <p class="section-kicker">BRAND STORY</p>
      <h2>{escape(brand.get("storyTitle") or "브랜드가 지키는 가치")}</h2>
      {reading_time}
      <p>{escape(brand.get("storyDescription") or brand["description"])}</p>{gallery_block}
      {story_article}
    </section>
  </main>{mobile_shop_block}

  <footer class="site-footer">
    <div class="footer-inner brand-detail-footer">
      <a class="brand-detail-footer-logo" href="/" aria-label="FYND 홈"><img src="/assets/brand/fynd-logo-transparent.png" alt="FYND"></a>
      <p>충남 곳곳의 가게와 브랜드를 만나보세요.</p>
      <small>© 2026 FYND.</small>
    </div>
  </footer>
</body>
</html>
"""


def build_sitemap(brands: list[dict], base_url: str) -> None:
    today = date.today().isoformat()
    urls = [
        (
            f"{base_url}/",
            "weekly",
            "1.0",
        ),
        (
            f"{base_url}/guide.html",
            "monthly",
            "0.6",
        ),
        (
            f"{base_url}/map.html",
            "weekly",
            "0.7",
        ),
        (
            f"{base_url}/partnership.html",
            "monthly",
            "0.6",
        ),
    ]
    for brand in brands:
        if (
            brand.get("published", True)
            and not brand.get("demo")
            and not brand.get("externalUrl")
        ):
            urls.append(
                (
                    f"{base_url}/brands/{brand['slug']}/",
                    "monthly",
                    "0.8",
                )
            )

    entries = "\n".join(
        f"""  <url>
    <loc>{escape(url)}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{frequency}</changefreq>
    <priority>{priority}</priority>
  </url>"""
        for url, frequency, priority in urls
    )
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n"
        "</urlset>\n"
    )
    (BASE_DIR / "sitemap.xml").write_text(sitemap, encoding="utf-8")


def build_all(base_url: str, detail_slugs: set[str] | None = None) -> list[dict]:
    brands = read_brand_files()
    brands.sort(key=lambda brand: (brand.get("sortOrder", 999), brand["name"]))
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "index.json").write_text(
        json.dumps(brands, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    for brand in brands:
        if brand.get("externalUrl"):
            continue
        if detail_slugs and brand["slug"] not in detail_slugs:
            continue
        page_path = PAGE_DIR / brand["slug"] / "index.html"
        page_path.parent.mkdir(parents=True, exist_ok=True)
        page_path.write_text(
            build_detail_html(brand, base_url),
            encoding="utf-8",
        )

    build_sitemap(brands, base_url)
    return brands


def create_brand(base_url: str) -> dict:
    print("\n새 입점 브랜드 정보를 입력합니다.")
    name = ask("브랜드명", required=True)
    slug = slugify(ask("영문 주소(slug)", default=name, required=True))
    category = ask("카테고리", default="농산", required=True)
    product = ask("대표 상품", required=True)
    region = ask("지역", required=True)
    headline = ask("한 줄 소개", required=True)
    description = ask("브랜드 소개", required=True)
    quantity = ask("상품 구성", default="공식 판매처에서 확인")
    story_title = ask("브랜드 스토리 제목", default="브랜드가 지키는 가치")
    story_description = ask("브랜드 스토리 본문", default=description)
    shop_url = validate_url(ask("공식 판매처 URL"))
    homepage_url = validate_url(ask("브랜드 홈페이지 URL"))
    trace_url = validate_url(ask("생산/이력 정보 URL"))
    phone = ask("전화번호")
    published = ask_yes_no("사이트에 바로 공개할까요?", default=True)

    brand_asset_dir = ASSET_DIR / slug
    brand_asset_dir.mkdir(parents=True, exist_ok=True)
    (brand_asset_dir / "README.txt").write_text(
        "main.jpg: 대표 상품 사진\n"
        "story-1.jpg, story-2.jpg: 업체가 제공한 브랜드 스토리 사진\n",
        encoding="utf-8",
    )

    brand = {
        "slug": slug,
        "name": name,
        "category": category,
        "categoryKey": CATEGORY_MAP.get(category, slugify(category)),
        "product": product,
        "region": region,
        "headline": headline,
        "description": description,
        "quantity": quantity,
        "storyTitle": story_title,
        "storyDescription": story_description,
        "shopUrl": shop_url,
        "homepageUrl": homepage_url,
        "traceUrl": trace_url,
        "phone": phone,
        "published": published,
        "sortOrder": 100,
        "publicUrl": f"{base_url}/brands/{slug}/",
        "qrImage": "",
        "images": {
            "main": f"/assets/brands/{slug}/main.jpg",
            "gallery": [
                f"/assets/brands/{slug}/story-1.jpg",
                f"/assets/brands/{slug}/story-2.jpg",
            ],
        },
    }

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    data_path = DATA_DIR / f"{slug}.json"
    if data_path.exists() and not ask_yes_no("이미 존재합니다. 덮어쓸까요?", False):
        raise SystemExit("취소했습니다.")
    data_path.write_text(
        json.dumps(brand, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return brand


def main() -> None:
    parser = argparse.ArgumentParser(
        description="FYND-CND 입점 브랜드 데이터와 상세 페이지를 관리합니다."
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help="배포 주소",
    )
    parser.add_argument(
        "--build-all",
        action="store_true",
        help="기존 데이터로 브랜드 목록·상세 페이지·사이트맵만 다시 만듭니다.",
    )
    parser.add_argument(
        "--brand",
        action="append",
        dest="brand_slugs",
        help="상세 페이지를 갱신할 브랜드 slug. 여러 번 지정할 수 있습니다.",
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    if not args.build_all:
        brand = create_brand(base_url)
        print(f"\n{brand['name']} 데이터를 저장했습니다.")

    brands = build_all(base_url, set(args.brand_slugs or []))
    print(f"총 {len(brands)}개 브랜드 페이지를 갱신했습니다.")
    print("브랜드 노출 순서는 처음 무작위로 정해지고 화면에서 10초마다 다시 섞입니다.")
    print("대표 사진을 assets/brands/<slug>/main.jpg에 넣고 다시 실행하세요.")


if __name__ == "__main__":
    main()
