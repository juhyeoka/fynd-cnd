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
const collaboratorSection = document.querySelector("#collaborators");
const collaboratorViewport = document.querySelector(".sv3-collaborator-viewport");
const collaboratorTrack = document.querySelector("#collaboratorTrack");
const collaboratorDots = document.querySelector("#collaboratorDots");
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
const COLLABORATOR_ROTATION_INTERVAL = 3000;

let brands = [];
let festivals = [];
let collaborators = [];
let searchKeyword = "";
let festivalRotationTimer = null;
let festivalGridInteractionActive = false;
let collaboratorIndex = 0;
let collaboratorCount = 0;
let collaboratorTimer = null;
let collaboratorPaused = false;
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

function hasCollaborationCard(item) {
  return Array.isArray(item.collaborationCards) && item.collaborationCards.length > 0;
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

function getLocationLabel(brand) {
  return brand.address || brand.region || "위치 정보 준비 중";
}

function getMapSearchUrl(brand) {
  if (brand.placeUrl) return brand.placeUrl;
  const query = brand.address || [brand.region, brand.name].filter(Boolean).join(" ");
  return query ? `https://map.kakao.com/?q=${encodeURIComponent(query)}` : "";
}

function renderBrandCard(brand, index) {
  const image = brand.images?.card || brand.images?.main || "/assets/brands/brand-placeholder.svg";
  const partner = isPartner(brand);
  const location = [brand.category, brand.region].filter(Boolean).join(" · ");

  return `
    <article class="brand-card-shell" data-brand-slug="${escapeHtml(brand.slug)}">
      <button
        class="brand-card brand-card-real brand-card-standard brand-card-toggle"
        type="button"
        aria-expanded="false"
        aria-controls="brandLocationPanel"
      >
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
            <b>위치 보기</b>
          </span>
        </span>
      </button>
    </article>
  `;
}

function renderLocationPanelContent(brand) {
  const detailUrl = getBrandPageUrl(brand);
  const mapUrl = getMapSearchUrl(brand);
  return `
    <small>${escapeHtml(brand.name)} 위치</small>
    <strong>${escapeHtml(getLocationLabel(brand))}</strong>
    <div>
      <a href="${escapeHtml(detailUrl)}"${getExternalLinkAttributes(brand)} data-brand-slug="${escapeHtml(brand.slug)}" data-brand-name="${escapeHtml(brand.name)}">이야기 자세히 보기</a>
      ${mapUrl ? `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">지도에서 보기 <span aria-hidden="true">↗</span></a>` : ""}
    </div>
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

function getVisibleCollaborators() {
  return collaborators.filter((item) => !searchKeyword || searchableText(item).includes(searchKeyword));
}

function countUniqueResults(...groups) {
  return new Set(
    groups.flat().map((item) => item.slug || item.externalUrl || item.name)
  ).size;
}

function renderBrands() {
  if (!brandGrid) return;
  const visibleBrands = getVisibleBrands();
  brandGrid.innerHTML = visibleBrands.map(renderBrandCard).join("") +
    '<div class="brand-location-panel" id="brandLocationPanel" hidden></div>';
  brandGrid.hidden = visibleBrands.length === 0;

  if (emptyResult) {
    const hasAnotherResult = Boolean(searchKeyword) && (
      getVisibleCollaborators().length > 0 || getVisibleFestivals().length > 0
    );
    emptyResult.hidden = visibleBrands.length > 0 || hasAnotherResult;
  }

  if (resultSummary) {
    if (searchKeyword) {
      const total = countUniqueResults(
        visibleBrands,
        getVisibleCollaborators(),
        getVisibleFestivals()
      );
      resultSummary.textContent = `"${brandSearchInput?.value.trim() || ""}" 전체 검색 결과 ${total}개`;
    } else {
      resultSummary.textContent = `등록된 이야기 ${visibleBrands.length}곳`;
    }
  }

  if (onboardingSlots) onboardingSlots.hidden = Boolean(searchKeyword) || brands.length >= 4;
}

function setCollaboratorSlide(nextIndex, announce = false) {
  if (!collaboratorTrack || collaboratorCount === 0) return;
  collaboratorIndex = (nextIndex + collaboratorCount) % collaboratorCount;
  collaboratorTrack.style.transform = `translate3d(-${collaboratorIndex * 100}%, 0, 0)`;
  collaboratorTrack.querySelectorAll(".sv3-collaborator-card").forEach((card, index) => {
    card.setAttribute("aria-hidden", String(index !== collaboratorIndex));
    card.tabIndex = index === collaboratorIndex ? 0 : -1;
  });
  collaboratorDots?.querySelectorAll("button").forEach((dot, index) => {
    const current = index === collaboratorIndex;
    dot.classList.toggle("active", current);
    dot.setAttribute("aria-current", current ? "true" : "false");
    if (announce) dot.focus({ preventScroll: true });
  });
}

function stopCollaboratorSlider() {
  window.clearInterval(collaboratorTimer);
  collaboratorTimer = null;
}

function startCollaboratorSlider() {
  stopCollaboratorSlider();
  if (
    collaboratorCount < 2 ||
    collaboratorPaused ||
    document.hidden ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) return;

  collaboratorTimer = window.setInterval(() => {
    setCollaboratorSlide(collaboratorIndex + 1);
  }, COLLABORATOR_ROTATION_INTERVAL);
}

function renderCollaborators() {
  if (!collaboratorTrack || !collaboratorSection) return;
  const visibleCollaborators = getVisibleCollaborators();
  const cards = visibleCollaborators.flatMap((brand) =>
    brand.collaborationCards.map((card) => ({ brand, card }))
  );

  collaboratorSection.hidden = cards.length === 0;
  collaboratorCount = cards.length;
  collaboratorIndex = 0;

  collaboratorTrack.innerHTML = cards.map(({ brand, card }, index) => `
    <a class="sv3-collaborator-card" href="${getBrandPageUrl(brand)}"${getExternalLinkAttributes(brand)}
       data-brand-slug="${escapeHtml(brand.slug)}" data-brand-name="${escapeHtml(brand.name)}"
       aria-hidden="${index === 0 ? "false" : "true"}" tabindex="${index === 0 ? "0" : "-1"}">
      <span>
        <small>${escapeHtml(card.eyebrow || "FYND 협력 파트너")}</small>
        <strong>${escapeHtml(card.title || brand.name)}</strong>
        <p>${escapeHtml(card.description || brand.description)}</p>
        ${card.fact ? `<i>${escapeHtml(card.fact)}</i>` : ""}
      </span>
      <img src="${escapeHtml(card.image || brand.images?.main || "/assets/brands/brand-placeholder.svg")}" alt="${escapeHtml(brand.name)} ${escapeHtml(card.title || brand.product)}" loading="lazy">
      <b>${escapeHtml(card.linkLabel || "이야기 보기")} <span aria-hidden="true">↗</span></b>
    </a>
  `).join("");

  if (collaboratorDots) {
    collaboratorDots.innerHTML = cards.map(({ brand }, index) => `
      <button type="button" data-slide="${index}" aria-label="${escapeHtml(brand.name)} 보기" aria-current="${index === 0 ? "true" : "false"}" class="${index === 0 ? "active" : ""}"></button>
    `).join("");
    collaboratorDots.hidden = cards.length < 2;
  }

  collaboratorTrack.style.transform = "translate3d(0, 0, 0)";
  startCollaboratorSlider();
}

collaboratorDots?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-slide]");
  if (!button) return;
  setCollaboratorSlide(Number(button.dataset.slide));
  startCollaboratorSlider();
});

