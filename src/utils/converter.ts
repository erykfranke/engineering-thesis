import {LatLngModel} from "../models/lat-lng.model";

const CENTER_LAT = 51.77676585777656;
const CENTER_LNG = 19.489204287528995;
const R = 6371000;
const d = Math.PI / 180;
const SINGLE_CHUNK_SIZE = 10;

export function positionToIndex(lat: number, lng: number, size = SINGLE_CHUNK_SIZE): {latIndex: number, lngIndex: number} {
    const latR = (size / R) / d;
    const chunkLatIndex = (Math.floor((Number(lat - CENTER_LAT)) / latR));

    const lngR = latR / Math.cos(Math.PI / 180 * (latR * Math.abs(Math.floor((Number(lat)) / latR))));
    const chunkLngIndex = (Math.floor((Number(lng - CENTER_LNG)) / lngR));
    return {latIndex: chunkLatIndex, lngIndex: chunkLngIndex};
}

export function indexToPosition(latIndex: number, lngIndex: number, size = SINGLE_CHUNK_SIZE): {start: LatLngModel, end: LatLngModel} {
    const latR = (size / R) / d;
    const chunkLat = (latIndex * latR) + CENTER_LAT;

    const lngR = latR / Math.cos(Math.PI / 180 * (chunkLat));
    const chunkLng = (lngIndex * lngR) + CENTER_LNG;

    return {
        start: {lat: chunkLat, lng: chunkLng},
        end: {lat: chunkLat + latR, lng: chunkLng + lngR},
    };
}

export function calcChunkSize(mapZoom: number): number {
    switch (mapZoom) {
        case 18:
            return 1;
        case 17:
            return 2;
        case 16:
            return 4;
        case 15:
            return 8;
        case 14:
            return 16;
        case 13:
            return 32;
        case 12:
            return 64;
        case 11:
        default:
            return 65;
    }
}
