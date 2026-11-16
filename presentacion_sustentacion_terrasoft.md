# 🎓 TerraSoft: Sustentación en 5 Diapositivas para Jurados Académicos

Esta presentación está diseñada específicamente para **evaluadores y jurados universitarios/académicos**: equilibra el **impacto social y agronómico** con el **rigor metodológico, la arquitectura de ingeniería de datos y el modelo matemático-multicriterio** del proyecto.

---

## Diapositiva 1: Planteamiento del Problema y Brecha Tecnológica
### 🌍 ¿Por qué los datos satelitales de la NASA y la FAO aún no llegan a quien decide qué sembrar?

* **El problema agronómico y ambiental:** El monocultivo reiterado agota el nitrógeno disponible, degrada la estructura edáfica y perpetúa ciclos de plagas fitosanitarias, elevando hasta en un **35%–40%** la dependencia de fertilizantes sintéticos.
* **La brecha de información:** Existen repositorios satelitales abiertos de escala mundial (**NASA POWER** y **FAO GAEZ v4**), pero están en formatos complejos (*GeoTIFF*, *NetCDF*, APIs científicas en inglés) inaccesibles para el productor rural.
* **Pregunta de Investigación / Proyecto:** *¿Cómo transformar datos agroclimáticos y edafológicos satelitales en un sistema de soporte a la decisión (DSS) intuitivo, financiero y en tiempo real?*

> 🎙️ **Guion para el jurado (45 seg):**
> *"Estimados jurados: hoy la NASA y la FAO poseen radiografías completas del clima y del suelo de cada rincón de Colombia, pero esa ciencia se queda en archivos GeoTIFF que ningún agricultor puede abrir en el campo. Mientras tanto, el productor sigue sembrando por tradición, repitiendo monocultivos que agotan el suelo y arriesgando su patrimonio. **TerraSoft** nace para cerrar esa brecha: traduce ciencia espacial en decisiones agronómicas y financieras en menos de tres segundos."*

---

## Diapositiva 2: Arquitectura de Ingeniería y Fusión Geoespacial
### 🛰️ Triangulación Científica en Tiempo Real: Clima + Edafología + Visión Óptica

1. **Climatología Satelital (NASA POWER):** Series diarias y mensuales de temperatura máxima (`T2M_MAX`) y precipitación corregida (`PRECTOTCORR`) de la comunidad agroclimática (`AG`).
2. **Extracción Ráster Local (FAO GAEZ v4):** Procesamiento de **15 capas GeoTIFF** para Colombia (malla `162 × 216` a `5 arc-min ≈ 9 km`): altitud (`m s.n.m.`), pendiente, áreas protegidas, periodo de crecimiento (**LGP**), proyección **RCP 4.5 a 2050** y las **7 Calidades del Suelo (`SQ1–SQ7`)**.
3. **Verificación Micro-Espacial (OSM + Reflectancia Óptica):** Filtra cuerpos de agua, pavimentos, edificaciones, roca estéril o nieve para evitar falsos positivos en zonas no cultivables.

> 🎙️ **Guion para el jurado (50 seg):**
> *"Desde la ingeniería de software, el reto fue combinar escalas distintas. Cuando el usuario selecciona una coordenada, nuestro backend consulta la API de NASA POWER y cruza una matriz local extraída de 15 capas GeoTIFF oficiales de FAO GAEZ v4 para Colombia. Pero como un píxel de la FAO mide 9 kilómetros, agregamos una tercera capa: telemetría de OpenStreetMap y análisis espectral sobre el mosaico satelital en HTML5 Canvas. Si el puntero cae sobre una carretera, un techo o un glaciar, las 7 barras de aptitud del suelo caen automáticamente a Clase N (0%), garantizando coherencia física y espacial."*

---

## Diapositiva 3: Modelo Multicriterio de Rotación y Viabilidad
### 🧮 Algoritmo de Puntuación Agronómica y Balance de Nitrógeno

$$\text{Puntaje}_{\text{cultivo}} = S_{\text{base}} + \Delta_{\text{familia}} + \Delta_{\text{prioridad}} + \Delta_{\text{clima (NASA)}} + \Delta_{\text{LGP (FAO)}} + \Delta_{\text{calendario}} + \Delta_{\text{vocación}}$$

| Criterio Evaluado | Regla Agronómica Implementada en el Motor |
| :--- | :--- |
| **Alternancia Fitosanitaria ($\Delta_{\text{familia}}$)** | Penaliza el monocultivo (`-35 pts`) y familias con plagas cruzadas; premia el corte de ciclo biológico (`+14 pts`). |
| **Simbiosis con Leguminosas ($\Delta_{\text{prioridad}}$)** | Prioriza *Fabaceae* (frijol, arveja, soya, haba) que fijan nitrógeno atmosférico y descuentan entre **15% y 20%** el costo de fertilización del ciclo siguiente. |
| **Ajuste Edafoclimático ($\Delta_{\text{NASA}} + \Delta_{\text{FAO}}$)** | Contrasta el rango térmico/hídrico óptimo de **24 cultivos colombianos** contra NASA POWER y verifica que el ciclo (días) quepa dentro del **LGP** de la FAO. |

