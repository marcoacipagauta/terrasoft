# Proyecto: TerraSync - Prototipo MVP (48 Horas)

**Objetivo:** Crear una herramienta de apoyo agrícola que consuma datos de NASA
POWER para sugerir rotaciones de cultivos basadas en el clima histórico y
prioridades locales.

## 1. Stack Tecnológico del Prototipo

- **Framework:** Astro (SSR habilitado para llamadas a API ocultas).
- **Estilos:** Bootstrap 5.3 (vía CDN para rapidez).
- **Mapa:** Leaflet.js (para seleccionar la parcela).
- **Gráficos:** Chart.js o CDN simple.
- **Base de Datos:** Archivo `src/data/cultivos.json` estático.

## 2. Flujo de Usuario (Core de la App)

1. **Paso 1:** El usuario entra, ve un mapa (Leaflet) y hace clic en su
   ubicación (capturamos Lat/Lon).
2. **Paso 2:** Selecciona en un `<select>` su cultivo actual y su prioridad (Ej:
   "Conservar Agua", "Mejorar Suelo", "Rentabilidad").
3. **Paso 3:** Al enviar, Astro hace un `fetch` a la API de NASA POWER
   (Historical Daily - Agroclimatology) para los últimos 12 meses.
4. **Paso 4:** Se muestran 2 gráficos simples: Histórico de Lluvia y Temperatura
   Máxima.
5. **Paso 5:** El algoritmo (lógica simple en JS) cruza los datos climáticos +
   prioridad + catálogo JSON y renderiza 3 tarjetas con estrategias de rotación.

## 3. Catálogo de Datos Simulado (`src/data/cultivos.json`)

El sistema debe basarse en este catálogo estático para tomar decisiones:

```json
[
    {
        "id": "maiz",
        "nombre": "Maíz",
        "tipo": "cereal",
        "agua": "alta",
        "beneficio": "rentabilidad"
    },
    {
        "id": "frijol",
        "nombre": "Frijol (Leguminosa)",
        "tipo": "cobertura",
        "agua": "media",
        "beneficio": "mejora_suelo_nitrogeno"
    },
    {
        "id": "sorgo",
        "nombre": "Sorgo",
        "tipo": "cereal",
        "agua": "baja",
        "beneficio": "resiliencia_sequia"
    }
]
```
