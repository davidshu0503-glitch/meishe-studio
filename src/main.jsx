import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, HashRouter, Link, Route, Routes } from "react-router-dom";
import "./styles/global.css";
import { SiteProvider } from "./lib/site";
import { AuthProvider } from "./lib/auth";
import { PageHero, Spinner, ToastProvider } from "./components/ui";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Portfolio from "./pages/Portfolio";
import Services from "./pages/Services";
import About from "./pages/About";
import Booking from "./pages/Booking";
import Gallery from "./pages/Gallery";
import Member from "./pages/Member";

const Admin = lazy(() => import("./pages/admin/Admin"));
const DemoBanner = import.meta.env.VITE_DEMO === "1" ? lazy(() => import("./demo/DemoBanner")) : () => null;
const Router = import.meta.env.VITE_DEMO === "1" ? HashRouter : BrowserRouter;

function NotFound() {
  return (
    <>
      <PageHero eyebrow="404" title="找不到這個頁面" />
      <div className="section-tight center"><Link className="btn" to="/">回首頁</Link></div>
    </>
  );
}

function render() {
  ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Router>
      <SiteProvider>
        <AuthProvider>
          <ToastProvider>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/admin/*" element={<Admin />} />
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="portfolio" element={<Portfolio />} />
                  <Route path="services" element={<Services />} />
                  <Route path="about" element={<About />} />
                  <Route path="booking" element={<Booking />} />
                  <Route path="gallery" element={<Gallery />} />
                  <Route path="member" element={<Member />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
            <Suspense fallback={null}><DemoBanner /></Suspense>
          </ToastProvider>
        </AuthProvider>
      </SiteProvider>
    </Router>
  </React.StrictMode>
);
}

if (import.meta.env.VITE_DEMO === "1") import("./demo/mock.js").then(render);
else render();
