import {LatLngModel} from "../models/lat-lng.model";

export class Converter {

    static SINGLE_CHUNK_SIZE = 10;
    static MAX_ZOOM = 18;
    static CENTER_LAT = 51.77676585777656;
    static CENTER_LNG = 19.489204287528995;
    static R = 6371000;
    static d = Math.PI / 180;

    static positionToIndex(lat: number, lng: number, size = this.SINGLE_CHUNK_SIZE): {latIndex: number, lngIndex: number} {
        const latR = (size / this.R) / this.d;
        const chunkLatIndex = (Math.floor((Number(lat - this.CENTER_LAT)) / latR));

        const lngR = latR / Math.cos(Math.PI / 180 * (latR * Math.abs(Math.floor((Number(lat)) / latR))));
        const chunkLngIndex = (Math.floor((Number(lng - this.CENTER_LNG)) / lngR));
        return {latIndex: chunkLatIndex, lngIndex: chunkLngIndex};
    }

    static indexToPosition(latIndex: number, lngIndex: number, size = this.SINGLE_CHUNK_SIZE): {start: LatLngModel, end: LatLngModel} {
        const latR = (size / this.R) / this.d;
        const chunkLat = (latIndex * latR) + this.CENTER_LAT;

        const lngR = latR / Math.cos(Math.PI / 180 * (chunkLat));
        const chunkLng = (lngIndex * lngR) + this.CENTER_LNG;

        return {
            start: {lat: chunkLat, lng: chunkLng},
            end: {lat: chunkLat + latR, lng: chunkLng + lngR},
        };
    }

    static calcChunkSize(mapZoom: number): number {
        return Math.pow(2, (this.MAX_ZOOM - mapZoom ));
    }
}

