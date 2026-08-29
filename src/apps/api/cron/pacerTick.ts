import type { AppDb } from "@/db/client"
import { createRepositories } from "@api/repositories"
import type { ApiRepositories } from "@api/repositories"
import type { CloudflareBindings } from "@/apps/env"
import { notifyLinkedChats } from "@api/lib/telegram-notify"
import { formatMoney } from "@/shared/money"
import {
  localDateString,
  addDays,
  startOfLocalDay,
  daysBetweenLocalDates,
  parseDbTimestamp
} from "@/shared/datetime"
import { poolMinor, allowanceForDay, sweepMinor, daysToAfford } from "@/shared/allowance"

const ACCOUNTS_PAGE_SIZE = 100
const MORNING_PUSH_HOUR = 8

// Every account with an open cycle, once per tick: close out yesterday (if not
// already closed) and send the once-daily morning push (if it's that account's
// local 8am and it hasn't been sent today). Both are guarded by a composite-PK
// idempotency table, so re-running this on retry or overlap is a safe no-op.
export const runPacerTick = async (
  db: AppDb,
  env: CloudflareBindings,
  now: Date = new Date()
): Promise<void> => {
  const repos = createRepositories(db)

  let cursor: string | null = null
  for (;;) {
    const accountIds = await repos.cycles.listAccountsWithOpenCycle(cursor, ACCOUNTS_PAGE_SIZE)
    if (accountIds.length === 0) break

    for (const accountId of accountIds) {
      await processAccount(db, repos, env, accountId, now)
    }

    if (accountIds.length < ACCOUNTS_PAGE_SIZE) break
    cursor = accountIds[accountIds.length - 1] ?? null
  }
}

const processAccount = async (
  db: AppDb,
  repos: ApiRepositories,
  env: CloudflareBindings,
  accountId: string,
  now: Date
): Promise<void> => {
  const account = await repos.accounts.findById(accountId)
  if (!account) return

  await closeYesterdayIfDue(db, repos, accountId, account.timezone, now)
  await sendMorningPushIfDue(db, repos, env.BOT_TOKEN, accountId, account.timezone, now)
}

const closeYesterdayIfDue = async (
  db: AppDb,
  repos: ApiRepositories,
  accountId: string,
  timezone: string,
  now: Date
): Promise<void> => {
  const today = localDateString(timezone, now)
  const yesterday = addDays(timezone, today, -1)

  // Idempotency guard: checked before assembling the batch, so a retried tick
  // that finds the row already there never re-inserts the ledger rows either.
  if (await repos.pacer.findDayClose(accountId, yesterday)) return

  const cycle = await repos.cycles.findOpenForDate(accountId, startOfLocalDay(timezone, yesterday))
  if (!cycle) return

  const allocations = await repos.cycles.listAllocations(cycle.id)
  const pool = poolMinor(
    cycle.grossMinor,
    allocations.map((a) => a.amountMinor)
  )

  const { spentMinor: spentBeforeYesterday, sweptMinor: sweptBeforeYesterday } =
    await repos.pacer.sumForCycleBefore(cycle.id, yesterday)

  // Half-open [yesterday's midnight, today's midnight) — contiguous with day
  // boundaries elsewhere, no Date round-trip needed.
  const spentYesterdayMinor = await repos.transactions.getCategoryExpenseInRange(
    accountId,
    null,
    startOfLocalDay(timezone, yesterday),
    startOfLocalDay(timezone, today)
  )

  const cycleEndLocalDate = localDateString(timezone, parseDbTimestamp(cycle.endAt))
  const daysRemainingInclusive = daysBetweenLocalDates(yesterday, cycleEndLocalDate)

  const allowanceMinor = allowanceForDay({
    poolMinor: pool,
    spentBeforeTodayMinor: spentBeforeYesterday,
    sweptBeforeTodayMinor: sweptBeforeYesterday,
    daysRemainingInclusive
  })
  const sweptMinor = sweepMinor({
    allowanceMinor,
    spentTodayMinor: spentYesterdayMinor,
    sweepPct: cycle.sweepPct
  })

  // Needs-reserve allocations fund the reserve once, on the cycle's first day.
  const cycleStartLocalDate = localDateString(timezone, parseDbTimestamp(cycle.startAt))
  const reserveCreditMinor =
    cycleStartLocalDate === yesterday
      ? allocations.filter((a) => a.kind === "needs_reserve").reduce((sum, a) => sum + a.amountMinor, 0)
      : 0

  const optional = []
  if (sweptMinor > 0) {
    optional.push(repos.pacer.insertSweep({ accountId, deltaMinor: sweptMinor, dayCloseLocalDate: yesterday }))
  }
  if (reserveCreditMinor > 0) {
    optional.push(
      repos.pacer.insertReserveCredit({ accountId, deltaMinor: reserveCreditMinor, dayCloseLocalDate: yesterday })
    )
  }

  await db.batch([
    repos.pacer.insertDayClose({
      accountId,
      localDate: yesterday,
      cycleId: cycle.id,
      allowanceMinor,
      spentMinor: spentYesterdayMinor,
      sweptMinor
    }),
    ...optional
  ])
}

