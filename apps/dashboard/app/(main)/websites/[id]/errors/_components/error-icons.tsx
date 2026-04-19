import {
	IconBugFillDuo18,
	IconCodeFillDuo18,
	IconConnectedDotsFillDuo18,
	IconConsoleFillDuo18,
	IconLaptopFillDuo18,
	IconMonitorFillDuo18,
	IconPhoneFillDuo18,
	IconTableFillDuo18,
} from "nucleo-ui-fill-duo-18";
export const getErrorTypeIcon = (type: string) => {
	if (!type) {
		return <IconBugFillDuo18 className="size-3.5 text-primary" />;
	}

	const lowerType = type.toLowerCase();
	if (lowerType.includes("react")) {
		return <IconCodeFillDuo18 className="size-3.5 text-primary" />;
	}
	if (lowerType.includes("network")) {
		return <IconConnectedDotsFillDuo18 className="size-3.5 text-primary" />;
	}
	if (lowerType.includes("script")) {
		return <IconCodeFillDuo18 className="size-3.5 text-primary" />;
	}
	if (lowerType.includes("syntax")) {
		return <IconConsoleFillDuo18 className="size-3.5 text-primary" />;
	}
	return <IconBugFillDuo18 className="size-3.5 text-primary" />;
};

// Get device icon
export const getDeviceIcon = (deviceType: string) => {
	if (!deviceType) {
		return <IconMonitorFillDuo18 className="size-3.5 text-chart-2" />;
	}

	switch (deviceType.toLowerCase()) {
		case "mobile":
			return <IconPhoneFillDuo18 className="size-3.5 text-chart-2" />;
		case "tablet":
			return <IconTableFillDuo18 className="size-3.5 text-chart-2" />;
		case "desktop":
			return <IconLaptopFillDuo18 className="size-3.5 text-chart-2" />;
		default:
			return <IconMonitorFillDuo18 className="size-3.5 text-chart-2" />;
	}
};
