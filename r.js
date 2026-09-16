(function () {
  var CODE_RE = /^[0-9a-f]{24}$/;

  function parseCode(pathname) {
    var path = pathname.replace(/\/+$/, "") || "/";
    if (path === "/r") return "";
    if (path.indexOf("/r/") !== 0) return "";
    var rest = path.slice(3);
    try {
      rest = decodeURIComponent(rest);
    } catch (err) {
      return "";
    }
    if (!rest || rest.indexOf("/") !== -1) return "";
    return rest.toLowerCase();
  }

  var code = window.__acornShare || parseCode(location.pathname);
  if (!CODE_RE.test(code)) code = "";
  var valid = Boolean(code);

  document.documentElement.setAttribute(
    "data-invite",
    valid ? "valid" : "invalid"
  );

  var views = document.querySelectorAll("[data-invite-view]");
  for (var v = 0; v < views.length; v += 1) {
    var view = views[v];
    view.hidden =
      view.getAttribute("data-invite-view") !== (valid ? "valid" : "invalid");
  }

  if (valid) {
    var canonical = "/r/" + code;
    if (location.pathname !== canonical) {
      history.replaceState(null, "", canonical + location.search + location.hash);
    }
    var codeEl = document.getElementById("share-code");
    if (codeEl) codeEl.textContent = code;
    document.title = "You’ve been invited to Acorn";
  } else {
    document.title = "That invite isn’t valid — Acorn";
  }

  var toast = document.getElementById("invite-toast");
  var toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("is-on");
    }, 4200);
  }

  function fallbackCopy(text) {
    var area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (err) {}
    document.body.removeChild(area);
    return ok;
  }

  function copyCode() {
    if (!valid) return Promise.resolve(false);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(code).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(code);
        }
      );
    }
    return Promise.resolve(fallbackCopy(code));
  }

  var copyBtn = document.getElementById("copy-share-code");
  if (copyBtn) {
    var defaultLabel = copyBtn.textContent.trim() || "Copy";
    copyBtn.textContent = defaultLabel;
    copyBtn.addEventListener("click", function () {
      copyCode().then(function (ok) {
        if (!ok) return;
        copyBtn.textContent = "Copied";
        setTimeout(function () {
          copyBtn.textContent = defaultLabel;
        }, 1600);
      });
    });
  }

  var downloads = document.querySelectorAll("[data-invite-download]");
  for (var i = 0; i < downloads.length; i += 1) {
    downloads[i].addEventListener("click", function () {
      if (!valid) return;
      copyCode().then(function (ok) {
        showToast(
          ok
            ? "Share code copied. After you install, open Settings → Acorn Pro and paste it."
            : "After you install, open Settings → Acorn Pro and paste the share code from this page."
        );
      });
    });
  }
})();
