import * as express from 'express'
import * as bodyParser from 'body-parser'
import {HeatmapDatabase} from "./database-queries/heatmap-database";
import {positionToIndex} from "./utils/converter";
import {GpsModel} from "./models/gps.model";
import {GlobalDatabase} from "./database-queries/global-database";
import {chunkPreprocessing} from "./utils/chunk-processing";
import * as pg from 'pg';

require('dotenv').config()

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

const PORT = 3000;
const GPS_FREQUENCY_LOADING = 2000;
console.log(process.env.DB_HOST)
const heatmapDatabase = new HeatmapDatabase({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT),
    ssl: {
        rejectUnauthorized: false
    }
} as pg.PoolConfig);

const globalDataBase = new GlobalDatabase( {
    host: process.env.API_HOST,
    authorizationKey: `Bearer ${process.env.API_AUTHORIZATION}`
})


app.listen(PORT, async () => {
    console.log(`Server is listening at http://localhost:${PORT}`);
    loadGps();
});

app.get('/chunks', async (req: express.Request, res: express.Response) => {
    const {latIndex: northEastLatIndex, lngIndex: northEastLngIndex} = positionToIndex(Number(req.query.northEastLat), Number(req.query.northEastLng));
    const {latIndex: southWestLatIndex, lngIndex: southWestLngIndex} = positionToIndex(Number(req.query.southWestLat), Number(req.query.southWestLng));
    const hourRange = req.query.hourRange.toString().split(',');
    const dateRange = req.query.dateRange.toString().split(',');
    const disabilitiesIds =req.query.disabilities.toString().split(',') ;
    const chunks =  req.query.disabilities.length !== 0 ? await heatmapDatabase.getChunks(southWestLatIndex, northEastLatIndex, southWestLngIndex, northEastLngIndex, hourRange, dateRange, disabilitiesIds) : [];
    res.send(chunkPreprocessing(chunks, Number(req.query.zoom)))
});

function loadGps() {
    setTimeout(async () => {
        let currentPage = 1, lastPage: number, response: GpsModel;
        const lastGpsId = await heatmapDatabase.getVariableValue('last_gps_id');
        do {
            try {
                response = await globalDataBase.getGps(currentPage++, Number(lastGpsId));
                if (response.gps.data.length === 0) break;
                lastPage = response.gps.last_page;
                for (const data of response.gps.data) {
                    for (const disability of data.disabilities) {
                        const {latIndex, lngIndex} = positionToIndex(data.latitude, data.longitude);
                        await heatmapDatabase.addChunk(latIndex, lngIndex, new Date(data.created_at).getTime(), disability.id);
                    }
                }
            } catch (err) {
                console.log("ERROR", err);
            }
        } while (currentPage <= lastPage);
        if (response.gps.data.length !== 0) {
            await heatmapDatabase.updateVariableValue('last_gps_id', response.gps.data[response.gps.data.length - 1].id);
        }
        loadGps();
    }, GPS_FREQUENCY_LOADING)
}
