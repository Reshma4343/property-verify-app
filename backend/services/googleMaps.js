const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_SEARCH_RADIUS_METERS = 10000;
const DEFAULT_PLACE_LIMIT = 10;
const HYDERABAD_BOUNDS = {
  minLat: 16.8,
  maxLat: 17.9,
  minLng: 77.8,
  maxLng: 79.2,
};

const metroStations = [];

const railStations = [
  { name: "Malakpet MMTS Station", latitude: 17.3772, longitude: 78.4998 },
  { name: "Dabirpura MMTS Station", latitude: 17.3664, longitude: 78.4888 },
  { name: "Yakutpura MMTS Station", latitude: 17.3616, longitude: 78.4845 },
  { name: "Huppuguda MMTS Station", latitude: 17.3435, longitude: 78.4824 },
  { name: "Dilsukhnagar MMTS Station", latitude: 17.3688, longitude: 78.5262 },
  { name: "Kacheguda Railway Station", latitude: 17.3892, longitude: 78.4984 },
  { name: "Hyderabad Deccan Nampally Railway Station", latitude: 17.3924, longitude: 78.4675 },
  { name: "Secunderabad Railway Station", latitude: 17.4344, longitude: 78.5010 },
  { name: "Malkajgiri MMTS Station", latitude: 17.4474, longitude: 78.5350 },
  { name: "Begumpet Railway Station", latitude: 17.4377, longitude: 78.4576 },
  { name: "Bharat Nagar MMTS Station", latitude: 17.4555, longitude: 78.4486 },
  { name: "Borabanda MMTS Station", latitude: 17.4573, longitude: 78.4138 },
  { name: "HITEC City MMTS Station", latitude: 17.4502, longitude: 78.3830 },
  { name: "Lingampalli Railway Station", latitude: 17.4849, longitude: 78.3170 },
];

const amenityConfigs = [
  {
    field: "hospitals_list",
    includedTypes: ["hospital"],
    fallbackType: "Hospital",
  },
  {
    field: "schools_list",
    includedTypes: ["school"],
    fallbackType: "School",
  },
  {
    field: "restaurants_list",
    includedTypes: ["restaurant", "cafe"],
  },
  {
    field: "gardens_list",
    includedTypes: ["park"],
  },
  {
    field: "malls_list",
    includedTypes: ["shopping_mall"],
  },
  {
    field: "tourism_list",
    includedTypes: ["tourist_attraction"],
  },
  {
    field: "local_transport",
    includedTypes: ["bus_station", "transit_station"],
  },
];

function isHyderabadCoordinate(latitude, longitude) {
  return latitude >= HYDERABAD_BOUNDS.minLat
    && latitude <= HYDERABAD_BOUNDS.maxLat
    && longitude >= HYDERABAD_BOUNDS.minLng
    && longitude <= HYDERABAD_BOUNDS.maxLng;
}

function getGoogleMapsConfig(options = {}) {
  return {
    apiKey: String(
      options.apiKey
      || process.env.GOOGLE_MAPS_API_KEY
      || process.env.GOOGLE_API_KEY
      || ""
    ).trim(),
    timeoutMs: Math.max(
      3000,
      Number(options.timeoutMs || process.env.GOOGLE_DISTANCE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS)
    ),
    searchRadiusMeters: Math.max(
      500,
      Number(options.searchRadiusMeters || process.env.GOOGLE_PLACES_RADIUS_METERS || DEFAULT_SEARCH_RADIUS_METERS)
    ),
    placeLimit: Math.max(
      1,
      Number(options.placeLimit || process.env.GOOGLE_PLACES_LIMIT || DEFAULT_PLACE_LIMIT)
    ),
  };
}

function roundKm(distanceMeters) {
  const meters = Number(distanceMeters);
  if (!Number.isFinite(meters)) return null;
  return Math.round((meters / 1000) * 10) / 10;
}

function getCoordinate(value, primary, fallback) {
  return Number(value?.[primary] ?? value?.[fallback]);
}

