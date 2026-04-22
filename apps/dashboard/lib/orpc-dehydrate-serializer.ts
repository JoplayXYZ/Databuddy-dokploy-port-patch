import {
	StandardRPCJsonSerializer,
	type StandardRPCJsonSerializedMetaItem,
} from "@orpc/client/standard";

const jsonSerializer = new StandardRPCJsonSerializer();

interface SerializedPayload {
	json: unknown;
	meta: StandardRPCJsonSerializedMetaItem[];
}

export function serializeQueryData(data: unknown): SerializedPayload {
	const [json, meta] = jsonSerializer.serialize(data);
	return { json, meta };
}

export function deserializeQueryData(payload: SerializedPayload): unknown {
	return jsonSerializer.deserialize(payload.json, payload.meta);
}

export const dehydrateDefaults = {
	serializeData: serializeQueryData,
} as const;

export const hydrateDefaults = {
	deserializeData: deserializeQueryData,
} as const;
