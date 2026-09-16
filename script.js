(function () {
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  var layoutMq = window.matchMedia("(min-width: 700px)");
  var motionMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  var heroFrame = document.querySelector("[data-hero-frame]");
  var heroVideo = document.querySelector("[data-hero-call]");
  var heroScene = document.querySelector(".hero-scene");

  function heroCanPlay() {
    return !motionMq.matches;
  }

  function heroCanPin() {
    return layoutMq.matches && !motionMq.matches;
  }

  function updateHeroScroll() {
    if (!heroFrame || !heroScene) return;
    if (!heroCanPin()) {
      heroFrame.style.setProperty("--hero-p", "0");
      return;
    }
    var rect = heroScene.getBoundingClientRect();
    var range = Math.max(1, heroScene.offsetHeight - window.innerHeight);
    var progress = Math.min(1, Math.max(0, -rect.top / range));
    heroFrame.style.setProperty("--hero-p", progress.toFixed(4));
  }

  function bindLoop(frame, video, src) {
    if (!frame || !video) return;
    var source = video.querySelector("source");

    function armVideo() {
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      if (source) source.removeAttribute("media");
    }

    function tryPlay() {
      if (!heroCanPlay()) return;
      armVideo();
      var play = video.play();
      if (play && play.then) {
        play.then(function () {
          if (heroCanPlay()) frame.classList.add("is-live");
        }).catch(function () {});
      }
    }

    function sync() {
      armVideo();
      if (heroCanPlay()) {
        video.preload = video.getAttribute("preload") || "auto";
        if (source && source.getAttribute("src") !== src) {
          source.setAttribute("src", src);
          video.load();
        }
        if (video.readyState >= 2) frame.classList.add("is-live");
        tryPlay();
      } else {
        video.pause();
        video.removeAttribute("autoplay");
        video.preload = "none";
        if (video.currentSrc) {
          if (source) source.removeAttribute("src");
          video.removeAttribute("src");
          video.load();
        }
        frame.classList.remove("is-live");
      }
    }

    video.addEventListener("loadeddata", function () {
      if (heroCanPlay()) frame.classList.add("is-live");
      tryPlay();
    });
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", function () {
      if (heroCanPlay()) frame.classList.add("is-live");
    });
    video.addEventListener("pause", function () {
      if (!heroCanPlay()) frame.classList.remove("is-live");
    });

    document.addEventListener("touchstart", tryPlay, { once: true, passive: true });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tryPlay();
    });

    if (typeof IntersectionObserver === "function") {
      var observer = new IntersectionObserver(
        function (entries) {
          if (entries[0] && entries[0].isIntersecting) tryPlay();
        },
        { threshold: 0.2 }
      );
      observer.observe(video);
    }

    sync();
    if (layoutMq.addEventListener) {
      layoutMq.addEventListener("change", sync);
      motionMq.addEventListener("change", sync);
    } else {
      layoutMq.addListener(sync);
      motionMq.addListener(sync);
    }
  }

  bindLoop(heroFrame, heroVideo, "/images/acorn-hero.mp4?v=2");
  bindLoop(
    document.querySelector("[data-ask-frame]"),
    document.querySelector("[data-ask-call]"),
    "/images/meeting-2.mp4"
  );

  if (heroScene && heroFrame) {
    updateHeroScroll();
    window.addEventListener("scroll", updateHeroScroll, { passive: true });
    window.addEventListener("resize", updateHeroScroll);
    if (layoutMq.addEventListener) {
      layoutMq.addEventListener("change", updateHeroScroll);
    } else {
      layoutMq.addListener(updateHeroScroll);
    }
  }

  var stage = document.querySelector("[data-ask]");
  if (!stage) return;

  var qEl = stage.querySelector("[data-q]");
  var aEl = stage.querySelector("[data-a]");
  if (!qEl || !aEl) return;

  var prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var items = [
    {
      q: "What did we commit to before Friday?",
      a: "Ship the API change. Ben owns it. Review is Monday, not this week.",
    },
    {
      q: "Who owns the security questionnaire?",
      a: "Maya. She’ll send it Friday, before the Atlas follow-up.",
    },
    {
      q: "What’s still open from last week?",
      a: "EU data residency. No update since the procurement intro.",
    },
  ];

  i = 1;

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  async function typeText(el, text) {
    el.textContent = "";
    if (prefersReduced) {
      el.textContent = text;
      return;
    }
    for (var n = 0; n < text.length; n += 1) {
      el.textContent = text.slice(0, n + 1);
      await sleep(18);
    }
  }

  async function cycle() {
    await sleep(3800);
    var item = items[i % items.length];
    aEl.classList.remove("is-in");
    await typeText(qEl, item.q);
    await sleep(280);
    aEl.classList.add("is-in");
    await typeText(aEl, item.a);
    i += 1;
    cycle();
  }

  cycle();
})();
