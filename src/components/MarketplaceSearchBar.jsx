// components/MarketplaceSearchBar.jsx
//
// The one search bar UI, shared between the Home page and the results
// (HierarchySearchPage) so both offer identical text + image search.
// Fully controlled (value/onChange from the parent) and submit-only: a
// keystroke never triggers a search, only Enter/the search button/a
// resolved image search does, via onSubmit / onImageResolved.

import { useRef, useState } from "react";
import { Search, Camera, FileText, Loader2 } from "lucide-react";
import { searchByImage } from "../utils/api";
import { resizeImageForSearch } from "../utils/resizeImageForSearch";

export default function MarketplaceSearchBar({
    value,
    onChange,
    onSubmit,
    onImageResolved,
    placeholder = "Search any product, brand, category...",
}) {
    const [imageSearching, setImageSearching] = useState(false);
    const [imageError, setImageError] = useState(null);
    const fileInputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        setImageError(null);
        onSubmit(trimmed);
    };

    const handleImageButtonClick = () => {
        if (imageSearching) return;
        setImageError(null);
        fileInputRef.current?.click();
    };

    const handleImageFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-selecting the same file next time
        if (!file) return;

        setImageSearching(true);
        setImageError(null);
        try {
            const { base64, mimeType } = await resizeImageForSearch(file);
            const result = await searchByImage(base64, mimeType);

            if (result?.success && result.resolved && result.stack) {
                onImageResolved(result);
            } else {
                setImageError(result?.reason || "We couldn't identify a product in that photo.");
            }
        } catch {
            setImageError("Something went wrong reading that photo. Please try again.");
        } finally {
            setImageSearching(false);
        }
    };

    return (
        <div className="w-full">
            <form
                onSubmit={handleSubmit}
                className="w-full rounded-full p-[2px] bg-gradient-to-r from-[#0B8A93] via-[#3B82F6] to-[#FF6A00] shadow-lg"
            >
                <div className="flex h-[60px] lg:h-[62px] xl:h-[64px] items-center rounded-full bg-white px-3 pl-5 lg:px-5 lg:pl-7">

                    {/* Logo */}
                    <div className="flex shrink-0 items-center pr-3 lg:pr-4">
                        <img src="./Logo.png" alt="Logo" className="h-6 w-6 lg:h-8 lg:w-8 object-contain" />
                    </div>

                    <div className="mr-3 lg:mr-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

                    {/* Search — updates local text only, never triggers a search itself */}
                    <div className="flex min-w-0 flex-1 items-center">
                        <Search size={16} className="mr-2 lg:mr-3 shrink-0 text-slate-400 lg:!w-4 lg:!h-4" />
                        <input
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            className="w-full min-w-0 bg-transparent text-[10px] lg:text-base text-slate-700 placeholder:text-slate-400 outline-none"
                        />
                    </div>

                    <div className="mx-3 lg:mx-4 h-8 lg:h-10 w-px shrink-0 bg-gray-200" />

                    {/* Image search */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                    />
                    <button
                        type="button"
                        onClick={handleImageButtonClick}
                        disabled={imageSearching}
                        className="flex shrink-0 flex-col items-center justify-center gap-1 px-0 lg:px-2 disabled:opacity-60"
                    >
                        <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#E7F7F7]">
                            {imageSearching ? (
                                <Loader2 size={15} className="animate-spin text-[#00838F] lg:!w-[15px] lg:!h-[15px]" />
                            ) : (
                                <Camera size={15} className="text-[#00838F] lg:!w-[15px] lg:!h-[15px]" />
                            )}
                        </div>
                        <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#00838F]">
                            {imageSearching ? "Scanning" : "Image"}
                        </span>
                    </button>

                    {/* PDF */}
                    <button
                        type="button"
                        className="flex shrink-0 flex-col items-center justify-center gap-1 px-2 pr-0 lg:px-2 lg:pr-1"
                    >
                        <div className="flex h-7 w-7 lg:h-6 lg:w-6 items-center justify-center rounded-full bg-[#F1EEFF]">
                            <FileText size={15} className="text-[#6655D8] lg:!w-[15px] lg:!h-[15px]" />
                        </div>
                        <span className="text-[9px] lg:text-[11px] font-medium leading-none text-[#6655D8]">
                            PDF
                        </span>
                    </button>

                    {/* Search Button — only way (besides Enter) to submit */}
                    <button
                        type="submit"
                        className="ml-2 lg:ml-3 flex h-9 w-9 lg:h-9 lg:w-9 shrink-0 items-center justify-center rounded-full bg-[#F15A24] text-white transition hover:scale-105"
                    >
                        <Search size={14} className="lg:!w-[16px] lg:!h-[16px]" />
                    </button>

                </div>
            </form>

            {imageError && (
                <p className="mt-2 px-4 text-[11.5px] font-medium text-amber-600">{imageError}</p>
            )}
        </div>
    );
}