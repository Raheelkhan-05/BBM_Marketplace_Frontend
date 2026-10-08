// components/growSeller/brandLogos.js
// Logos shown in the "brands already on the marketplace" strip of the single-enquiry page.
// Set `src` to an imported asset or a hosted URL, e.g.
//   import bosch from "../../assets/brands/bosch.png";  ->  { name: "Bosch", src: bosch }
// While `src` is null the tile falls back to the brand name as text.
import bosch from "../../../public/brands/Bosch.jpg";
import castrol from "../../../public/brands/Castrol.jpg";
import mobil from "../../../public/brands/Mobil.jpg";
import nerolac from "../../../public/brands/Nerolac.jpg";
import shell from "../../../public/brands/Shell.jpg";
import skf from "../../../public/brands/SKF.jpg";
import timken from "../../../public/brands/Timken.jpg";
import zerust from "../../../public/brands/Zerust.jpg";

const BRAND_LOGOS = [
    { name: "Bosch", src: bosch },
    { name: "Castrol", src: castrol },
    { name: "Mobil", src: mobil },
    { name: "Nerolac", src: nerolac },
    { name: "Shell", src: shell },
    { name: "SKF", src: skf },
    { name: "Timken", src: timken },
    { name: "Zerust", src: zerust },
];

export default BRAND_LOGOS;