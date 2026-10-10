import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import './visitor-logs.css'
import { useAsyncData } from '../hooks/useAsyncData'
import { UserError } from '../lib/feedback'
import { EmptyState } from '../components/Feedback'

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })

export function VisitorLogsPage() {
  const [phone, setPhone] = useState('')
  const [queryPhone, setQueryPhone] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  useEffect(() => {
    const timer = window.setTimeout(() => setQueryPhone(phone), 250)
    return () => window.clearTimeout(timer)
  }, [phone])
  const load = useMemo(() => async () => {
    const signal = AbortSignal.timeout(20_000)
    if (!supabase) throw new UserError('Supabase is not configured.')
    if (from && to && from > to) throw new UserError('From date must be before To date.')
    const { data: allowed, error: authError } = await supabase.rpc('is_admin').abortSignal(signal)
    if (authError || allowed !== true) throw new UserError('Active administrator access is required.')
    let query = supabase.schema('crm').from('visitor_activity').select('*', { count: 'exact' })
    let digits = queryPhone.replace(/\D/g, '').replace(/^00/, '')
    if (/^91[6-9]\d{9}$/.test(digits)) digits = digits.slice(2)
    if (queryPhone.trim()) {
      if (!/^\d{8,15}$/.test(digits)) throw new UserError('Enter the complete phone number to view its history.')
      query = query.eq('phone', digits)
    }
    if (from) query = query.gte('created_at', `${from}T00:00:00+05:30`)
    if (to) query = query.lt('created_at', new Date(new Date(`${to}T00:00:00+05:30`).getTime() + 86_400_000).toISOString())
    const result = await query.order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(page * 50, page * 50 + 49).abortSignal(signal)
    if (result.error) throw new UserError('Could not load visitor logs. Please try again.')
    return { rows: result.data, count: result.count ?? 0 }
  }, [queryPhone, from, to, page])
  const { data, loading, error, reload } = useAsyncData(load, [load], `visitor-logs:${JSON.stringify([queryPhone, from, to, page])}`)
  const rows = data?.rows ?? []
  const count = data?.count ?? 0
  return (
    <div className="page cms-page visitor-logs">
      <div className="page-heading gallery-heading">
        <div><h1>Visitor Logs</h1><p>Client site 2 welcome entries. Repeat attempts are matched by phone number only.</p></div>
        <Button onClick={() => void reload()} disabled={loading}><RefreshCw size={18} /> Refresh</Button>
      </div>
      <div className="crm-filters">
        <label>Phone number<input type="search" inputMode="tel" placeholder="Enter complete phone number" value={phone} onChange={e => { setPhone(e.target.value); setPage(0) }} /></label>
        <label>From date<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(0) }} /></label>
        <label>To date<input type="date" value={to} onChange={e => { setTo(e.target.value); setPage(0) }} /></label>
        <span>Dates and times shown in IST</span>
      </div>
      {loading ? <LoadingState label="Loading visitor logs…" /> : error ? <ErrorState message={error} retry={() => void reload()} /> : <>
        {count > 0 && <p>{count} {count === 1 ? 'entry' : 'entries'}</p>}
        {rows.length ? <div className="visitor-log-list">
          {rows.map(row => <article className="visitor-log" key={row.id}>
            <div className="visitor-log-header"><strong>{row.phone}</strong><span className={row.attempt > 1 ? 'visitor-attempt visitor-attempt-repeat' : 'visitor-attempt'}>Attempt {row.attempt}</span></div>
            <dl><div><dt>Name</dt><dd>{row.name}</dd></div><div><dt>District</dt><dd>{row.district}</dd></div><div><dt>Welcome form submitted</dt><dd><time dateTime={row.created_at}>{dateTime.format(new Date(row.created_at))}</time></dd></div></dl>
            <Button onClick={() => { setPhone(row.phone); setFrom(''); setTo(''); setPage(0) }}>View phone history</Button>
          </article>)}
        </div> : <EmptyState
          title={phone || from || to ? 'No matching visitor logs' : 'No visitor activity yet'}
          illustration={<img className="gallery-empty-illustration" src="/assets/crm-empty.svg" alt="" />}
          action={phone || from || to ? <Button onClick={() => { setPhone(''); setFrom(''); setTo(''); setPage(0) }}>Clear filters</Button> : undefined}
        >
          {phone || from || to ? 'Try a different phone number or date range, or clear your filters to see all visits.' : 'When visitors complete the welcome form, their phone number and visit history will appear here.'}
        </EmptyState>}
        {count > 0 && <div className="crm-pagination"><Button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page + 1} of {Math.max(1, Math.ceil(count / 50))}</span><Button disabled={(page + 1) * 50 >= count} onClick={() => setPage(value => value + 1)}>Next</Button></div>}
      </>}
    </div>
  )
}

