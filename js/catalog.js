/* =========================================================
   Chromea — Catálogo público (carrusel)
   Lee data/config.json y data/products.json (estáticos)
   y renderiza la tienda. No requiere backend.
   ========================================================= */

(function () {
  "use strict";

  var state = {
    config: null,
    products: [],
    category: "Todos",
    query: ""
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
    renderChips(uniqueCategories(state.products));
    renderCarousel();
  }

  function matchesFilters(p) {
    var inCategory = state.category === "Todos" || p.category === state.category;
    var q = state.query.trim().toLowerCase();
    var inQuery = !q ||
      (p.name && p.name.toLowerCase().indexOf(q) !== -1) ||
      (p.category && p.category.toLowerCase().indexOf(q) !== -1);
    return inCategory && inQuery;
  }

  function openLightbox(src, alt) {
    var lb = document.getElementById("lightbox");
    var img = document.getElementById("lightbox-img");
    if (!lb || !img) return;
    img.src = src;
    img.alt = alt || "";
    lb.classList.add("open");
  }

  function closeLightbox() {
    var lb = document.getElementById("lightbox");
    if (lb) lb.classList.remove("open");
  }

  function slideEl(p, config) {
    var slide = document.createElement("div");
    slide.className = "carousel-slide";

    var media = document.createElement("div");
    media.className = "slide-media" + (!p.inStock ? " is-out" : "");

    var img = document.createElement("img");
    img.src = p.image || "images/placeholder-generic.svg";
    img.alt = p.name || "Accesorio Chromea";
    img.loading = "lazy";
    media.appendChild(img);

    if (!p.inStock) {
      var badge = document.createElement("span");
      badge.className = "badge badge-out";
      badge.textContent = "Agotado";
      media.appendChild(badge);
    }

    media.addEventListener("click", function () { openLightbox(img.src, p.name); });
    slide.appendChild(media);

    var cta = document.createElement("a");
    cta.target = "_blank";
    cta.rel = "noopener";
    if (p.inStock) {
      cta.className = "slide-cta";
      var msg = p.name
        ? "Hola, vi el " + p.name + " en el catálogo de Chromea y quiero más información."
        : (config.whatsappDefaultMessage || "Hola, vi el catálogo de Chromea y quiero más información.");
      cta.href = buildWhatsAppLink(config, msg);
      cta.textContent = "Pedir por WhatsApp";
    } else {
      cta.className = "slide-cta disabled";
      cta.textContent = "Agotado";
    }
    slide.appendChild(cta);

    return slide;
  }

  function updateCounter(filtered) {
    var counter = document.getElementById("carousel-counter");
    if (!counter) return;
    counter.textContent = filtered.length > 0 ? ("1 / " + filtered.length) : "";
  }

  function renderCarousel() {
    var track = document.getElementById("carousel-track");
    var empty = document.getElementById("empty-state");
    if (!track) return;
    track.innerHTML = "";
    track.scrollLeft = 0;

    var filtered = state.products.filter(matchesFilters);

    if (filtered.length === 0) {
      empty.style.display = "block";
      updateCounter(filtered);
      return;
    }
    empty.style.display = "none";

    filtered.forEach(function (p) {
      track.appendChild(slideEl(p, state.config));
    });

    updateCounter(filtered);
    wireCounterScroll(filtered.length);
  }

  function wireCounterScroll(total) {
    var track = document.getElementById("carousel-track");
    var counter = document.getElementById("carousel-counter");
    if (!track || !counter) return;

    var ticking = false;
    track.onscroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var slide = track.querySelector(".carousel-slide");
        if (slide) {
          var step = slide.offsetWidth + 22; // gap
          var idx = Math.round(track.scrollLeft / step) + 1;
          idx = Math.max(1, Math.min(total, idx));
          counter.textContent = idx + " / " + total;
        }
        ticking = false;
      });
    };
  }

  function wireArrows() {
    var track = document.getElementById("carousel-track");
    var prev = document.getElementById("carousel-prev");
    var next = document.getElementById("carousel-next");
    if (!track || !prev || !next) return;

    function step() {
      var slide = track.querySelector(".carousel-slide");
      return slide ? slide.offsetWidth + 22 : 300;
    }

    prev.addEventListener("click", function () {
      track.scrollBy({ left: -step(), behavior: "smooth" });
    });
    next.addEventListener("click", function () {
      track.scrollBy({ left: step(), behavior: "smooth" });
    });
  }

  function init() {
    var lbClose = document.getElementById("lightbox-close");
    if (lbClose) lbClose.addEventListener("click", closeLightbox);
    var lb = document.getElementById("lightbox");
    if (lb) lb.addEventListener("click", function (e) { if (e.target === lb) closeLightbox(); });

    var search = document.getElementById("search-input");
    if (search) {
      search.addEventListener("input", function (e) {
        state.query = e.target.value;
        renderCarousel();
      });
    }

    wireArrows();

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
      renderCarousel();
    }).catch(function (err) {
      var track = document.getElementById("carousel-track");
      if (track) {
        track.innerHTML = "";
        var msg = document.createElement("div");
        msg.className = "empty-state";
        msg.textContent = "No se pudo cargar el catálogo. Si estás probando el sitio en tu computador, ábrelo con un servidor local (ver README) en lugar de abrir el archivo directamente.";
        track.appendChild(msg);
      }
      console.error("Error cargando catálogo:", err);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
