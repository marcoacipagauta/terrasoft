# 🛰️🌱 TerraSoft — Plataforma Aero-Agrícola de Rotación de Cultivos y Monitoreo Satelital

**TerraSoft** es un Sistema de Soporte a la Decisión Agronómica (*Agricultural Decision Support System - DSS*) que integra observación satelital agroclimática de la **NASA (POWER API)**, zonificación agroecológica y edáfica mundial de la **FAO (GAEZ v4 Land Resources)**, cartografía vectorial de **OpenStreetMap** y análisis óptico de superficie en tiempo real para recomendar rotaciones inteligentes de cultivos, calendarios de siembra de 12 meses y presupuestos detallados en **Pesos Colombianos (`$ COP`)**.

---

## 🛠️ Tecnologías Utilizadas (Tech Stack)

### 1. Core & Framework Full-Stack
| Tecnología | Versión / Estándar | Rol en el Proyecto |
| :--- | :--- | :--- |
| **Astro** | `^7.4.11` (SSR / Híbrido) | Framework principal de componentes y enrutamiento de páginas y endpoints API (`/api/clima`). |
| **@astrojs/node** | `^11.1.13` (`standalone`) | Adaptador de servidor Node.js autónomo para ejecución de endpoints SSR en tiempo real. |
| **TypeScript & ES Modules** | ES2022+ (`type: "module"`) | Tipado estático de servicios satelitales (`nasaPower.ts`), matrices edáficas y diccionarios de internacionalización (`translations.ts`). |
| **Node.js** | `>= 18.20` / `20+ LTS` | Entorno de ejecución del servidor backend y consumo asíncrono de APIs científicas. |

### 2. Frontend, Cartografía y Visualización Científica
| Tecnología | Rol en el Proyecto |
| :--- | :--- |
| **Leaflet.js (`1.9.4`)** | Motor de mapas interactivos multicapa (Mosaico Satelital Óptico *Esri World Imagery*, Mapa Topográfico *OpenStreetMap* y capa *WMS/ImageServer* de **FAO GAEZ v4**). |
| **HTML5 Canvas API** | Escáner óptico en el cliente que analiza la reflectancia RGB en un radio de 4 metros bajo el marcador para distinguir entre vegetación, tierra arada, asfalto/techos, agua, roca o nieve. |
| **Chart.js (`4.4.3`)** | Renderizado dinámico de series climáticas mensuales (precipitación acumulada en $\text{mm}$ y temperatura máxima promedio en $^\circ\text{C}$). |
| **Bootstrap `5.3.3` + CSS Aero-Agrícola** | Sistema de grilla responsiva, *Mini-Dock* móvil adaptado a dispositivos táctiles y tema visual espacial-agrícola. |
| **Motor i18n Reactivo (`ES` / `EN`)** | Sistema propio de internacionalización instantánea sin recarga de página (`src/i18n/translations.ts`) con persistencia en `localStorage`. |

### 3. Procesamiento de Datos Geoespaciales (ETL Ráster)
| Herramienta | Rol en el Proyecto |
| :--- | :--- |
| **Python 3 + `tifffile` + `NumPy`** | Pipeline de extracción y compresión de **15 rasters GeoTIFF oficiales de FAO GAEZ v4 (`LR`)** recortados para el territorio colombiano (malla de $162 \times 216$ celdas a resolución de $5\text{ minutos de arco} \approx 9\text{ km}$) hacia la matriz de consulta ultrarrápida `src/data/fao_lr_colombia.json`. |

---

## 🏗️ Infraestructura y Arquitectura del Sistema

