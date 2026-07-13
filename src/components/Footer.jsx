import { motion } from "framer-motion";
import { Mail, Phone, MapPin } from "lucide-react";

import {
  FaFacebookF,
  FaTwitter,
  FaLinkedinIn,
  FaInstagram,
} from "react-icons/fa";

import { TAGLINE } from "../../data/content";

const FOOTER_COLUMNS = [
  {
    title: "Marketplace",
    links: ["Explore Products", "Verified Suppliers", "Post RFQ", "Categories"],
  },
  {
    title: "Company",
    links: ["About BBM", "Careers", "Press", "Contact Us"],
  },
  {
    title: "Support",
    links: ["Help Center", "How it Works", "Trust & Safety", "FAQs"],
  },
];

const SOCIALS = [
  { icon: FaFacebookF, href: "#" },
  { icon: FaTwitter, href: "#" },
  { icon: FaLinkedinIn, href: "#" },
  { icon: FaInstagram, href: "#" },
];
export default function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="border-t border-slate-100 bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5">
          {/* Brand block */}
          <div className="lg:col-span-2">
            <a href="/" className="flex items-center gap-3">
            <img
              src="./Logo.png"
              alt="BBM"
              className="h-8 w-auto object-contain"
            />

            <h1
              className="text-xl font-bold text-slate-900"
              style={{ fontFamily: "Verdana, Geneva, Tahoma, sans-serif" }}
            >
              BBM
            </h1>
          </a>
            <p className="mt-3 text-sm font-medium text-blue-600">{TAGLINE}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              India&apos;s trusted B2B marketplace connecting buyers and verified
              suppliers across every industry.
            </p>

            <div className="mt-5 space-y-2 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-400" />
                <span>support@bbmpvtltd.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <span>Rajkot, Gujarat, India</span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              {SOCIALS.map(({ icon: Icon }, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:text-blue-600"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-slate-900">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-slate-500 transition-colors hover:text-blue-600"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-slate-200 pt-6 sm:flex-row">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} BBM. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-slate-400">
            <a href="#" className="hover:text-blue-600">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600">Terms of Service</a>
          </div>
        </div>
      </div>
    </motion.footer>
  );
}