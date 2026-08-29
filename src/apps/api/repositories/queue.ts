import type { AppDb } from "@/db/client"

import { and, asc, desc, eq, gt } from "drizzle-orm"
import { queueItems } from "@/db/schema"

export type QueueKind = "need" | "want"
export type QueueStatus = "queued" | "purchased" | "cancelled"

export type NewQueueItemInput = {
  kind: QueueKind
  title: string
  priceMinor: number
  currency: string
  rank: number
  coolingUntil: string | null
  deadline: string | null
}

export type QueueItemPatch = {
  title?: string
  priceMinor?: number
  deadline?: string | null
  rank?: number
}

export const createQueueRepo = (db: AppDb) => ({
  listByAccount: (accountId: string, kind: QueueKind, status: QueueStatus = "queued") =>
    db.query.queueItems.findMany({
      where: and(
        eq(queueItems.accountId, accountId),
        eq(queueItems.kind, kind),
        eq(queueItems.status, status)
      ),
      orderBy: [asc(queueItems.rank)]
    }),

  findById: (accountId: string, id: number) =>
    db.query.queueItems.findFirst({
      where: and(eq(queueItems.id, id), eq(queueItems.accountId, accountId))
    }),

  // Rank of the bottom-most queued item, or null for an empty list. Used to
  // append a newly created item below everything else.
  lastRank: async (accountId: string, kind: QueueKind): Promise<number | null> => {
    const last = await db.query.queueItems.findFirst({
      where: and(
        eq(queueItems.accountId, accountId),
        eq(queueItems.kind, kind),
        eq(queueItems.status, "queued")
      ),
      orderBy: [desc(queueItems.rank)]
    })
    return last?.rank ?? null
  },

  create: async (accountId: string, input: NewQueueItemInput) => {
    const [created] = await db
      .insert(queueItems)
      .values({
        accountId,
        kind: input.kind,
        title: input.title,
        priceMinor: input.priceMinor,
        currency: input.currency,
        rank: input.rank,
        coolingUntil: input.coolingUntil,
        deadline: input.deadline
      })
      .returning()
    if (!created) throw new Error("QUEUE_ITEM_CREATE_FAILED")
    return created
  },

  update: (accountId: string, id: number, patch: QueueItemPatch) =>
    db
      .update(queueItems)
      .set(patch)
      .where(and(eq(queueItems.id, id), eq(queueItems.accountId, accountId))),

  remove: (accountId: string, id: number) =>
    db
      .update(queueItems)
      .set({ status: "cancelled" })
      .where(and(eq(queueItems.id, id), eq(queueItems.accountId, accountId))),

  // Not awaited here — composed into the purchase route's db.batch() alongside
  // the fund-ledger debit. status="queued" guard prevents double-purchasing.
  markPurchased: (accountId: string, id: number) =>
    db
      .update(queueItems)
      .set({ status: "purchased", purchasedAt: new Date().toISOString() })
      .where(
        and(
          eq(queueItems.id, id),
          eq(queueItems.accountId, accountId),
          eq(queueItems.status, "queued")
        )
      ),

  // The rank of `afterId` (or null for "top of list") and whatever queued
  // item currently follows it, so the caller can compute a midpoint rank.
  neighbors: async (
    accountId: string,
    kind: QueueKind,
    afterId: number | null
  ): Promise<{ prevRank: number | null; nextRank: number | null }> => {
    if (afterId === null) {
      const first = await db.query.queueItems.findFirst({
        where: and(
          eq(queueItems.accountId, accountId),
          eq(queueItems.kind, kind),
          eq(queueItems.status, "queued")
        ),
        orderBy: [asc(queueItems.rank)]
      })
      return { prevRank: null, nextRank: first?.rank ?? null }
    }

    const after = await db.query.queueItems.findFirst({
      where: and(
        eq(queueItems.id, afterId),
        eq(queueItems.accountId, accountId),
        eq(queueItems.kind, kind)
      )
    })
    if (!after) throw new Error("QUEUE_ITEM_NOT_FOUND")

    const next = await db.query.queueItems.findFirst({
      where: and(
        eq(queueItems.accountId, accountId),
        eq(queueItems.kind, kind),
        eq(queueItems.status, "queued"),
        gt(queueItems.rank, after.rank)
      ),
      orderBy: [asc(queueItems.rank)]
    })

    return { prevRank: after.rank, nextRank: next?.rank ?? null }
  },

  // Rewrite every queued item's rank as 1000, 2000, 3000, ... to restore
  // float-precision headroom once repeated midpoint inserts close the gaps.
  renormalize: async (accountId: string, kind: QueueKind) => {
    const items = await db.query.queueItems.findMany({
      where: and(
        eq(queueItems.accountId, accountId),
        eq(queueItems.kind, kind),
        eq(queueItems.status, "queued")
      ),
      orderBy: [asc(queueItems.rank)]
    })
    await Promise.all(
      items.map((item, index) =>
        db
          .update(queueItems)
          .set({ rank: (index + 1) * 1000 })
          .where(eq(queueItems.id, item.id))
      )
    )
  }
})

export type QueueRepo = ReturnType<typeof createQueueRepo>
