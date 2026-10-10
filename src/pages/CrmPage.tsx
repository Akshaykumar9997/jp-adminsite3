import { useRef, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { Button } from '../components/ui'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import { loadCrm, type CrmKind } from '../lib/crm'
import type { CrmRow } from '../lib/database.types'
import { buildCrmWorkbook, cellText, filterCrm, leadColumns, leadStatuses, statusOf, supportColumns } from '../lib/crm-export.mjs'
import { useAsyncData } from '../hooks/useAsyncData'
import { EmptyState } from '../components/Feedback'

const loaders = { leads: () => loadCrm('leads'), customer_support: () => loadCrm('customer_support') }

export function CrmPage({ kind }: { kind: CrmKind }) {
  const title = kind === 'leads' ? 'Leads' : 'Customer Support'
  const columns = kind === 'leads' ? leadColumns : supportColumns
  const { data, loading, error, reload } = useAsyncData(loaders[kind], [kind])
  const rows = data ?? []
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)
  const exportLock = useRef(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const refresh = async () => { setPage(0); await reload() }
  let filtered: CrmRow[] = [], filterError = ''
  try { filtered = filterCrm(rows, { from, to, status }) }
  catch (reason) { filterError = (reason as Error).message }
  const statuses = [...leadStatuses, ...new Set(rows.map(statusOf).filter(value => value && !leadStatuses.includes(value)))]
  const exportExcel = async () => {
    if (exportLock.current) return
    exportLock.current = true
    setExporting(true)
    setExportError('')
    try {
      const bytes = await buildCrmWorkbook(kind, filtered)
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `${kind}_${from || 'all'}_${to || 'all'}_${status || 'all'}.xlsx`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : 'Could not export records.')
    } finally { exportLock.current = false; setExporting(false) }
  }
  const maxPage = Math.max(0, Math.ceil(filtered.length / 50) - 1)
  const currentPage = Math.min(page, maxPage)
  const hasFilters = Boolean(from || to || status)
  return (
    <div className="page cms-page crm-page">
      <div className="page-heading gallery-heading">
        <div><h1>{title}</h1><p>{kind === 'leads' ? 'Shared with the app. View and export leads; manage their status in the app.' : 'View and export customer support requests.'}</p></div>
        <div className="admin-actions">
          <Button onClick={() => void refresh()} disabled={loading || exporting}><RefreshCw size={18} /> Refresh</Button>
          <Button variant="primary" onClick={() => void exportExcel()} disabled={loading || exporting || !!filterError || !filtered.length}><Download size={18} /> {exporting ? 'Exporting…' : 'Export Excel'}</Button>
        </div>
      </div>
      <div className="crm-filters">
        <label>From date<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0) }} /></label>
        <label>To date<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0) }} /></label>
        {kind === 'leads' && <label>Status<select aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setPage(0) }}><option value="">All statuses</option>{statuses.map(value => <option key={value}>{value}</option>)}</select></label>}
        <span>{filtered.length} {filtered.length === 1 ? 'record' : 'records'} · Dates use your local time · Export includes all matching records</span>
      </div>
      {(filterError || exportError) && <p role="alert">{filterError || exportError}</p>}
      {loading ? <LoadingState label={`Loading ${title.toLowerCase()}…`} /> : error ? <ErrorState message={error} retry={() => void refresh()} /> :
        filtered.length ? <>
          <p>Scroll the table horizontally to see all details.</p>
          <div className="crm-table" tabIndex={0} role="region" aria-label={`${title} records`}>
            <table><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col">{label}{key === 'created_at' ? ' (local)' : ''}</th>)}</tr></thead>
              <tbody>{filtered.slice(currentPage * 50, currentPage * 50 + 50).map(row => <tr key={row.id}>{columns.map(([key]) => <td key={key}>{cellText(row, key) || '—'}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <div className="crm-pagination"><Button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {maxPage + 1}</span><Button disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}>Next</Button></div>
        </> : <EmptyState
          title={hasFilters ? 'No matching records' : kind === 'leads' ? 'No leads yet' : 'No support requests yet'}
          illustration={<img className="gallery-empty-illustration" src="/assets/crm-empty.svg" alt="" />}
          action={hasFilters ? <Button onClick={() => { setFrom(''); setTo(''); setStatus(''); setPage(0) }}>Clear filters</Button> : undefined}
        >
          {hasFilters ? 'Try a different date range or status, or clear your filters to see all records.' : kind === 'leads' ? 'New enquiries from the website and app will appear here, ready to review and export.' : 'Customer support requests will appear here when a client sends a request through the website.'}
        </EmptyState>}
    </div>
  )
}
