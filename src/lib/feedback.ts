export type OperationState = 'idle' | 'pending' | 'success' | 'error'
export class UserError extends Error {}
export function friendlyError(error: unknown, action = 'complete this action') {
  console.error(`[Admin site] Unable to ${action}`, error)
  if (error instanceof UserError) return error.message
  const message = error instanceof Error ? error.message : String(error)
  if (!navigator.onLine || /network|fetch|connection/i.test(message))
    return 'Connection lost. Your changes were kept. Check your connection and retry.'
  if (/permission|not_authorized|42501|JWT|session/i.test(message))
    return 'Your access could not be verified. Sign in again and retry.'
  if (/duplicate|unique|23505/i.test(message))
    return 'This name is already in use. Choose a different name.'
  if (/foreign key|23503/i.test(message))
    return 'This item is still in use. Remove its associations before deleting it.'
  return `Unable to ${action}. Your changes were kept. Please retry.`
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length ||
    from === to
  )
    return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
