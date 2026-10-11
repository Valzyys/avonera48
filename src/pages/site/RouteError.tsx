import { isRouteErrorResponse, Link, useRouteError } from "react-router";

/** Last-resort boundary for render errors and unknown route failures. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : "Unknown error";
  const chunkFailed = /dynamically imported module|Loading chunk/i.test(message);
  return (
    <main className="container not-found" id="main">
      <p className="t-label">Something broke</p>
      <h1 className="t-h1">{chunkFailed ? "A new version is available." : "This page failed to render."}</h1>
      <p className="t-lead">{chunkFailed ? "Reload to fetch the latest build." : message}</p>
      <p style={{ display: "flex", gap: 12 }}>
        <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>
          <span className="btn__label">Reload</span>
        </button>
        <Link to="/" className="btn btn--secondary btn--md">
          <span className="btn__label">Back to home</span>
        </Link>
      </p>
    </main>
  );
}
