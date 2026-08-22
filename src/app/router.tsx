import { Navigate, Route, Routes } from "react-router-dom";
import { DemoPage } from "../features/demo/DemoPage";
import { LandingPage } from "../features/landing/LandingPage";
import { MerchantPage } from "../features/merchant/MerchantPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/book" element={<DemoPage />} />
      <Route path="/demo" element={<Navigate to="/book" replace />} />
      <Route path="/merchant" element={<MerchantPage />} />
    </Routes>
  );
}
