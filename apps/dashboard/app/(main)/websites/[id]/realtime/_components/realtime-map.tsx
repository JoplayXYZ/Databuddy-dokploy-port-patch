"use client";

import { type GeoPermissibleObjects, geoNaturalEarth1, geoPath } from "d3-geo";
import { useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import worldTopo from "world-atlas/countries-110m.json";
import { COUNTRY_NAME_TO_ISO_NUMERIC } from "./country-codes";

interface Country {
	country_code: string;
	country_name?: string;
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
	const [tooltip, setTooltip] = useState<{
		x: number;
		y: number;
		name: string;
		visitors: number;
	} | null>(null);
	countriesRef.current = countries;

	const countryByPixelRef = useRef<Uint16Array | null>(null);
	const numericToCountryRef = useRef<Map<number, Country>>(new Map());
	const dimensionsRef = useRef({ w: 0, h: 0 });

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
		const logH = canvas.offsetHeight || 700;
		canvas.width = logW;
		canvas.height = logH;
		dimensionsRef.current = { w: logW, h: logH };

		const rootStyle = getComputedStyle(document.documentElement);
		const BG = rootStyle.getPropertyValue("--background").trim() || "#19191D";
		const BORDER = rootStyle.getPropertyValue("--border").trim() || "#33333B";
		const ACCENT = rootStyle.getPropertyValue("--success").trim() || "#22c55e";

		const projection = geoNaturalEarth1().fitExtent(
			[
				[-40, -10],
				[logW + 40, logH + 10],
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

		bx.fillStyle = BG;
		bx.fillRect(0, 0, logW, logH);
		const basePath = geoPath(projection, bx);
		for (const f of features) {
			bx.beginPath();
			basePath(f);
			bx.fillStyle = BG;
			bx.fill();
			bx.strokeStyle = BORDER;
			bx.lineWidth = 0.5;
			bx.stroke();
		}

		// Build per-country pixel lists + hit-test map
		const countryPixels = new Map<number, number[]>();
		const hitMap = new Uint16Array(logW * logH);

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
			// Fill hit-test map at full pixel resolution
			for (let y = 0; y < logH; y++) {
				for (let x = 0; x < logW; x++) {
					if ((data[(y * logW + x) * 4] ?? 0) > 100) {
						hitMap[y * logW + x] = id;
					}
				}
			}
		}
		countryByPixelRef.current = hitMap;

		const brightness = new Map<number, { value: number; target: number }>();
		let hoveredId: number | null = null;

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

			// Update numeric lookup
			numericToCountryRef.current.clear();
			for (const c of activeCountries) {
				const numId = COUNTRY_NAME_TO_ISO_NUMERIC[c.country_code];
				if (numId !== undefined) {
					numericToCountryRef.current.set(numId, c);
					const existing = brightness.get(numId);
					const target = Math.min(0.3 + (c.visitors / maxVisitors) * 0.7, 1);
					if (existing) {
						existing.target = target;
					} else {
						brightness.set(numId, { value: 0, target });
					}
				}
			}

			for (const [id, b] of brightness) {
				const isActive = numericToCountryRef.current.has(id);
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

			for (const [id, b] of brightness) {
				if (b.value <= 0) {
					continue;
				}
				const pixels = countryPixels.get(id);
				if (!pixels) {
					continue;
				}

				const isHovered = id === hoveredId;
				ctx.fillStyle = isHovered ? "#fff" : ACCENT;

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

			// Hovered country outline highlight
			if (hoveredId !== null) {
				const pixels = countryPixels.get(hoveredId);
				if (pixels && !brightness.has(hoveredId)) {
					ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
					for (let i = 0; i < pixels.length; i += 2) {
						ctx.fillRect(pixels[i], pixels[i + 1], 2, 2);
					}
				}
			}

			rafRef.current = requestAnimationFrame(draw);
		}

		const handleMouseMove = (e: MouseEvent) => {
			const rect = canvas.getBoundingClientRect();
			const x = Math.floor(((e.clientX - rect.left) / rect.width) * logW);
			const y = Math.floor(((e.clientY - rect.top) / rect.height) * logH);

			if (x < 0 || x >= logW || y < 0 || y >= logH) {
				hoveredId = null;
				setTooltip(null);
				return;
			}

			const id = hitMap[y * logW + x];
			if (id && id !== hoveredId) {
				hoveredId = id;
				const country = numericToCountryRef.current.get(id);
				if (country) {
					setTooltip({
						x: e.clientX - rect.left,
						y: e.clientY - rect.top,
						name: country.country_name || country.country_code,
						visitors: country.visitors,
					});
				} else {
					setTooltip(null);
				}
			} else if (!id) {
				hoveredId = null;
				setTooltip(null);
			} else if (id === hoveredId) {
				setTooltip((prev) =>
					prev
						? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
						: null
				);
			}
		};

		const handleMouseLeave = () => {
			hoveredId = null;
			setTooltip(null);
		};

		canvas.addEventListener("mousemove", handleMouseMove);
		canvas.addEventListener("mouseleave", handleMouseLeave);

		rafRef.current = requestAnimationFrame(draw);

		return () => {
			destroyed = true;
			canvas.removeEventListener("mousemove", handleMouseMove);
			canvas.removeEventListener("mouseleave", handleMouseLeave);
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
			}
		};
	}, []);

	return (
		<div className="relative h-full w-full">
			<canvas className="block h-full w-full" ref={canvasRef} />
			{tooltip && (
				<div
					className="pointer-events-none absolute z-10 rounded border border-border/60 bg-popover px-2.5 py-1.5 text-xs shadow-md"
					style={{
						left: tooltip.x,
						top: tooltip.y - 36,
						transform: "translateX(-50%)",
					}}
				>
					<span className="font-bold">{tooltip.name}</span>
					<span className="text-muted-foreground">
						{" "}
						· {tooltip.visitors} active
					</span>
				</div>
			)}
		</div>
	);
}
