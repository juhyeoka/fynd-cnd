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
const resultSummary = document.querySelector("#resultSummary");
const festivalResultSummary = document.querySelector("#festivalResultSummary");
const emptyResult = document.querySelector("#emptyResult");
const festivalEmptyResult = document.querySelector("#festivalEmptyResult");
const onboardingSlots = document.querySelector("#onboardingSlots");
const recentBrandButton = document.querySelector("#recentBrandButton");
const brandTicker = document.querySelector("#brandTicker");
const toast = document.querySelector("#toast");

const RECENT_BRAND_KEY = "fynd-cnd-recent-brand";
const FESTIVAL_ROTATION_INTERVAL = 12000;

let brands = [];
let festivals = [];
let searchKeyword = "";
let festivalRotationTimer = null;
let festivalGridInteractionActive = false;
let toastTimer = null;

function setMenuOpen(open) {
  if (!menuButton || !mobileMenu) return;
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
  if (event.key === "Escape") setMenuOpen(false);
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

function normalized(value) {
  return String(value ?? "").trim().toLocaleLowerCase("ko");
}

function searchableText(item) {
  return normalized(
    [
      item.name,
      item.category,
      item.product,
      item.region,
      item.address,
      item.headline,
      item.description,
      ...(item.tags || [])
    ].join(" ")
  );
}

function getBrandPageUrl(brand) {
  return brand.externalUrl || `/brands/${encodeURIComponent(brand.slug)}/`;
}

function isFestival(item) {
  return item.type === "festival";
}

function isCollaborator(item) {
  return item.type === "collaborator";
}

function isPartner(item) {
  return item.type === "partner";
}

function getExternalLinkAttributes(item) {
  return item.externalUrl ? ' target="_blank" rel="noopener noreferrer"' : "";
}

function getRegionBadge(region) {
  return (
    String(region || "")
      .replace(/^충청남도\s*/, "")
      .replace(/^충남\s*/, "")
      .trim() || "충남"
  );
}

function renderBrandCard(brand, index) {
  const image = brand.images?.card || brand.images?.main || "/assets/brands/brand-placeholder.svg";
  const partner = isPartner(brand);
  const location = [brand.category, brand.region].filter(Boolean).join(" · ");
  const url = getBrandPageUrl(brand);

  return `
    <article class="brand-card-shell" data-brand-slug="${escapeHtml(brand.slug)}">
      <a class="brand-card brand-card-real brand-card-standard${partner ? " brand-card-partner" : ""}"
         href="${escapeHtml(url)}"${getExternalLinkAttributes(brand)}
         data-brand-slug="${escapeHtml(brand.slug)}" data-brand-name="${escapeHtml(brand.name)}">
        <span class="brand-card-media">
          <img
            src="${escapeHtml(image)}"
            alt="${escapeHtml(brand.name)} ${escapeHtml(brand.product)} 대표 이미지"
            ${index < 4 ? 'fetchpriority="high"' : 'loading="lazy"'}
          >
          <i class="brand-card-status">${escapeHtml(partner ? "FYND 협력사" : getRegionBadge(brand.region))}</i>
        </span>
        <span class="brand-card-body">
          <small>${escapeHtml(location)}</small>
          <strong>${escapeHtml(brand.name)}</strong>
          <p>${escapeHtml(brand.headline)}</p>
          <span class="brand-card-meta">
            <i>${escapeHtml(brand.product)}</i>
            <b>이야기 보기</b>
          </span>
        </span>
      </a>
    </article>
  `;
}

function getSeoulDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isCurrentFestival(festival) {
  return !festival.endDate || festival.endDate >= getSeoulDateKey();
}

function renderFestivalCard(festival, index) {
  const image = festival.images?.main || "/assets/brands/brand-placeholder.svg";
  const eventDate = festival.eventDate || festival.product || "행사 일정 확인";
  return `
    <a class="festival-card" href="${getBrandPageUrl(festival)}"${getExternalLinkAttributes(festival)}
       data-brand-slug="${escapeHtml(festival.slug)}" data-brand-name="${escapeHtml(festival.name)}">
      <span class="festival-card-media"><img src="${escapeHtml(image)}" alt="${escapeHtml(festival.name)}" ${index < 2 ? 'fetchpriority="high"' : 'loading="lazy"'}></span>
      <span class="festival-card-copy">
        <small>${escapeHtml(festival.region)} · ${escapeHtml(eventDate)}</small>
        <strong>${escapeHtml(festival.name)}</strong>
        <p>${escapeHtml(festival.headline)}</p>
        <b>공식 안내 보기 <span aria-hidden="true">↗</span></b>
      </span>
    </a>
  `;
}

function getVisibleBrands() {
  return brands.filter((brand) => !searchKeyword || searchableText(brand).includes(searchKeyword));
}

function getVisibleFestivals() {
  return festivals.filter((festival) => !searchKeyword || searchableText(festival).includes(searchKeyword));
}

function countUniqueResults(...groups) {
  return new Set(
    groups.flat().map((item) => item.slug || item.externalUrl || item.name)
  ).size;
}

function renderBrands() {
  if (!brandGrid) return;
  const visibleBrands = getVisibleBrands();
  brandGrid.innerHTML = visibleBrands.map(renderBrandCard).join("");
  brandGrid.hidden = visibleBrands.length === 0;

  if (emptyResult) {
    const hasAnotherResult = Boolean(searchKeyword) && getVisibleFestivals().length > 0;
    emptyResult.hidden = visibleBrands.length > 0 || hasAnotherResult;
  }

  if (resultSummary) {
    if (searchKeyword) {
      const total = countUniqueResults(visibleBrands, getVisibleFestivals());
      resultSummary.textContent = `"${brandSearchInput?.value.trim() || ""}" 전체 검색 결과 ${total}개`;
      resultSummary.hidden = false;
    } else {
      resultSummary.textContent = "";
      resultSummary.hidden = true;
    }
  }

  if (onboardingSlots) onboardingSlots.hidden = Boolean(searchKeyword) || brands.length >= 4;
}

function renderFestivals() {
  if (!festivalGrid) return;
  const visibleFestivals = getVisibleFestivals();
  festivalGrid.innerHTML = visibleFestivals.map(renderFestivalCard).join("");
  festivalGrid.hidden = visibleFestivals.length === 0;
  if (festivalEmptyResult) festivalEmptyResult.hidden = visibleFestivals.length > 0;
  if (festivalResultSummary) {
    festivalResultSummary.textContent = searchKeyword
      ? `행사 검색 결과 ${visibleFestivals.length}개`
      : `행사와 축제 ${visibleFestivals.length}개`;
  }
}

function rotateFestivalOrder() {
  if (festivals.length < 2 || searchKeyword || document.hidden || festivalGridInteractionActive) return;
  festivals = [...festivals.slice(1), festivals[0]];
  renderFestivals();
}

function startFestivalRotation() {
  window.clearInterval(festivalRotationTimer);
  festivalRotationTimer = window.setInterval(rotateFestivalOrder, FESTIVAL_ROTATION_INTERVAL);
}

function renderBrandTicker(items) {
  if (!brandTicker || !items.length) return;
  const renderList = (hidden = false) => `
    <div class="brand-lineup-list"${hidden ? ' aria-hidden="true"' : ""}>
      ${items.map((brand) => `
        <a class="real" href="${getBrandPageUrl(brand)}"${getExternalLinkAttributes(brand)} data-brand-slug="${escapeHtml(brand.slug)}" data-brand-name="${escapeHtml(brand.name)}">
          <strong>${escapeHtml(brand.name)}</strong><small>${escapeHtml(brand.product)} · ${escapeHtml(brand.region)}</small>
        </a>
      `).join("")}
    </div>`;
  brandTicker.innerHTML = renderList() + renderList(true);
}

function renderAll() {
  renderBrands();
  renderFestivals();
}

function resetFilters() {
  searchKeyword = "";
  if (brandSearchInput) brandSearchInput.value = "";
  if (clearSearchButton) clearSearchButton.hidden = true;
  const url = new URL(window.location.href);
  url.searchParams.delete("search");
  window.history.replaceState({}, "", url);
  renderAll();
}

function applySearch(value) {
  searchKeyword = normalized(value);
  if (clearSearchButton) clearSearchButton.hidden = !searchKeyword;
  const url = new URL(window.location.href);
  if (value.trim()) url.searchParams.set("search", value.trim());
  else url.searchParams.delete("search");
  window.history.replaceState({}, "", url);
  renderAll();
}

brandSearchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  applySearch(brandSearchInput?.value || "");
  document.querySelector("#brands")?.scrollIntoView({ behavior: "smooth" });
});

