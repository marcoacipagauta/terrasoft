import faoLrColombia from '../data/fao_lr_colombia.json';

export interface ResumenMensual {
	mes: string;
	tempMaxPromedio: number;
	lluviaTotal: number;
	lluviaPromedioDiaria: number;
}

export interface PropiedadSueloFao {
	codigo: string;
	nombre: string;
	icono: string;
	porcentaje: number;
	estado: string;
}

export interface EvaluacionTerreno {
	aptoParaSiembra: boolean;
	clasificacion:
		| 'agricola_rural'
		| 'asfalto_via'
		| 'urbano_edificado'
		| 'cuerpo_agua'
		| 'hielo_glaciar'
		| 'desierto_arido'
		| 'no_cultivable';
	etiqueta: string;
	ubicacionNombre: string;
	motivo: string;
	categoriaOsm: string;
	distanciaViaMetros?: number;
	geometriaDetectada?: Array<{ lat: number; lon: number }>;
	tieneInfraestructuraCercana?: boolean;
}

export interface EvaluacionFaoGaez {
	zonaAgroecologica: string;
	lgpDias: number; // Length of Growing Period (0 - 365 días/año)
	claseSueloFao: 'S1' | 'S2' | 'S3' | 'N';
	etiquetaSueloFao: string;
	regimenHumedadFao: string;
	factorRendimientoFao: number; // 0.75 a 1.15
	fuenteServicio: string;
	exportImageUrl: string;
	wmsLrUrl: string;
	wmsLgpUrl: string;
	// Datos locales extraídos de C:\Users\anthony\Downloads\LR (FAO GAEZ v4 Theme 1 LR)
	altitudMsnm: number | null;
	pendienteTexto: string;
	enAreaProtegida: boolean;
	areaProtegidaTexto: string;
	escasezAguaTexto: string;
	aez2020sTexto: string;
	aez2050sTexto: string;
	proyeccionClimatica2050: string;
	propiedadesSuelo: PropiedadSueloFao[];
}

export interface ResultadoClimaNasa {
	coordenadas: {
		lat: number;
		lon: number;
	};
	periodo: {
		inicio: string;
		fin: string;
	};
	promedios: {
		tempMax: number; // °C promedio diario
		lluviaDiaria: number; // mm/día promedio
		lluviaTotalAnual: number; // mm acumulados en el año
	};
	mensual: ResumenMensual[];
	terreno: EvaluacionTerreno;
	faoGaez: EvaluacionFaoGaez;
}

