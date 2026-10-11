import { ButtonLink } from "@/components/ui";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <div className="container not-found page">
      <p className="not-found__code">404</p>
      <h1 className="h-page">Page not found</h1>
      <p className="lead">The link may be broken, or the page has moved.</p>
      <div className="actions-row">
        <ButtonLink to="/" variant="primary">
          Go to home
        </ButtonLink>
        <ButtonLink to="/theater" variant="secondary">
          Theater schedule
        </ButtonLink>
      </div>
    </div>
  );
}
