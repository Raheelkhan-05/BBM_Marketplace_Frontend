// src/components/PublicFooter.jsx
// The one footer for the whole site (marketplace, Grow, Save, legal pages).
//
// Full-width band with square edges. It brings its own dark BBM palette, so it
// looks the same on the white marketplace, the `.ba` legal theme and the `.sv`
// Save theme. Mount it OUTSIDE any max-width wrapper so the band can reach both
// screen edges; the content inside is centred and capped at 1120px by itself.
//
// <PublicFooter dock />  adds bottom space on phones so the fixed bottom dock
// never covers the footer. Leave `dock` off on pages where the dock is hidden.
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, FOOTER_LINKS, addressOneLine } from "../config/company.js";

const linkFor = (to) => FOOTER_LINKS.find((l) => l.to === to);
const GROUPS = [
    { title: "Company", paths: ["/services", "/pricing", "/contact"] },
    { title: "Legal", paths: ["/terms", "/privacy-policy", "/refund-policy"] },
].map((g) => ({ ...g, links: g.paths.map(linkFor).filter(Boolean) }));

const CSS = `
.bbmf{
  --f-bg:#06161C;--f-ink:#FFFFFF;--f-mute:rgba(255,255,255,.68);--f-line:rgba(255,255,255,.12);--f-go:#FFD60A;
  display:block;width:100%;margin:48px 0 0;background:var(--f-bg);color:var(--f-mute);
  font:500 .93rem/1.6 "Figtree",system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;box-sizing:border-box;
}
.bbmf *,.bbmf *::before,.bbmf *::after{box-sizing:border-box}
.bbmf a{color:inherit;text-decoration:none;transition:color .15s}
.bbmf a:hover{color:var(--f-go)}
.bbmf a:focus-visible{outline:2px solid var(--f-go);outline-offset:3px}
.bbmf ul{list-style:none;margin:0;padding:0}
.bbmf p{margin:0}

.bbmf-in{max-width:1280px;margin:0 auto;padding:44px 20px 0}
@media(min-width:760px){.bbmf-in{padding:52px 28px 0}}

.bbmf-top{display:grid;gap:36px;grid-template-columns:minmax(0,1fr)}
@media(min-width:760px){.bbmf-top{grid-template-columns:minmax(0,1.5fr) minmax(0,.8fr) minmax(0,.8fr);gap:48px}}

.bbmf-brand a.bbmf-logo{display:inline-flex;align-items:center;gap:10px;color:var(--f-ink)}
.bbmf-brand a.bbmf-logo:hover{color:var(--f-ink)}
.bbmf-chip{display:flex;align-items:center;background:#fff;padding:2.5px 4px}
.bbmf-chip img{display:block;height:36px;width:auto;object-fit:contain}
.bbmf-name{font:800 1.2rem/1 "Bricolage Grotesque","Figtree",system-ui,sans-serif;letter-spacing:.02em}
.bbmf-tag{margin-top:14px;max-width:35ch;color:var(--f-ink);font:700 1.02rem/1.4 "Bricolage Grotesque","Figtree",system-ui,sans-serif}
.bbmf-sub{margin-top:6px;max-width:44ch}

.bbmf-contact{margin-top:22px;display:grid;gap:10px}
.bbmf-contact li{display:flex;gap:10px;align-items:flex-start;overflow-wrap:anywhere}
.bbmf-contact svg{flex:none;width:16px;height:16px;margin-top:4px;color:var(--f-go)}

.bbmf-col h2{margin:0 0 12px;font:800 .95rem/1.3 "Bricolage Grotesque","Figtree",system-ui,sans-serif;color:var(--f-ink);letter-spacing:.01em}
.bbmf-col ul{display:grid;gap:4px}
.bbmf-col a{display:inline-block;padding:5px 0}
.bbmf-links{display:grid;grid-template-columns:1fr 1fr;gap:28px}
@media(min-width:760px){.bbmf-links{display:contents}}

.bbmf-bot{margin-top:36px;border-top:1px solid var(--f-line);padding:18px 0 calc(22px + env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;gap:6px 24px;justify-content:space-between;font-size:.82rem;color:rgba(255,255,255,.55)}
.bbmf-ids{display:flex;flex-wrap:wrap;gap:4px 18px}

@media(max-width:767px){.bbmf.bbmf-dock .bbmf-bot{padding-bottom:calc(92px + env(safe-area-inset-bottom,0px))}}
`;

export default function PublicFooter({ dock = false }) {
    return (
        <footer className={`bbmf${dock ? " bbmf-dock" : ""} pb-5 md:pb-20`} aria-label="Company information and policies">
            <style>{CSS}</style>
            <div className="bbmf-in">
                <div className="bbmf-top">
                    <div className="bbmf-brand">
                        <Link to="/" className="bbmf-logo" aria-label="BBM home">
                            <span className="bbmf-chip"><img src="/Logo.png" alt="" /></span>
                            <span className="bbmf-name">{COMPANY.brand}</span>
                        </Link>
                        <p className="bbmf-tag py-1">More buyers. More business. Less selling effort.</p>
                        <p className="bbmf-sub pb-3">
                            A B2B marketplace and business services company for registered businesses.
                        </p>

                        <ul className="bbmf-contact">
                            <li>
                                <MapPin aria-hidden="true" />
                                <span>{addressOneLine()}</span>
                            </li>
                            <li>
                                <Mail aria-hidden="true" />
                                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                            </li>
                            <li>
                                <Phone aria-hidden="true" />
                                <a href={`tel:${COMPANY.phone}`}>{COMPANY.phoneDisplay}</a>
                            </li>
                        </ul>
                    </div>

                    <div className="bbmf-links">
                        {GROUPS.map((g) => (
                            <nav className="bbmf-col" key={g.title} aria-label={g.title}>
                                <h2>{g.title}</h2>
                                <ul>
                                    {g.links.map((l) => (
                                        <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
                                    ))}
                                </ul>
                            </nav>
                        ))}
                    </div>
                </div>

                <div className="bbmf-bot">
                    <span>&copy; {new Date().getFullYear()} {COMPANY.legalName}</span>
                    <span className="bbmf-ids">
                        <span>CIN {COMPANY.cin}</span>
                        {COMPANY.gstin ? <span>GSTIN {COMPANY.gstin}</span> : null}
                        {COMPANY.supportHours ? <span>{COMPANY.supportHours}</span> : null}
                    </span>
                </div>
            </div>
        </footer>
    );
}