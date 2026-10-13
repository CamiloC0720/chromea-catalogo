/* =========================================================
   Chromea — Panel de administración
   Lee y escribe data/config.json y data/products.json
   directamente en GitHub usando la Contents API del usuario.
   Todo corre en el navegador: no hay servidor ni base de datos.
   ========================================================= */

(function () {
  "use strict";

  var SESSION_KEY = "chromea_admin_session";
  var API = "https://api.github.com";

  var session = null;     // { owner, repo, branch, token }
  var products = [];
  var productsSha = null;
  var configSha = null;
  var pendingImageFiles = []; // Files chosen for the product currently being edited
  var existingImages = [];    // image paths already saved for the product being edited

  /* ---------------- helpers ---------------- */

  function $(id) { return document.getElementById(id); }

  function showToast(msg, isError) {
    var t = $("toast");
    if (!t) return;
    t.textContent = msg;
    t.className = "toast show" + (isError ? " error" : "");
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      t.className = "toast";
    }, 4200);
  }

  function slugify(str) {
    return (str || "")
      .toString()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "producto";
  }

  function uniqueId(base) {
    var id = base, i = 1;
    var existingIds = products.map(function (p) { return p.id; });
    while (existingIds.indexOf(id) !== -1) {
      id = base + "-" + i;
      i++;
    }
    return id;
  }

  // UTF-8 safe base64 encode/decode (product descriptions have tildes, ñ, etc.)
  function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_, p1) {
      return String.fromCharCode("0x" + p1);
    }));
  }
  function b64DecodeUnicode(b64) {
    var binary = atob(b64.replace(/\n/g, ""));
    var percentEncoded = Array.prototype.map.call(binary, function (c) {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join("");
    return decodeURIComponent(percentEncoded);
  }

  function apiHeaders() {
    return {
      "Authorization": "Bearer " + session.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  }

  function apiUrl(path) {
    return API + "/repos/" + session.owner + "/" + session.repo + "/contents/" +
      path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(session.branch);
  }

  function friendlyError(status) {
    if (status === 401) return "Token inválido o expirado.";
    if (status === 403) return "Sin permiso. Revisa que el token tenga acceso de Contents (lectura y escritura) a este repositorio.";
    if (status === 404) return "No se encontró el repositorio, la rama o el archivo. Revisa usuario, repositorio y rama.";
    if (status === 409) return "Alguien más actualizó el archivo al mismo tiempo. Vuelve a intentar.";
    if (status === 422) return "GitHub rechazó la solicitud (422). Revisa el contenido enviado.";
    return "Error de GitHub (código " + status + ").";
  }

  async function getFile(path) {
    var res = await fetch(apiUrl(path), { headers: apiHeaders() });
    if (res.status === 404) return { content: null, sha: null, notFound: true };
    if (!res.ok) throw new Error(friendlyError(res.status));
    var json = await res.json();
    return { content: b64DecodeUnicode(json.content), sha: json.sha, notFound: false };
  }

  async function putTextFile(path, text, sha, message) {
    var body = {
      message: message,
      content: b64EncodeUnicode(text),
      branch: session.branch
    };
    if (sha) body.sha = sha;
    var res = await fetch(apiUrl(path).split("?")[0], {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, apiHeaders()),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var errJson = await res.json().catch(function () { return {}; });
      throw new Error(friendlyError(res.status) + (errJson.message ? " (" + errJson.message + ")" : ""));
    }
    return res.json();
  }

  async function putBase64File(path, base64, message) {
    var body = {
      message: message,
      content: base64,
      branch: session.branch
    };
    var res = await fetch(apiUrl(path).split("?")[0], {
      method: "PUT",
      headers: Object.assign({ "Content-Type": "application/json" }, apiHeaders()),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var errJson = await res.json().catch(function () { return {}; });
      throw new Error(friendlyError(res.status) + (errJson.message ? " (" + errJson.message + ")" : ""));
    }
    return res.json();
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = reader.result; // data:<mime>;base64,xxxx
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function extensionOf(filename) {
    var m = /\.([a-zA-Z0-9]+)$/.exec(filename || "");
    return m ? m[1].toLowerCase() : "jpg";
  }

  /* ---------------- session ---------------- */

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveSession(s) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  async function connect(owner, repo, branch, token) {
    session = { owner: owner, repo: repo, branch: branch || "main", token: token };
    // Validate by requesting the repo itself
    var res = await fetch(API + "/repos/" + owner + "/" + repo, { headers: apiHeaders() });
    if (!res.ok) throw new Error(friendlyError(res.status));
    var repoJson = await res.json();
    if (!branch) session.branch = repoJson.default_branch || "main";
    saveSession(session);
    return session;
  }

  /* ---------------- dashboard bootstrap ---------------- */

  async function loadDashboard() {
    $("login-gate").style.display = "none";
    $("dashboard").style.display = "block";
    $("repo-label").textContent = session.owner + "/" + session.repo + " (" + session.branch + ")";

    await Promise.all([loadSettingsIntoForm(), loadProductsIntoTable()]);
  }

  async function loadSettingsIntoForm() {
    var res = await getFile("data/config.json");
    var config = res.notFound ? {} : JSON.parse(res.content);
    configSha = res.sha;

    $("s-siteName").value = config.siteName || "";
    $("s-whatsapp").value = config.whatsappNumber || "";
    $("s-waMessage").value = config.whatsappDefaultMessage || "";
    $("s-ig").value = config.instagramHandle || "";
    $("s-igUrl").value = config.instagramUrl || "";
    $("s-email").value = config.email || "";
    $("s-heroHeadline").value = config.heroHeadline || "";
    $("s-heroSub").value = config.heroSubheadline || "";
    $("s-footerNote").value = config.footerNote || "";
    $("s-showPrices").checked = config.showPrices !== false;

    window._fullConfig = config;
  }

  async function saveSettings() {
    var btn = $("btn-save-settings");
    btn.disabled = true;
    try {
      var config = Object.assign({}, window._fullConfig, {
        siteName: $("s-siteName").value.trim(),
        whatsappNumber: $("s-whatsapp").value.replace(/\D/g, ""),
        whatsappDefaultMessage: $("s-waMessage").value.trim(),
        instagramHandle: $("s-ig").value.trim(),
        instagramUrl: $("s-igUrl").value.trim(),
        email: $("s-email").value.trim(),
        heroHeadline: $("s-heroHeadline").value.trim(),
        heroSubheadline: $("s-heroSub").value.trim(),
        footerNote: $("s-footerNote").value.trim(),
        showPrices: $("s-showPrices").checked
      });
      var result = await putTextFile("data/config.json", JSON.stringify(config, null, 2), configSha, "Admin: actualizar datos del sitio");
      configSha = result.content.sha;
      window._fullConfig = config;
      showToast("Datos del sitio guardados. El catálogo se actualizará en ~1 minuto.");
    } catch (e) {
      showToast(e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function loadProductsIntoTable() {
    var res = await getFile("data/products.json");
    products = res.notFound ? [] : JSON.parse(res.content);
    productsSha = res.sha;
    renderTable();
  }

  function renderTable() {
    var tbody = $("product-tbody");
    tbody.innerHTML = "";
    if (products.length === 0) {
      var tr = document.createElement("tr");
      tr.innerHTML = '<td colspan="6" style="text-align:center; color:var(--c-slate); padding:24px;">Aún no hay productos. Crea el primero con "+ Nuevo producto".</td>';
      tbody.appendChild(tr);
      return;
    }
    products.forEach(function (p) {
      var tr = document.createElement("tr");

      var tdImg = document.createElement("td");
      var img = document.createElement("img");
      img.className = "thumb";
      img.src = (p.images && p.images[0]) || "images/placeholder-generic.svg";
      tdImg.appendChild(img);

      var tdName = document.createElement("td");
      tdName.textContent = p.name || "";

      var tdCat = document.createElement("td");
      tdCat.textContent = p.category || "";

      var tdPrice = document.createElement("td");
      tdPrice.textContent = typeof p.price === "number" ? "$" + p.price.toLocaleString("es-CO") : "—";

      var tdStatus = document.createElement("td");
      var pill = document.createElement("span");
      pill.className = "status-pill " + (p.inStock ? "in" : "out");
      pill.textContent = p.inStock ? "Disponible" : "Agotado";
      tdStatus.appendChild(pill);

      var tdActions = document.createElement("td");
      var actionsWrap = document.createElement("div");
      actionsWrap.className = "row-actions";

      var editBtn = document.createElement("button");
      editBtn.className = "icon-btn";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", function () { openProductForm(p); });

      var delBtn = document.createElement("button");
      delBtn.className = "icon-btn";
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", function () { deleteProduct(p); });

      actionsWrap.appendChild(editBtn);
      actionsWrap.appendChild(delBtn);
      tdActions.appendChild(actionsWrap);

      tr.appendChild(tdImg);
      tr.appendChild(tdName);
      tr.appendChild(tdCat);
      tr.appendChild(tdPrice);
      tr.appendChild(tdStatus);
      tr.appendChild(tdActions);
      tbody.appendChild(tr);
    });
  }

  /* ---------------- product form ---------------- */

  function openProductForm(p) {
    pendingImageFiles = [];
    existingImages = (p && p.images) ? p.images.slice() : [];

    $("product-form-title").textContent = p ? "Editar producto" : "Nuevo producto";
    $("p-id").value = p ? p.id : "";
    $("p-name").value = p ? p.name || "" : "";
    $("p-category").value = p ? p.category || "" : "";
    $("p-price").value = p && typeof p.price === "number" ? p.price : "";
    $("p-sku").value = p ? p.sku || "" : "";
    $("p-description").value = p ? p.description || "" : "";
    $("p-colors").value = p && p.colors ? p.colors.join(", ") : "";
    $("p-inStock").checked = p ? !!p.inStock : true;
    $("p-isNew").checked = p ? !!p.isNew : false;
    $("p-images").value = "";

    renderImagePreviews();

    $("product-form-card").style.display = "block";
    $("product-form-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeProductForm() {
    $("product-form-card").style.display = "none";
  }

  function renderImagePreviews() {
    var wrap = $("p-image-previews");
    wrap.innerHTML = "";

    existingImages.forEach(function (path, idx) {
      var div = document.createElement("div");
      div.className = "image-preview";
      var img = document.createElement("img");
      img.src = path;
      var btn = document.createElement("button");
      btn.textContent = "×";
      btn.title = "Quitar imagen";
      btn.addEventListener("click", function () {
        existingImages.splice(idx, 1);
        renderImagePreviews();
      });
      div.appendChild(img);
      div.appendChild(btn);
      wrap.appendChild(div);
    });

    pendingImageFiles.forEach(function (file, idx) {
      var div = document.createElement("div");
      div.className = "image-preview";
      var img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      var btn = document.createElement("button");
      btn.textContent = "×";
      btn.title = "Quitar imagen";
      btn.addEventListener("click", function () {
        pendingImageFiles.splice(idx, 1);
        renderImagePreviews();
      });
      div.appendChild(img);
      div.appendChild(btn);
      wrap.appendChild(div);
    });
  }

  async function saveProduct() {
    var btn = $("btn-save-product");
    var name = $("p-name").value.trim();
    if (!name) { showToast("El producto necesita un nombre.", true); return; }

    btn.disabled = true;
    try {
      // Re-fetch latest products.json right before writing to reduce conflicts
      var latest = await getFile("data/products.json");
      products = latest.notFound ? [] : JSON.parse(latest.content);
      productsSha = latest.sha;

      var id = $("p-id").value || uniqueId(slugify(name));
      var isEditing = !!$("p-id").value;

      // Upload any newly selected images
      var uploadedPaths = [];
      for (var i = 0; i < pendingImageFiles.length; i++) {
        var file = pendingImageFiles[i];
        var base64 = await fileToBase64(file);
        var path = "images/" + id + "-" + Date.now() + "-" + i + "." + extensionOf(file.name);
        await putBase64File(path, base64, "Admin: imagen para " + name);
        uploadedPaths.push(path);
      }

      var images = existingImages.concat(uploadedPaths);
      if (images.length === 0) images = ["images/placeholder-generic.svg"];

      var priceVal = $("p-price").value;
      var productObj = {
        id: id,
        name: name,
        category: $("p-category").value.trim() || "General",
        price: priceVal === "" ? null : Number(priceVal),
        sku: $("p-sku").value.trim(),
        description: $("p-description").value.trim(),
        colors: $("p-colors").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
        images: images,
        inStock: $("p-inStock").checked,
        isNew: $("p-isNew").checked,
        createdAt: isEditing ? (products.find(function (p) { return p.id === id; }) || {}).createdAt || todayISO() : todayISO()
      };

      var idx = products.findIndex(function (p) { return p.id === id; });
      if (idx === -1) {
        products.push(productObj);
      } else {
        products[idx] = productObj;
      }

      var result = await putTextFile(
        "data/products.json",
        JSON.stringify(products, null, 2),
        productsSha,
        (isEditing ? "Admin: actualizar " : "Admin: agregar ") + name
      );
      productsSha = result.content.sha;

      showToast("Producto guardado. El catálogo se actualizará en ~1 minuto.");
      closeProductForm();
      renderTable();
    } catch (e) {
      showToast(e.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function deleteProduct(p) {
    if (!confirm('¿Eliminar "' + p.name + '" del catálogo? Esta acción no se puede deshacer desde el panel.')) return;
    try {
      var latest = await getFile("data/products.json");
      products = latest.notFound ? [] : JSON.parse(latest.content);
      productsSha = latest.sha;

      products = products.filter(function (item) { return item.id !== p.id; });

      var result = await putTextFile(
        "data/products.json",
        JSON.stringify(products, null, 2),
        productsSha,
        "Admin: eliminar " + p.name
      );
      productsSha = result.content.sha;
      showToast("Producto eliminado.");
      renderTable();
    } catch (e) {
      showToast(e.message, true);
    }
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ---------------- wiring ---------------- */

  function wireEvents() {
    $("btn-connect").addEventListener("click", async function () {
      var owner = $("f-owner").value.trim();
      var repo = $("f-repo").value.trim();
      var branch = $("f-branch").value.trim();
      var token = $("f-token").value.trim();

      if (!owner || !repo || !token) {
        $("connect-status").textContent = "Completa usuario, repositorio y token.";
        return;
      }

      $("btn-connect").disabled = true;
      $("connect-status").textContent = "Conectando...";
      try {
        await connect(owner, repo, branch, token);
        $("connect-status").textContent = "";
        await loadDashboard();
      } catch (e) {
        $("connect-status").textContent = e.message;
      } finally {
        $("btn-connect").disabled = false;
      }
    });

    $("btn-disconnect").addEventListener("click", function () {
      clearSession();
      session = null;
      $("dashboard").style.display = "none";
      $("login-gate").style.display = "block";
      $("f-token").value = "";
    });

    $("btn-save-settings").addEventListener("click", saveSettings);
    $("btn-new-product").addEventListener("click", function () { openProductForm(null); });
    $("btn-cancel-product").addEventListener("click", closeProductForm);
    $("btn-save-product").addEventListener("click", saveProduct);

    $("p-images").addEventListener("change", function (e) {
      pendingImageFiles = pendingImageFiles.concat(Array.prototype.slice.call(e.target.files));
      renderImagePreviews();
    });
  }

  async function init() {
    wireEvents();
    var saved = loadSession();
    if (saved && saved.owner && saved.repo && saved.token) {
      session = saved;
      $("f-owner").value = saved.owner;
      $("f-repo").value = saved.repo;
      $("f-branch").value = saved.branch || "main";
      try {
        await loadDashboard();
      } catch (e) {
        showToast("No se pudo reconectar automáticamente: " + e.message, true);
        $("login-gate").style.display = "block";
        $("dashboard").style.display = "none";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
