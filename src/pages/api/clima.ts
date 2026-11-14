import type { APIRoute } from 'astro';
import { consultarNasaPower } from '../../services/nasaPower';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
	const latParam = url.searchParams.get('lat') ?? url.searchParams.get('latitude');
	const lonParam = url.searchParams.get('lon') ?? url.searchParams.get('longitude');

	const lat = latParam !== null ? parseFloat(latParam) : NaN;
	const lon = lonParam !== null ? parseFloat(lonParam) : NaN;

	if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
		return new Response(
			JSON.stringify({
				error: 'Parámetros de coordenadas inválidos. Envía ?lat=<latitud>&lon=<longitud>.',
			}),
			{
				status: 400,
				headers: { 'Content-Type': 'application/json' },
			}
		);
	}

	try {
		const resultado = await consultarNasaPower(lat, lon);
		return new Response(JSON.stringify(resultado), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (error) {
		const mensaje = error instanceof Error ? error.message : 'Error desconocido al consultar NASA POWER';
		return new Response(JSON.stringify({ error: mensaje }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

