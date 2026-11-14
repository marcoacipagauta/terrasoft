export interface ResumenMensual {
	mes: string;
	tempMaxPromedio: number;
	lluviaTotal: number;
	lluviaPromedioDiaria: number;
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
	};
}
