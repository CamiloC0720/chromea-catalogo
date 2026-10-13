/* =========================================================
   Chromea — Catálogo público (visor de una foto a la vez)
   Lee data/config.json y data/products.json (estáticos)
   y renderiza la tienda. No requiere backend.
   ========================================================= */

(function () {
  "use strict";

  var state = {
    config: null,
    products: [],
    category: "Todos",
    items: [],   // productos filtrados por categoría actual
    index: 0
  };

  function buildWhatsAppLink(config, message) {
    var number = (config.whatsappNumber || "").replace(/\D/g, "");
    var text = encodeURIComponent(message || config.whatsappDefaultMessage || "Hola, vi el catálogo de Chromea.");
    return "https://wa.me/" + number + "?text=" + text;
  }

  function applyConfig(config) {
    document.title = (config.siteName || "Chromea") + " — Catálogo de Accesorios";

    var topbar = document.getElementById("topbar-note");
    if (topbar && config.footerNote) topbar.textContent = config.footerNote;

    var heroH = document.getElementById("hero-headline");
    if (heroH && config.heroHeadline) heroH.textContent = config.heroHeadline;

    var heroP = document.getElementById("hero-sub");
    if (heroP && config.heroSubheadline) heroP.textContent = config.heroSubheadline;

    var generalLink = buildWhatsAppLink(config);

    ["nav-whatsapp", "hero-whatsapp", "footer-whatsapp", "float-whatsapp"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute("href", generalLink);
    });

    var ig = document.getElementById("footer-instagram");
    if (ig && config.instagramUrl) {
      ig.setAttribute("href", config.instagramUrl);
      ig.textContent = config.instagramHandle || "Instagram";
    }

    var email = document.getElementById("footer-email");
    if (email && config.email) {
      email.style.display = "block";
      email.textContent = config.email;
    }

    var note = document.getElementById("footer-note");
    if (note && config.footerNote) note.textContent = config.footerNote;

    var year = document.getElementById("footer-year");
    if (year) year.textContent = new Date().getFullYear();
  }

  function uniqueCategories(products) {
    var set = {};
    products.forEach(function (p) { if (p.category) set[p.category] = true; });
    return Object.keys(set).sort();
  }

  function renderChips(categories) {
    var wrap = document.getElementById("category-chips");
    if (!wrap) return;
    wrap.innerHTML = "";

    if (categories.length < 2) { wrap.style.display = "none"; return; }
    wrap.style.display = "flex";

    var all = document.createElement("button");
    all.className = "chip" + (state.category === "Todos" ? " active" : "");
    all.textContent = "Todos";
    all.addEventListener("click", function () { setCategory("Todos"); });
    wrap.appendChild(all);

    categories.forEach(function (cat) {
      var chip = document.createElement("button");
      chip.className = "chip" + (state.category === cat ? " active" : "");
      chip.textContent = cat;
      chip.addEventListener("click", function () { setCategory(cat); });
      wrap.appendChild(chip);
    });
  }

  function setCategory(cat) {
    state.category = cat;
    state.index = 0;
    renderChips(uniqueCategories(state.products));
    rebuildItems();
    renderStage(false);
  }

  function rebuildItems() {
    state.items = state.products.filter(function (p) {
      return state.category === "Todos" || p.category === state.category;
    });
    if (state.index >= state.items.length) state.index = 0;
  }

  function go(delta) {
    if (state.items.length === 0) return;
    state.index = (state.index + delta + state.items.length) % state.items.length;
    renderStage(true);
  }

  function renderStage(animate) {
    var frame = document.getElementById("stage-frame");
    var img = document.getElementById("stage-img");
    var badge = document.getElementById("stage-badge");
    var counter = document.getElementById("stage-counter");
    var cta = document.getElementById("stage-cta");
    var empty = document.getElementById("empty-state");

    if (!frame || !img) return;

    if (state.items.length === 0) {
      state.config && (frame.style.display = "none");
      frame.style.display = "none";
      counter.textContent = "";
      cta.style.display = "none";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    frame.style.display = "block";
    cta.style.display = "inline-flex";

    var p = state.items[state.index];

    function apply() {
      img.src = p.image || "images/placeholder-generic.svg";
      img.alt = p.name || "Accesorio Chromea";
      img.classList.toggle("is-out", !p.inStock);

      if (!p.inStock) {
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }

      counter.textContent = (state.index + 1) + " / " + state.items.length;

      if (p.inStock) {
        cta.classList.remove("disabled");
        var msg = p.name
          ? "Hola, vi el " + p.name + " en el catálogo de Chromea y quiero más información."
          : (state.config.whatsappDefaultMessage || "Hola, vi el catálogo de Chromea y quiero más información.");
        cta.href = buildWhatsAppLink(state.config, msg);
        cta.textContent = "Pedir por WhatsApp";
      } else {
        cta.classList.add("disabled");
        cta.textContent = "Agotado";
      }

      img.classList.remove("is-fading");
    }

    if (animate) {
      img.classList.add("is-fading");
      setTimeout(apply, 160);
    } else {
      apply();
    }
  }

  function wireStageControls() {
    var frame = document.getElementById("stage-frame");
    var prevBtn = document.getElementById("stage-prev");
    var nextBtn = document.getElementById("stage-next");
    if (!frame) return;

    prevBtn.addEventListener("click", function (e) { e.stopPropagation(); go(-1); });
    nextBtn.addEventListener("click", function (e) { e.stopPropagation(); go(1); });

    // Tap en la mitad izquierda/derecha de la imagen para pasar, como en historias
    frame.addEventListener("click", function (e) {
      var rect = frame.getBoundingClientRect();
      var x = e.clientX - rect.left;
      if (x < rect.width / 2) go(-1); else go(1);
    });

    // Swipe en móvil
    var startX = null;
    frame.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    frame.addEventListener("touchend", function (e) {
      if (startX === null) return;
      var deltaX = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(deltaX) > 40) {
        if (deltaX < 0) go(1); else go(-1);
      }
    }, { passive: true });

    // Flechas del teclado
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    });
  }

  function init() {
    wireStageControls();

    Promise.all([
      fetch("data/config.json").then(function (r) { return r.json(); }),
      fetch("data/products.json").then(function (r) { return r.json(); })
    ]).then(function (results) {
      state.config = results[0];
      state.products = results[1].slice().sort(function (a, b) {
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
      applyConfig(state.config);
      renderChips(uniqueCategories(state.products));
      rebuildItems();
      renderStage(false);
    }).catch(function (err) {
      var frame = document.getElementById("stage-frame");
      var empty = document.getElementById("empty-state");
      if (frame) frame.style.display = "none";
      if (empty) {
        empty.style.display = "block";
        empty.textContent = "No se pudo cargar el catálogo. Si estás probando el sitio en tu computador, ábrelo con un servidor local (ver README) en lugar de abrir el archivo directamente.";
      }
      console.error("Error cargando catálogo:", err);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
