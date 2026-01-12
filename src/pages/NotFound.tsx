import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page">
      <section className="card">
        <h2>Page not found</h2>
        <p className="muted">The page you requested does not exist.</p>
        <Link to="/" className="app__primary link-button">
          Go to dashboard
        </Link>
      </section>
    </div>
  );
}
