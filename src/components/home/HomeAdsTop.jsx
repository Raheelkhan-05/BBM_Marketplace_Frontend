// components/home/HomeAdsTop.jsx — everything paid/curated that sits ABOVE the product feed on Home:
//   1. the paid hero carousel (home_hero), only when an ad is live
//   2. the shelves: Deal of the Day, Featured (paid products first, labelled "Sponsored"), Limited stock, New arrivals
// home_duo and home_strip are placed between feed sections by HomeProductFeed (see INTEGRATION_PATCHES.md).
//
// `ads` comes from useLiveAds() in HomeProductFeed, so there is ONE poll / socket listener for all paid blocks.
// Both parts render nothing when there is nothing to show; shelves are an extra and never show an error banner.
import AdBannerBlock from "./AdBannerBlock.jsx";
import HomeShelves from "./HomeShelves.jsx";
import useHomeShelves from "../../hooks/useHomeShelves.js";

export default function HomeAdsTop({ ads, categoryId = null, showShelves = true }) {
    const { shelves, loading } = useHomeShelves({ categoryId, enabled: showShelves });
    return (
        <>
            <AdBannerBlock placement="home_hero" ads={ads?.home_hero} priority />
            {showShelves && <HomeShelves shelves={shelves} loading={loading} />}
        </>
    );
}