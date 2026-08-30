// src/pages/HomePage.jsx — redesigned shell (v2)
//
// Top to bottom: NavStrip -> search bar (icons hidden) -> CategoryStrip
// (filter, not a link) -> HomeProductFeed (paginated hs_generic_products).
// Hero, Welcome, QuickActions, SellerQuickManage, TrustStrip,
// CategoryIconExplorer, HomeProductShelves, StartSellingBanner: all removed.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import MarketplaceSearchBar from "../components/MarketplaceSearchBar";
import HomePageSkeleton from "../components/skeletons/HomePageSkeleton.jsx";
import CategoryStrip from "../components/home/CategoryStrip.jsx";
import HomeProductFeed from "../components/home/HomeProductFeed.jsx";
import FloatingSellButton from "../components/FloatingSellButton.jsx";
import { SmoothScrollProvider } from "../providers/SmoothScrollProvider";
import { performSearchNavigation } from "../utils/searchResolve.js";
import { Contacts } from '@capacitor-community/contacts';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

function normalizeAndDedupeContacts(rawContacts, defaultCountry = 'IN') {
    const result = new Map(); // normalized number -> name

    for (const contact of rawContacts) {
        const name = contact.name?.display?.trim();
        if (!name) continue; // skip contacts with no name at all

        const phones = contact.phones ?? [];
        if (phones.length === 0) continue; // skip contacts with no number (e.g. "Soib Lohani")

        // dedupe numbers within THIS contact first (same number appears 2-4x)
        const seenInContact = new Set();

        for (const p of phones) {
            const raw = p.number?.trim();
            if (!raw) continue;

            const parsed = parsePhoneNumberFromString(raw, defaultCountry);

            // filters out junk like "121", short-codes, malformed entries
            if (!parsed || !parsed.isValid()) continue;

            const normalized = parsed.number; // E.164, e.g. +919428336678

            if (seenInContact.has(normalized)) continue; // skip dup within same contact
            seenInContact.add(normalized);

            // last name wins if the same number shows up under multiple saved contacts
            result.set(normalized, name);
        }
    }

    return result; // Map<normalizedNumber, name>
}

async function testContacts() {
    const perm = await Contacts.requestPermissions();
    // console.log('Permission result:', perm);

    if (perm.contacts === 'granted') {
        const result = await Contacts.getContacts({
            projection: { name: true, phones: true }
        });
        const cleaned = normalizeAndDedupeContacts(result.contacts);
        console.log('Cleaned contacts:', cleaned.size);
        console.log('Sample:', [...cleaned.entries()].slice(0, 5));
        // console.log('Contacts found:', result.contacts.length);
        // console.log('First contact:', result.contacts[0]);
    }
}

const FONT_BODY = "'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Public Sans', Roboto, sans-serif";

export default function HomePage() {
    const [ready, setReady] = useState(false);
    const [isRfqOpen, setIsRfqOpen] = useState(false); // kept for NavStrip's Post RFQ tab — modal itself lives outside this file
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState(null); // { id, name, slug } | null
    const navigate = useNavigate();

    const handleSuggestionSelect = (s) => {
        if (s.level === "brandFamily") {
            // brand family still needs its own page; only case that navigates
            navigate(`/brand-family/${encodeURIComponent(s.name)}`);
            return;
        }
        setQuery(s.name); // just fills the box — HomeProductFeed's debounced q picks it up and live-filters
    };

    useEffect(() => {
        const id = requestAnimationFrame(() => setReady(true));
        return () => cancelAnimationFrame(id);
    }, []);

    if (!ready) return <HomePageSkeleton />;

    const handleSubmit = (trimmedQuery) => performSearchNavigation(navigate, trimmedQuery);
    const handleImageResolved = (result) => navigate("/browse", { state: { imageResult: result } });

    return (
        <div className="min-h-screen bg-[#FCFBF9] text-slate-900 antialiased overflow-x-hidden" style={{ fontFamily: FONT_BODY }}>
            <SmoothScrollProvider>

                <main className="mx-auto max-w-7xl px-2.5 mt-2 sm:px-4 lg:px-6 pb-5 sm:pb-20 pt-3 space-y-4">
                    <button onClick={testContacts}>Test Contacts</button>
                    <MarketplaceSearchBar
                        value={query}
                        onChange={setQuery}
                        onSubmit={handleSubmit}
                        onImageResolved={handleImageResolved}
                        showMediaButtons={false}
                        onSuggestionSelect={handleSuggestionSelect}
                    />

                    <CategoryStrip activeCategoryId={activeCategory?.id} onSelect={setActiveCategory} />

                    <HomeProductFeed category={activeCategory} q={query} />
                </main>
            </SmoothScrollProvider>
            <FloatingSellButton to="/seller/sell" label="Sell" />
        </div>
    );
}