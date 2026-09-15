const menuButton = document.querySelector("#menuButton");
const mobileMenu = document.querySelector("#mobileMenu");
const mobileMenuLinks = document.querySelectorAll("#mobileMenu a");
const headerSearchButton = document.querySelector("#headerSearchButton");
const bottomSearchButton = document.querySelector("#bottomSearchButton");
const brandSearchForm = document.querySelector("#brandSearchForm");
const brandSearchInput = document.querySelector("#brandSearchInput");
const clearSearchButton = document.querySelector("#clearSearchButton");
const resetSearchButton = document.querySelector("#resetSearchButton");
const brandGrid = document.querySelector("#brandGrid");
const festivalGrid = document.querySelector("#festivalGrid");
const categoryFilter = document.querySelector("#categoryFilter");
const resultSummary = document.querySelector("#resultSummary");
const festivalResultSummary = document.querySelector("#festivalResultSummary");
const emptyResult = document.querySelector("#emptyResult");
const festivalEmptyResult = document.querySelector("#festivalEmptyResult");
const onboardingSlots = document.querySelector("#onboardingSlots");
const recentBrandButton = document.querySelector("#recentBrandButton");
const toast = document.querySelector("#toast");
const mapCategoryFilter = document.querySelector("#mapCategoryFilter");
const mapRegionPanel = document.querySelector("#mapRegionPanel");
const mapLoading = document.querySelector("#mapLoading");
const brandTicker = document.querySelector("#brandTicker");

const RECENT_BRAND_KEY = "fynd-cnd-recent-brand";
const BRAND_ROTATION_INTERVAL = 10000;
const BRAND_CARD_LAYOUTS = [
  "tall",
  "compact",
  "standard",
  "compact",
  "tall",
  "standard",
  "tall",
  "standard",
  "compact"
];

let randomizedBrands = [];
let randomizedFestivals = [];
let activeCategory = "all";
let searchKeyword = "";
let toastTimer = null;
let brandRotationTimer = null;
let festivalRotationTimer = null;
let brandGridInteractionActive = false;
let festivalGridInteractionActive = false;
let brandRotationPauseUntil = 0;
let brandMap = null;
let brandMapGeocoder = null;
let brandMapOverlays = [];
let brandMapResizeObserver = null;
let activeMapCategory = "all";
let mapRenderSequence = 0;
let mapFallbackActive = false;
let brandMasonryResizeTimer = null;
const regionPositionCache = new Map();

function setMenuOpen(open) {
  if (!menuButton || !mobileMenu) {
    return;
  }

  menuButton.classList.toggle("is-open", open);
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  mobileMenu.hidden = !open;
  document.body.classList.toggle("menu-open", open);
}

menuButton?.addEventListener("click", () => {
  setMenuOpen(menuButton.getAttribute("aria-expanded") !== "true");
});