collaboratorViewport?.addEventListener("mouseenter", () => {
  collaboratorPaused = true;
  stopCollaboratorSlider();
});

collaboratorViewport?.addEventListener("mouseleave", () => {
  collaboratorPaused = false;
  startCollaboratorSlider();
});

collaboratorSection?.addEventListener("focusin", () => {
  collaboratorPaused = true;
  stopCollaboratorSlider();
});

collaboratorSection?.addEventListener("focusout", (event) => {
  if (!collaboratorSection.contains(event.relatedTarget)) {
    collaboratorPaused = false;
    startCollaboratorSlider();
  }
});

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
  renderCollaborators();
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
  window.scrollTo({ top: 0, behavior: "smooth" });
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
  const toggle = event.target.closest(".brand-card-toggle");
  if (toggle) {
    const shell = toggle.closest(".brand-card-shell");
    const panel = brandGrid.querySelector("#brandLocationPanel");
    if (!shell || !panel) return;
    const willOpen = toggle.getAttribute("aria-expanded") !== "true";

    brandGrid.querySelectorAll(".brand-card-toggle[aria-expanded='true']").forEach((openToggle) => {
      openToggle.setAttribute("aria-expanded", "false");
      const openLabel = openToggle.querySelector(".brand-card-meta b");
      if (openLabel) openLabel.textContent = "위치 보기";
    });

    if (!willOpen) {
      panel.hidden = true;
      return;
    }

    const brand = brands.find((item) => item.slug === shell.dataset.brandSlug);
    if (!brand) return;
    const shells = [...brandGrid.querySelectorAll(".brand-card-shell")];
    const shellIndex = shells.indexOf(shell);
    const columnCount = Math.max(
      1,
      getComputedStyle(brandGrid).gridTemplateColumns.split(" ").filter(Boolean).length
    );
    const rowEndIndex = Math.min(
      Math.ceil((shellIndex + 1) / columnCount) * columnCount - 1,
      shells.length - 1
    );
    shells[rowEndIndex].after(panel);
    panel.innerHTML = renderLocationPanelContent(brand);
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", String(willOpen));
    const label = toggle.querySelector(".brand-card-meta b");
    if (label) label.textContent = "위치 닫기";
    return;
  }

  const link = event.target.closest("a[data-brand-slug]");
  if (link) saveRecentBrand(link);
});

[festivalGrid, collaboratorTrack, brandTicker].forEach((container) => {
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

document.addEventListener("visibilitychange", () => {
  startCollaboratorSlider();
});

async function loadBrands() {
  try {
    const response = await fetch("/data/brands/index.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`브랜드 데이터를 불러오지 못했습니다. (${response.status})`);
    const items = (await response.json()).filter((item) => item.published !== false);

    collaborators = items.filter(hasCollaborationCard);
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
    collaborators = [];
    renderAll();
    if (resultSummary) resultSummary.textContent = "가게 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.";
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
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        "상호 또는 담당자": formData.get("name"),
        "연락처": formData.get("contact"),
        "지역과 업종": formData.get("region"),
        "문의 내용": formData.get("message") || "별도 내용 없음",
        _subject: "[FYND 서비스웹] 소개 신청",
        _template: "table"
      })
    });
    if (!response.ok) throw new Error("문의 전송 실패");
    serviceInquiryForm.reset();
    if (serviceInquiryStatus) {
      serviceInquiryStatus.textContent = "문의가 접수됐어요. 남겨주신 연락처로 답변드릴게요.";
      serviceInquiryStatus.className = "success";
    }
  } catch (error) {
    console.error(error);
    if (serviceInquiryStatus) {
      serviceInquiryStatus.textContent = "지금은 전송이 되지 않아요. 잠시 후 다시 보내주세요.";
      serviceInquiryStatus.className = "error";
    }
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
  }
});
