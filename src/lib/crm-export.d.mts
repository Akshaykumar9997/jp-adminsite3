import type { CrmRow } from './database.types'
export const leadStatuses: string[]
export const leadColumns: [string, string][]
export const supportColumns: [string, string][]
export function statusOf(row: CrmRow): string
export function cellText(row: CrmRow, key: string): string
export function filterCrm(rows: CrmRow[], filters?: {from?: string; to?: string; status?: string}): CrmRow[]
export function buildCrmWorkbook(kind: string, rows: CrmRow[]): Promise<ArrayBuffer>
