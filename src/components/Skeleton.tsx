/**
 * Grey shapes that stand where a screen's parts will be while its records load, so the page
 * does not jump when they arrive. A screen reader hears "Loading" once.
 */
export function PageSkeleton({ narrow }: { narrow?: boolean }) {
  return (
    <main className={narrow ? 'page narrow' : 'page'}>
      <span className="sr-only" role="status">Loading</span>
      <div className="sk" style={{ width: 'min(320px, 70%)', height: 30 }} />
      <div className="sk" style={{ height: 76 }} />
      <div className="sk" style={{ height: 220 }} />
      <div className="sk" style={{ height: 140 }} />
    </main>
  )
}

/** Rows of a list that is still loading. */
export function RowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <span className="sr-only" role="status">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="sk-row" key={i}>
          <div className="sk" style={{ width: `${34 + ((i * 13) % 22)}%` }} />
          <div className="sk" style={{ width: '18%' }} />
        </div>
      ))}
    </div>
  )
}