brandSearchInput?.addEventListener("input", (event) => applySearch(event.currentTarget.value));
clearSearchButton?.addEventListener("click", resetFilters);
resetSearchButton?.addEventListener("click", resetFilters);

function focusBrandSearch() {
  setMenuOpen(false);
  brandSearchForm?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => brandSearchInput?.focus(), 350);
}

headerSearchButton?.addEventListener("click", focusBrandSearch);
bottomSearchButton?.addEventListener("click", focusBrandSearch);

function saveRecentBrand(link) {
  try {
    localStorage.setItem(RECENT_BRAND_KEY, JSON.stringify({
      slug: link.dataset.brandSlug,
      name: link.dataset.brandName,
      url: link.getAttribute("href")
    }));
  } catch {
    // 저장소를 사용할 수 없는 브라우저에서는 링크 이동만 진행합니다.
  }
}

brandGrid?.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-brand-slug]");
  if (link) saveRecentBrand(link);
});

[festivalGrid, brandTicker].forEach((container) => {
  container?.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-brand-slug]");
    if (link) saveRecentBrand(link);
  });
});

festivalGrid?.addEventListener("mouseenter", () => { festivalGridInteractionActive = true; });
festivalGrid?.addEventListener("mouseleave", () => { festivalGridInteractionActive = false; });
festivalGrid?.addEventListener("focusin", () => { festivalGridInteractionActive = true; });
festivalGrid?.addEventListener("focusout", (event) => {
  if (!festivalGrid.contains(event.relatedTarget)) festivalGridInteractionActive = false;
});

