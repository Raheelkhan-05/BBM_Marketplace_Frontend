// context/DockVisibilityContext.jsx
// Lets a page temporarily hide the BottomNavStrip (e.g. while the store checkout bar is showing).
import { createContext, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext({ hidden: false, setHidden: () => { } });

export function DockVisibilityProvider({ children }) {
    const [hidden, setHidden] = useState(false);
    const value = useMemo(() => ({ hidden, setHidden }), [hidden]);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useDockHidden = () => useContext(Ctx).hidden;

// Call inside a page: useHideDock(true) hides the dock while mounted/active, restores it on cleanup.
export function useHideDock(active) {
    const { setHidden } = useContext(Ctx);
    useEffect(() => {
        if (!active) return undefined;
        setHidden(true);
        return () => setHidden(false);
    }, [active, setHidden]);
}