function normalizeStation(station) {
  const latitude = getCoordinate(station, "latitude", "lat");
  const longitude = getCoordinate(station, "longitude", "lng");
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    name: String(station.name || "").trim(),
    latitude,
    longitude,
    line: String(station.line || "").trim(),
  };
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function haversineKm(originLatitude, originLongitude, destinationLatitude, destinationLongitude) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(destinationLatitude - originLatitude);
  const dLng = toRadians(destinationLongitude - originLongitude);
  const lat1 = toRadians(originLatitude);
  const lat2 = toRadians(destinationLatitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeWaypoint(latitude, longitude) {
  return {
    waypoint: {
      location: {
        latLng: {
          latitude,
          longitude,
        },
      },
    },
  };
}

function getPlaceName(place) {
  return String(place?.displayName?.text || place?.name || "").trim();
}

function getPlaceCoordinates(place) {
  const latitude = Number(place?.location?.latitude);
  const longitude = Number(place?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function getGovernmentOrPrivateType(place, fallbackType = "") {
  const name = getPlaceName(place);
  if (!fallbackType) return undefined;
  if (/\b(govt|government|osmania|gandhi|niloufer|esi|district|primary health|phc)\b/i.test(name)) {
    return "Government";
  }
  return "Private";
}

export async function geocodeLocality(locality, options = {}) {
  const { apiKey, timeoutMs } = getGoogleMapsConfig(options);
  if (!apiKey || !String(locality || "").trim()) return null;

  const params = new URLSearchParams({
    address: `${String(locality).trim()}, Hyderabad, Telangana, India`,
    components: "administrative_area:Telangana|country:IN",
    region: "in",
    key: apiKey,
  });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    const result = await response.json().catch(() => ({}));
    const firstResult = result?.results?.[0];
    const latitude = Number(firstResult?.geometry?.location?.lat);
    const longitude = Number(firstResult?.geometry?.location?.lng);

    if (!response.ok || result.status !== "OK" || !isHyderabadCoordinate(latitude, longitude)) {
      console.warn("Google geocode lookup failed:", result.error_message || result.status || response.status);
      return null;
    }

    return {
      latitude,
      longitude,
      formattedAddress: String(firstResult?.formatted_address || "").trim(),
    };
  } catch (err) {
    console.warn("Google geocode lookup failed:", err.message);
    return null;
  }
}

export function findNearestMetro(latitude, longitude, limit = 3) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  return metroStations
    .map(normalizeStation)
    .filter(Boolean)
    .map((station) => ({
      ...station,
      straight_line_distance_km: Math.round(
        haversineKm(latitude, longitude, station.latitude, station.longitude) * 10
      ) / 10,
    }))
    .sort((first, second) => first.straight_line_distance_km - second.straight_line_distance_km)
    .slice(0, limit);
}

export async function getRoadDistance(originLat, originLng, destinationLat, destinationLng, options = {}) {
  const distances = await getRoadDistances(
    originLat,
    originLng,
    [{ latitude: destinationLat, longitude: destinationLng }],
    options
  );
  return distances[0]?.distance_km ?? null;
}

export async function getRoadDistances(originLat, originLng, destinations, options = {}) {
  const { apiKey, timeoutMs } = getGoogleMapsConfig(options);
  if (!apiKey || !Number.isFinite(originLat) || !Number.isFinite(originLng) || !destinations.length) {
    return [];
  }

  try {
    const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "originIndex,destinationIndex,distanceMeters,status",
      },
      body: JSON.stringify({
        origins: [routeWaypoint(originLat, originLng)],
        destinations: destinations.map((destination) => routeWaypoint(destination.latitude, destination.longitude)),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
        regionCode: "IN",
      }),
    });
    const result = await response.json().catch(() => []);
    if (!response.ok || !Array.isArray(result)) {
      console.warn("Google Routes distance lookup failed:", result?.error?.message || response.status);
      return [];
    }

    return result
      .map((element) => ({
        index: Number(element?.destinationIndex),
        distance_km: roundKm(element?.distanceMeters),
      }))
      .filter((item) => Number.isInteger(item.index) && Number.isFinite(item.distance_km));
  } catch (err) {
    console.warn("Google Routes distance lookup failed:", err.message);
    return [];
  }
}

// export async function getVerifiedMetroStations(latitude, longitude, options = {}) {
//   const nearestStations = findNearestMetro(latitude, longitude, 3);
//   if (!nearestStations.length) return [];

//   const roadDistances = await getRoadDistances(latitude, longitude, nearestStations, options);
//   const roadDistanceByIndex = new Map(
//     roadDistances.map((item) => [item.index, item.distance_km])
//   );

