# Plan de Extracción Local y Visualización de Recursos FAO GAEZ (`Downloads\LR`)

## 1. Objetivo
Aprovechar el paquete oficial **FAO GAEZ v4 — Theme 1: Land and Water Resources (`LR`)** descargado en `C:\Users\anthony\Downloads\LR` (~1 GB mundial) extrayendo únicamente la ventana geográfica de **Colombia (`Lat: -4.5° a 13.5°`, `Lon: -80.0° a -66.5°`)** en un archivo ligero dentro del proyecto (`src/data/fao_lr_colombia.json`) e incorporando **3 nuevas visualizaciones científicas** en el Dashboard de **TerraSoft**.

## 2. Capas GeoTIFF Locales Procesadas desde `C:\Users\anthony\Downloads\LR`
- **`ter\altmed05.tif`**: Altitud mediana (`m s.n.m.`) a 5 arc-min.
- **`ter\slpmed05.tif`**: Clase de pendiente media del terreno (`1–8`).
- **`prt\pa_5min.tif`**: Áreas Naturales Protegidas (`WDPA / FAO`).
- **`soi1\SQ0_mze_v9aL.tif` y `SQ1_mze_v9aL.tif` .. `SQ7_mze_v9aL.tif`**: Los 7 Índices Oficiales de Calidad de Suelo de la FAO (`Nutrientes`, `Retención`, `Enraizamiento`, `Oxígeno/Drenaje`, `Salinidad`, `Toxicidad/Acidez`, `Labranza`).
- **`aez\aez_v9v2red_5m_ENSEMBLE_rcp4p5_2020s.tif` y `2050s.tif`**: Zonificación Agroecológica (`AEZ`) actual (`2020s`) vs. proyectada (`2050s`).
- **`wat\wscar_cls05.tif`**: Clase de escasez hídrica (`Water Scarcity`).

## 3. Visualizaciones Incorporadas en el Dashboard
1. **⛰️ Cinta Topográfica, Ambiental y Proyección Climática 2050 (`panel-fao-gaez`)**: Altitud en `m s.n.m.`, clase de pendiente, estado de Área Protegida y proyección `AEZ 2020s ➔ 2050s`.
2. **🧪 Radiografía Visual de las 7 Propiedades del Suelo (`SQ1–SQ7`)**: Barras comparativas con porcentajes y diagnóstico edáfico real por coordenada.
3. **Integración en Algoritmo de Rotación e Informes PDF / Excel (`.CSV`)**.
