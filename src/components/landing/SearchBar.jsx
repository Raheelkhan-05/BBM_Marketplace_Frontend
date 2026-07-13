import { useState } from "react";
import { motion } from "framer-motion";
import { Search } from "lucide-react";

export default function SearchBar() {
  const [query, setQuery] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    // Wire this up to real search routing later.
    console.log("Search for:", query);
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="mt-4 flex w-full items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:max-w-xl"
    >
      <Search className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for products, brands, categories..."
        className="w-full bg-transparent px-3 py-2 text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="m-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700"
      >
        <Search className="h-4 w-4" />
      </button>
    </motion.form>
  );
}