const NOMBRES_MESES = [
	'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
	'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

function distanciaPuntoASegmentoMetros(
	lat: number,
	lon: number,
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const rad = Math.PI / 180;
	const cosLat = Math.cos(lat * rad);
	const mPorGradoLat = 111132;
	const mPorGradoLon = 111320 * cosLat;

	const px = (lon - lon1) * mPorGradoLon;
	const py = (lat - lat1) * mPorGradoLat;
	const dx = (lon2 - lon1) * mPorGradoLon;
	const dy = (lat2 - lat1) * mPorGradoLat;

	const lenSq = dx * dx + dy * dy;
	let t = 0;
	if (lenSq > 0) {
		t = Math.max(0, Math.min(1, (px * dx + py * dy) / lenSq));
	}

	const projX = t * dx;
	const projY = t * dy;
	return Math.hypot(px - projX, py - projY);
}

function puntoDentroDePoligono(
	lat: number,
	lon: number,
	geometria: Array<{ lat: number; lon: number }>
): boolean {
	if (!geometria || geometria.length < 3) return false;
	let dentro = false;
	for (let i = 0, j = geometria.length - 1; i < geometria.length; j = i++) {
		const xi = geometria[i].lon;
		const yi = geometria[i].lat;
		const xj = geometria[j].lon;
		const yj = geometria[j].lat;

		const intersecta =
			yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
		if (intersecta) dentro = !dentro;
	}
	return dentro;
}

function distanciaMinimaAPolilinea(
	lat: number,
	lon: number,
	puntos: Array<{ lat: number; lon: number }>
): number {
	if (!puntos || puntos.length === 0) return Infinity;
	if (puntos.length === 1) {
		return distanciaPuntoASegmentoMetros(lat, lon, puntos[0].lat, puntos[0].lon, puntos[0].lat, puntos[0].lon);
	}
	let min = Infinity;
	for (let i = 0; i < puntos.length - 1; i++) {
		const d = distanciaPuntoASegmentoMetros(
			lat,
			lon,
			puntos[i].lat,
			puntos[i].lon,
			puntos[i + 1].lat,
			puntos[i + 1].lon
		);
		if (d < min) min = d;
	}
	return min;
}

function extraerAnillosGeoJson(geojson: any): Array<Array<{ lat: number; lon: number }>> {
	if (!geojson || !geojson.type || !geojson.coordinates) return [];

	const convertirPar = (c: number[]) => ({ lon: Number(c[0]), lat: Number(c[1]) });

	if (geojson.type === 'LineString') {
		return [geojson.coordinates.map(convertirPar)];
	}
	if (geojson.type === 'Polygon' || geojson.type === 'MultiLineString') {
		return geojson.coordinates.map((ring: number[][]) => ring.map(convertirPar));
	}
	if (geojson.type === 'MultiPolygon') {
		const rings: Array<Array<{ lat: number; lon: number }>> = [];
		for (const poly of geojson.coordinates) {
			for (const ring of poly) {
				rings.push(ring.map(convertirPar));
			}
		}
		return rings;
	}
	return [];
}

/**
 * Evalúa la cartografía de OpenStreetMap (vías, glorietas, edificios, cuerpos de agua, glaciares, roca).
 */
async function evaluarTerrenoPreciso(lat: number, lon: number): Promise<EvaluacionTerreno> {
	try {
		const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
			lat
		)}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1&polygon_geojson=1&extratags=1&accept-language=es`;

		const res = await fetch(nominatimUrl, {
			headers: { 'User-Agent': 'TerraSync-Agricultural-MVP/1.0' },
			signal: AbortSignal.timeout(4500),
		});

		if (!res.ok) {
			return {
				aptoParaSiembra: true,
				clasificacion: 'agricola_rural',
				etiqueta: 'Lote / Terreno Evaluado',
				ubicacionNombre: `Lat ${lat}, Lon ${lon}`,
				motivo: 'Parcela evaluada por coordenadas geográficas.',
				categoriaOsm: 'fallback',
				tieneInfraestructuraCercana: false,
			};
		}

		const nomData = await res.json();

		if (nomData.error) {
			return {
				aptoParaSiembra: false,
				clasificacion: 'cuerpo_agua',
				etiqueta: 'Océano / Cuerpo de Agua o Zona Remota Inaccesible',
				ubicacionNombre: `Coordenada (${lat}, ${lon})`,
				motivo: 'El punto seleccionado se encuentra en el océano o en una región polar/remota sin suelo agrícola.',
				categoriaOsm: 'ocean',
				tieneInfraestructuraCercana: false,
			};
		}

		const category: string = (nomData.category || '').toLowerCase();
		const type: string = (nomData.type || '').toLowerCase();
		const ubicacionNombre: string = nomData.display_name || `Lat ${lat}, Lon ${lon}`;
		const addr = nomData.address || {};
		const extratags = nomData.extratags || {};
		const lugarCorto =
			addr.village ||
			addr.hamlet ||
			addr.town ||
			addr.municipality ||
			addr.city ||
			addr.county ||
			addr.state ||
			addr.country ||
			'Terreno seleccionado';

		const tieneInfraestructuraCercana = Boolean(
			addr.road ||
				addr.suburb ||
				addr.neighbourhood ||
				addr.city ||
				addr.town ||
				addr.village ||
				category === 'highway' ||
				category === 'building' ||
				category === 'amenity'
		);

		const anillos = extraerAnillosGeoJson(nomData.geojson);
		const anilloPrincipal = anillos[0] || [];

		let distMinMetros = Infinity;
		let dentroPoligono = false;

		for (const ring of anillos) {
			const d = distanciaMinimaAPolilinea(lat, lon, ring);
			if (d < distMinMetros) distMinMetros = d;
			if (ring.length >= 4 && puntoDentroDePoligono(lat, lon, ring)) {
				dentroPoligono = true;
			}
		}

		if (distMinMetros === Infinity && nomData.lat && nomData.lon) {
			distMinMetros = distanciaPuntoASegmentoMetros(
				lat,
				lon,
				Number(nomData.lat),
				Number(nomData.lon),
				Number(nomData.lat),
				Number(nomData.lon)
			);
		}

		// 1. Glaciares, casquetes polares o nieve perpetua cartografiada en OSM
		if (type === 'glacier' || type === 'tundra' || extratags.natural === 'glacier') {
			return {
				aptoParaSiembra: false,
				clasificacion: 'hielo_glaciar',
				etiqueta: `Glaciar / Hielo Perpetuo (${lugarCorto})`,
				ubicacionNombre,
				motivo: `La ubicación corresponde a una masa glaciar o suelo congelado en ${lugarCorto}. No existe suelo agrícola descubierta para sembrar.`,
				categoriaOsm: `${category}:${type}`,
				tieneInfraestructuraCercana: false,
			};
		}

		// 2. Superficies naturales de roca desnuda, arena desértica o acantilados
		if (category === 'natural' && ['bare_rock', 'scree', 'shingle', 'sand', 'dune', 'desert', 'cliff', 'volcano'].includes(type)) {
			return {
				aptoParaSiembra: false,
				clasificacion: 'no_cultivable',
				etiqueta: `Superficie Natural No Cultivable (${type === 'sand' || type === 'dune' ? 'Arena / Dunas' : 'Roca Desnuda'})`,
				ubicacionNombre,
				motivo: `El punto presenta suelo estéril (${type}) en ${lugarCorto}, sin capa vegetal arable.`,
				categoriaOsm: `${category}:${type}`,
				tieneInfraestructuraCercana: false,
			};
		}

		// 3. Cuerpos de Agua
		const tiposAgua = ['water', 'river', 'stream', 'canal', 'reservoir', 'basin', 'bay', 'wetland', 'sea', 'ocean', 'fjord'];
		if (category === 'waterway' || tiposAgua.includes(type)) {
			if (dentroPoligono || distMinMetros <= 8) {
				return {
					aptoParaSiembra: false,
					clasificacion: 'cuerpo_agua',
					etiqueta: `Cuerpo de Agua (${nomData.name || type})`,
					ubicacionNombre,
					motivo: `El punto cae sobre un cuerpo de agua o cauce hídrico (${nomData.name || type}).`,
					categoriaOsm: `${category}:${type}`,
					geometriaDetectada: anilloPrincipal,
					tieneInfraestructuraCercana,
				};
			}
		}

		// 4. Edificaciones, Estaciones de Servicio, Industria o Comercio
		const categoriasConstruidas = ['building', 'amenity', 'shop', 'office', 'industrial', 'commercial', 'man_made', 'aeroway', 'railway', 'leisure'];
		if (categoriasConstruidas.includes(category)) {
			if (dentroPoligono || distMinMetros <= 10) {
				const nombreLugar = nomData.name || addr.amenity || addr.building || `Infraestructura (${type})`;
				return {
					aptoParaSiembra: false,
					clasificacion: 'urbano_edificado',
					etiqueta: `Infraestructura / Edificación (${nombreLugar})`,
					ubicacionNombre,
					motivo: `El punto seleccionado cae sobre infraestructura construida o pavimentada (${nombreLugar}). Selecciona un lote con suelo descubierto.`,
					categoriaOsm: `${category}:${type}`,
					distanciaViaMetros: Number(distMinMetros.toFixed(1)),
					geometriaDetectada: anilloPrincipal,
					tieneInfraestructuraCercana: true,
				};
			}
		}

		// 5. Carretera, Glorieta, Autopista o Calle Municipal
		if (category === 'highway' || extratags.junction === 'roundabout') {
			const esGlorieta =
				extratags.junction === 'roundabout' ||
				(anilloPrincipal.length >= 4 &&
					anilloPrincipal[0].lat === anilloPrincipal[anilloPrincipal.length - 1].lat &&
					anilloPrincipal[0].lon === anilloPrincipal[anilloPrincipal.length - 1].lon);

			let umbralVia = 7.5;
			if (['motorway', 'trunk', 'primary', 'motorway_link', 'trunk_link', 'primary_link'].includes(type)) {
				umbralVia = 14.0;
			} else if (['secondary', 'tertiary', 'secondary_link', 'tertiary_link'].includes(type) || esGlorieta) {
				umbralVia = 11.0;
			} else if (['track', 'path', 'footway', 'cycleway'].includes(type)) {
				umbralVia = 4.5;
			}

			if ((esGlorieta && dentroPoligono) || distMinMetros <= umbralVia) {
				const nombreVia =
					nomData.name ||
					addr.road ||
					(esGlorieta
						? 'Glorieta / Intersección Vial'
						: `Malla Vial (${type === 'unclassified' ? 'Vía municipal' : type})`);

				return {
					aptoParaSiembra: false,
					clasificacion: 'asfalto_via',
					etiqueta: esGlorieta ? `Glorieta / Intersección (${nombreVia})` : `Malla Vial / Carretera (${nombreVia})`,
					ubicacionNombre,
					motivo: esGlorieta && dentroPoligono
						? `El punto cae dentro de una glorieta o intersección vial (${nombreVia}). No es terreno apto para siembra agrícola.`
						: `El marcador está sobre la calzada o berma de "${nombreVia}" (a ${distMinMetros.toFixed(
								1
						  )} m del eje vial). Mueve el marcador fuera de la carretera hacia el interior del lote.`,
					categoriaOsm: `highway:${type}`,
					distanciaViaMetros: Number(distMinMetros.toFixed(1)),
					geometriaDetectada: anilloPrincipal,
					tieneInfraestructuraCercana: true,
				};
			}
		}

		const notaDistancia =
			distMinMetros < 150
				? ` (A ${distMinMetros.toFixed(1)} m del eje de la vía/estructura más cercana, fuera de la calzada).`
				: '.';

		return {
			aptoParaSiembra: true,
			clasificacion: 'agricola_rural',
			etiqueta: `Lote / Terreno Apto (${lugarCorto})`,
			ubicacionNombre,
			motivo: `Terreno fuera de la malla vial y edificaciones en ${lugarCorto}${notaDistancia}`,
			categoriaOsm: `${category || 'land'}:${type || 'cultivable'}`,
			distanciaViaMetros: distMinMetros < 200 ? Number(distMinMetros.toFixed(1)) : undefined,
			tieneInfraestructuraCercana,
		};
	} catch {
		return {
			aptoParaSiembra: true,
			clasificacion: 'agricola_rural',
			etiqueta: 'Lote / Terreno Evaluado',
			ubicacionNombre: `Lat ${lat}, Lon ${lon}`,
			motivo: 'Parcela evaluada por coordenadas geográficas.',
			categoriaOsm: 'fallback',
			tieneInfraestructuraCercana: false,
		};
	}
}

/**
 * Consulta la API de NASA POWER (Agroclimatology) para el año 2023
 * y combina sus datos climáticos con la evaluación del terreno para detectar también
 * zonas polares/glaciares (ej. Groenlandia, Antártida, nevados) y desiertos extremos.
 */
export async function consultarNasaPower(lat: number, lon: number): Promise<ResultadoClimaNasa> {
	const start = '20230101';
	const end = '20231231';

	const urlNasa = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,PRECTOTCORR&community=AG&longitude=${encodeURIComponent(
		lon
	)}&latitude=${encodeURIComponent(lat)}&start=${start}&end=${end}&format=JSON`;

	const [responseNasa, terrenoBase] = await Promise.all([
		fetch(urlNasa),
		evaluarTerrenoPreciso(lat, lon),
	]);

	if (!responseNasa.ok) {
		throw new Error(`Error al consultar NASA POWER API: ${responseNasa.status} ${responseNasa.statusText}`);
	}

	const data = await responseNasa.json();
	const parameters = data?.properties?.parameter;

	if (!parameters || !parameters.T2M_MAX || !parameters.PRECTOTCORR) {
		throw new Error('Respuesta inválida de la API de NASA POWER.');
	}

	const rawTemp: Record<string, number> = parameters.T2M_MAX;
	const rawPrecip: Record<string, number> = parameters.PRECTOTCORR;

	const valoresTempValidos = Object.values(rawTemp).filter((v) => typeof v === 'number' && v > -900);
	const valoresPrecipValidos = Object.values(rawPrecip).filter((v) => typeof v === 'number' && v > -900);

	const promedioTempMax =
		valoresTempValidos.length > 0
			? Number(
					(valoresTempValidos.reduce((acc, v) => acc + v, 0) / valoresTempValidos.length).toFixed(2)
			  )
			: 0;

	const lluviaTotalAnual =
		valoresPrecipValidos.length > 0
			? Number(valoresPrecipValidos.reduce((acc, v) => acc + v, 0).toFixed(2))
			: 0;

	const promedioLluviaDiaria =
		valoresPrecipValidos.length > 0
			? Number((lluviaTotalAnual / valoresPrecipValidos.length).toFixed(2))
			: 0;

	const mensual: ResumenMensual[] = NOMBRES_MESES.map((nombreMes, idx) => {
		const mesPrefijo = `2023${String(idx + 1).padStart(2, '0')}`;

		const tempsMes = Object.entries(rawTemp)
			.filter(([fecha, valor]) => fecha.startsWith(mesPrefijo) && valor > -900)
			.map(([, valor]) => valor);

		const lluviasMes = Object.entries(rawPrecip)
			.filter(([fecha, valor]) => fecha.startsWith(mesPrefijo) && valor > -900)
			.map(([, valor]) => valor);

		const tempMaxPromedio =
			tempsMes.length > 0
				? Number((tempsMes.reduce((a, b) => a + b, 0) / tempsMes.length).toFixed(2))
				: 0;

		const lluviaTotal =
			lluviasMes.length > 0 ? Number(lluviasMes.reduce((a, b) => a + b, 0).toFixed(2)) : 0;

		const lluviaPromedioDiaria =
			lluviasMes.length > 0 ? Number((lluviaTotal / lluviasMes.length).toFixed(2)) : 0;

		return {
			mes: nombreMes,
			tempMaxPromedio,
			lluviaTotal,
			lluviaPromedioDiaria,
		};
	});

	// Cruzar clima extremo con la evaluación del terreno (Groenlandia, casquetes polares, alta montaña nevada o desiertos hiperáridos)
	let terreno: EvaluacionTerreno = { ...terrenoBase };

	const mesesSobreDiezGrados = mensual.filter((m) => m.tempMaxPromedio >= 10).length;

	if (promedioTempMax <= 5 || (Math.abs(lat) >= 60 && mesesSobreDiezGrados < 3)) {
		terreno = {
			aptoParaSiembra: false,
			clasificacion: 'hielo_glaciar',
			etiqueta: `❄️ Zona Polar / Glaciar o Permafrost (${terrenoBase.ubicacionNombre.split(',')[0]})`,
			ubicacionNombre: terrenoBase.ubicacionNombre,
			motivo: `No es posible sembrar: la ubicación presenta condiciones de hielo perpetuo, nieve o permafrost con una temperatura máxima media anual de ${promedioTempMax} °C (${mesesSobreDiezGrados} meses ≥ 10 °C). El suelo permanece congelado e inapto para agricultura a campo abierto.`,
			categoriaOsm: 'climate:polar_glacier',
			tieneInfraestructuraCercana: false,
		};
	} else if (promedioTempMax < 9 && mesesSobreDiezGrados <= 2) {
		terreno = {
			aptoParaSiembra: false,
			clasificacion: 'hielo_glaciar',
			etiqueta: `🏔️ Páramo Alto / Zona Nival de Congelamiento`,
			ubicacionNombre: terrenoBase.ubicacionNombre,
			motivo: `Temperatura demasiado baja para el desarrollo fisiológico de cultivos (${promedioTempMax} °C máx. promedio anual). Zona de páramo alto o nieve perpetua.`,
			categoriaOsm: 'climate:alpine_nival',
			tieneInfraestructuraCercana: false,
		};
	} else if (lluviaTotalAnual < 90 && promedioTempMax > 18 && terreno.aptoParaSiembra) {
		terreno = {
			aptoParaSiembra: false,
			clasificacion: 'desierto_arido',
			etiqueta: `🏜️ Desierto Hiperárido (${lluviaTotalAnual} mm/año)`,
			ubicacionNombre: terrenoBase.ubicacionNombre,
			motivo: `Precipitación anual extremadamente baja (${lluviaTotalAnual} mm/año) y alta evaporación (${promedioTempMax} °C). Terreno desértico no cultivable en secano.`,
			categoriaOsm: 'climate:hyperarid_desert',
			tieneInfraestructuraCercana: false,
		};
	}

// Decodificación en memoria de la malla local de Colombia extraída de Downloads\LR (162 x 216 celdas a 5 arc-min)
const CAPAS_LR_MEMORIA: Record<string, Buffer> = {};
for (const [k, b64] of Object.entries(faoLrColombia.capas)) {
	CAPAS_LR_MEMORIA[k] = Buffer.from(b64 as string, 'base64');
}

const MAPA_AEZ_CLASES: Record<number, string> = {
	1: 'Trópico de Tierras Bajas · Semiárido',
	2: 'Trópico de Tierras Bajas · Subhúmedo',
	3: 'Trópico de Tierras Bajas · Húmedo',
	4: 'Trópico de Altura Andino · Semiárido',
	5: 'Trópico de Altura Andino · Subhúmedo',
	6: 'Trópico de Altura Andino · Húmedo',
	7: 'Subtrópico Cálido · Semiárido',
	8: 'Subtrópico Cálido · Subhúmedo',
	9: 'Subtrópico Cálido · Húmedo',
	10: 'Subtrópico Templado · Semiárido',
	11: 'Subtrópico Templado · Subhúmedo',
	12: 'Subtrópico Templado · Húmedo',
	13: 'Subtrópico Frío · Semiárido',
	14: 'Subtrópico Frío · Subhúmedo',
	15: 'Subtrópico Frío · Húmedo',
	22: 'Alta Montaña Fría · Seca',
	23: 'Alta Montaña Fría · Húmeda',
	24: 'Alta Montaña Fría · Muy Húmeda',
	25: 'Relieve Muy Escarpado (>30%)',
	26: 'Tierras con Limitación Edáfica Severa',
	27: 'Tierras con Potencial de Riego',
	28: 'Suelos Hidromórficos (Vegas / Humedales)',
	29: 'Clima Desértico / Árido',
	30: 'Clima Boreal / Páramo Frío',
	31: 'Clima Nival / Glaciar',
	32: 'Zona Predominantemente Urbana',
	33: 'Cuerpo de Agua Continental / Marino',
};

const MAPA_PENDIENTE_FAO: Record<number, string> = {
	1: 'Plano (0 – 0.5%) · Mecanización total',
	2: 'Casi plano (0.5 – 2%) · Mecanización fácil',
	3: 'Suavemente inclinado (2 – 5%) · Mecanizable',
	4: 'Ondulado (5 – 8%) · Labranza en contorno',
	5: 'Fuertemente ondulado (8 – 16%) · Riesgo erosión',
	6: 'Ladera montañosa (16 – 30%) · Cultivo en curvas',
	7: 'Escarpado (30 – 45%) · Agroforestería / Conservación',
	8: 'Muy escarpado (> 45%) · Protección forestal',
	9: 'Cuerpo de agua',
};

const MAPA_AREA_PROTEGIDA_FAO: Record<number, string> = {
	0: 'Fuera de Reservas / Frontera Agrícola Permitida',
	1: 'Reserva Natural Estricta (IUCN Ia)',
	2: 'Área Silvestre Protegida (IUCN Ib)',
	3: 'Parque Nacional Natural (IUCN II)',
	4: 'Monumento Natural Protegido (IUCN III)',
	5: 'Área de Manejo de Hábitat (IUCN IV)',
	6: 'Paisaje Terrestre Protegido (IUCN V)',
	7: 'Reserva de Recursos Manejados (IUCN VI)',
	8: 'Humedal Protegido Ramsar',
	9: 'Patrimonio Natural Mundial UNESCO',
	10: 'Reserva de la Biósfera UNESCO-MAB',
	14: 'Área Protegida Nacional (No Forestal)',
	15: 'Reserva Forestal Nacional Protegida',
};

const MAPA_ESCASEZ_AGUA_FAO: Record<number, string> = {
	1: 'Baja (Buena disponibilidad hídrica)',
	2: 'Moderada (Cuidar riego en estiaje)',
	3: 'Alta (Estrés hídrico frecuente)',
	4: 'Muy Alta (Déficit hídrico crítico)',
};

function leerCeldaColombiaLR(lat: number, lon: number) {
	const { lonMin, lonMax, latMax, latMin, cols, rows } = faoLrColombia.metadata;
	if (lat < latMin || lat > latMax || lon < lonMin || lon > lonMax) {
		return null;
	}
	const r = Math.min(rows - 1, Math.max(0, Math.floor((latMax - lat) * 12)));
	const c = Math.min(cols - 1, Math.max(0, Math.floor((lon - lonMin) * 12)));
	const idx = r * cols + c;

	const altitudMsnm = CAPAS_LR_MEMORIA.altitud_msnm.readInt16LE(idx * 2);
	return {
		altitudMsnm: altitudMsnm > -500 ? altitudMsnm : 0,
		pendienteCls: CAPAS_LR_MEMORIA.pendiente_cls[idx],
		areaProtegidaCls: CAPAS_LR_MEMORIA.area_protegida[idx],
		escasezAguaCls: CAPAS_LR_MEMORIA.escasez_agua[idx],
		aezHist: CAPAS_LR_MEMORIA.aez_hist[idx],
		aez2020s: CAPAS_LR_MEMORIA.aez_2020s[idx],
		aez2050s: CAPAS_LR_MEMORIA.aez_2050s[idx],
		sq0: CAPAS_LR_MEMORIA.sq0_general[idx],
		sq1: CAPAS_LR_MEMORIA.sq1_nutrientes[idx],
		sq2: CAPAS_LR_MEMORIA.sq2_retencion[idx],
		sq3: CAPAS_LR_MEMORIA.sq3_enraizamiento[idx],
		sq4: CAPAS_LR_MEMORIA.sq4_oxigeno_drenaje[idx],
		sq5: CAPAS_LR_MEMORIA.sq5_salinidad[idx],
		sq6: CAPAS_LR_MEMORIA.sq6_toxicidad[idx],
		sq7: CAPAS_LR_MEMORIA.sq7_labranza[idx],
	};
}

function convertirValorSqAPorcentaje(val: number): { porcentaje: number; estado: string } {
	// En FAO GAEZ soi1 (SQ1..SQ7), los valores 1..10 representan deciles de calidad (1 = 0-10% ... 10 = 90-100%)
	if (!val || val <= 0 || val >= 11) {
		return { porcentaje: 75, estado: 'Moderado' };
	}
	const pct = Math.min(98, Math.max(12, val * 10 - 5));
	const estado = pct >= 75 ? 'Óptimo' : pct >= 50 ? 'Moderado' : 'Limitado';
	return { porcentaje: pct, estado };
}

/**
 * Consulta la malla local extraída de C:\Users\anthony\Downloads\LR junto con los servicios ArcGIS ImageServer de FAO GAEZ v4
 */
async function evaluarFaoGaez(
	lat: number,
	lon: number,
	promedioTempMax: number,
	lluviaTotalAnual: number,
	mensual: ResumenMensual[],
	terreno: EvaluacionTerreno
): Promise<EvaluacionFaoGaez> {
	const baseFao = 'https://gaez-services.fao.org/server/rest/services';
	const deltaBbox = 0.25;
	const bbox = `${(lon - deltaBbox).toFixed(4)},${(lat - deltaBbox).toFixed(4)},${(lon + deltaBbox).toFixed(
		4
	)},${(lat + deltaBbox).toFixed(4)}`;

	const exportImageUrl = `${baseFao}/LR/ImageServer/exportImage?bbox=${encodeURIComponent(
		bbox
	)}&bboxSR=4326&size=160,160&imageSR=4326&format=png&transparent=true&f=image`;
	const wmsLrUrl = `${baseFao}/LR/ImageServer/WMSServer`;
	const wmsLgpUrl = `${baseFao}/res02/ImageServer/WMSServer`;

	const celdaLocal = leerCeldaColombiaLR(lat, lon);

	// Cálculo de LGP (Length of Growing Period en días/año) bajo metodología FAO GAEZ v4
	let lgpCalculado = 0;
	for (const m of mensual) {
		if (m.tempMaxPromedio < 9) continue;
		const etpMensualEstimada = Math.max(45, m.tempMaxPromedio * 4.6);
		if (m.lluviaTotal >= etpMensualEstimada * 0.75) {
			lgpCalculado += 30.4;
		} else if (m.lluviaTotal >= etpMensualEstimada * 0.42) {
			lgpCalculado += 18;
		} else if (m.lluviaTotal >= 22) {
			lgpCalculado += 8;
		}
	}
	const lgpDias =
		!terreno.aptoParaSiembra && terreno.clasificacion === 'hielo_glaciar'
			? 0
			: Math.min(365, Math.max(0, Math.round(lgpCalculado)));

	// Zonificación Térmica y de Humedad según matriz FAO GAEZ v4 + Raster Local AEZ
	let pisoAez = 'Trópico Templado / Subtrópico';
	if (promedioTempMax <= 6) pisoAez = 'Zona Polar / Nival (AEZ Criogénica)';
	else if (promedioTempMax < 13) pisoAez = 'Alta Montaña / Tierra Fría Andina';
	else if (promedioTempMax <= 21) pisoAez = 'Trópico de Altura (Fresco - Templado)';
	else if (promedioTempMax <= 27) pisoAez = 'Trópico Subcálido Premontano';
	else pisoAez = 'Trópico Cálido de Tierras Bajas';

	let regimenHumedadFao = 'Subhúmedo (LGP 180–269 d)';
	if (lgpDias < 60 || lluviaTotalAnual < 250) regimenHumedadFao = 'Árido / Semiárido (LGP < 60 d)';
	else if (lgpDias < 120) regimenHumedadFao = 'Seco Estacional (LGP 60–119 d)';
	else if (lgpDias < 180) regimenHumedadFao = 'Subhúmedo Seco (LGP 120–179 d)';
	else if (lgpDias <= 270) regimenHumedadFao = 'Subhúmedo Húmedo (LGP 180–270 d)';
	else regimenHumedadFao = 'Húmedo Continuo (LGP > 270 d)';

	const aez2020sTexto =
		(celdaLocal && MAPA_AEZ_CLASES[celdaLocal.aez2020s]) ||
		(celdaLocal && MAPA_AEZ_CLASES[celdaLocal.aezHist]) ||
		`${pisoAez} · ${regimenHumedadFao.split('(')[0].trim()}`;

	const aez2050sTexto =
		(celdaLocal && MAPA_AEZ_CLASES[celdaLocal.aez2050s]) || aez2020sTexto;

	const proyeccionClimatica2050 =
		aez2020sTexto === aez2050sTexto
			? `Estable hacia 2050 (${aez2050sTexto})`
			: `Cambio proyectado 2050: ${aez2020sTexto} ➔ ${aez2050sTexto}`;

	const zonaAgroecologica = aez2020sTexto;

	const altitudMsnm = celdaLocal ? celdaLocal.altitudMsnm : null;
	const pendienteTexto =
		(celdaLocal && MAPA_PENDIENTE_FAO[celdaLocal.pendienteCls]) || 'Suavemente inclinado (2 – 5%)';
	const enAreaProtegida = Boolean(celdaLocal && celdaLocal.areaProtegidaCls > 0);
	const areaProtegidaTexto =
		(celdaLocal && MAPA_AREA_PROTEGIDA_FAO[celdaLocal.areaProtegidaCls]) ||
		'Fuera de Reservas / Frontera Agrícola Permitida';
	const escasezAguaTexto =
		(celdaLocal && MAPA_ESCASEZ_AGUA_FAO[celdaLocal.escasezAguaCls]) ||
		'Baja (Buena disponibilidad hídrica)';

	// Construir las 7 Propiedades del Suelo FAO (SQ1 a SQ7) desde los rasters locales soi1\SQ1..SQ7
	const definicionSq = [
		{ codigo: 'SQ1', nombre: 'Nutrientes Naturales', icono: '🧪', raw: celdaLocal?.sq1 ?? 8 },
		{ codigo: 'SQ2', nombre: 'Retención de Abono', icono: '🧲', raw: celdaLocal?.sq2 ?? 8 },
		{ codigo: 'SQ3', nombre: 'Profundidad / Raíz', icono: '🌱', raw: celdaLocal?.sq3 ?? 9 },
		{ codigo: 'SQ4', nombre: 'Oxígeno y Drenaje', icono: '💧', raw: celdaLocal?.sq4 ?? 8 },
		{ codigo: 'SQ5', nombre: 'Libre de Salinidad', icono: '🧂', raw: celdaLocal?.sq5 ?? 10 },
		{ codigo: 'SQ6', nombre: 'Baja Acidez/Toxicidad', icono: '🛡️', raw: celdaLocal?.sq6 ?? 9 },
		{ codigo: 'SQ7', nombre: 'Facilidad de Labranza', icono: '🚜', raw: celdaLocal?.sq7 ?? 8 },
	];

	const propiedadesSuelo: PropiedadSueloFao[] = definicionSq.map((item) => {
		const { porcentaje, estado } = convertirValorSqAPorcentaje(item.raw);
		return {
			codigo: item.codigo,
			nombre: item.nombre,
			icono: item.icono,
			porcentaje,
			estado,
		};
	});

	const promedioSq = Math.round(
		propiedadesSuelo.reduce((acc, p) => acc + p.porcentaje, 0) / propiedadesSuelo.length
	);

	// Clase de Aptitud Edáfica FAO (S1: Muy Apta, S2: Moderadamente Apta, S3: Marginalmente Apta, N: No Apta)
	let claseSueloFao: 'S1' | 'S2' | 'S3' | 'N' = 'S1';
	let etiquetaSueloFao = `Clase S1 — Alta Aptitud Edáfica FAO (Índice SQ promedio: ${promedioSq}%)`;
	let factorRendimientoFao = 1.08;

	if (!terreno.aptoParaSiembra) {
		claseSueloFao = 'N';
		etiquetaSueloFao = 'Clase N — No Apto para Agricultura (Restricción Física/Superficial)';
		factorRendimientoFao = 0;
	} else if (lgpDias < 75 || lluviaTotalAnual < 380 || promedioTempMax < 9 || promedioSq < 48) {
		claseSueloFao = 'S3';
		etiquetaSueloFao = `Clase S3 — Aptitud Marginal (Índice SQ: ${promedioSq}%)`;
		factorRendimientoFao = 0.82;
	} else if (promedioSq >= 72 && lgpDias >= 150) {
		claseSueloFao = 'S1';
		etiquetaSueloFao = `Clase S1 — Alta Aptitud Agroecológica FAO (Salud de Suelo: ${promedioSq}%)`;
		factorRendimientoFao = 1.08;
	} else {
		claseSueloFao = 'S2';
		etiquetaSueloFao = `Clase S2 — Aptitud Moderada FAO (Salud de Suelo: ${promedioSq}%)`;
		factorRendimientoFao = 0.96;
	}

	return {
		zonaAgroecologica,
		lgpDias,
		claseSueloFao,
		etiquetaSueloFao,
		regimenHumedadFao,
		factorRendimientoFao,
		fuenteServicio: celdaLocal
			? 'FAO GAEZ v4 — Rasters Locales LR (soi1, ter, aez, prt, wat)'
			: 'FAO GAEZ v4 Modelo Agroecológico (AEZ/LGP)',
		exportImageUrl,
		wmsLrUrl,
		wmsLgpUrl,
		altitudMsnm,
		pendienteTexto,
		enAreaProtegida,
		areaProtegidaTexto,
		escasezAguaTexto,
		aez2020sTexto,
		aez2050sTexto,
		proyeccionClimatica2050,
		propiedadesSuelo,
	};
}

	const faoGaez = await evaluarFaoGaez(
		lat,
		lon,
		promedioTempMax,
		lluviaTotalAnual,
		mensual,
		terreno
	);

	return {
		coordenadas: { lat, lon },
		periodo: { inicio: start, fin: end },
		promedios: {
			tempMax: promedioTempMax,
			lluviaDiaria: promedioLluviaDiaria,
			lluviaTotalAnual,
		},
		mensual,
		terreno,
		faoGaez,
	};
}
