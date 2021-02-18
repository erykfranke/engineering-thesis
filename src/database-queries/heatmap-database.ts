import * as moment from 'moment';
import * as pg from 'pg';
import {ChunkModel} from "../models/chunk.model";
import {TimeChunkModel} from "../models/time-chunk.model";
import {TimeChunksDisabilitiesModel} from "../models/time-chunks-disabilities.model";

export class HeatmapDatabase {

    private pool: pg.Pool;
    constructor(config: pg.PoolConfig) {
        this.pool = new pg.Pool(config);
    }

    async getChunks(southWestLatIndex: number, northEastLatIndex: number, southWestLngIndex: number,
                    northEastLngIndex: number, hourRange: string[], dateRange: string[], disabilitiesIds: string[]
    ): Promise<ChunkModel[]> {
        let response;
        try {
            response = await this.pool.query(`
                SELECT c.id, c.lat_index, c.lng_index, SUM(tcd.count) as count
                FROM chunk as c, time_chunk as tc, time_chunk_disabilities as tcd
                WHERE (c.lat_index BETWEEN ${southWestLatIndex - 1} AND ${northEastLatIndex + 1})
                AND (c.lng_index BETWEEN ${southWestLngIndex - 1} AND ${northEastLngIndex + 1})
                AND (tc.hour BETWEEN B'${Number(hourRange[0]).toString(2).padStart(5, '0')}' AND B'${Number(hourRange[1]).toString(2).padStart(5, '0')}')
                AND (tc.date BETWEEN '${moment(Number(dateRange[0])).format('YYYY-MM-DD')}' AND '${moment(Number(dateRange[1])).format('YYYY-MM-DD')}')
                ${disabilitiesIds.length !== 0 ? `AND (tcd.disability_id = ${disabilitiesIds.join(' OR tcd.disability_id = ')})` : ``}
                AND c.id = tc.chunk_id
                AND tc.id = tcd.time_chunk_id
                GROUP BY c.id`
            );
            return response.rows;
        } catch (err) {
            console.log(err);
        }
    }

    async addChunk(chunkLatIndex: number, chunkLngIndex: number, timestamp: number, disabilityId: number): Promise<void> {
        let chunkId = await this.getChunkId(chunkLatIndex, chunkLngIndex);
        if (chunkId === null) {
            chunkId = await this.insertChunk(chunkLatIndex, chunkLngIndex);
            const timeChunkId = await this.insertTimeChunk(chunkId, timestamp);
            await this.insertTimeChunksKDisabilities(timeChunkId, disabilityId);
        } else {
            const timeChunk = await this.getNewestTimeChunk(chunkId);
            if (moment(timeChunk.date).format('YYYY-MM-DD') === moment(timestamp).format('YYYY-MM-DD')
                && moment(timestamp).hour().toString(2).padStart(5, '0') === timeChunk.hour
            ) {
                const timeChunksDisabilities = await this.getTimeChunksKDisabilities(timeChunk.id, disabilityId);
                if (timeChunksDisabilities) {
                    await this.updateTimeChunksDisabilities(timeChunksDisabilities.id, ++timeChunksDisabilities.count);
                } else {
                    await this.insertTimeChunksKDisabilities(timeChunk.id, disabilityId);
                }
            } else {
                const timeChunkId = await this.insertTimeChunk(chunkId, timestamp);
                await this.insertTimeChunksKDisabilities(timeChunk.id, timeChunkId);
            }
        }
    }

    async getChunkId(chunkLatIndex: number, chunkLngIndex: number): Promise<number> {
        let response;
        try {
            response = await this.pool.query(`
                SELECT id
                FROM chunk
                WHERE lat_index=${chunkLatIndex} AND lng_index=${chunkLngIndex}`
            );
            return response.rows.length === 0 ? null : response.rows[0].id;
        } catch (err) {
            console.log(err);
        }
    }

    async insertChunk(chunkLatIndex: number, chunkLngIndex: number): Promise<number> {
        let response;
        try {
            response = await this.pool.query(`
                INSERT INTO Chunk (lat_index, lng_index)
                VALUES (${chunkLatIndex}, ${chunkLngIndex})
                RETURNING id`
            );
            return response.rows.length === 0 ? null : response.rows[0].id;
        } catch (err) {
            console.log(err);
        }
    }

    async insertTimeChunk(chunkId: number, date: number): Promise<number> {
        let response;
        try {
            response = await this.pool.query(`
                INSERT INTO time_chunk (chunk_id, date, hour)
                VALUES (${chunkId}, '${moment(Number(date)).format('YYYY-MM-DD')}', B'${moment(Number(date)).hour().toString(2).padStart(5, '0')}')
                RETURNING id`
            );
            return response.rows.length === 0 ? null : response.rows[0].id;
        } catch (err) {
            console.log(err);
        }
    }

    async getNewestTimeChunk(chunkId: number): Promise<TimeChunkModel> {
        let response;
        try {
            response = await this.pool.query(`
                SELECT *
                FROM time_chunk
                WHERE chunk_id=${chunkId}
                ORDER BY date, hour
                DESC LIMIT 1
            `);
            return response.rows.length === 0 ? null : response.rows[0];
        } catch (err) {
            console.log(err);
        }
    }

    async insertTimeChunksKDisabilities(timeChunkId: number, disabilityId: number, count = 1): Promise<number> {
        let response;
        try {
            response = await this.pool.query(`
                INSERT INTO time_chunk_disabilities (time_chunk_id, disability_id, count)
                VALUES (${timeChunkId}, '${disabilityId}', ${count})
                RETURNING id`
            );
            return response.rows.length === 0 ? null : response.rows[0].id;
        } catch (err) {
            console.log(err);
        }
    }

    async getTimeChunksKDisabilities(timeChunkId: number, disabilityId: number): Promise<TimeChunksDisabilitiesModel> {
        let response;
        try {
            response = await this.pool.query(`
                SELECT * FROM time_chunk_disabilities
                WHERE time_chunk_id=${timeChunkId}
                AND disability_id='${disabilityId}'
            `);
            return response.rows.length === 0 ? null : response.rows[0];
        } catch (err) {
            console.log(err);
        }
    }

    async updateTimeChunksDisabilities(id: number, incrementedCount: number): Promise<number> {
        let response;
        try {
            response = await this.pool.query(`
                UPDATE time_chunk_disabilities
                SET count=${incrementedCount}
                WHERE id=${id}
            `);
            return response.rows.length === 0 ? null : response.rows[0].id;
        } catch (err) {
            console.log(err);
        }
    }

    async updateVariableValue(name: string, gpsId: number): Promise<void> {
        try {
            await this.pool.query(`
                UPDATE variables
                SET value='${gpsId}'
                WHERE name='${name}'
            `)
        } catch (err) {
            console.log(err);
        }
    }

    async getVariableValue(name: string): Promise<string> {
        let response;
        try {
            response = await this.pool.query(`
                SELECT value
                FROM variables
                WHERE name='${name}'
            `);
            return response.rows[0].value;
        }  catch (err) {
            console.log(err);
        }
    }

    async InsertVariable(name: string, value: string): Promise<void> {
        try {
            await this.pool.query(`
                INSERT INTO variables (name, value)
                VALUES ('${name}', '${value}')
            `);
        } catch (err) {
            console.log(err);
        }
    }
}
