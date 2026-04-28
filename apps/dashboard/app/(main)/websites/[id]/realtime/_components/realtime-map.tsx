"use client";

import { type GeoPermissibleObjects, geoNaturalEarth1, geoPath } from "d3-geo";
import { useEffect, useRef } from "react";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { COUNTRY_NAME_TO_ISO_NUMERIC } from "./country-codes";

interface Country {
	country_code: string;
	visitors: number;
}

interface RealtimeMapProps {
	countries: Country[];
}

const BAYER: number[][] = [
	[0, 8, 2, 10],
	[12, 4, 14, 6],
	[3, 11, 1, 9],
	[15, 7, 13, 5],
];

const G = 3;

export function RealtimeMap({ countries }: RealtimeMapProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rafRef = useRef<number | null>(null);
	const countriesRef = useRef<Country[]>(countries);
	countriesRef.current = countries;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}

		let destroyed = false;

		const logW = canvas.offsetWidth || 800;
		const logH = canvas.offsetHeight || 300;
		canvas.width = logW;
		canvas.height = logH;

		const rootStyle = getComputedStyle(document.documentElement);
		const BG = rootStyle.getPropertyValue("--background").trim() || "#19191D";
		const BORDER = rootStyle.getPropertyValue("--border").trim() || "#33333B";
		const ACCENT = rootStyle.getPropertyValue("--success").trim() || "#22c55e";

		const projection = geoNaturalEarth1().fitExtent(
			[
				[-60, -20],
				[logW + 60, logH + 20],
			],
			{ type: "Sphere" } as GeoPermissibleObjects
		);

		const features = (
			feature(worldTopo as any, (worldTopo as any).objects.countries) as any
		).features;

		const baseCanvas = document.createElement("canvas");
		baseCanvas.width = logW;
		baseCanvas.height = logH;
		const bx = baseCanvas.getContext("2d");
		if (!bx) {
			return;
		}

		const basePath = geoPath(projection, bx);
		bx.fillStyle = BG;
		bx.fillRect(0, 0, logW, logH);
		for (const f of features) {
			bx.beginPath();
			basePath(f);
			bx.fillStyle = BG;
			bx.fill();
			bx.strokeStyle = BORDER;
			bx.lineWidth = 0.4;
			bx.stroke();
		}

		const countryPixels = new Map<number, number[]>();
		for (const f of features) {
			const id = +(f.id ?? -1);
			const off = document.createElement("canvas");
			off.width = logW;
			off.height = logH;
			const ox = off.getContext("2d");
			if (!ox) {
				continue;
			}
			const oPath = geoPath(projection, ox);
			ox.beginPath();
			oPath(f);
			ox.fillStyle = "#fff";
			ox.fill();
			const data = ox.getImageData(0, 0, logW, logH).data;
			const pixels: number[] = [];
			for (let y = 0; y < logH; y += G) {
				for (let x = 0; x < logW; x += G) {
					if ((data[(y * logW + x) * 4] ?? 0) > 100) {
						pixels.push(x, y);
					}
				}
			}
			if (pixels.length > 0) {
				countryPixels.set(id, pixels);
			}
		}

		const brightness = new Map<number, { value: number; target: number }>();

		let last = performance.now();

		function draw(ts: number) {
			if (!ctx || destroyed) {
				return;
			}
			const dt = Math.min(ts - last, 50);
			last = ts;

			const activeCountries = countriesRef.current;
			const maxVisitors = Math.max(
				...activeCountries.map((c) => c.visitors),
				1
			);

			for (const c of activeCountries) {
				const numId = COUNTRY_NAME_TO_ISO_NUMERIC[c.country_code];
				if (numId === undefined) {
					continue;
				}
				const existing = brightness.get(numId);
				const target = Math.min(0.3 + (c.visitors / maxVisitors) * 0.7, 1);
				if (existing) {
					existing.target = target;
				} else {
					brightness.set(numId, { value: 0, target });
				}
			}

			for (const [id, b] of brightness) {
				const isActive = activeCountries.some(
					(c) => COUNTRY_NAME_TO_ISO_NUMERIC[c.country_code] === id
				);
				if (!isActive) {
					b.target = 0;
				}
				if (b.value < b.target) {
					b.value = Math.min(b.target, b.value + dt / 400);
				} else {
					b.value = Math.max(0, b.value - dt / 2000);
				}
			}

			ctx.fillStyle = BG;
			ctx.fillRect(0, 0, logW, logH);
			ctx.drawImage(baseCanvas, 0, 0);

			ctx.fillStyle = ACCENT;
			for (const [id, b] of brightness) {
				if (b.value <= 0) {
					continue;
				}
				const pixels = countryPixels.get(id);
				if (!pixels) {
					continue;
				}

				for (let i = 0; i < pixels.length; i += 2) {
					const x = pixels[i];
					const y = pixels[i + 1];
					const bayer =
						(BAYER[Math.floor(y / G) % 4]?.[Math.floor(x / G) % 4] ?? 0) / 16;
					if (b.value > bayer) {
						ctx.fillRect(x, y, 2, 2);
					}
				}
			}

			rafRef.current = requestAnimationFrame(draw);
		}

		rafRef.current = requestAnimationFrame(draw);

		return () => {
			destroyed = true;
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, []);

	return <canvas className="block h-full w-full" ref={canvasRef} />;
}
