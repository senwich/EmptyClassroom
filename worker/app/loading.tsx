export default function Loading() {
  return (
    <main className="app-shell app-shell-loading" aria-busy="true">
      <div className="logo-mark logo-mark-placeholder">空</div>
      <div className="title-skeleton shimmer-block" />
      <div className="toolbar-card loading-card">
        <div className="toolbar-grid">
          <div className="button-row">
            <div className="mini-skeleton shimmer-block" />
            <div className="mini-skeleton shimmer-block" />
            <div className="switch-skeleton shimmer-block" />
          </div>
          <div className="wide-skeleton shimmer-block" />
          <div className="wide-skeleton shimmer-block" />
          <div className="time-skeleton-grid">
            {Array.from({ length: 9 }, (_, index) => <div className="time-skeleton shimmer-block" key={index} />)}
          </div>
        </div>
      </div>
      <div className="result-card loading-card table-skeleton">
        {Array.from({ length: 7 }, (_, index) => <div className="table-row-skeleton shimmer-block" key={index} />)}
      </div>
    </main>
  );
}