TerraSoft opera bajo una **arquitectura híbrida de baja latencia** que combina procesamiento en el servidor Node.js (SSR), una base de datos matricial embebida en memoria y validación óptica en el navegador del cliente:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CLIENTE WEB (Navegador Desktop / Móvil)               │
│  • Mapa Leaflet Multicapa + Escáner Óptico RGB en HTML5 Canvas               │
│  • Motor Multicriterio de Rotación (24 Cultivos · 6 Macroregiones Colombia)  │
│  • Simulador Financiero ($ COP: m², Fanegadas, Hectáreas) + Exportador PDF   │
│  • Asistente Interactivo "Don Terra" + Conmutador Bilingüe Instantáneo ES/EN │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │ Petición HTTP GET /api/clima?lat={LAT}&lon={LON}
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  SERVIDOR BACKEND ASTRO SSR (@astrojs/node)                  │
│                        Endpoint: src/pages/api/clima.ts                      │
│                       Servicio: src/services/nasaPower.ts                    │
└───────┬──────────────────────────────┬───────────────────────────────┬───────┘
        │                              │                               │
        ▼                              ▼                               ▼
┌──────────────────────┐   ┌───────────────────────────┐   ┌────────────────────────┐
│ 1. NASA POWER API    │   │ 2. MATRIZ LOCAL FAO GAEZ  │   │ 3. OPENSTREETMAP APIs  │
│ (Agroclimatology AG) │   │ (fao_lr_colombia.json)    │   │ (Nominatim + Overpass) │
│ • T2M_MAX (°C)       │   │ • 15 Capas GeoTIFF (LR):  │   │ • Geocodificación      │
│ • PRECTOTCORR (mm)   │   │   - Altitud (m s.n.m.)    │   │   inversa del municipio│
│ • Series diarias y   │   │   - Pendiente media (%)   │   │ • Detección vectorial  │
│   agregación mensual │   │   - Áreas protegidas      │   │   de carreteras, vías, │
│                      │   │   - LGP (días humedad/año)│   │   ríos y edificios     │
│                      │   │   - Proyección 2050 RCP4.5│   │   a radio de 25 metros │
│                      │   │   - 7 Propiedades Suelo   │   │                        │
│                      │   │     (SQ1 a SQ7)           │   │                        │
└──────────────────────┘   └───────────────────────────┘   └────────────────────────┘
```

### Componentes Clave de la Infraestructura:
1. **Servidor Autónomo (`@astrojs/node` en modo `standalone`):**
   - No requiere bases de datos relacionales externas ni contenedores pesados para funcionar.
   - El servidor compila en `./dist/server/entry.mjs` y sirve tanto los activos estáticos como el endpoint `/api/clima`.
2. **Base de Datos Geoespacial Matricial en Memoria (`src/data/fao_lr_colombia.json`):**
   - Contiene la extracción local de 15 capas GeoTIFF de **FAO GAEZ v4 Land Resources** para Colombia ($13^\circ\text{N}$ a $-5^\circ\text{S}$, $-80^\circ\text{W}$ a $-66^\circ\text{W}$), respondiendo consultas edafológicas y topográficas en **menos de $5\text{ ms}$** sin depender de la disponibilidad externa de los servidores de la FAO.
3. **Resiliencia y Tolerancia a Fallos:**
   - Si alguna API externa presenta demoras o el usuario realiza múltiples clics rápidos en el mapa, el sistema cancela peticiones previas mediante `AbortController` y cuenta con respaldos deterministas para garantizar continuidad operativa durante demostraciones en vivo o trabajo en campo.

---

## 📂 Estructura del Proyecto

```text
TerraSync/
├── public/
│   ├── images/                         # Recursos visuales del Hero y tarjetas informativas
│   └── presentacion_terrasoft.html     # Presentación interactiva (5 diapositivas para sustentación)
├── src/
│   ├── components/
│   │   ├── HeroSpace.astro             # Portada principal e introducción en 3 tarjetas
│   │   ├── MapSelector.astro           # Mapa satelital Leaflet, buscador y escáner óptico
│   │   ├── RotationCards.astro         # Contenedor de recomendaciones Top 3 y leyenda
│   │   └── AssistantTour.astro         # Asistente pedagógico "Don Terra" (Desktop & Mini-Dock Móvil)
│   ├── data/
│   │   ├── cultivos.json               # Catálogo de 24 cultivos de Colombia, familias, clima y costos COP
│   │   └── fao_lr_colombia.json        # Matriz local extraída de 15 rasters GeoTIFF de FAO GAEZ v4
│   ├── i18n/
│   │   └── translations.ts             # Diccionario bilingüe completo Español (ES) / Inglés (EN)
│   ├── layouts/
│   │   └── Layout.astro                # Layout maestro, barra de navegación, estilos globales y motor i18n
│   ├── pages/
│   │   ├── index.astro                 # Dashboard unificado, motor de rotación, gráficos y exportador PDF/CSV
│   │   └── api/
│   │       └── clima.ts                # Endpoint SSR de consulta agroclimática y edáfica
│   └── services/
│       └── nasaPower.ts                # Integración con NASA POWER, FAO GAEZ v4 y OpenStreetMap
├── astro.config.mjs                    # Configuración de Astro con adaptador @astrojs/node (standalone)
├── package.json                        # Dependencias y scripts de ejecución
└── presentacion_sustentacion_terrasoft.md # Guion y preguntas frecuentes para sustentación académica
```

---

## 🚀 Requisitos e Instalación Paso a Paso

### 1. Requisitos Previos
* **Node.js:** Versión `18.20.0` o superior (se recomienda **Node.js `20 LTS`** o `22 LTS`).
* **npm:** Incluido con Node.js (versión `9+`).
* **Conexión a Internet:** Requerida para descargar los mosaicos satelitales de *Esri/OpenStreetMap* y consultar en vivo la API de **NASA POWER**.

### 2. Clonar o Descargar el Proyecto
Abre una terminal (PowerShell, CMD o Bash) y sitúate en la carpeta raíz del proyecto:

```bash
cd TerraSync
```

### 3. Instalar las Dependencias
Ejecuta el siguiente comando para instalar Astro y el adaptador de servidor Node.js:

```bash
npm install
```

### 4. Ejecutar en Modo Desarrollo (Local)
Para iniciar el servidor de desarrollo con recarga en caliente (*Hot Reload*):

```bash
npm run dev
```

Una vez iniciado, abre tu navegador en:
* **Aplicación Principal (TerraSoft):** `http://localhost:4321/`
* **Presentación de Sustentación (5 Diapositivas):** `http://localhost:4321/presentacion_terrasoft.html`

