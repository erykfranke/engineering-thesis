import {PositionChunkModel} from './position-chunk.model';

export interface PreprocessedChunkModel {
    chunks: PositionChunkModel[];
    maxCount: number;
}
