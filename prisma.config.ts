import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// The Prisma CLI (migrate/studio) uses the DIRECT (unpooled) Neon connection.
// The Worker uses the pooled DATABASE_URL through @prisma/adapter-pg.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
})
