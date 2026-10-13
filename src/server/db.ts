import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type Prisma } from '~/generated/prisma/client'

export type Db = PrismaClient
export type Tx = Prisma.TransactionClient
export type DbOrTx = Db | Tx

/**
 * A client is created per request and disconnected when the request (or its
 * streamed body) finishes — Workers cannot reuse sockets across requests.
 */
export function createDb(connectionString: string): Db {
  const adapter = new PrismaPg({ connectionString, max: 5 })
  return new PrismaClient({ adapter })
}
