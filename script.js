(function () {
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
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
