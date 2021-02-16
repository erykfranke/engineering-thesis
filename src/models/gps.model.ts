export interface GpsModel {
    gps: {
        data: {
            id: number;
            latitude: number;
            longitude: number;
            created_at: string;
            disabilities: {
                id: number;
                name: number;
                slug: number;
            } [];
        } [];
        current_page: number;
        last_page: number;
        total: number;
    }
}
