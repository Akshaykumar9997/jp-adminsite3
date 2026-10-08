import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ExcelJS from 'exceljs'
import { PGlite } from '@electric-sql/pglite'
import { filterCrm, buildCrmWorkbook, leadStatuses } from '../src/lib/crm-export.mjs'

const rows = [
  { id: 1, created_at: new Date(2026, 9, 8, 0, 0).toISOString(), name: '=HYPERLINK("bad")', status: 'Pending', contact: '0123456789' },
  { id: 2, created_at: new Date(2026, 9, 8, 23, 59).toISOString(), name: 'Late', status: 'APPROVED' },
  { id: 3, created_at: new Date(2026, 9, 9, 0, 0).toISOString(), name: 'Next day', status: 'LOST' },
]
assert.deepEqual(filterCrm(rows, { from: '2026-10-08', to: '2026-10-08' }).map(r => r.id), [1, 2])
assert.equal(filterCrm(rows, { status: 'PENDING' }).length, 1)
assert.throws(() => filterCrm(rows, { from: '2026-10-09', to: '2026-10-08' }))
assert.deepEqual(leadStatuses, ['PENDING', 'MEASUREMENT', 'APPROVED', 'REJECTED', 'CONVERTED'])
const book = new ExcelJS.Workbook()
await book.xlsx.load(await buildCrmWorkbook('leads', rows))
const sheet = book.getWorksheet('Leads Export')
assert.equal(sheet.getRow(1).getCell(1).value, 'Status')
assert.equal(sheet.getRow(3).getCell(2).value, '=HYPERLINK("bad")')
assert.equal(sheet.getRow(3).getCell(2).type, ExcelJS.ValueType.String)
assert.equal(sheet.getRow(3).getCell(3).value, '0123456789')
assert.ok(sheet.getSheetValues().flat(2).includes('OTHER'))
const support = new ExcelJS.Workbook()
await support.xlsx.load(await buildCrmWorkbook('customer_support', [{ ...rows[0], phone: '+971 50 123 4567', consent: true, message: 'Line one\nLine two' }]))
assert.equal(support.getWorksheet(1).getRow(2).getCell(9).value, 'Yes')
assert.equal(support.getWorksheet(1).getRow(2).getCell(8).value, 'Line one\nLine two')
await assert.rejects(buildCrmWorkbook('leads', []))

const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema crm; grant usage on schema crm to anon, authenticated, service_role;
    create function public.is_admin() returns boolean language sql as $$ select current_setting('test.admin', true) = 'yes' $$;`)
  await db.exec(await readFile('supabase/migrations/20261008065515_customer_support.sql', 'utf8'))
  const insert = `insert into crm.customer_support(name,phone,city,reason,preferred_contact,message,consent) values ('Test User','9876543210','Dubai','Other','Phone call','Test support details',true)`
  await db.exec('set role service_role')
  await db.exec(insert)
  await db.exec('reset role; set role anon')
  await assert.rejects(db.query('select * from crm.customer_support'), /permission denied/)
  await assert.rejects(db.exec(insert), /permission denied/)
  await db.exec("reset role; set role authenticated; set test.admin='no'")
  assert.equal((await db.query('select * from crm.customer_support')).rows.length, 0)
  await db.exec("set test.admin='yes'")
  assert.equal((await db.query('select * from crm.customer_support')).rows.length, 1)
  for (const sql of [insert, "update crm.customer_support set name='Changed'", 'delete from crm.customer_support']) await assert.rejects(db.exec(sql), /permission denied/)
  await db.exec('reset role')
  await assert.rejects(db.exec(insert.replace("'Phone call'", "'Email'")), /email_contact_requires_email/)
} finally { await db.close() }
console.log('PASS CRM XLSX round trip, local date boundaries, statuses, text/formula safety and support SELECT-only admin RLS')