---

## 📦 Compilación y Despliegue en Producción

TerraSoft está configurado con `@astrojs/node` en modo `standalone`, por lo que puede desplegarse fácilmente en cualquier servidor Linux/Windows, VPS (DigitalOcean, AWS EC2, Google Cloud), Railway, Render o Docker:

### 1. Generar el Build de Producción
```bash
npm run build
```
Esto generará la carpeta `./dist` con los activos estáticos optimizados (`./dist/client`) y el servidor autónomo (`./dist/server/entry.mjs`).

### 2. Iniciar el Servidor de Producción
```bash
node ./dist/server/entry.mjs
```
*(Opcionalmente puedes definir las variables de entorno `HOST=0.0.0.0` y `PORT=4321` antes de ejecutarlo).*

---

## 🛰️ Fuentes de Datos Científicos Acreditadas
* **NASA POWER Project:** *Prediction Of Worldwide Energy Resources (Agroclimatology Community `AG`)* — Langley Research Center.
* **FAO & IIASA:** *Global Agro-Ecological Zones version 4 (GAEZ v4) — Land and Water Resources, Soil Suitability (`SQ1–SQ7`), Terrain & Agro-climatic Indicators*.
* **OpenStreetMap & Overpass API:** Cartografía colaborativa y validación vectorial de infraestructura y cuerpos de agua.
* **Esri World Imagery:** Ortofotos satelitales de alta resolución para el análisis de reflectancia superficial.
