import { Helmet } from "react-helmet-async";
const SITE = "https://www.bbm.business";

export default function Seo({ title, description, path, noindex = false, jsonLd }) {
    const url = path ? SITE + path : undefined;
    return (
        <Helmet>
            <title>{title}</title>
            {description && <meta name="description" content={description} />}
            {url && <link rel="canonical" href={url} />}
            <meta name="robots" content={noindex ? "noindex,follow" : "index,follow"} />
            <meta property="og:title" content={title} />
            {description && <meta property="og:description" content={description} />}
            {url && <meta property="og:url" content={url} />}
            <meta property="og:type" content="website" />
            {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
        </Helmet>
    );
}