"""Browser regression checks for the mixed shop feed.

Requires Playwright with Chromium and a running static server:
  FYND_TEST_URL=http://127.0.0.1:8777 python tests/test_shop_feed.py
Set FYND_SMOKE=1 for a short deployment check.
"""

import os
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("FYND_TEST_URL", "http://127.0.0.1:8777")
SMOKE = os.environ.get("FYND_SMOKE") == "1"
SLUGS = {"i4", "yesan-apple-united", "fluffy-d", "greeny-box", "croba-poultry", "pamp"}
WIDTHS = [1440, 390, 320] if SMOKE else [1440, 1081, 1024, 901, 800, 768, 740, 721, 720, 557, 390, 375, 320]
SEEDS = [0.42] if SMOKE else [0.01, 0.23, 0.42, 0.51, 0.78, 0.99]


def assert_layout(page, width):
    page.wait_for_timeout(80)
    data = page.evaluate("""() => {
      const grid=document.querySelector('#brandGrid');
      const cards=[...grid.querySelectorAll('.brand-card')].map(a=>{
        const r=a.getBoundingClientRect();
        const heading=a.querySelector('strong'), h=heading.getBoundingClientRect();
        const range=document.createRange(); range.selectNodeContents(heading);
        return {slug:a.dataset.brandSlug, href:a.getAttribute('href'), x:r.x,y:r.y,right:r.right,bottom:r.bottom,
          titleFits:[...range.getClientRects()].every(q=>q.left>=h.left-1&&q.right<=h.right+1&&q.top>=h.top-1&&q.bottom<=h.bottom+1)};
      });
      const spans=[...document.querySelectorAll('#heroTitle>span')];
      return {cards,overflow:document.documentElement.scrollWidth>innerWidth,
        columns:getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        title:spans.map(s=>s.textContent),
        heroLines:spans.map(s=>{const r=document.createRange();r.selectNodeContents(s);return r.getClientRects().length}),
        badImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src)};
    }""")
    assert not data["overflow"] and not data["badImages"], (width, data)
    assert data["title"] == ["충청남도", "소상공인 네트워크"] and data["heroLines"] == [1, 1]
    assert all(c["titleFits"] for c in data["cards"]), (width, data["cards"])
    for index, card in enumerate(data["cards"]):
        assert card["href"] == f'/brands/{card["slug"]}/'
        for other in data["cards"][index + 1:]:
            overlap = (min(card["right"], other["right"]) - max(card["x"], other["x"]) > 1
                       and min(card["bottom"], other["bottom"]) - max(card["y"], other["y"]) > 1)
            assert not overlap, (width, card, other)
    if data["cards"]:
        assert data["columns"] == (2 if width <= 720 or len(data["cards"]) != 6 else 12)
        last_bottom = max(card["bottom"] for card in data["cards"])
        assert page.locator("#festivals").bounding_box()["y"] > last_bottom
    return [card["slug"] for card in data["cards"]]


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    orders = set()
    for seed in SEEDS:
        page = browser.new_page(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.add_init_script(f"Math.random = () => {seed}")
        page.goto(BASE_URL, wait_until="networkidle")
        page.evaluate("document.fonts.ready")
        page.locator(".brand-card").nth(5).wait_for()
        page.evaluate("document.querySelectorAll('img[loading=lazy]').forEach(i=>i.loading='eager')")
        page.wait_for_load_state("networkidle")
        original = assert_layout(page, 1440)
        assert set(original) == SLUGS and original[0] != "croba-poultry"
        orders.add(tuple(original))
        for width in WIDTHS:
            page.set_viewport_size({"width": width, "height": 844})
            assert assert_layout(page, width) == original
        for query, expected in [("예산", {"yesan-apple-united", "greeny-box"}), ("PAMP", {"pamp"}), ("공주", {"fluffy-d"}), ("not-a-shop", set())]:
            page.locator("#brandSearchInput").fill(query)
            actual = assert_layout(page, WIDTHS[-1])
            assert actual == [slug for slug in original if slug in expected], (query, actual)
            page.locator("#clearSearchButton").click()
            assert assert_layout(page, WIDTHS[-1]) == original
        assert not errors, errors
        print(f"seed={seed}: {len(WIDTHS)} sizes, stable search order, no overlap or clipped titles", flush=True)
        page.close()
    if not SMOKE:
        assert len(orders) == len(SEEDS)
        page = browser.new_page(viewport={"width": 390, "height": 844}, java_script_enabled=False)
        page.goto(BASE_URL, wait_until="networkidle")
        assert page.locator("#brandGrid .brand-card").count() == 1
        assert page.locator("#festivals").bounding_box()["y"] > page.locator(".brand-card").bounding_box()["y"] + page.locator(".brand-card").bounding_box()["height"]
        page.close()
    browser.close()
print("Shop feed checks passed", flush=True)
