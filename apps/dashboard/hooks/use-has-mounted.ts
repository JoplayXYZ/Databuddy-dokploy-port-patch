import { useEffect, useState } from "react";

/** True after the first client commit. Use to avoid SSR / hydration mismatches for client-only state. */
export function useHasMounted(): boolean {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	return mounted;
}
