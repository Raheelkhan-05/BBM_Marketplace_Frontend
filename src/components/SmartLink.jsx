// src/components/SmartLink.jsx — drop-in replacement for <Link>
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GUEST_ONLY = ["/", "/login", "/search"];

export default function SmartLink({ to, onClick, children, ...rest }) {
  const { isLoggedIn } = useAuth();

  const handleClick = (e) => {
    if (isLoggedIn && GUEST_ONLY.includes(to)) {
      e.preventDefault(); // cancel — don't even start the navigation
      return;
    }
    onClick?.(e);
  };

  return (
    <Link to={to} onClick={handleClick} {...rest}>
      {children}
    </Link>
  );
}