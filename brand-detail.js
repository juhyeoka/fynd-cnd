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
    });
  });

  reader.classList.add("is-story-ready");
  updateControls(0);
});
