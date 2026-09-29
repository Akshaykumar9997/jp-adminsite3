import { Bell, Building2, Globe2, Image, RotateCcw, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '../components/ui'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import { useAsyncData } from '../hooks/useAsyncData'
import { getSettings, messageFrom, saveSettings } from '../lib/showcase'
import type { Json } from '../lib/database.types'

type SettingsForm = {
  workspaceName: string
  adminName: string
  locale: string
  timezone: string
  defaultVisibility: string
  reviewBeforePublish: boolean
  includeDraftsInPreview: boolean
  activityDigest: boolean
  mediaAlerts: boolean
  optimizeImages: boolean
  requireAltText: boolean
}

const initialSettings: SettingsForm = {
  workspaceName: 'JP Aluminium Interiors',
  adminName: 'Vikram Patel',
  locale: 'English (India)',
  timezone: 'Asia/Kolkata',
  defaultVisibility: 'Draft',
  reviewBeforePublish: true,
  includeDraftsInPreview: false,
  activityDigest: true,
  mediaAlerts: true,
  optimizeImages: true,
  requireAltText: true,
}

function Toggle({ checked, label, description, onChange }: { checked: boolean; label: string; description: string; onChange: (checked: boolean) => void }) {
  return (
    <div className="setting-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <button type="button" className={`toggle ${checked ? 'toggle--on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}><i /></button>
    </div>
  )
}

export function SettingsPage() {
  const { data, error, loading, reload } = useAsyncData(() => getSettings('workspace', initialSettings as unknown as Json), [])
  const [saved, setSaved] = useState(initialSettings)
  const [draft, setDraft] = useState(initialSettings)
  const [notice, setNotice] = useState('')
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft)
  useEffect(() => { if (data) { const settings = data.value as unknown as SettingsForm; setSaved(settings); setDraft(settings) } }, [data])
  const update = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setNotice('')
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    setNotice('')
    try {
      await saveSettings('workspace', draft as unknown as Json)
      setSaved(draft)
      setNotice('Settings saved.')
      await reload()
    } catch (reason) {
      setNotice(messageFrom(reason))
    }
  }

  const cancel = () => {
    setDraft(saved)
    setNotice('Changes discarded.')
  }

  if (error) return <div className="page settings-page"><ErrorState message={error} retry={() => void reload()} /></div>
  if (loading) return <div className="page settings-page"><LoadingState label="Loading CMS settings…" /></div>

  return (
    <form className="page settings-page" onSubmit={save}>
      <div className="page-heading">
        <div><span className="eyebrow">Workspace administration</span><h1>Settings</h1><p>Manage CMS defaults and editorial preferences.</p></div>
        <div className="page-heading__actions">
          <Button type="button" icon={<RotateCcw size={16} />} onClick={cancel} disabled={!dirty}>Cancel</Button>
          <Button type="submit" variant="primary" icon={<Save size={16} />} disabled={!dirty}>Save Changes</Button>
        </div>
      </div>

      {notice && <div className="settings-notice" role="status">{notice}</div>}

      <div className="settings-grid">
        <section className="settings-card">
          <header><span><Building2 size={18} /></span><div><h2>Workspace details</h2><p>Names and regional defaults used across the CMS.</p></div></header>
          <div className="settings-fields">
            <label className="field field--wide"><span>Workspace name</span><input value={draft.workspaceName} onChange={(event) => update('workspaceName', event.target.value)} /></label>
            <label className="field"><span>Administrator display name</span><input value={draft.adminName} onChange={(event) => update('adminName', event.target.value)} /></label>
            <label className="field"><span>Language</span><select value={draft.locale} onChange={(event) => update('locale', event.target.value)}><option>English (India)</option><option>English (United Kingdom)</option></select></label>
            <label className="field field--wide"><span>Timezone</span><select value={draft.timezone} onChange={(event) => update('timezone', event.target.value)}><option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option><option value="UTC">Coordinated Universal Time (UTC)</option></select></label>
          </div>
        </section>

        <section className="settings-card">
          <header><span><Globe2 size={18} /></span><div><h2>Publishing defaults</h2><p>Choose how new content begins its editorial workflow.</p></div></header>
          <div className="settings-fields">
            <label className="field field--wide"><span>Default project visibility</span><select value={draft.defaultVisibility} onChange={(event) => update('defaultVisibility', event.target.value)}><option>Draft</option><option>Published</option></select><small>Applied when a new project is created.</small></label>
          </div>
          <div className="settings-list">
            <Toggle checked={draft.reviewBeforePublish} label="Confirm before publishing" description="Ask for confirmation before content becomes public." onChange={(value) => update('reviewBeforePublish', value)} />
            <Toggle checked={draft.includeDraftsInPreview} label="Include drafts in preview" description="Allow draft projects to appear in CMS preview mode." onChange={(value) => update('includeDraftsInPreview', value)} />
          </div>
        </section>

        <section className="settings-card">
          <header><span><Bell size={18} /></span><div><h2>Notifications</h2><p>Control which CMS events surface to administrators.</p></div></header>
          <div className="settings-list settings-list--flush">
            <Toggle checked={draft.activityDigest} label="Content activity summary" description="Show a summary of recent editorial changes." onChange={(value) => update('activityDigest', value)} />
            <Toggle checked={draft.mediaAlerts} label="Media processing alerts" description="Show alerts when an upload needs attention." onChange={(value) => update('mediaAlerts', value)} />
          </div>
        </section>

        <section className="settings-card">
          <header><span><Image size={18} /></span><div><h2>Media preferences</h2><p>Set default checks for portfolio imagery.</p></div></header>
          <div className="settings-list settings-list--flush">
            <Toggle checked={draft.optimizeImages} label="Optimize images on upload" description="Prepare uploaded images for responsive display." onChange={(value) => update('optimizeImages', value)} />
            <Toggle checked={draft.requireAltText} label="Require alternative text" description="Flag images without an accessibility description." onChange={(value) => update('requireAltText', value)} />
          </div>
        </section>
      </div>

      <div className="settings-footer">
        <span>{dirty ? 'You have unsaved changes.' : 'All preview changes are saved.'}</span>
        <div><Button type="button" onClick={cancel} disabled={!dirty}>Cancel</Button><Button type="submit" variant="primary" disabled={!dirty}>Save Changes</Button></div>
      </div>
      <section className="settings-card audit-card"><header><span><RotateCcw size={18} /></span><div><h2>Recent audit activity</h2><p>Database-enforced administrative changes.</p></div></header><div className="history-list">{data?.audit.slice(0, 10).map((event) => <p key={event.id}><strong>{event.action.toUpperCase()} · {event.table_name}</strong><span>{new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.occurred_at))} · {event.record_id ?? 'settings record'}</span></p>)}</div></section>
    </form>
  )
}
