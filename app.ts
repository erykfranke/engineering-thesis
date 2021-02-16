import * as express from 'express'
import * as bodyParser from 'body-parser'
import {HeatmapDatabase} from "./database-queries/heatmap-database";
import {calcChunkSize, indexToPosition, positionToIndex} from "./utils/converter";
import {ChunkModel} from "./models/chunk.model";
import {LatLngModel} from "./models/lat-lng.model";
import {GpsModel} from "./models/gps.model";
import {GlobalDatabase} from "./database-queries/global-database";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const port = 3000;
let LAST_GPS_ID = 0;

const heatmapDatabase = new HeatmapDatabase({
    user: 'postgres',
    host: 'localhost',
    database: 'heatmap',
    password: '12Lisar34',
    port: 5432,
});

const globalDataBase = new GlobalDatabase( {
    host: 'server437671.nazwa.pl',
    authorizationKey: 'Bearer xuyR6D1kgai15WstR01CwyBljcZt1J4StGsNMeoU'
})


app.listen(port, async () => {
    console.log(`Server is listening at http://localhost:${port}`);
    loadGps();
});

app.get('/', async (req: express.Request, res: express.Response) => {
    const [northEastLatIndex, northEastLngIndex] = positionToIndex(Number(req.query.northEastLat), Number(req.query.northEastLng));
    const [southWestLatIndex, southWestLngIndex] = positionToIndex(Number(req.query.southWestLat), Number(req.query.southWestLng));
    const hourRange = req.query.hourRange.toString().split(',');
    const dateRange = req.query.dateRange.toString().split(',');
    const disabilitiesIds = req.query.disabilities.toString().split(',');

    const chunks = await heatmapDatabase.getChunks(southWestLatIndex, northEastLatIndex, southWestLngIndex, northEastLngIndex, hourRange, dateRange, disabilitiesIds);
    const mergeSize = calcChunkSize(Number(req.query.zoom));

    if (mergeSize !== 1) {
        res.send(mergeChunks(chunks, mergeSize));
    } else {
        const preparedChunks = [];
        let maxCount = 0;
        chunks.forEach((chunk) => {
            const chunkPosition = indexToPosition(chunk.lat_index, chunk.lng_index);
            preparedChunks.push({
                southWest: chunkPosition.start,
                northEast: chunkPosition.end,
                count: chunk.count
            });
            if (maxCount < Number(chunk.count)) {
                maxCount = chunk.count;
            }
        });
        res.send({
            chunks: preparedChunks,
            maxCount
        });
    }
});

function mergeChunks(chunkBeforeMerge: ChunkModel[], mergeSize) {
    let maxCount = 0;
    const mergedChunks = [];
    while (chunkBeforeMerge.length !== 0) {
        const chunk = chunkBeforeMerge[0];
        const newChunkIndexesRange = calcNewMergedChunksIndexes(chunk, mergeSize);
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
        countSum /= Math.pow(mergeSize, 2);
        if (maxCount < countSum) {
            maxCount = countSum;
        }
        const chunkBounds = indexToPosition(
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

function calcNewMergedChunksIndexes(chunk: ChunkModel, mergeSize: number): { start: LatLngModel, end: LatLngModel } {
    const latRange = calcIndexRange(chunk.lat_index, mergeSize);
    const lngRange = calcIndexRange(chunk.lng_index, mergeSize);
    return {
        start: {lat: latRange.start, lng: lngRange.start},
        end: {lat: latRange.end, lng: lngRange.end}
    };
}

function calcIndexRange(index, mergeSize): { start: number, end: number } {
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

function loadGps() {
    setTimeout(async () => {
        let currentPage = 1, lastPage: number, response: GpsModel;
        do {
            try {
                response = await globalDataBase.getGps(currentPage++, LAST_GPS_ID);
                if (response.gps.data.length === 0) break;
                lastPage = response.gps.last_page;
                response.gps.data.forEach(data => {
                    data.disabilities.forEach(disability => {
                        const [latIndex, lngIndex] = positionToIndex(data.latitude, data.longitude);
                        // heatmapDatabase.addChunk(latIndex, lngIndex, new Date(data.created_at).getTime(), disability.id);
                    })
                })
            } catch (err) {
                console.log("ERROR", err);
            }
        } while (currentPage <= lastPage);
        if (response.gps.data.length !== 0) {
            LAST_GPS_ID = response.gps.data[response.gps.data.length - 1].id;
        }
        loadGps();
    }, 2000)
}
