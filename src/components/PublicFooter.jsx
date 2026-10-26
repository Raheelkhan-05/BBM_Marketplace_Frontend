// src/components/PublicFooter.jsx
// The one footer for the whole site (marketplace, Grow, Save, legal pages).
//
// Compact full-width band with square edges. It brings its own dark BBM palette,
// so it looks the same on the white marketplace, the `.ba` legal theme and the
// `.sv` Save theme. Mount it OUTSIDE any max-width wrapper so the band can reach
// both screen edges; the content inside is centred and capped by itself.
//
// <PublicFooter dock />  adds bottom space so the fixed bottom dock never covers
// the footer. Leave `dock` off on pages where the dock is hidden.
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
  display:block;width:100%;margin:28px 0 0;background:var(--f-bg);color:var(--f-mute);
  font:500 .85rem/1.5 "Figtree",system-ui,-apple-system,"Segoe UI",sans-serif;text-align:left;box-sizing:border-box;
}
.bbmf *,.bbmf *::before,.bbmf *::after{box-sizing:border-box}
.bbmf a{color:inherit;text-decoration:none;transition:color .15s}
.bbmf a:hover{color:var(--f-go)}
.bbmf a:focus-visible{outline:2px solid var(--f-go);outline-offset:3px}
.bbmf ul{list-style:none;margin:0;padding:0}
.bbmf p{margin:0}

.bbmf-in{max-width:1280px;margin:0 auto;padding:24px 16px 0}
@media(min-width:760px){.bbmf-in{padding:28px 24px 0}}

/* mobile: stacked. desktop: brand | contact | links in one row */
.bbmf-top{display:grid;gap:18px;grid-template-columns:minmax(0,1fr);align-items:start}
@media(min-width:900px){.bbmf-top{grid-template-columns:minmax(0,1.35fr) minmax(0,1.25fr) minmax(0,.9fr);gap:32px}}

.bbmf-brand a.bbmf-logo{display:inline-flex;align-items:center;gap:8px;color:var(--f-ink)}
.bbmf-brand a.bbmf-logo:hover{color:var(--f-ink)}
.bbmf-chip{display:flex;align-items:center;background:#fff;border-radius:4px}
.bbmf-chip img{display:block;height:28px;width:auto;object-fit:contain;border-radius:4px}
.bbmf-name{font:800 1.05rem/1 "Bricolage Grotesque","Figtree",system-ui,sans-serif;letter-spacing:.02em}
.bbmf-tag{margin-top:10px;color:var(--f-ink);font:700 .92rem/1.35 "Bricolage Grotesque","Figtree",system-ui,sans-serif}
.bbmf-sub{margin-top:3px;max-width:46ch;font-size:.82rem;line-height:1.45}

.bbmf-contact{display:grid;gap:6px}
.bbmf-contact li{display:flex;gap:8px;align-items:flex-start;overflow-wrap:anywhere}
.bbmf-contact svg{flex:none;width:14px;height:14px;margin-top:4px;color:var(--f-go)}

.bbmf-links{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.bbmf-col h2{margin:0 0 4px;font:800 .8rem/1.3 "Bricolage Grotesque","Figtree",system-ui,sans-serif;color:var(--f-ink);letter-spacing:.04em;text-transform:uppercase}
.bbmf-col ul{display:grid;gap:0}
.bbmf-col a{display:inline-block;padding:2px 0}

.bbmf-bot{margin-top:18px;border-top:1px solid var(--f-line);padding:10px 0 calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-wrap:wrap;gap:2px 20px;justify-content:space-between;font-size:.76rem;line-height:1.5;color:rgba(255,255,255,.55)}
.bbmf-ids{display:flex;flex-wrap:wrap;gap:2px 14px}

/* space for the fixed bottom dock (only when the dock prop is on) */
.bbmf.bbmf-dock .bbmf-bot{padding-bottom:calc(100px + env(safe-area-inset-bottom,0px))}
@media(min-width:768px){.bbmf.bbmf-dock .bbmf-bot{padding-bottom:calc(64px + env(safe-area-inset-bottom,0px))}}
`;

export default function PublicFooter({ dock = false }) {
    return (
        <footer className={`bbmf${dock ? " bbmf-dock" : ""}`} aria-label="Company information and policies">
            <style>{CSS}</style>
            <div className="bbmf-in">
                <div className="bbmf-top">
                    <div className="bbmf-brand">
                        <Link to="/" className="bbmf-logo" aria-label="BBM home">
                            <span className="bbmf-chip"><img src="/Logo_with_whiteborder.png" alt="" /></span>
                            <span className="bbmf-name">{COMPANY.brand}</span>
                        </Link>
                        <p className="bbmf-tag">More buyers. More business. Less selling effort.</p>
                        <p className="bbmf-sub">
                            A B2B marketplace and business services company for registered businesses.
                        </p>
                    </div>

                    <ul className="bbmf-contact" aria-label="Contact">
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