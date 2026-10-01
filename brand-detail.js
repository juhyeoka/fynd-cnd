const storyReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll("[data-story-reader]").forEach((reader) => {
  const viewport = reader.querySelector("[data-story-viewport]");
  const slides = Array.from(reader.querySelectorAll("[data-story-index]"));
  const previous = reader.querySelector("[data-story-prev]");
  const next = reader.querySelector("[data-story-next]");
  const status = reader.querySelector("[data-story-status]");
  const dots = Array.from(reader.querySelectorAll("[data-story-dot]"));

  if (!viewport || slides.length === 0) return;

  let activeIndex = 0;
  let scrollFrame = 0;
  let settleTimer = 0;

  function updateScrollableCopy() {
    slides.forEach((slide) => {
      const copy = slide.querySelector(".brand-detail-story-section-copy") || slide;
      const canScroll = copy.scrollHeight > copy.clientHeight + 2;
      copy.dataset.storyCanScroll = String(canScroll);
      copy.classList.toggle("is-scrollable", canScroll);
      slide.classList.toggle("has-scrollable-copy", canScroll);

      let cue = slide.querySelector(".brand-detail-story-more-cue");
      if (!cue) {
        cue = document.createElement("span");
        cue.className = "brand-detail-story-more-cue";
        cue.textContent = "위로 더 읽기";
        cue.setAttribute("aria-hidden", "true");
        slide.append(cue);
      }

      const updateCue = () => {
        const reachedEnd = copy.scrollTop + copy.clientHeight >= copy.scrollHeight - 4;
        cue.hidden = copy.dataset.storyCanScroll !== "true" || reachedEnd;
      };

      if (!copy.dataset.storyScrollCue) {
        copy.dataset.storyScrollCue = "true";
        copy.addEventListener("scroll", updateCue, { passive: true });
      }
      updateCue();

      if (canScroll) {
        copy.tabIndex = 0;
        copy.setAttribute("aria-label", "이야기 본문. 위아래로 스크롤할 수 있습니다.");
      } else {
        copy.removeAttribute("tabindex");
        copy.removeAttribute("aria-label");
      }
    });
  }

  function updateControls(index) {
    activeIndex = Math.max(0, Math.min(index, slides.length - 1));
    if (previous) previous.disabled = activeIndex === 0;
    if (next) next.disabled = activeIndex === slides.length - 1;
    if (status) status.textContent = `${activeIndex + 1} / ${slides.length}`;

    slides.forEach((slide, slideIndex) => {
      const current = slideIndex === activeIndex;
      slide.setAttribute("aria-current", String(current));
      slide.toggleAttribute("inert", !current);
    });

    dots.forEach((dot, dotIndex) => {
      dot.setAttribute("aria-current", String(dotIndex === activeIndex));
    });
  }

  function closestSlideIndex() {
    return slides.reduce((closest, slide, index) => {
      const distance = Math.abs(slide.offsetLeft - viewport.scrollLeft);
      return distance < closest.distance ? { index, distance } : closest;
    }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
  }

  function settleCurrentSlide() {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => updateControls(closestSlideIndex()), 80);
  }

  function goToSlide(index) {
    const target = Math.max(0, Math.min(index, slides.length - 1));
    updateControls(target);
    viewport.scrollTo({
      left: slides[target].offsetLeft,
      behavior: storyReducedMotion.matches ? "auto" : "smooth"
    });
  }

  viewport.addEventListener("scroll", () => {
    window.cancelAnimationFrame(scrollFrame);
    scrollFrame = window.requestAnimationFrame(settleCurrentSlide);
  }, { passive: true });

  viewport.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToSlide(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToSlide(activeIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToSlide(0);
    } else if (event.key === "End") {
      event.preventDefault();
      goToSlide(slides.length - 1);
    }
  });

  previous?.addEventListener("click", () => goToSlide(activeIndex - 1));
  next?.addEventListener("click", () => goToSlide(activeIndex + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => goToSlide(index)));

  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => {
      viewport.scrollTo({ left: slides[activeIndex].offsetLeft, behavior: "auto" });
      updateScrollableCopy();
    });
  });

  window.addEventListener("load", updateScrollableCopy, { once: true });

  reader.classList.add("is-story-ready");
  updateControls(0);
  updateScrollableCopy();
});
