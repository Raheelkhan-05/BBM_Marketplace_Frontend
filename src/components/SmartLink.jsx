// src/components/SmartLink.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const GUEST_ONLY = ["/", "/login"];

export default function SmartLink({ to, onClick, children, ...rest }) {
  const { isLoggedIn } = useAuth();
  const target = isLoggedIn && GUEST_ONLY.includes(to) ? "/home" : to;

  return (
    <Link to={target} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}