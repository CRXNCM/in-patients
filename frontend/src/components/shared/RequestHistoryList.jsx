import { formatDateTime } from '@/lib/utils'

export function RequestHistoryList({ history = [] }) {
  if (!history.length) {
    return <p className="text-sm text-muted-foreground">No processing history yet.</p>
  }

  return (
    <ol className="space-y-3">
      {history.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className="rounded-lg border bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium capitalize">{entry.action}</p>
          <p className="text-xs text-muted-foreground">
            {entry.by} · {formatDateTime(entry.at)}
          </p>
          {entry.note ? <p className="mt-1 text-sm">{entry.note}</p> : null}
        </li>
      ))}
    </ol>
  )
}
