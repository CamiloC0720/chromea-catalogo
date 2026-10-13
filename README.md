# Catálogo Chromea

Catálogo web gratuito para Chromea, hosteado en GitHub Pages ($0 de costo) con un
panel de administración para agregar, editar y eliminar productos sin tocar código.

No hay servidor ni base de datos: el catálogo es un sitio estático (HTML/CSS/JS) que
lee dos archivos (`data/config.json` y `data/products.json`), y el panel de admin
escribe en esos mismos archivos directamente en tu repositorio de GitHub usando la
API de GitHub desde el navegador.

---

## 1. Crear el repositorio

1. Entra a [github.com](https://github.com) y crea una cuenta gratuita si no tienes una.
2. Click en **New repository**.
   - Nombre sugerido: `chromea-catalogo`
   - Visibilidad: **Public** (necesario para que GitHub Pages sea gratis en cuentas gratuitas).
   - No marques "Add a README" (ya tienes uno).
3. Sube todos los archivos de esta carpeta al repositorio. La forma más fácil sin usar
   la terminal:
   - En la página del repo, click **Add file → Upload files**.
   - Arrastra **todo el contenido** de esta carpeta (no la carpeta en sí, sino lo que
     hay adentro: `index.html`, `admin.html`, `css/`, `js/`, `data/`, `images/`, `assets/`).
   - Click **Commit changes**.

   Si prefieres usar git desde la terminal:
   ```bash
   cd chromea-catalogo
   git init
   git add .
   git commit -m "Catálogo inicial Chromea"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/chromea-catalogo.git
   git push -u origin main
   ```

## 2. Activar GitHub Pages

1. En el repositorio, ve a **Settings → Pages**.
2. En **Source**, elige **Deploy from a branch**.
3. En **Branch**, elige `main` y la carpeta `/ (root)`. Guarda.
4. Espera 1-2 minutos. Tu catálogo quedará publicado en:
   ```
   https://TU-USUARIO.github.io/chromea-catalogo/
   ```
   (GitHub te muestra esta URL en la misma página de Settings → Pages cuando ya está lista).

## 3. Crear el token de administrador

El panel de admin necesita un **token de acceso personal "fine-grained"** limitado
**solo a este repositorio**, para poder guardar los cambios que hagas (agregar
producto, subir foto, etc). Es gratis y lo creas una sola vez.

1. Ve a [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. **Token name**: `chromea-admin` (o el nombre que quieras).
3. **Expiration**: elige lo que prefieras (recomendado 90 días; cuando expire, generas
   uno nuevo y lo vuelves a pegar en el panel — toma 1 minuto).
4. **Repository access**: elige **Only select repositories** y selecciona
   `chromea-catalogo`.
5. **Permissions → Repository permissions → Contents**: cambia a **Read and write**.
   Deja todo lo demás sin acceso.
6. Click **Generate token** y **copia el token** (empieza con `github_pat_...`).
   GitHub solo lo muestra una vez — si lo pierdes, generas otro.

> ⚠️ Este token solo puede leer y escribir archivos de este repositorio puntual,
> nada más de tu cuenta de GitHub. Aun así, trátalo como una contraseña: no lo
> compartas ni lo subas a ningún archivo del repositorio. El panel lo guarda
> únicamente en el navegador donde lo ingreses (localStorage), nunca se envía a
> otro lugar que no sea GitHub.

## 4. Usar el panel de administración

1. Abre:
   ```
   https://TU-USUARIO.github.io/chromea-catalogo/admin.html
   ```
2. Completa:
   - **Usuario u organización de GitHub**: tu usuario, ej. `TU-USUARIO`
   - **Repositorio**: `chromea-catalogo`
   - **Rama**: `main`
   - **Token**: el que copiaste en el paso 3
3. Click **Conectar**.
4. En **Datos del sitio** actualiza el número de WhatsApp real (solo números, con
   indicativo de país, ej. `573001234567`), tu usuario de Instagram y los textos del
   encabezado. Click **Guardar datos del sitio**.
5. En **Productos**, click **+ Nuevo producto** para agregar los productos reales
   de Chromea con sus fotos, o **Editar/Eliminar** sobre los productos de ejemplo
   que ya vienen cargados (Glacial Indifference, Lora, Britanny, Mini Pouch) para
   reemplazarlos por tu catálogo real.

Cada cambio queda guardado como un commit en tu repositorio y el catálogo público
se actualiza automáticamente en aproximadamente 1 minuto (GitHub Pages necesita
ese tiempo para reconstruir el sitio).

No necesitas volver a instalar nada ni pagar hosting: todo el flujo —sitio público
y panel de administración— vive dentro del mismo repositorio gratuito de GitHub.

## 5. Vincular el link de WhatsApp e Instagram

- El botón de WhatsApp de todo el sitio (barra superior, hero, flotante, pie de
  página) usa el número configurado en **Datos del sitio**.
- Cada producto genera automáticamente su propio mensaje de WhatsApp mencionando
  el nombre del producto, usando ese mismo número.
- En tu bio de Instagram, pon el link del catálogo:
  ```
  https://TU-USUARIO.github.io/chromea-catalogo/
  ```

## 6. Probar el sitio en tu computador antes de subirlo (opcional)

Este sitio carga los datos con `fetch()`, lo cual no funciona si simplemente haces
doble clic en `index.html` (los navegadores bloquean esas solicitudes en archivos
locales). Para probarlo localmente:

```bash
cd chromea-catalogo
python3 -m http.server 8000
```

Luego abre `http://localhost:8000` en tu navegador. (El panel de admin funciona
igual en local, apuntando al repositorio real en GitHub.)

## 7. Personalizar el diseño

Todos los colores, tipografías y espaciados están centralizados al inicio de
`css/styles.css`, en la sección `:root`:

```css
--c-charcoal: #2A2A2E;  /* carbón */
--c-blush:    #F0D7DC;  /* rosa palo */
--c-wine:     #5C1A2B;  /* vino */
--c-slate:    #525C68;  /* pizarra */
```

Cambia estos valores y se actualiza todo el sitio (catálogo + admin) de forma
consistente.

## Estructura de archivos

```
index.html          → Catálogo público
admin.html           → Panel de administración
css/styles.css       → Estilos de marca (colores, tipografías)
js/catalog.js         → Lógica del catálogo público (filtros, búsqueda, WhatsApp)
js/admin.js           → Lógica del panel (login con GitHub, guardar productos/imágenes)
data/config.json      → Datos del sitio (WhatsApp, Instagram, textos)
data/products.json    → Catálogo de productos
images/                → Fotos de productos (las que subas desde el admin caen aquí)
assets/favicon.svg    → Ícono del sitio (monograma CR)
```

## Preguntas frecuentes

**¿Esto tiene algún costo?**
No. GitHub Pages es gratis para repositorios públicos, y el panel de administración
usa la API gratuita de GitHub (no hay base de datos ni servidor que pagar).

**¿Qué pasa si pierdo el token?**
No pasa nada grave: genera uno nuevo siguiendo el paso 3 y pégalo de nuevo en el
panel. El token anterior puedes revocarlo desde
[github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).

**¿Alguien más puede editar mi catálogo?**
Solo quien tenga un token válido con permiso de escritura sobre tu repositorio.
El link `admin.html` puede ser público (está en el mismo sitio), pero sin el token
nadie puede guardar cambios.

**¿Puedo usar un dominio propio en vez de `github.io`?**
Sí, GitHub Pages permite conectar un dominio propio gratis (solo pagarías el
dominio en sí, si decides comprarlo). Se configura en Settings → Pages → Custom domain.
