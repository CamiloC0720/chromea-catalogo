/* =========================================================
   Chromea — Catálogo público
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

  function fmtPrice(n, config) {
    if (typeof n !== "number") return "";
    var symbol = (config && config.currencySymbol) || "$";
    return symbol + n.toLocaleString("es-CO");
  }

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

    var all = document.createElement("button");
    all.className = "chip" + (state.category === "Todos" ? " active" : "");
    all.textContent = "Todos";
    all.dataset.category = "Todos";
    all.addEventListener("click", function () { setCategory("Todos"); });
    wrap.appendChild(all);

    categories.forEach(function (cat) {
      var chip = document.createElement("button");
      chip.className = "chip" + (state.category === cat ? " active" : "");
      chip.textContent = cat;
      chip.dataset.category = cat;
      chip.addEventListener("click", function () { setCategory(cat); });
      wrap.appendChild(chip);
    });
  }

  function setCategory(cat) {
    state.category = cat;
    renderChips(uniqueCategories(state.products));
    renderGrid();
  }

  function matchesFilters(p) {
    var inCategory = state.category === "Todos" || p.category === state.category;
    var q = state.query.trim().toLowerCase();
    var inQuery = !q ||
      (p.name && p.name.toLowerCase().indexOf(q) !== -1) ||
      (p.description && p.description.toLowerCase().indexOf(q) !== -1) ||
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

  function productCard(p, config) {
    var card = document.createElement("div");
    card.className = "product-card";

    var media = document.createElement("div");
    media.className = "product-media";

    var img = document.createElement("img");
    var firstImage = (p.images && p.images[0]) || "images/placeholder-generic.svg";
    img.src = firstImage;
    img.alt = p.name || "Producto Chromea";
    img.loading = "lazy";
    media.appendChild(img);

    if (!p.inStock) {
      var badge = document.createElement("span");
      badge.className = "badge badge-out";
      badge.textContent = "Agotado";
      media.appendChild(badge);
    } else if (p.isNew) {
      var nbadge = document.createElement("span");
      nbadge.className = "badge";
      nbadge.textContent = "Nuevo";
      media.appendChild(nbadge);
    }

    media.addEventListener("click", function () { openLightbox(firstImage, p.name); });
    card.appendChild(media);

    var info = document.createElement("div");
    info.className = "product-info";

    var cat = document.createElement("span");
    cat.className = "product-category";
    cat.textContent = p.category || "";
    info.appendChild(cat);

    var name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = p.name || "";
    info.appendChild(name);

    if (config.showPrices && typeof p.price === "number") {
      var price = document.createElement("div");
      price.className = "product-price";
      price.textContent = fmtPrice(p.price, config);
      info.appendChild(price);
    }

    if (p.description) {
      var desc = document.createElement("p");
      desc.className = "product-desc";
      desc.textContent = p.description;
      info.appendChild(desc);
    }

    var order = document.createElement("a");
    order.target = "_blank";
    order.rel = "noopener";
    if (p.inStock) {
      order.className = "product-order";
      var msg = "Hola, vi el " + p.name + " en el catálogo de Chromea y quiero más información.";
      order.href = buildWhatsAppLink(config, msg);
      order.textContent = "Pedir por WhatsApp";
    } else {
      order.className = "product-order disabled";
      order.textContent = "Agotado";
      order.removeAttribute("href");
    }
    info.appendChild(order);

    card.appendChild(info);
    return card;
  }

  function renderGrid() {
    var grid = document.getElementById("product-grid");
    var empty = document.getElementById("empty-state");
    if (!grid) return;
    grid.innerHTML = "";

    var filtered = state.products.filter(matchesFilters);

    if (filtered.length === 0) {
      empty.style.display = "block";
      return;
    }
    empty.style.display = "none";

    filtered.forEach(function (p) {
      grid.appendChild(productCard(p, state.config));
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
        renderGrid();
      });
    }

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
      renderGrid();
    }).catch(function (err) {
      var grid = document.getElementById("product-grid");
      if (grid) {
        grid.innerHTML = "";
        var msg = document.createElement("div");
        msg.className = "empty-state";
        msg.textContent = "No se pudo cargar el catálogo. Si estás probando el sitio en tu computador, ábrelo con un servidor local (ver README) en lugar de abrir el archivo directamente.";
        grid.appendChild(msg);
      }
      console.error("Error cargando catálogo:", err);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
