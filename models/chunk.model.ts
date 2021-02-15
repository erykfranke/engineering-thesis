export interface ChunkModel {
    id: number;
    lat_index: number;
    lng_index: number;
    quarter: '00' | '01' | '10' | '11';
    count: number;
}