mobileMenuLinks.forEach((link) => {
  link.addEventListener("click", () => setMenuOpen(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setMenuOpen(false);
  }
});

document.addEventListener("click", (event) => {
  if (
    mobileMenu?.hidden === false &&
    !event.target.closest("#mobileMenu") &&
    !event.target.closest("#menuButton")
  ) {
    setMenuOpen(false);
  }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function randomInteger(maximum) {
  if (maximum <= 0) {
    return 0;
  }

  if (window.crypto?.getRandomValues) {
    const randomValue = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maximum) * maximum;

    do {
      window.crypto.getRandomValues(randomValue);
    } while (randomValue[0] >= limit);

    return randomValue[0] % maximum;
  }

  return Math.floor(Math.random() * maximum);
}

function shuffled(items) {
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInteger(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }

  return result;
}

function hasSameOrder(first, second) {
  return (
    first.length === second.length &&
    first.every((brand, index) => brand.slug === second[index]?.slug)
  );
}

function shuffledWithNewOrder(items) {
  if (items.length < 2) {
    return [...items];
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const nextOrder = shuffled(items);
    if (!hasSameOrder(items, nextOrder)) {
      return nextOrder;
    }
  }

  return [...items.slice(1), items[0]];
}

function canRotateBrands() {
  return (
    randomizedBrands.length > 1 &&
    activeCategory === "all" &&
    !searchKeyword &&
    !document.hidden &&
    !brandGridInteractionActive &&
    Date.now() >= brandRotationPauseUntil
  );
}

function rotateBrandOrder() {
  if (!brandGrid || !canRotateBrands()) {
    return;
  }

  const applyNewOrder = () => {
    randomizedBrands = shuffledWithNewOrder(randomizedBrands);
    renderBrands();
    renderBrandTicker(randomizedBrands);
    window.requestAnimationFrame(() => {
      brandGrid.classList.remove("is-reordering");
    });
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    applyNewOrder();
    return;
  }

  brandGrid.classList.add("is-reordering");
  window.setTimeout(applyNewOrder, 240);
}

function startBrandRotation() {
  window.clearInterval(brandRotationTimer);
  brandRotationTimer = window.setInterval(
    rotateBrandOrder,
    BRAND_ROTATION_INTERVAL
  );
}

function canRotateFestivals() {
  return (
    randomizedFestivals.length > 1 &&
    !searchKeyword &&
    !document.hidden &&
    !festivalGridInteractionActive
  );
}

function rotateFestivalOrder() {
  if (!festivalGrid || !canRotateFestivals()) {
    return;
  }

  const applyNewOrder = () => {
    randomizedFestivals = shuffledWithNewOrder(randomizedFestivals);
    renderFestivals();
    window.requestAnimationFrame(() => {
      festivalGrid.classList.remove("is-reordering");
    });
  };

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    applyNewOrder();
    return;
  }

  festivalGrid.classList.add("is-reordering");
  window.setTimeout(applyNewOrder, 240);
}

function startFestivalRotation() {
  window.clearInterval(festivalRotationTimer);
  festivalRotationTimer = window.setInterval(
    rotateFestivalOrder,
    BRAND_ROTATION_INTERVAL + 2000
  );
}

function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ko");
}

function searchableText(brand) {
  return normalized(
    [
      brand.name,
      brand.category,
      brand.product,
      brand.region,
      brand.headline,
      brand.description,
      ...(brand.tags || [])
    ].join(" ")
  );
}

function getBrandPageUrl(brand) {
  if (brand.externalUrl) {
    return brand.externalUrl;
  }

  return `/brands/${encodeURIComponent(brand.slug)}/`;
}

function isFestival(brand) {
  return brand.type === "festival";
}

function getExternalLinkAttributes(brand) {
  return brand.externalUrl
    ? ' target="_blank" rel="noopener noreferrer"'
    : "";
}

function getRegionBadge(region) {
  const label = String(region || "")
    .replace(/^충청남도\s*/, "")
    .replace(/^충남\s*/, "")
    .trim();

  return label || "충남";
}

function renderBrandCard(brand, index) {
  const image =
    brand.images?.main || "/assets/brands/brand-placeholder.svg";
  const location = [brand.category, brand.region].filter(Boolean).join(" · ");
  const cardClass = isFestival(brand)
    ? "brand-card-festival"
    : brand.demo
      ? "brand-card-demo"
      : "brand-card-real";
  const layoutClass =
    BRAND_CARD_LAYOUTS[index % BRAND_CARD_LAYOUTS.length];

  return `
    <a
      class="brand-card ${cardClass} brand-card-${layoutClass}"
      href="${getBrandPageUrl(brand)}"
      ${getExternalLinkAttributes(brand)}
      data-brand-slug="${escapeHtml(brand.slug)}"
      data-brand-name="${escapeHtml(brand.name)}"
    >
      <span class="brand-card-media">
        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(brand.name)} ${escapeHtml(brand.product)} 대표 이미지"
          ${index < 3 ? 'fetchpriority="high"' : 'loading="lazy"'}
        >
        <i class="brand-card-status">
          ${escapeHtml(getRegionBadge(brand.region))}
        </i>
      </span>

      <span class="brand-card-body">
        <small>${escapeHtml(location)}</small>
        <strong>${escapeHtml(brand.name)}</strong>
        <p>${escapeHtml(brand.headline)}</p>
        <span class="brand-card-meta">
          <i>${escapeHtml(brand.product)}</i>
          <b>${isFestival(brand) ? "공식 안내" : "브랜드 보기"}</b>
        </span>
      </span>
    </a>
  `;
}