const localHour = (timezone: string, now: Date): number =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hour12: false
    }).format(now)
  ) % 24

const sendMorningPushIfDue = async (
  db: AppDb,
  repos: ApiRepositories,
  botToken: string | undefined,
  accountId: string,
  timezone: string,
  now: Date
): Promise<void> => {
  if (localHour(timezone, now) !== MORNING_PUSH_HOUR) return

  const today = localDateString(timezone, now)
  if (await repos.pacer.findMorningPush(accountId, today)) return

  const account = await repos.accounts.findById(accountId)
  const currency = account?.defaultCurrency ?? "USD"

  const cycle = await repos.cycles.findOpenForDate(accountId, startOfLocalDay(timezone, today))
  if (!cycle) return

  const allocations = await repos.cycles.listAllocations(cycle.id)
  const pool = poolMinor(
    cycle.grossMinor,
    allocations.map((a) => a.amountMinor)
  )
  const { spentMinor: spentBeforeToday, sweptMinor: sweptBeforeToday } =
    await repos.pacer.sumForCycleBefore(cycle.id, today)
  const cycleEndLocalDate = localDateString(timezone, parseDbTimestamp(cycle.endAt))
  const daysRemainingInclusive = daysBetweenLocalDates(today, cycleEndLocalDate)
  const allowanceMinor = allowanceForDay({
    poolMinor: pool,
    spentBeforeTodayMinor: spentBeforeToday,
    sweptBeforeTodayMinor: sweptBeforeToday,
    daysRemainingInclusive
  })

  const wantQueue = await repos.queue.listByAccount(accountId, "want")
  const nearest = wantQueue[0]
  let nearestLine = ""
  if (nearest) {
    const wantFundMinor = await repos.pacer.balance(accountId, "want_fund")
    const projectedDailySweepMinor = sweepMinor({
      allowanceMinor,
      spentTodayMinor: 0,
      sweepPct: cycle.sweepPct
    })
    const days = daysToAfford({
      priceMinor: nearest.priceMinor,
      currentBalanceMinor: wantFundMinor,
      projectedDailySweepMinor
    })
    nearestLine =
      days === null
        ? `\n\n${nearest.title} is next up — not affordable at the current pace yet.`
        : days === 0
          ? `\n\n${nearest.title} is next up — you can afford it today.`
          : `\n\n${nearest.title} is next up — about ${days} day${days === 1 ? "" : "s"} away.`
  }

  const text = `☀️ Today's number: ${formatMoney(allowanceMinor, currency)}${nearestLine}`
  await notifyLinkedChats(botToken, db, accountId, text)
  await repos.pacer.insertMorningPush(accountId, today)
}
