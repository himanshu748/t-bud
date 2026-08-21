import { Link } from "react-router-dom";

export function BrandMark() {
  return (
    <Link className="brand-mark" to="/" aria-label="T-Bud home">
      <span className="brand-mark__signal" aria-hidden="true" />
      <span>T-Bud</span>
    </Link>
  );
}
