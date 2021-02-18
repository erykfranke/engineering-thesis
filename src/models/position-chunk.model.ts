import {LatLngModel} from "./lat-lng.model";

export interface PositionChunkModel {
    southWest: LatLngModel;
    northEast: LatLngModel;
    count: number;
}