> 🎙️ **Guion para el jurado (45 seg):**
> *"El corazón de TerraSoft no es una lista estática, sino un algoritmo heurístico multicriterio sobre 24 cultivos de las 6 macroregiones de Colombia. El modelo penaliza severamente el monocultivo, premia la ruptura de ciclos de plagas entre familias botánicas, comprueba que los días de humedad del suelo (LGP de la FAO) cubran el ciclo vegetativo del cultivo y cuantifica en pesos colombianos el ahorro en fertilizantes nitrogenados cuando se rota tras una leguminosa."*

---

## Diapositiva 4: Apropiación Social, Inclusión Digital y Bilingüismo
### 👨‍🌾 Diseñado para que la Ciencia Sea Usable desde el Potrero hasta la Academia

1. **Economía Real por Unidad Agrícola Local:** Convierte instantáneamente presupuestos entre **m², Fanegadas (6.400 m²) y Hectáreas (10.000 m²)**, ajustando el rendimiento esperado según la clase de suelo FAO (`S1` a `S4`).
2. **Asistente Pedagógico "Don Terra":** Un guía interactivo contextual que acompaña paso a paso al usuario y se compacta en un *Mini-Dock* en dispositivos móviles.
3. **Internacionalización Reactiva (`🇨🇴 ES | 🇺🇸 EN`):** Cambio instantáneo de idioma sin recargar el estado ni perder las coordenadas analizadas.
4. **Trazabilidad Documental:** Generación automática de informes técnicos en **PDF** y **CSV (Excel)** listos para sustentar créditos agropecuarios o planes de siembra.

> 🎙️ **Guion para el jurado (40 seg):**
> *"Un sistema de soporte a la decisión fracasa si el usuario no lo entiende. Por eso incorporamos unidades reales del campo colombiano como la fanegada, un asistente interactivo llamado Don Terra que guía al usuario en tiempo real según el diagnóstico del lote, soporte bilingüe español-inglés instantáneo para proyección internacional y exportación directa a PDF y Excel."*

---

## Diapositiva 5: Invitación al Jurado — Prueba de Estrés en Vivo
### 🎯 Pongamos a Prueba a TerraSoft con Cualquier Coordenada Ahora Mismo

* **❄️ Prueba 1 (Puntero en Nevado, Río o Carretera):** Detección óptica + OSM → Bloqueo automático y barras FAO caen a `0%` (`Clase N`).
* **🌱 Prueba 2 (Parcela en Boyacá, Meta o Valle):** NASA POWER + FAO GAEZ v4 → Top 3 de Rotación + Calendario de 12 Meses + Costos `$ COP`.
* **🌐 Prueba 3 (Cambio `ES/EN` + Exportación PDF):** Estado reactivo → Informe técnico completo listo para imprimir.

> 🎙️ **Guion de cierre para cautivar al jurado (35 seg):**
> *"La mejor forma de validar un sistema científico es poniéndolo a prueba sin filtros. Los invitamos ahora mismo a elegir cualquier coordenada en el mapa —ya sea una finca productiva, una carretera o una cumbre nevada— para que vean en tiempo real cómo responden los motores de la NASA y la FAO en TerraSoft. Muchas gracias, quedamos atentos a sus preguntas y a la demostración en vivo."*

---

## 💡 Posibles Preguntas del Jurado Académico y Respuestas Ganadoras

1. **¿Cómo resolvieron la diferencia de resolución espacial entre los rasters de la FAO (5 minutos de arco, ~9 km) y el nivel de parcela o finca?**
   * **Respuesta:** Implementamos una arquitectura híbrida en dos escalas: usamos los 15 rasters de FAO GAEZ v4 y NASA POWER para la macro-aptitud edafoclimática regional, y los modulamos a escala de sub-píxel (10 a 30 metros) mediante consultas vectoriales a OpenStreetMap y análisis de reflectancia RGB sobre la ortofoto satelital de Esri. Así evitamos que el sistema recomiende sembrar sobre una vía o cuerpo de agua dentro de una celda agrícola.
2. **¿De dónde salen las estimaciones de ahorro de fertilizantes y costos en pesos colombianos?**
   * **Respuesta:** Cada uno de los 24 cultivos del catálogo parametriza su estructura de costos por hectárea en 4 rubros (semilla, mano de obra, fertilizantes y fitosanitarios) basados en referencias técnicas del agro colombiano. Cuando el cultivo previo pertenece a la familia *Fabaceae* (leguminosas), el modelo aplica un descuento agronómico del 18% sobre el rubro de fertilizantes nitrogenados del cultivo sucesor por fijación biológica de nitrógeno, y pondera el rendimiento esperado según la clase edáfica FAO (`S1` a `S4`) del lote.
3. **¿Qué pasa si la API de la NASA o algún servicio externo tarda o falla en el campo?**
   * **Respuesta:** La matriz de las 15 capas de FAO GAEZ v4 para Colombia fue pre-procesada desde los archivos GeoTIFF originales a una estructura matricial ligera local (`src/data/fao_lr_colombia.json`), lo que permite respuesta en menos de 5 milisegundos sin depender de servidores externos de la FAO, además de contar con cancelación de peticiones (`AbortController`) y modelos de respaldo agroclimático.