//   return nearestStations
//     .map((station, index) => ({
//       name: station.name,
//       distance_km: roadDistanceByIndex.get(index) ?? station.straight_line_distance_km,
//       line: station.line,
//       latitude: station.latitude,
//       longitude: station.longitude,
//       distance_source: roadDistanceByIndex.has(index) ? "google_routes" : "haversine_fallback",
//     }))
//     .sort((first, second) => first.distance_km - second.distance_km);
// }

export async function getVerifiedMetroStations(
  latitude,
  longitude,
  options = {}
) {
  const places = await searchNearbyMetroStations(
    latitude,
    longitude,
    options
  );

  if (!places.length) {
    return [];
  }

  const stations = places
    .map((place) => {
      const coords = getPlaceCoordinates(place);

      if (!coords) return null;

      return {
        name: getPlaceName(place),
        latitude: coords.latitude,
        longitude: coords.longitude,
        line: "",
      };
    })
    .filter(Boolean);

  if (!stations.length) {
    return [];
  }

  const roadDistances = await getRoadDistances(
    latitude,
    longitude,
    stations,
    options
  );

  const roadDistanceByIndex = new Map(
    roadDistances.map((item) => [item.index, item.distance_km])
  );

  return stations
    .map((station, index) => ({
      name: station.name,
      distance_km:
        roadDistanceByIndex.get(index) ??
        Math.round(
          haversineKm(
            latitude,
            longitude,
            station.latitude,
            station.longitude
          ) * 10
        ) / 10,
      line: station.line,
      latitude: station.latitude,
      longitude: station.longitude,
      distance_source: roadDistanceByIndex.has(index)
        ? "google_routes"
        : "haversine_fallback",
    }))
    .sort((a, b) => a.distance_km - b.distance_km);
}

export async function getVerifiedRailAccess(latitude, longitude, locality, options = {}) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

  const normalizedLocality = normalizeText(locality);
  const nearestStations = railStations
    .map((station) => ({
      ...station,
      straight_line_distance_km: Math.round(
        haversineKm(latitude, longitude, station.latitude, station.longitude) * 10
      ) / 10,
    }))
    .sort((first, second) => first.straight_line_distance_km - second.straight_line_distance_km);

  const selectedStations = [];
  const addStation = (station) => {
    if (station && !selectedStations.some((item) => item.name === station.name)) {
      selectedStations.push(station);
    }
  };

  if (normalizedLocality.includes("malakpet")) {
    addStation(nearestStations.find((station) => /malakpet/i.test(station.name)));
  }
  nearestStations.slice(0, 5).forEach(addStation);

  const finalStations = selectedStations.slice(0, 5);
  const roadDistances = await getRoadDistances(latitude, longitude, finalStations, options);
  const roadDistanceByIndex = new Map(
    roadDistances.map((item) => [item.index, item.distance_km])
  );

  return finalStations
    .map((station, index) => ({
      name: station.name,
      distance_km: roadDistanceByIndex.get(index) ?? station.straight_line_distance_km,
    }))
    .sort((first, second) => first.distance_km - second.distance_km)
    .slice(0, 3);
}

// export async function searchNearbyPlaces(latitude, longitude, includedTypes, options = {}) {
// export async function searchNearbyMetroStations(latitude, longitude, options = {}) {
//   const { apiKey, timeoutMs, searchRadiusMeters, placeLimit } =
//     getGoogleMapsConfig(options);

//   if (!apiKey || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
//     return [];
//   }

//   try {
//     const response = await fetch(
//       "https://places.googleapis

//   const { apiKey, timeoutMs, searchRadiusMeters, placeLimit } = getGoogleMapsConfig(options);
//   if (!apiKey || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

//   try {
//     const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
//       method: "POST",
//       signal: AbortSignal.timeout(timeoutMs),
//       headers: {
//         "Content-Type": "application/json",
//         "X-Goog-Api-Key": apiKey,
//         "X-Goog-FieldMask": "places.displayName,places.location,places.types",
//       },
//       body: JSON.stringify({
//         includedTypes,
//         maxResultCount: placeLimit,
//         locationRestriction: {
//           circle: {
//             center: {
//               latitude,
//               longitude,
//             },
//             radius: searchRadiusMeters,
//           },
//         },
//       }),
//     });
//     const result = await response.json().catch(() => ({}));
//     if (!response.ok || !Array.isArray(result?.places)) {
//       console.warn("Google Places lookup failed:", result?.error?.message || response.status);
//       return [];
//     }
//     return result.places;
//   } catch (err) {
//     console.warn("Google Places lookup failed:", err.message);
//     return [];
//   }
// }