function renderFestivalCard(festival, index) {
  const image =
    festival.images?.main || "/assets/brands/brand-placeholder.svg";
  const eventDate = festival.eventDate || festival.product || "행사 일정 확인";

  return `
    <a
      class="festival-card"
      href="${getBrandPageUrl(festival)}"
      ${getExternalLinkAttributes(festival)}
      data-brand-slug="${escapeHtml(festival.slug)}"
      data-brand-name="${escapeHtml(festival.name)}"
    >
      <span class="festival-card-media">
        <img
          src="${escapeHtml(image)}"
          alt="${escapeHtml(festival.name)}"
          ${index < 2 ? 'fetchpriority="high"' : 'loading="lazy"'}
        >
      </span>
      <span class="festival-card-copy">
        <small>${escapeHtml(festival.region)} · ${escapeHtml(eventDate)}</small>
        <strong>${escapeHtml(festival.name)}</strong>
        <p>${escapeHtml(festival.headline)}</p>
        <b>공식 안내 보기 <span aria-hidden="true">↗</span></b>
      </span>
    </a>
  `;
}

function renderBrandTicker(brands) {
  if (!brandTicker || !brands.length) {
    return;
  }

  const renderList = (hidden = false) => `
    <div class="brand-lineup-list"${hidden ? ' aria-hidden="true"' : ""}>
      ${brands
        .map(
          (brand) => `
            <a
              class="${brand.demo ? "" : "real"}"
              href="${getBrandPageUrl(brand)}"
              ${getExternalLinkAttributes(brand)}
              data-brand-slug="${escapeHtml(brand.slug)}"
              data-brand-name="${escapeHtml(brand.name)}"
            >
              <strong>${escapeHtml(brand.name)}</strong>
              <small>${escapeHtml(brand.product)} · ${escapeHtml(brand.region)}</small>
            </a>
          `
        )
        .join("")}
    </div>
  `;

  brandTicker.innerHTML = renderList() + renderList(true);
}

