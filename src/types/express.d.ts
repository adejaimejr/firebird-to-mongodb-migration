import { Request as ExpressRequest, Response as ExpressResponse } from 'express';

declare global {
    namespace Express {
        interface Request extends ExpressRequest {}
        interface Response extends ExpressResponse {}
    }
}

export interface ImportRequest {
    gbkPath: string;
    mongoCollection: string;
}

export interface ProgressResponse {
    status: string;
    details: any;
}