export async function searchNearbyPlaces(latitude, longitude, includedTypes, options = {}) {
  const { apiKey, timeoutMs, searchRadiusMeters, placeLimit } =
    getGoogleMapsConfig(options);

  if (!apiKey || !Number.isFinite(latitude) || !Number.isFinite(longitude))
    return [];

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.location,places.types",
        },
        body: JSON.stringify({
          includedTypes,
          maxResultCount: placeLimit,
          locationRestriction: {
            circle: {
              center: {
                latitude,
                longitude,
              },
              radius: searchRadiusMeters,
            },
          },
        }),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(result?.places)) {
      console.warn(
        "Google Places lookup failed:",
        result?.error?.message || response.status
      );
      return [];
    }

    return result.places;
  } catch (err) {
    console.warn("Google Places lookup failed:", err.message);
    return [];
  }
}

export async function searchNearbyMetroStations(
  latitude,
  longitude,
  options = {}
) {
  return searchNearbyPlaces(
    latitude,
    longitude,
    ["subway_station"],
    options
  );
}

export async function getVerifiedPlaces(latitude, longitude, config, options = {}) {
  const places = await searchNearbyPlaces(latitude, longitude, config.includedTypes, options);
  const placeItems = places
    .map((place) => ({
      place,
      name: getPlaceName(place),
      coordinates: getPlaceCoordinates(place),
    }))
    .filter((item) => item.name && item.coordinates);

  if (!placeItems.length) return [];

  const roadDistances = await getRoadDistances(
    latitude,
    longitude,
    placeItems.map((item) => item.coordinates),
    options
  );
  const roadDistanceByIndex = new Map(
    roadDistances.map((item) => [item.index, item.distance_km])
  );

  return placeItems
    .map((item, index) => {
      const type = getGovernmentOrPrivateType(item.place, config.fallbackType);
      return {
        name: item.name,
        distance_km: roadDistanceByIndex.get(index)
          ?? Math.round(
            haversineKm(latitude, longitude, item.coordinates.latitude, item.coordinates.longitude) * 10
          ) / 10,
        ...(type ? { type } : {}),
      };
    })
    .sort((first, second) => first.distance_km - second.distance_km)
    .slice(0, getGoogleMapsConfig(options).placeLimit);
}

export async function buildGoogleVerifiedInsights(locality, options = {}) {
  const geocoded = await geocodeLocality(locality, options);
  if (!geocoded) return null;

  const [metroStationsVerified, railAccess, ...amenityResults] = await Promise.all([
    getVerifiedMetroStations(geocoded.latitude, geocoded.longitude, options),
    getVerifiedRailAccess(geocoded.latitude, geocoded.longitude, locality, options),
    ...amenityConfigs.map((config) => getVerifiedPlaces(
      geocoded.latitude,
      geocoded.longitude,
      config,
      options
    )),
  ]);

  const amenities = {};
  amenityConfigs.forEach((config, index) => {
    const places = amenityResults[index];
    if (places.length) amenities[config.field] = places;
  });

  return {
    geocoded,
    metro_stations: metroStationsVerified,
    rail_access: railAccess,
    amenities,
  };
}

export function applyGoogleVerifiedInsights(data, verifiedInsights) {
  if (!data || typeof data !== "object" || !verifiedInsights) return data;

  data.locality_coordinates = {
    lat: verifiedInsights.geocoded.latitude,
    lng: verifiedInsights.geocoded.longitude,
  };
  data.formatted_address = verifiedInsights.geocoded.formattedAddress;

  if (verifiedInsights.metro_stations.length) {
    data.metro_stations = verifiedInsights.metro_stations.map((station) => ({
      name: station.name,
      distance_km: station.distance_km,
      line: station.line,
    }));
    const nearest = data.metro_stations[0];
    data.metro = `${nearest.name} - ${nearest.distance_km} km`;
    data.metro_distance_source = verifiedInsights.metro_stations.some(
      (station) => station.distance_source === "google_routes"
    )
      ? "google_routes"
      : "haversine_fallback";
  }

  if (Array.isArray(verifiedInsights.rail_access) && verifiedInsights.rail_access.length) {
    data.rail_access = verifiedInsights.rail_access;
  }

  for (const [field, places] of Object.entries(verifiedInsights.amenities)) {
    if (Array.isArray(places) && places.length) {
      data[field] = places;
    }
  }

  data.google_verified_at = new Date().toISOString();
  return data;
}
