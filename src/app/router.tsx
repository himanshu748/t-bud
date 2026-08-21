import { Route, Routes } from "react-router-dom";
import { DemoPage } from "../features/demo/DemoPage";
import { LandingPage } from "../features/landing/LandingPage";
import { MerchantPage } from "../features/merchant/MerchantPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/merchant" element={<MerchantPage />} />
    </Routes>
  );
}
