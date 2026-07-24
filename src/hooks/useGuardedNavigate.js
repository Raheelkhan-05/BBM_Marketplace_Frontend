// src/hooks/useGuardedNavigate.js
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GUEST_ONLY = ["/", "/login", "/search"];
const AUTH_ONLY = ["/home"];

export function useGuardedNavigate() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  return (to, options) => {
    const path = typeof to === "string" ? to : to.pathname;
    if (isLoggedIn && GUEST_ONLY.includes(path)) return navigate("/home", options);
    if (!isLoggedIn && AUTH_ONLY.includes(path)) return navigate("/login", options);
    navigate(to, options);
  };
}