function renderCategoryButtons(brands) {
  if (!categoryFilter) {
    return;
  }

  const categories = [...new Set(brands.map((brand) => brand.category))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko"));

  categoryFilter.innerHTML = [
    '<button class="active" type="button" data-category="all">전체</button>',
    ...categories.map(
      (category) => `
        <button type="button" data-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `
    )
  ].join("");
}

function getVisibleBrands() {
  return randomizedBrands.filter((brand) => {
    const matchesCategory =
      activeCategory === "all" || brand.category === activeCategory;
    const matchesSearch =
      !searchKeyword || searchableText(brand).includes(searchKeyword);

    return matchesCategory && matchesSearch;
  });
}

function getVisibleFestivals() {
  return randomizedFestivals.filter(
    (festival) =>
      !searchKeyword || searchableText(festival).includes(searchKeyword)
  );
}

function layoutBrandMasonry() {
  if (!brandGrid || brandGrid.hidden) {
    return;
  }

  const cards = [...brandGrid.querySelectorAll(".brand-card")];
  if (!cards.length) {
    brandGrid.classList.remove("is-masonry");
    return;
  }

  brandGrid.classList.remove("is-masonry");
  cards.forEach((card) => card.style.removeProperty("grid-row-end"));

  const gutter =
    Number.parseFloat(
      window.getComputedStyle(brandGrid).getPropertyValue("--brand-grid-gap")
    ) || 18;
  const cardHeights = cards.map((card) =>
    Math.ceil(card.getBoundingClientRect().height + gutter)
  );

  cards.forEach((card, index) => {
    card.style.gridRowEnd = `span ${cardHeights[index]}`;
  });
  brandGrid.classList.add("is-masonry");
}

window.addEventListener("resize", () => {
  window.clearTimeout(brandMasonryResizeTimer);
  brandMasonryResizeTimer = window.setTimeout(layoutBrandMasonry, 120);
});

function renderBrands() {
  if (!brandGrid) {
    return;
  }

  const brands = getVisibleBrands();

  brandGrid.innerHTML = brands
    .map((brand, index) => renderBrandCard(brand, index))
    .join("");

  brandGrid.hidden = brands.length === 0;
  layoutBrandMasonry();
  if (emptyResult) {
    emptyResult.hidden = brands.length !== 0;
  }

  if (resultSummary) {
    const realCount = brands.filter((brand) => !brand.demo).length;
    const demoCount = brands.filter((brand) => brand.demo).length;
    const sampleSuffix = demoCount > 0 ? " · 소개 예시 포함" : "";

    if (searchKeyword) {
      resultSummary.textContent = `"${brandSearchInput.value.trim()}" 검색 결과 ${brands.length}개${sampleSuffix}`;
    } else if (activeCategory !== "all") {
      resultSummary.textContent = `${activeCategory} 이야기 ${brands.length}곳${sampleSuffix}`;
    } else {
      resultSummary.textContent =
        `등록된 이야기 ${realCount}곳` +
        (demoCount > 0 ? ` · 소개 예시 ${demoCount}곳` : "");
    }
  }

  if (onboardingSlots) {
    onboardingSlots.hidden =
      Boolean(searchKeyword) || activeCategory !== "all" || randomizedBrands.length >= 4;
  }
}

function renderFestivals() {
  if (!festivalGrid) {
    return;
  }

  const festivals = getVisibleFestivals();
  festivalGrid.innerHTML = festivals
    .map((festival, index) => renderFestivalCard(festival, index))
    .join("");
  festivalGrid.hidden = festivals.length === 0;

  if (festivalEmptyResult) {
    festivalEmptyResult.hidden = festivals.length !== 0;
  }
  if (festivalResultSummary) {
    festivalResultSummary.textContent = searchKeyword
      ? `검색 결과 ${festivals.length}개`
      : `행사와 축제 ${festivals.length}개`;
  }
}

function resetFilters() {
  activeCategory = "all";
  searchKeyword = "";

  if (brandSearchInput) {
    brandSearchInput.value = "";
  }
  if (clearSearchButton) {
    clearSearchButton.hidden = true;
  }

  categoryFilter
    ?.querySelectorAll("button")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.category === "all")
    );

  const url = new URL(window.location.href);
  url.searchParams.delete("search");
  window.history.replaceState({}, "", url);
  renderBrands();
  renderFestivals();
}

function applySearch(value) {
  searchKeyword = normalized(value);
  if (clearSearchButton) {
    clearSearchButton.hidden = !searchKeyword;
  }

  const url = new URL(window.location.href);
  if (value.trim()) {
    url.searchParams.set("search", value.trim());
  } else {
    url.searchParams.delete("search");
  }
  window.history.replaceState({}, "", url);
  renderBrands();
  renderFestivals();
}

categoryFilter?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-category]");
  if (!button) {
    return;
  }

  activeCategory = button.dataset.category;
  categoryFilter.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  renderBrands();
});

brandSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  applySearch(brandSearchInput?.value || "");
  document.querySelector("#brands")?.scrollIntoView({ behavior: "smooth" });
});

brandSearchInput?.addEventListener("input", (event) => {
  applySearch(event.currentTarget.value);
});

clearSearchButton?.addEventListener("click", resetFilters);
resetSearchButton?.addEventListener("click", resetFilters);

function focusBrandSearch() {
  setMenuOpen(false);
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.setTimeout(() => brandSearchInput?.focus(), 350);
}

headerSearchButton?.addEventListener("click", focusBrandSearch);
bottomSearchButton?.addEventListener("click", focusBrandSearch);

function saveRecentBrand(link) {
  try {
    localStorage.setItem(
      RECENT_BRAND_KEY,
      JSON.stringify({
        slug: link.dataset.brandSlug,
        name: link.dataset.brandName,
        url: link.getAttribute("href")
      })
    );
  } catch {
    // 저장소를 사용할 수 없는 브라우저에서는 링크 이동만 진행합니다.
  }
}

brandGrid?.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-brand-slug]");
  if (link) {
    saveRecentBrand(link);
  }
});

festivalGrid?.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-brand-slug]");
  if (link) {
    saveRecentBrand(link);
  }
});

brandTicker?.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-brand-slug]");
  if (link) {
    saveRecentBrand(link);
  }
});

