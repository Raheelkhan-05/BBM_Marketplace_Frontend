// src/components/AuthLayout.jsx
import { Outlet } from "react-router-dom";
import BackgroundAmbience from "./landing/BackgroundAmbience.jsx";

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-white">
      <BackgroundAmbience />
      <div className="relative z-1 flex min-h-screen items-center justify-center overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}