import {GpsModel} from "../models/gps.model";
import * as http from 'http';

export class GlobalDatabase {

    constructor(private config: {host: string, authorizationKey: string; }) {
    }

    public getGps(page: number, lastGpsId: number): Promise<GpsModel> {
        return new Promise((resolve, reject) => {
            try {
                const httpReq = http.request({
                    host: this.config.host,
                    path: encodeURI(`/api/gps?with-user-disability=1&page=${page}&pagination=1000&offset=${lastGpsId}`),
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'Authorization': this.config.authorizationKey
                    }
                }, function (response) {
                    let str = '';
                    response.on('data', function (chunk) {
                        str += chunk;
                    });
                    response.on('end', function () {
                        const json = JSON.parse(str);
                        resolve(json);
                    });
                });
                httpReq.end();
            } catch (err) {
                console.log(err)
                reject(err);
            }
        });
    }
}
