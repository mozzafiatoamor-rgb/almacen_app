# Almacén Mozzafiato v2.1 — Guía de Setup

## Prerrequisitos
- Node.js 20+
- Cuenta de GitHub con GitHub Pages habilitado
- El Google Sheet existente con las hojas configuradas

---

## 1. Google Sheets — Cambio de contraseña a PIN

La columna C de la hoja **👤 Usuarios** ahora es **PIN** (antes era Password).

| Columna | Campo    | Ejemplo         |
|---------|----------|-----------------|
| A       | ID       | USR0001         |
| B       | Usuario  | juan.garcia     |
| C       | **PIN**  | **1234**        |
| D       | Nombre   | Juan García     |
| E       | Rol      | almacenista     |
| F       | Activo   | SI              |

> Actualiza los PINs de todos tus usuarios en la hoja antes de activar la nueva app.

---

## 2. Apps Script — Actualizar Code.gs

1. Abre tu Google Sheet → Extensiones → Apps Script
2. Reemplaza todo el contenido con el archivo `Code.gs` de este proyecto
3. Guarda (Ctrl+S)
4. **Ejecuta `setupV21` una sola vez** (esto crea la hoja Gastos y agrega columnas J y K al Catálogo):
   - En el editor de Apps Script, selecciona la función `setupV21` en el menú desplegable
   - Haz clic en ▶ Ejecutar
   - Autoriza los permisos cuando se soliciten
5. Publica → Implementar como app web:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
   - Si ya tenías una versión anterior, haz clic en **Nueva implementación** (no editar la existente)
6. Copia la nueva URL de implementación — la necesitarás en el Setup de la app

---

## 3. Google Cloud — API Key para lectura

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea o selecciona un proyecto
3. Habilita **Google Sheets API**
4. Credenciales → Crear credencial → API Key
5. Restringe la clave a "Google Sheets API" y al dominio de tu GitHub Pages
6. Copia la API Key

---

## 4. Configurar el proyecto React

```bash
# Clona / descarga este proyecto
cd mozzafiato-almacen

# Instala dependencias
npm install

# Prueba en local
npm run dev
```

### Variable de entorno para GitHub Pages

Si tu repo se llama `mozzafiato-almacen`, crea en GitHub:
- Settings → Secrets and variables → Actions → Variables
- Nombre: `VITE_BASE_URL`
- Valor: `/mozzafiato-almacen/`

---

## 5. Poner el logo

Copia tu archivo `logo.png` a la carpeta `public/`:
```
public/
  logo.png   ← reemplaza el placeholder
```

---

## 6. Desplegar en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub
2. Settings → Pages → Source: **GitHub Actions**
3. El workflow `.github/workflows/deploy.yml` se ejecutará automáticamente en cada push a `main`
4. En ~2 minutos tendrás la app en `https://tu-usuario.github.io/mozzafiato-almacen/`

---

## 7. Primer uso de la app

Al abrir la app por primera vez, verás el Setup de 3 pasos:

1. **Sheet ID** — La parte de la URL de tu Google Sheet entre `/d/` y `/edit`
   - Ejemplo URL: `https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFM.../edit`
   - Sheet ID: `1BxiMVs0XRA5nFM...`

2. **API Key** — La clave de Google Cloud del paso 3

3. **Apps Script URL** — La URL del Web App del paso 2

Después del setup, selecciona tu usuario y entra tu PIN de 4 dígitos.

---

## 8. Notificaciones de stock bajo (opcional)

En `Code.gs`, busca la sección `CONFIG` al final del archivo:

```javascript
var CONFIG = {
  ADMIN_EMAIL:       'tu@email.com',   // ← cambia esto
  CALLMEBOT_PHONE:   '+521234567890',  // ← tu número de WhatsApp
  CALLMEBOT_APIKEY:  'xxxxxxx',        // ← API key de callmebot.com
  SEND_WHATSAPP:     true,             // ← activa cuando esté listo
  SEND_EMAIL:        true,
};
```

Luego en Apps Script → Triggers → Agregar trigger:
- Función: `checkStockBajo`
- Tipo: Basado en tiempo
- Tipo de tiempo: Temporizador de día
- Hora: 8am–9am

---

## 9. Reconciliación de stock

Si el stock queda desincronizado, desde la app (como admin):
- El botón de **Reconciliar** recalcula el stock de todos los productos sumando todos los movimientos y restando todas las mermas desde cero.

---

## Nuevas funciones v2.1

### 📷 Escáner de códigos de barras
- Disponible en Entradas, Salidas y en el Catálogo (asignar código a un producto)
- Usa la cámara trasera del celular para leer EAN-13 y EAN-8
- El botón 📷 aparece junto al selector de producto
- Para asignar: ve a Catálogo → editar producto → escanear con el botón 📷

### ☰ Navegación Speed Dial
- Un único botón circular (☰) en la parte inferior central
- Al tocarlo, todos los módulos emergen hacia arriba como botones circulares con animación
- Toca fuera o selecciona un módulo para cerrar el menú
- El botón muestra el módulo activo en una etiqueta pequeña arriba

### 💰 Módulo de Gastos
- Al registrar una **Entrada**, opcionalmente ingresa el precio unitario
- Ese precio se convierte en el **precio de referencia** del producto (col K en Catálogo)
- La **Lista de Compras** muestra el presupuesto estimado (`faltante × precioRef`) por producto y el total
- En la **Lista de Compras**, cada producto tiene botón **📥 Comprar** para registrar la entrada desde la tienda sin salir de la lista (incluye precio)
- La hoja **💰 Gastos** registra cada compra con precio: fecha, producto, cantidad, precio/u, total, proveedor
- La **página Gastos** muestra gráficas: gasto diario (14 días), por categoría (pie chart), top productos, y tabla de registros con filtros

### Estructura del Google Sheet (columnas nuevas)
| Hoja | Col J | Col K |
|------|-------|-------|
| 📦 Catálogo | codigoBarras | precioRef |
| 📥 Movimientos | — | precioUnit |

La hoja **💰 Gastos** se crea automáticamente con `setupV21`.

---

## Estructura del proyecto

```
mozzafiato-almacen/
├── src/
│   ├── api/          # Comunicación con Sheets API y Apps Script
│   ├── auth/         # Login con PIN, contexto de autenticación
│   ├── components/
│   │   ├── forms/    # MovimientoForm, MermaForm, ProductoForm (con escáner)
│   │   ├── layout/   # StatusBar, BottomNav (Speed Dial), Modal
│   │   └── shared/   # BarcodeScanner, ProductAutocomplete, Toast…
│   ├── hooks/        # React Query hooks, offline sync, toast
│   ├── pages/        # 10 pantallas: Home, Movimientos, Inventario, Compras,
│   │                 #   Mermas, Catálogo, Bitácora, Reportes, Gastos, Usuarios
│   ├── store/        # Dexie (IndexedDB) para cola offline
│   └── utils/        # Fechas, IDs
├── public/           # logo.png, manifest PWA
├── Code.gs           # Backend Google Apps Script v2.1
└── .github/          # GitHub Actions deploy workflow
```
