import env from "../config/env";

export interface PolygonPoint {
  latitude: number;
  longitude: number;
}

export interface DetectedBuilding {
  id: string;
  latitude: number;
  longitude: number;
  address: string;
  buildingNumber?: number;
  source: "osm" | "simulated";
}

export interface BuildingDetectionResult {
  buildings: DetectedBuilding[];
  warnings: string[];
}

const EARTH_RADIUS_METERS = 6_378_137;
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const GOOGLE_GEOCODE_ENDPOINT =
  "https://maps.googleapis.com/maps/api/geocode/json";

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const withRetries = async <T>(
  task: () => Promise<T>,
  options?: { attempts?: number; initialDelayMs?: number }
): Promise<T> => {
  const attempts = Math.max(1, options?.attempts ?? 3);
  const initialDelayMs = options?.initialDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        const delay = initialDelayMs * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
};

const convertToCartesian = (
  point: PolygonPoint,
  referenceLatitude: number
): { x: number; y: number } => {
  const x =
    toRadians(point.longitude) *
    EARTH_RADIUS_METERS *
    Math.cos(toRadians(referenceLatitude));
  const y = toRadians(point.latitude) * EARTH_RADIUS_METERS;
  return { x, y };
};

const calculatePolygonArea = (polygon: PolygonPoint[]): number => {
  if (polygon.length < 3) {
    return 0;
  }
  const referenceLatitude =
    polygon.reduce((sum, point) => sum + point.latitude, 0) / polygon.length;
  const points = polygon.map((point) =>
    convertToCartesian(point, referenceLatitude)
  );
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]!;
    const next = points[(i + 1) % points.length]!;
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
};

