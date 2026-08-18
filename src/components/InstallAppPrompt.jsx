// components/InstallAppPrompt.jsx
import { Download, X } from "lucide-react";
import { usePwaInstallPrompt } from "../hooks/usePwaInstallPrompt";

export default function InstallAppPrompt() {
    const { show, platform, promptInstall, dismiss } = usePwaInstallPrompt();
    if (!show) return null;

    return (
        <div className="fixed inset-x-3 bottom-3 z-[999] rounded-2xl border bg-white p-4 shadow-lg sm:inset-x-auto sm:right-4 sm:w-80" style={{ borderColor: "rgba(11,17,22,0.09)" }}>
            <button onClick={dismiss} className="absolute right-2 top-2 rounded-full p-1 hover:bg-black/5">
                <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 pr-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D2462B]/10 text-[#D2462B]">
                    <Download className="h-5 w-5" />
                </span>
                <div>
                    <p className="text-[13.5px] font-extrabold">Install the app</p>
                    {platform === "android" ? (
                        <>
                            <p className="mt-1 text-[12px] font-medium text-gray-600">Get a faster, full-screen experience with offline access.</p>
                            <button onClick={promptInstall} className="mt-3 rounded-lg bg-[#D2462B] px-3 py-1.5 text-[12px] font-bold text-white">
                                Install now
                            </button>
                        </>
                    ) : (
                        <p className="mt-1 text-[12px] font-medium text-gray-600">
                            Tap the Share icon <span className="font-bold">⬆️</span> then "Add to Home Screen" to install.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}