import { useNavigate } from 'react-router-dom'
import { useAsyncData } from '../hooks/useAsyncData'
import { loadCms } from '../lib/cms'
import { Button, MetricCard } from '../components/ui'
import { EmptyState } from '../components/Feedback'
import { ErrorState, LoadingState } from '../components/CmsDialog'
export function DashboardPage() {
  const navigate = useNavigate()
  const { data, error, loading, reload } = useAsyncData(loadCms)
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Overview</h1>
          <p>Room-based works and the content available on your website.</p>
        </div>
        <Button variant="primary" onClick={() => navigate('/rooms')}>
          Open rooms
        </Button>
      </div>
      {loading ? (
        <LoadingState label="Loading showcase overview…" />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : (
        data && (
          <>
            <section className="metrics">
              <MetricCard
                label="Works"
                value={String(data.works.length)}
                note="Room-based showcase"
                icon="▦"
              />
              <MetricCard
                label="Published works"
                value={String(
                  data.works.filter((w) => w.status === 'published').length,
                )}
                note="Visible on website"
                icon="✓"
              />
              <MetricCard
                label="Rooms"
                value={String(data.rooms.length)}
                note="Default and custom categories"
                icon="▤"
              />
              <MetricCard
                label="Media"
                value={String(data.assets.length)}
                note="Private storage"
                icon="▧"
              />
            </section>
            <section className="panel quick-actions">
              <h2>Manage your showcase</h2>
              <div className="dashboard-shortcuts">
                {[
                  ['/rooms', 'Rooms'],
                  ['/materials', 'Materials'],
                  ['/partners', 'Partners'],
                  ['/media', 'Media Library'],
                ].map(([path, label]) => (
                  <Button key={path} onClick={() => navigate(path)}>
                    {label} →
                  </Button>
                ))}
              </div>
            </section>
            {!data.works.length && (
              <EmptyState
                title="Your first work starts here"
                action={
                  <Button onClick={() => navigate('/rooms')}>Open rooms</Button>
                }
              >
                Add a title, room, location and media to start building the
                public showcase.
              </EmptyState>
            )}
          </>
        )
      )}
    </div>
  )
}
