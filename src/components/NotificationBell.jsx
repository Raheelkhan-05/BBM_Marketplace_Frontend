import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { fetchNotifications, markNotificationRead } from "../utils/api.js";
import SmartLink from "./SmartLink.jsx";

export default function NotificationBell() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
        if (!token) return; // wait for AuthContext to finish hydrating before calling authenticated endpoints
        let active = true;
        const load = () => fetchNotifications(token).then((res) => {
            if (active && res?.success) { setItems(res.notifications); setUnread(res.unreadCount); }
        });
        load();
        const id = setInterval(load, 60000);
        return () => { active = false; clearInterval(id); };
    }, [token]);

  const handleClick = (n) => {
    if (!n.read) markNotificationRead(token, n.id).then(() => setUnread((u) => Math.max(0, u - 1)));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative rounded-full p-1.5 text-slate-500 hover:text-[#047084]">
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#d2462b] ring-2 ring-white" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-slate-100 bg-white py-1.5 shadow-xl">
            {items.length === 0 && <p className="px-4 py-6 text-center text-[12.5px] text-slate-400">No notifications yet.</p>}
            {items.map((n) => (
              <SmartLink key={n.id} to={n.link || "#"} onClick={() => handleClick(n)}
                className={`block px-4 py-2.5 text-[12.5px] hover:bg-slate-50 ${!n.read ? "bg-[#047084]/[0.04]" : ""}`}>
                <p className="font-bold text-slate-800">{n.title}</p>
                {n.body && <p className="mt-0.5 text-slate-500">{n.body}</p>}
              </SmartLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}