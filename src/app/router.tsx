import { Link, Route, Routes } from "react-router-dom";
import { LandingPage } from "../features/landing/LandingPage";

function RoutePlaceholder({ title }: { title: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <nav aria-label="T-Bud routes">
        <Link to="/">Home</Link> <Link to="/demo">Demo</Link>{" "}
        <Link to="/merchant">Merchant</Link>
      </nav>
    </main>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<RoutePlaceholder title="T-Bud demo" />} />
      <Route
        path="/merchant"
        element={<RoutePlaceholder title="T-Bud merchant console" />}
      />
    </Routes>
  );
}
