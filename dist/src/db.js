import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import dotenv from 'dotenv';
dotenv.config();
function getDirectPostgresUrl(url) {
    if (!url)
        return 'postgresql://postgres:postgres@localhost:5432/postgres';
    if (url.startsWith('prisma+postgres://')) {
        try {
            const parsedUrl = new URL(url);
            const apiKey = parsedUrl.searchParams.get('api_key');
            if (apiKey) {
                const decoded = JSON.parse(Buffer.from(apiKey, 'base64').toString('utf-8'));
                if (decoded.databaseUrl) {
                    return decoded.databaseUrl;
                }
            }
        }
        catch (e) {
            console.error('Failed to parse Prisma Postgres API key:', e);
        }
    }
    return url;
}
const connectionString = getDirectPostgresUrl(process.env.DATABASE_URL);
console.log(`[DB] Connecting to PostgreSQL at: ${connectionString.replace(/:[^:@]+@/, ':****@')}`);
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });
//# sourceMappingURL=db.js.map