function showToast(message) {
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2600);
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

async function loadBrands() {
  try {
    const response = await fetch("/data/brands/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`브랜드 데이터를 불러오지 못했습니다. (${response.status})`);
    const items = (await response.json()).filter((item) => item.published !== false);

    brands = items
      .filter((item) => !isFestival(item) && !isCollaborator(item))
      .sort((first, second) =>
        (first.sortOrder ?? 999) - (second.sortOrder ?? 999) || first.name.localeCompare(second.name, "ko")
      );
    festivals = items
      .filter((item) => isFestival(item) && isCurrentFestival(item))
      .sort((first, second) => String(first.startDate || "").localeCompare(String(second.startDate || "")));

    const initialSearch = new URL(window.location.href).searchParams.get("search");
    if (initialSearch && brandSearchInput) {
      brandSearchInput.value = initialSearch;
      searchKeyword = normalized(initialSearch);
      if (clearSearchButton) clearSearchButton.hidden = false;
    }

    renderAll();
    renderBrandTicker(brands);
    startFestivalRotation();
  } catch (error) {
    console.error(error);
    brands = [];
    festivals = [];
    renderAll();
    if (resultSummary) {
      resultSummary.textContent = "가게 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.";
      resultSummary.hidden = false;
    }
  }
}

loadBrands();
