const EARTH_RADIUS_METERS = 6_371_000;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

function validateCoordinates(point: Coordinates): void {
  if (
    !Number.isFinite(point.latitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    !Number.isFinite(point.longitude) ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new RangeError('Koordinat latitude/longitude tidak valid.');
  }
}

/** Menghitung jarak permukaan bumi antara dua koordinat menggunakan Haversine. */
export function distanceInMeters(from: Coordinates, to: Coordinates): number {
  validateCoordinates(from);
  validateCoordinates(to);

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, haversine)));
}