const isPointInPolygon = (
  point: PolygonPoint,
  polygon: PolygonPoint[]
): boolean => {
  if (polygon.length < 3) {
    return false;
  }
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i];
    const previous = polygon[j];
    if (!current || !previous) {
      continue;
    }
    const xi = current.longitude;
    const yi = current.latitude;
    const xj = previous.longitude;
    const yj = previous.latitude;

    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude <
        ((xj - xi) * (point.latitude - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
};

interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

const getBoundingBox = (polygon: PolygonPoint[]): BoundingBox => {
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;
  let minLng = Number.POSITIVE_INFINITY;
  let maxLng = Number.NEGATIVE_INFINITY;

  for (const point of polygon) {
    if (
      !point ||
      typeof point.latitude !== "number" ||
      typeof point.longitude !== "number"
    ) {
      continue;
    }
    const { latitude, longitude } = point;
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  }

  return { minLat, maxLat, minLng, maxLng };
};

const fetchBuildingsFromOSM = async (
  polygon: PolygonPoint[],
  boundingBox: BoundingBox
): Promise<Array<{ id: string; latitude: number; longitude: number }>> => {
  const { minLat, maxLat, minLng, maxLng } = boundingBox;
  console.log("[buildingDetection] Fetching OSM buildings", {
    minLat,
    maxLat,
    minLng,
    maxLng,
  });

  const query = `
    [out:json];
    (
      way["building"](${minLat},${minLng},${maxLat},${maxLng});
      relation["building"](${minLat},${minLng},${maxLat},${maxLng});
      node["building"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out center;
  `;

  const response = await withRetries(
    () => fetch(`${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`),
    { attempts: 3, initialDelayMs: 800 }
  );

  if (!response.ok) {
    throw new Error("Failed to contact OpenStreetMap Overpass API");
  }

  const data = await response.json();
  if (!Array.isArray(data?.elements)) {
    console.warn("[buildingDetection] OSM response missing elements");
    return [];
  }

  const candidates: Array<{ id: string; latitude: number; longitude: number }> =
    [];

  data.elements.forEach((element: any) => {
    if (!element) {
      return;
    }
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (typeof element.lat === "number" && typeof element.lon === "number") {
      latitude = element.lat;
      longitude = element.lon;
    } else if (
      typeof element.center?.lat === "number" &&
      typeof element.center?.lon === "number"
    ) {
      latitude = element.center.lat;
      longitude = element.center.lon;
    } else if (
      Array.isArray(element.geometry) &&
      element.geometry.length > 0 &&
      typeof element.geometry[0]?.lat === "number" &&
      typeof element.geometry[0]?.lon === "number"
    ) {
      latitude = element.geometry[0].lat;
      longitude = element.geometry[0].lon;
    }

    if (
      typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      typeof longitude === "number" &&
      Number.isFinite(longitude)
    ) {
      const point = { latitude, longitude };
      if (isPointInPolygon(point, polygon)) {
        candidates.push({
          id: String(element.id),
          latitude,
          longitude,
        });
      }
    }
  });

  console.log("[buildingDetection] Filtered buildings inside polygon", {
    candidateCount: candidates.length,
  });

  return candidates;
};

const getGoogleMapsKey = (): string | undefined => {
  return env.googleMapsApiKey || undefined;
};

const reverseGeocode = async (
  latitude: number,
  longitude: number,
  warnings: string[]
): Promise<{ address: string; buildingNumber?: number }> => {
  const apiKey = getGoogleMapsKey();

  if (!apiKey) {
    const warning =
      "Google Maps API key not configured. Using coordinates as addresses.";
    if (!warnings.includes(warning)) {
      warnings.push(warning);
    }
    return {
      address: `Building at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    };
  }

  const url = `${GOOGLE_GEOCODE_ENDPOINT}?latlng=${latitude},${longitude}&key=${apiKey}`;

  try {
    const response = await withRetries(() => fetch(url), {
      attempts: 2,
      initialDelayMs: 400,
    });
    const data = await response.json();
    if (
      data.status === "OK" &&
      Array.isArray(data.results) &&
      data.results[0]
    ) {
      const formatted = data.results[0].formatted_address;
      const address =
        formatted ||
        `Building at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      const result: { address: string; buildingNumber?: number } = { address };
      const houseNumberMatch = address.match(/^(\d+)[^\d]?/);
      if (houseNumberMatch) {
        const parsed = Number(houseNumberMatch[1]);
        if (!Number.isNaN(parsed)) {
          result.buildingNumber = parsed;
        }
      }
      return result;
    }
  } catch (error) {
    console.warn(
      "[buildingDetection] reverseGeocode failed:",
      (error as Error)?.message || error
    );
  }

  return {
    address: `Building at ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
  };
};

const generateRandomPointInPolygon = (
  polygon: PolygonPoint[],
  boundingBox: BoundingBox
): PolygonPoint | null => {
  const { minLat, maxLat, minLng, maxLng } = boundingBox;
  for (let attempts = 0; attempts < 30; attempts += 1) {
    const latitude = minLat + Math.random() * (maxLat - minLat);
    const longitude = minLng + Math.random() * (maxLng - minLng);
    const point = { latitude, longitude };
    if (isPointInPolygon(point, polygon)) {
      return point;
    }
  }
  return null;
};

export const detectBuildingsWithinPolygon = async (
  polygon: PolygonPoint[]
): Promise<BuildingDetectionResult> => {
  if (polygon.length < 3) {
    throw new Error("Polygon must contain at least three points");
  }

  console.log("[buildingDetection] Starting detection", {
    pointCount: polygon.length,
  });

  const warnings: string[] = [];
  const area = calculatePolygonArea(polygon);
  const targetCount = Math.max(3, Math.min(25, Math.round(area / 400)));
  const boundingBox = getBoundingBox(polygon);

  console.log("[buildingDetection] Polygon metrics", {
    area,
    targetCount,
    boundingBox,
  });

  const detectedBuildings: DetectedBuilding[] = [];

  try {
    const osmBuildings = await fetchBuildingsFromOSM(polygon, boundingBox);
    console.log("[buildingDetection] Received candidates", {
      osmCount: osmBuildings.length,
    });

    for (const building of osmBuildings) {
      if (!building) {
        continue;
      }
      const geocodeResult = await reverseGeocode(
        building.latitude,
        building.longitude,
        warnings
      );
      const detected: DetectedBuilding = {
        id: `osm-${building.id}`,
        latitude: building.latitude,
        longitude: building.longitude,
        address: geocodeResult.address,
        source: "osm",
      };
      if (
        typeof geocodeResult.buildingNumber === "number" &&
        Number.isFinite(geocodeResult.buildingNumber)
      ) {
        detected.buildingNumber = geocodeResult.buildingNumber;
      }
      detectedBuildings.push(detected);
      if (detectedBuildings.length >= targetCount) {
        break;
      }
    }
  } catch (error) {
    console.error(
      "[buildingDetection] Failed to detect buildings:",
      (error as Error)?.message || error
    );
    warnings.push(
      "Unable to fetch live building data right now. Using simulated points for this area."
    );
  }

  if (detectedBuildings.length < targetCount) {
    const missing = targetCount - detectedBuildings.length;
    console.log("[buildingDetection] Adding simulated buildings", {
      missing,
    });
    for (let i = 0; i < missing; i += 1) {
      const randomPoint = generateRandomPointInPolygon(polygon, boundingBox);
      if (!randomPoint) {
        break;
      }
      detectedBuildings.push({
        id: `sim-${Date.now()}-${i}`,
        latitude: randomPoint.latitude,
        longitude: randomPoint.longitude,
        address: `Simulated building near ${randomPoint.latitude.toFixed(
          6
        )}, ${randomPoint.longitude.toFixed(6)}`,
        source: "simulated",
      });
    }

    if (missing > 0) {
      warnings.push(
        "Limited real building data available. Added simulated buildings to approximate the area."
      );
    }
  }

  console.log("[buildingDetection] Detection finished", {
    total: detectedBuildings.length,
    warnings: warnings.length,
  });
  return { buildings: detectedBuildings, warnings };
};
