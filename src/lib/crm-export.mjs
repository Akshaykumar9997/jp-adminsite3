export const leadStatuses = ['PENDING', 'MEASUREMENT', 'APPROVED', 'REJECTED', 'CONVERTED']
export const leadColumns = [
  ['status', 'Status'], ['name', 'Name'], ['contact', 'Contact'], ['email', 'Email'],
  ['address', 'Address'], ['comment', 'Comment'], ['created_at', 'Date'],
  ['id', 'ID'], ['referral_source', 'Referral Source'], ['referral_details', 'Referral Details'],
  ['latitude', 'Latitude'], ['longitude', 'Longitude'], ['user_id', 'User ID'],
]
export const supportColumns = [
  ['name', 'Name'], ['phone', 'Phone'], ['city', 'City / Emirate'], ['email', 'Email'],
  ['reference', 'Project / Invoice Reference'], ['reason', 'Topic'],
  ['preferred_contact', 'Preferred Contact'], ['message', 'Message'], ['consent', 'Contact Consent'],
  ['created_at', 'Date'], ['id', 'ID'],
]
export const statusOf = row => String(row.status ?? '').trim().toUpperCase()
export function filterCrm(rows, { from = '', to = '', status = '' } = {}) {
  if (from && to && from > to) throw new Error('From date must be on or before To date.')
  const start = from ? new Date(from + 'T00:00:00').getTime() : -Infinity
  const end = to ? new Date(to + 'T00:00:00') : null
  if (end) end.setDate(end.getDate() + 1)
  if (Number.isNaN(start) || (end && Number.isNaN(end.getTime()))) throw new Error('Choose valid dates.')
  return rows.filter(row => {
    const time = new Date(row.created_at).getTime()
    return (!from && !to || time >= start && time < (end?.getTime() ?? Infinity)) &&
      (!status || statusOf(row) === status)
  })
}
export function cellText(row, key) {
  if (key === 'created_at' && row[key]) {
    const date = new Date(row[key])
    return Number.isNaN(date.getTime()) ? String(row[key]) :
      date.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '')
  }
  if (key === 'status') return statusOf(row)
  if (key === 'consent') return row[key] === true ? 'Yes' : 'No'
  return row[key] == null ? '' : String(row[key])
}
export async function buildCrmWorkbook(kind, rows) {
  if (!rows.length) throw new Error('No records match these filters.')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const columns = kind === 'leads' ? leadColumns : supportColumns
  const sheet = workbook.addWorksheet(kind === 'leads' ? 'Leads Export' : 'Customer Support')
  sheet.addRow(columns.map(([, label]) => label))
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF6347' } }
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.columns.forEach((column, index) => {
    column.width = ['message', 'address', 'comment', 'referral_details'].includes(columns[index][0]) ? 45 : 25
  })
  const add = row => {
    // Plain strings preserve phone numbers and prevent customer text becoming formulas.
    const added = sheet.addRow(columns.map(([key]) => cellText(row, key)))
    added.alignment = { vertical: 'top', wrapText: true }
  }
  if (kind === 'leads') {
    for (const group of [...leadStatuses, 'OTHER']) {
      const members = rows.filter(row => group === 'OTHER' ? !leadStatuses.includes(statusOf(row)) : statusOf(row) === group)
      if (!members.length) continue
      const heading = sheet.addRow([group])
      heading.font = { bold: true }
      heading.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
      members.forEach(add)
      sheet.addRow([])
    }
  } else rows.forEach(add)
  return workbook.xlsx.writeBuffer()
}
