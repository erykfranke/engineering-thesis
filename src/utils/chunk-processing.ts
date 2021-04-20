import {ChunkModel} from "../models/chunk.model";
import {Converter} from "./converter";
import {LatLngModel} from "../models/lat-lng.model";
import {PositionChunkModel} from "../models/position-chunk.model";
import {PreprocessedChunkModel} from "../models/preprocessed-chunk.model";

export class ChunkPreprocessing {

    static preprocess(chunks: ChunkModel[], mapZoom: number) {
        const mergeSize = Converter.calcChunkSize(mapZoom);
        if (mergeSize === 1) {
            return this.singleChunkPreparation(chunks);
        } else {
            return this.mergeChunks(chunks, mergeSize);
        }
    }

    static singleChunkPreparation(chunks: ChunkModel[]): PreprocessedChunkModel {
        const preparedChunks: PositionChunkModel[] = [];
        let maxCount = 0;
        chunks.forEach((chunk) => {
            const chunkPosition = Converter.indexToPosition(chunk.lat_index, chunk.lng_index);
            preparedChunks.push({
                southWest: chunkPosition.start,
                northEast: chunkPosition.end,
                count: chunk.count
            });
            if (maxCount < Number(chunk.count)) {
                maxCount = chunk.count;
            }
        });
        return {
            chunks: preparedChunks,
            maxCount: maxCount,
        };
    }

    static mergeChunks(chunkBeforeMerge: ChunkModel[], mergeSize: number): PreprocessedChunkModel {
        let maxCount = 0;
        const mergedChunks: PositionChunkModel[] = [];
        while (chunkBeforeMerge.length !== 0) {
            const chunk = chunkBeforeMerge[0];
            const newChunkIndexesRange = this.calcNewMergedChunksIndexes(chunk, mergeSize);
            const chunkToMerge = [];
            chunkBeforeMerge = chunkBeforeMerge.filter(
                item => {
                    if ((item.lat_index >= 0 ? item.lat_index >= newChunkIndexesRange.start.lat : item.lat_index <= newChunkIndexesRange.start.lat)
                        && (item.lat_index >= 0 ? item.lat_index <= newChunkIndexesRange.end.lat : item.lat_index >= newChunkIndexesRange.end.lat)
                        && (item.lng_index >= 0 ? item.lng_index >= newChunkIndexesRange.start.lng : item.lng_index <= newChunkIndexesRange.start.lng)
                        && (item.lng_index >= 0 ? item.lng_index <= newChunkIndexesRange.end.lng : item.lng_index >= newChunkIndexesRange.end.lng)
                    ) {
                        chunkToMerge.push(item);
                        return false;
                    } else {
                        return true;
                    }
                }
            );
            let countSum = chunkToMerge.reduce((previousValue, currentValue) => {
                return previousValue + Number(currentValue.count);
            }, 0);

            if (maxCount < countSum) {
                maxCount = countSum;
            }
            const chunkBounds = Converter.indexToPosition(
                (newChunkIndexesRange.start.lat >= 0 ? newChunkIndexesRange.start.lat : newChunkIndexesRange.end.lat) / mergeSize,
                (newChunkIndexesRange.start.lng >= 0 ? newChunkIndexesRange.start.lng : newChunkIndexesRange.end.lng) / mergeSize,
                mergeSize * 10
            );
            mergedChunks.push({
                southWest: chunkBounds.start,
                northEast: chunkBounds.end,
                count: countSum
            });
        }
        return {
            chunks: mergedChunks,
            maxCount: maxCount,
        };
    }

    static calcNewMergedChunksIndexes(chunk: ChunkModel, mergeSize: number): { start: LatLngModel, end: LatLngModel } {
        const latRange = this.calcIndexRange(chunk.lat_index, mergeSize);
        const lngRange = this.calcIndexRange(chunk.lng_index, mergeSize);
        return {
            start: {lat: latRange.start, lng: lngRange.start},
            end: {lat: latRange.end, lng: lngRange.end}
        };
    }

    static calcIndexRange(index, mergeSize): { start: number, end: number } {
        const isNegative = index < 0;
        if (isNegative) {
            index = -(index + 1);
        }
        const chunkLatQuarter = Math.abs(Number(index) % mergeSize);
        let start = Number(index) - chunkLatQuarter;
        let end = Number(index) + ((mergeSize - 1) - chunkLatQuarter);
        if (isNegative) {
            start = -(start + 1);
            end = -(end + 1);
        }
        return {start, end}
    }
}