brandGrid?.addEventListener("mouseenter", () => {
  brandGridInteractionActive = true;
});

brandGrid?.addEventListener("mouseleave", () => {
  brandGridInteractionActive = false;
});

brandGrid?.addEventListener("focusin", () => {
  brandGridInteractionActive = true;
});

brandGrid?.addEventListener("focusout", (event) => {
  if (!brandGrid.contains(event.relatedTarget)) {
    brandGridInteractionActive = false;
  }
});

brandGrid?.addEventListener(
  "touchstart",
  () => {
    brandRotationPauseUntil = Date.now() + BRAND_ROTATION_INTERVAL;
  },
  { passive: true }
);

festivalGrid?.addEventListener("mouseenter", () => {
  festivalGridInteractionActive = true;
});

festivalGrid?.addEventListener("mouseleave", () => {
  festivalGridInteractionActive = false;
});

festivalGrid?.addEventListener("focusin", () => {
  festivalGridInteractionActive = true;
});

festivalGrid?.addEventListener("focusout", (event) => {
  if (!festivalGrid.contains(event.relatedTarget)) {
    festivalGridInteractionActive = false;
  }
});

function showToast(message) {
  if (!toast) {
    return;
  }

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

recentBrandButton?.addEventListener("click", () => {
  try {
    const recentBrand = JSON.parse(localStorage.getItem(RECENT_BRAND_KEY));
    if (recentBrand?.url) {
      window.location.href = recentBrand.url;
      return;
    }
  } catch {
    // 잘못된 저장값은 무시합니다.
  }

  showToast("아직 살펴본 브랜드가 없어요.");
});

const regionSearchQueries = {
  "충남 홍성": "충청남도 홍성군",
  "충남 예산": "충청남도 예산군",
  "충남 공주": "충청남도 공주시",
  "충남 천안": "충청남도 천안시",
  "충남 청양": "충청남도 청양군",
  "충남 아산": "충청남도 아산시",
  "충남 논산": "충청남도 논산시",
  "충남 보령": "충청남도 보령시"
};

/*
 * 공개 지도에는 업체의 상세 주소가 아니라 시·군·구 중심 위치를 표시합니다.
 * 자주 쓰는 지역은 미리 확인한 좌표를 사용해 지도 로딩과 마커 표시를 안정화하고,
 * 새 지역이 추가된 경우에만 아래의 카카오 주소 검색을 보조 수단으로 사용합니다.
 */
const regionCoordinates = {
  "충남 아산": { lat: 36.789784, lng: 127.001849 },
  "충남 논산": { lat: 36.187065, lng: 127.098745 },
  "충남 보령": { lat: 36.333162, lng: 126.612944 },
  "충남 청양": { lat: 36.459151, lng: 126.802238 },
  "충남 공주": { lat: 36.4465551158221, lng: 127.11905504092 },
  "충남 예산": { lat: 36.6826228017856, lng: 126.848642241312 },
  "충남 천안": { lat: 36.8150678816279, lng: 127.113911972591 },
  "충남 홍성": { lat: 36.6013575607948, lng: 126.66083238915 }
};

function showMapMessage(title, description) {
  if (!mapLoading) {
    return;
  }

  mapLoading.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <span>${escapeHtml(description)}</span>
  `;
  mapLoading.hidden = false;
}

function hideMapMessage() {
  if (mapLoading) {
    mapLoading.hidden = true;
  }
}

function renderMapCategoryButtons(brands) {
  if (!mapCategoryFilter) {
    return;
  }

  const categories = [...new Set(
    brands.filter((brand) => !isFestival(brand)).map((brand) => brand.category)
  )]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ko"));

  mapCategoryFilter.innerHTML = [
    '<button class="active" type="button" data-map-category="all">전체</button>',
    ...categories.map(
      (category) => `
        <button type="button" data-map-category="${escapeHtml(category)}">
          ${escapeHtml(category)}
        </button>
      `
    )
  ].join("");
}

function groupMapBrands(brands) {
  const groups = new Map();

  brands.forEach((brand) => {
    const region = brand.region || "지역 미정";
    if (!groups.has(region)) {
      groups.set(region, { region, brands: [] });
    }
    groups.get(region).brands.push(brand);
  });

  return [...groups.values()];
}

function getFilteredMapGroups() {
  const mappableBrands = randomizedBrands.filter(
    (brand) => !isFestival(brand)
  );
  const mapBrands =
    activeMapCategory === "all"
      ? mappableBrands
      : mappableBrands.filter(
          (brand) => brand.category === activeMapCategory
        );

  return groupMapBrands(mapBrands);
}

function clearBrandMapOverlays() {
  brandMapOverlays.forEach((overlay) => overlay?.setMap?.(null));
  brandMapOverlays = [];
}

function renderMapFallback() {
  const mapContainer = document.querySelector("#brandMap");
  if (!mapContainer) {
    return;
  }

  clearBrandMapOverlays();
  brandMap = null;
  brandMapGeocoder = null;
  mapFallbackActive = true;
  mapContainer.classList.add("is-fallback");

  const groups = getFilteredMapGroups();
  if (!groups.length) {
    mapContainer.innerHTML = `
      <div class="map-fallback map-fallback-empty">
        <strong>지금은 표시할 지역이 없어요.</strong>
        <span>다른 분류를 골라보세요.</span>
      </div>
    `;
    hideMapMessage();
    return;
  }

  mapContainer.innerHTML = `
    <div class="map-fallback">
      <div class="map-fallback-kakao-stage">
        <div class="map-fallback-kakao-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <small>KAKAO MAP</small>
        <strong>지도를 잠시 불러오지 못했어요.</strong>
        <span>지역 목록은 그대로 둘러볼 수 있어요.</span>
        <a href="https://map.kakao.com/?q=${encodeURIComponent("충청남도")}" target="_blank" rel="noopener noreferrer">카카오맵에서 충남 보기 <b aria-hidden="true">↗</b></a>
      </div>
      <div class="map-fallback-directory">
        <div class="map-fallback-head">
          <small>지역으로 찾기</small>
          <strong>지역을 선택하면 가게와 브랜드를 볼 수 있어요.</strong>
          <span>먼저 궁금한 지역을 골라보세요.</span>
        </div>
        <div class="map-fallback-grid">
          ${groups
            .map(
              (group, index) => `
                <button
                  type="button"
                  class="map-fallback-button${index === 0 ? " active" : ""}"
                  data-fallback-region="${escapeHtml(group.region)}"
                >
                  <span>${escapeHtml(group.region)}</span>
                  <strong>${group.brands.length}</strong>
                </button>
              `
            )
            .join("")}
        </div>
      </div>
    </div>
  `;

  mapContainer.querySelectorAll("[data-fallback-region]").forEach((button) => {
    button.addEventListener("click", () => {
      const group = groups.find(
        (item) => item.region === button.dataset.fallbackRegion
      );
      if (!group) {
        return;
      }
      mapContainer.querySelectorAll(".map-fallback-button").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      renderMapRegionPanel(group);
    });
  });

  renderMapRegionPanel(groups[0]);
  hideMapMessage();
}

function resolveRegionPosition(region) {
  if (regionPositionCache.has(region)) {
    return Promise.resolve(regionPositionCache.get(region));
  }

  const storedCoordinate = regionCoordinates[region];
  if (storedCoordinate) {
    const position = new kakao.maps.LatLng(
      storedCoordinate.lat,
      storedCoordinate.lng
    );
    regionPositionCache.set(region, position);
    return Promise.resolve(position);
  }

  const query = regionSearchQueries[region] || region;

  return new Promise((resolve) => {
    brandMapGeocoder.addressSearch(query, (result, status) => {
      if (
        status === kakao.maps.services.Status.OK &&
        Array.isArray(result) &&
        result[0]
      ) {
        const position = new kakao.maps.LatLng(
          Number(result[0].y),
          Number(result[0].x)
        );
        regionPositionCache.set(region, position);
        resolve(position);
        return;
      }

      resolve(null);
    });
  });
}

function renderMapRegionPanel(group) {
  if (!mapRegionPanel) {
    return;
  }

  const cards = group.brands
    .map(
      (brand) => `
        <a class="map-region-brand" href="${getBrandPageUrl(brand)}">
          <img
            src="${escapeHtml(brand.images?.main || "/assets/brands/brand-placeholder.svg")}"
            alt=""
            loading="lazy"
          >
          <span>
            <small>${escapeHtml(brand.category)}</small>
            <strong>${escapeHtml(brand.name)}</strong>
            <i>${escapeHtml(brand.product)}</i>
          </span>
          <b aria-hidden="true">→</b>
        </a>
      `
    )
    .join("");

  mapRegionPanel.innerHTML = `
    <p class="section-kicker">지역별 이야기</p>
    <h3>${escapeHtml(group.region)}</h3>
    <span>${group.brands.length}곳을 만나볼 수 있어요.</span>
    <div class="map-region-brand-list">${cards}</div>
  `;
}

function createRegionOverlay(group, position) {
  const markerButton = document.createElement("button");
  markerButton.type = "button";
  markerButton.className = "brand-region-marker";
  markerButton.setAttribute(
    "aria-label",
    `${group.region} 브랜드 ${group.brands.length}개 보기`
  );
  markerButton.innerHTML = `
    <span>${escapeHtml(group.region)}</span>
    <strong>${group.brands.length}</strong>
  `;

  markerButton.addEventListener("click", () => {
    brandMap.panTo(position);
    brandMap.setLevel(7);
    renderMapRegionPanel(group);
  });

  const overlay = new kakao.maps.CustomOverlay({
    map: brandMap,
    position,
    content: markerButton,
    yAnchor: 1.15,
    zIndex: 5
  });

  brandMapOverlays.push(overlay);
}

async function renderBrandMapMarkers() {
  if (!brandMap || !brandMapGeocoder) {
    return;
  }

  const renderSequence = ++mapRenderSequence;
  clearBrandMapOverlays();

  const groups = getFilteredMapGroups();

  showMapMessage(
    "가게가 있는 지역을 표시하고 있어요.",
    "잠시만 기다려 주세요."
  );

  const positionedGroups = await Promise.all(
    groups.map(async (group) => ({
      group,
      position: await resolveRegionPosition(group.region)
    }))
  );

  if (renderSequence !== mapRenderSequence) {
    return;
  }

  const validGroups = positionedGroups.filter((item) => item.position);
  if (!validGroups.length) {
    showMapMessage(
      "지금은 표시할 지역이 없어요.",
      "다른 분류를 골라보세요."
    );
    return;
  }

  const bounds = new kakao.maps.LatLngBounds();
  validGroups.forEach(({ group, position }) => {
    createRegionOverlay(group, position);
    bounds.extend(position);
  });

  brandMap.setBounds(bounds);
  hideMapMessage();
}

function initializeBrandMap() {
  const mapContainer = document.querySelector("#brandMap");
  if (!mapContainer || (brandMap && !mapFallbackActive)) {
    return;
  }

  try {
    mapContainer.classList.remove("is-fallback");
    mapContainer.innerHTML = "";
    mapFallbackActive = false;
    brandMap = new kakao.maps.Map(mapContainer, {
      center: new kakao.maps.LatLng(36.35, 127.75),
      level: 12
    });
    brandMapGeocoder = new kakao.maps.services.Geocoder();
  } catch (error) {
    renderMapFallback();
    return;
  }

  if ("ResizeObserver" in window) {
    brandMapResizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        if (!brandMap) {
          return;
        }
        const currentCenter = brandMap.getCenter();
        const currentLevel = brandMap.getLevel();
        brandMap.relayout();
        brandMap.setCenter(currentCenter);
        brandMap.setLevel(currentLevel);
      });
    });
    brandMapResizeObserver.observe(mapContainer);
  }

  renderBrandMapMarkers();
}

function loadKakaoMapSdk() {
  const key = String(window.KAKAO_JAVASCRIPT_KEY || "").trim();
  if (!key) {
    renderMapFallback();
    return;
  }

  if (window.kakao?.maps) {
    try {
      kakao.maps.load(initializeBrandMap);
    } catch (error) {
      renderMapFallback();
    }
    return;
  }

  const script = document.createElement("script");
  script.src =
    "https://dapi.kakao.com/v2/maps/sdk.js" +
    `?appkey=${encodeURIComponent(key)}` +
    "&autoload=false&libraries=services";
  script.addEventListener("load", () => {
    if (!window.kakao?.maps) {
      renderMapFallback();
      return;
    }
    try {
      kakao.maps.load(initializeBrandMap);
    } catch (error) {
      renderMapFallback();
    }
  });
  script.addEventListener("error", renderMapFallback);
  document.head.appendChild(script);

  window.setTimeout(() => {
    if (!brandMap && !mapFallbackActive) {
      renderMapFallback();
    }
  }, 6000);
}

mapCategoryFilter?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-map-category]");
  if (!button) {
    return;
  }

  activeMapCategory = button.dataset.mapCategory;
  mapCategoryFilter.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  if (mapFallbackActive) {
    renderMapFallback();
  } else {
    renderBrandMapMarkers();
  }
});

async function loadBrands() {
  try {
    const response = await fetch("/data/brands/index.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`브랜드 데이터를 불러오지 못했습니다. (${response.status})`);
    }

    const brands = await response.json();
    const publishedItems = brands.filter((brand) => brand.published !== false);
    randomizedBrands = shuffled(
      publishedItems.filter((brand) => !isFestival(brand))
    );
    randomizedFestivals = shuffled(
      publishedItems.filter((brand) => isFestival(brand))
    );

    renderCategoryButtons(randomizedBrands);
    renderMapCategoryButtons(randomizedBrands);

    const initialSearch = new URL(window.location.href).searchParams.get("search");
    if (initialSearch && brandSearchInput) {
      brandSearchInput.value = initialSearch;
      searchKeyword = normalized(initialSearch);
      if (clearSearchButton) {
        clearSearchButton.hidden = false;
      }
    }

    renderBrands();
    renderFestivals();
    renderBrandTicker(randomizedBrands);
    startBrandRotation();
    startFestivalRotation();
    if (document.querySelector("#brandMap")) {
      loadKakaoMapSdk();
    }
  } catch (error) {
    console.error(error);
    randomizedBrands = [
      {
        slug: "i4",
        name: "아이뽀란",
        category: "농산",
        product: "계란",
        region: "충남 홍성",
        headline: "농장에서 식탁까지 과정을 살펴볼 수 있는 계란",
        published: true,
        images: { main: "/assets/i4-eggs.png" }
      }
    ];
    randomizedFestivals = [];
    renderCategoryButtons(randomizedBrands);
    renderMapCategoryButtons(randomizedBrands);
    renderBrands();
    renderFestivals();
    renderBrandTicker(randomizedBrands);
    startBrandRotation();
    startFestivalRotation();
    if (document.querySelector("#brandMap")) {
      loadKakaoMapSdk();
    }
  }
}

loadBrands();

const serviceInquiryForm = document.querySelector("#serviceInquiryForm");
const serviceInquiryStatus = document.querySelector("#serviceInquiryStatus");

serviceInquiryForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitButton = serviceInquiryForm.querySelector('button[type="submit"]');
  const formData = new FormData(serviceInquiryForm);
  const originalLabel = submitButton?.textContent || "문의 보내기";

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "보내는 중";
  }
  if (serviceInquiryStatus) {
    serviceInquiryStatus.textContent = "";
    serviceInquiryStatus.className = "";
  }

  try {
    const response = await fetch("https://formsubmit.co/ajax/fyndcom@gmail.com", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "상호 또는 담당자": formData.get("name"),
        "연락처": formData.get("contact"),
        "지역과 업종": formData.get("region"),
        "문의 내용": formData.get("message") || "별도 내용 없음",
        _subject: "[FYND 서비스웹] 소개 신청",
        _template: "table"
      })
    });

    if (!response.ok) {
      throw new Error("문의 전송 실패");
    }

    serviceInquiryForm.reset();
    if (serviceInquiryStatus) {
      serviceInquiryStatus.textContent =
        "문의가 접수됐어요. 남겨주신 연락처로 답변드릴게요.";
      serviceInquiryStatus.className = "success";
    }
  } catch (error) {
    console.error(error);
    if (serviceInquiryStatus) {
      serviceInquiryStatus.textContent =
        "지금은 전송이 되지 않아요. 잠시 후 다시 보내주세요.";
      serviceInquiryStatus.className = "error";
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
});
