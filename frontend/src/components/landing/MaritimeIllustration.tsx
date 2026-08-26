import React from 'react';
import { Anchor, Radio, Shield, Truck, Container as ContainerIcon, Ship } from 'lucide-react';

export const MaritimeIllustration: React.FC = () => {
  return (
    <div className="relative w-full aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 bg-gradient-to-b from-slate-900 via-sky-950 to-slate-950 text-white">
      {/* Dynamic Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(2,132,199,0.25),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(13,148,136,0.2),transparent_50%)] pointer-events-none" />

      {/* Grid overlay for digital enterprise feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c70f_1px,transparent_1px),linear-gradient(to_bottom,#0284c70f_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Primary SVG Canvas */}
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B132B" />
            <stop offset="60%" stopColor="#1C2541" />
            <stop offset="100%" stopColor="#0284C7" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="oceanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0284C7" stopOpacity="0.8" />
            <stop offset="40%" stopColor="#0369A1" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>

          <linearGradient id="hullGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="50%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          <linearGradient id="craneMetal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#D97706" />
          </linearGradient>

          {/* Container Colors */}
          <linearGradient id="contRed" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#991B1B" />
          </linearGradient>
          <linearGradient id="contBlue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#075985" />
          </linearGradient>
          <linearGradient id="contTeal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#115E59" />
          </linearGradient>
          <linearGradient id="contGreen" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>

          {/* Radar Sweep Pattern */}
          <linearGradient id="radarSweep" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#14B8A6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Sky / Atmosphere */}
        <rect width="1000" height="350" fill="url(#skyGrad)" />

        {/* Distant Mountains / Horizon */}
        <path d="M0 320 Q150 280 300 310 Q450 270 600 315 Q750 290 1000 330 L1000 350 L0 350 Z" fill="#0F172A" opacity="0.7" />

        {/* Port Terminal Dock Ground (Concrete Wharf) */}
        <path d="M0 350 L1000 350 L1000 420 L0 440 Z" fill="#1E293B" />
        <line x1="0" y1="355" x2="1000" y2="355" stroke="#0284C7" strokeWidth="3" strokeDasharray="12 6" opacity="0.6" />

        {/* OCEAN WATER */}
        <rect x="0" y="420" width="1000" height="180" fill="url(#oceanGrad)" />

        {/* Ocean Waves Accent Lines */}
        <path d="M 0 460 Q 250 450 500 465 Q 750 480 1000 460" stroke="#38BDF8" strokeWidth="1.5" fill="none" opacity="0.4" />
        <path d="M 0 500 Q 200 515 450 500 Q 700 485 1000 510" stroke="#0284C7" strokeWidth="2" fill="none" opacity="0.5" />
        <path d="M 0 550 Q 300 535 600 555 Q 850 540 1000 560" stroke="#14B8A6" strokeWidth="1.5" fill="none" opacity="0.3" />

        {/* ================= CARGO SHIP (LARGE CONTAINER VESSEL) ================= */}
        <g id="cargo-ship" transform="translate(180, 240)">
          {/* Main Hull */}
          <path d="M 20 180 L 70 210 L 580 210 L 640 160 L 580 160 L 50 160 Z" fill="url(#hullGrad)" stroke="#38BDF8" strokeWidth="0.8" />
          {/* Waterline Stripe */}
          <path d="M 60 200 L 590 200 L 630 168 L 575 168 Q 300 190 60 200" fill="#EF4444" opacity="0.9" />

          {/* Ship Superstructure / Navigation Bridge */}
          <rect x="480" y="60" width="70" height="100" fill="#F8FAFC" rx="2" />
          <rect x="485" y="70" width="60" height="12" fill="#0284C7" rx="1" /> {/* Windows */}
          <rect x="485" y="90" width="60" height="10" fill="#0F172A" rx="1" />
          {/* Radar Mast */}
          <line x1="515" y1="60" x2="515" y2="25" stroke="#94A3B8" strokeWidth="3" />
          <line x1="500" y1="35" x2="530" y2="35" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="515" cy="22" r="4" fill="#EF4444" className="animate-pulse" />

          {/* STACKED CONTAINER CARGO ON SHIP DECK */}
          {/* Tier 1 */}
          <rect x="80" y="130" width="65" height="28" fill="url(#contBlue)" rx="2" stroke="#0F172A" />
          <rect x="148" y="130" width="65" height="28" fill="url(#contRed)" rx="2" stroke="#0F172A" />
          <rect x="216" y="130" width="65" height="28" fill="url(#contTeal)" rx="2" stroke="#0F172A" />
          <rect x="284" y="130" width="65" height="28" fill="url(#contGreen)" rx="2" stroke="#0F172A" />
          <rect x="352" y="130" width="65" height="28" fill="url(#contBlue)" rx="2" stroke="#0F172A" />
          <rect x="420" y="130" width="55" height="28" fill="url(#contRed)" rx="2" stroke="#0F172A" />

          {/* Tier 2 */}
          <rect x="80" y="100" width="65" height="28" fill="url(#contTeal)" rx="2" stroke="#0F172A" />
          <rect x="148" y="100" width="65" height="28" fill="url(#contGreen)" rx="2" stroke="#0F172A" />
          <rect x="216" y="100" width="65" height="28" fill="url(#contBlue)" rx="2" stroke="#0F172A" />
          <rect x="284" y="100" width="65" height="28" fill="url(#contRed)" rx="2" stroke="#0F172A" />
          <rect x="352" y="100" width="65" height="28" fill="url(#contTeal)" rx="2" stroke="#0F172A" />

          {/* Tier 3 */}
          <rect x="148" y="70" width="65" height="28" fill="url(#contRed)" rx="2" stroke="#0F172A" />
          <rect x="216" y="70" width="65" height="28" fill="url(#contTeal)" rx="2" stroke="#0F172A" />
          <rect x="284" y="70" width="65" height="28" fill="url(#contGreen)" rx="2" stroke="#0F172A" />
        </g>

        {/* ================= PORT STS GANTRY CRANES ================= */}
        {/* Crane 1 */}
        <g id="crane-1" transform="translate(260, 160)">
          {/* Vertical Legs */}
          <line x1="20" y1="200" x2="35" y2="40" stroke="url(#craneMetal)" strokeWidth="7" />
          <line x1="70" y1="200" x2="55" y2="40" stroke="url(#craneMetal)" strokeWidth="7" />
          <line x1="30" y1="120" x2="65" y2="120" stroke="url(#craneMetal)" strokeWidth="4" />
          <line x1="25" y1="160" x2="70" y2="160" stroke="url(#craneMetal)" strokeWidth="4" />

          {/* Horizontal Boom extending over ocean */}
          <rect x="-40" y="30" width="160" height="14" fill="url(#craneMetal)" rx="2" />
          {/* Trolley & Spreader Hoist */}
          <rect x="10" y="44" width="20" height="10" fill="#0F172A" />
          <line x1="15" y1="54" x2="15" y2="140" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
          <line x1="25" y1="54" x2="25" y2="140" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="3 3" />
          {/* Container suspended in air */}
          <rect x="2" y="140" width="36" height="18" fill="url(#contTeal)" rx="1" stroke="#0F172A" />
        </g>

        {/* Crane 2 */}
        <g id="crane-2" transform="translate(480, 160)">
          <line x1="20" y1="200" x2="35" y2="40" stroke="url(#craneMetal)" strokeWidth="7" />
          <line x1="70" y1="200" x2="55" y2="40" stroke="url(#craneMetal)" strokeWidth="7" />
          <rect x="-40" y="30" width="160" height="14" fill="url(#craneMetal)" rx="2" />
        </g>

        {/* ================= PORT CONTROL TOWER ================= */}
        <g id="control-tower" transform="translate(40, 120)">
          {/* Tower Base & Column */}
          <rect x="30" y="120" width="24" height="130" fill="#334155" />
          <line x1="42" y1="120" x2="42" y2="250" stroke="#0284C7" strokeWidth="2" />

          {/* Control Room Pod (Glass hexagonal structure) */}
          <polygon points="12,80 72,80 62,120 22,120" fill="#0F172A" stroke="#0284C7" strokeWidth="2" />
          <polygon points="16,84 68,84 60,105 24,105" fill="#38BDF8" opacity="0.3" />

          {/* Roof Radar Dome */}
          <path d="M 28 80 A 14 14 0 0 1 56 80 Z" fill="#F8FAFC" />
          <line x1="42" y1="66" x2="42" y2="45" stroke="#38BDF8" strokeWidth="2" />
          {/* Radar Scan Dish */}
          <circle cx="42" cy="45" r="18" fill="none" stroke="#14B8A6" strokeWidth="1.5" strokeDasharray="4 2" />
          <circle cx="42" cy="45" r="4" fill="#14B8A6" className="animate-ping" />
        </g>

        {/* ================= LOGISTICS WAREHOUSE ================= */}
        <g id="warehouse" transform="translate(730, 230)">
          {/* Main Structure */}
          <rect x="0" y="30" width="220" height="90" fill="#1E293B" stroke="#475569" strokeWidth="2" rx="3" />
          {/* Peaked Roof */}
          <polygon points="-10,30 110,-10 230,30" fill="#334155" />
          <text x="110" y="55" fill="#0284C7" fontSize="12" fontWeight="bold" textAnchor="middle" letterSpacing="1">PORTIDE LOGISTICS HUB</text>
          {/* Loading Dock Doors */}
          <rect x="20" y="75" width="35" height="45" fill="#0F172A" stroke="#0284C7" strokeWidth="1" />
          <rect x="70" y="75" width="35" height="45" fill="#0F172A" stroke="#0284C7" strokeWidth="1" />
          <rect x="120" y="75" width="35" height="45" fill="#0F172A" stroke="#0284C7" strokeWidth="1" />
        </g>

        {/* ================= CONTAINER YARD STACKS ================= */}
        <g id="yard-stacks" transform="translate(620, 290)">
          <rect x="0" y="30" width="40" height="20" fill="url(#contRed)" rx="1" />
          <rect x="0" y="8" width="40" height="20" fill="url(#contBlue)" rx="1" />
          <rect x="44" y="30" width="40" height="20" fill="url(#contTeal)" rx="1" />
          <rect x="44" y="8" width="40" height="20" fill="url(#contGreen)" rx="1" />
          <rect x="44" y="-14" width="40" height="20" fill="url(#contRed)" rx="1" />
        </g>

        {/* ================= CONTAINER TRUCKS ================= */}
        <g id="truck-1" transform="translate(680, 375)">
          {/* Truck Cabin */}
          <rect x="90" y="0" width="28" height="25" fill="#0284C7" rx="3" />
          {/* Chassis */}
          <rect x="0" y="15" width="90" height="8" fill="#334155" />
          {/* Container Trailer */}
          <rect x="0" y="-10" width="85" height="24" fill="url(#contBlue)" rx="2" stroke="#0F172A" />
          {/* Wheels */}
          <circle cx="20" cy="26" r="6" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
          <circle cx="35" cy="26" r="6" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
          <circle cx="105" cy="26" r="6" fill="#0F172A" stroke="#94A3B8" strokeWidth="1.5" />
        </g>

        <g id="truck-2" transform="translate(850, 390)">
          <rect x="70" y="0" width="24" height="22" fill="#14B8A6" rx="3" />
          <rect x="0" y="-8" width="68" height="22" fill="url(#contGreen)" rx="2" stroke="#0F172A" />
          <circle cx="15" cy="20" r="5" fill="#0F172A" />
          <circle cx="80" cy="20" r="5" fill="#0F172A" />
        </g>
      </svg>

      {/* Dynamic Floating Badges Overlay */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex flex-wrap gap-2.5">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-sky-500/40 backdrop-blur-md shadow-lg text-xs font-semibold text-sky-300">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>Vessel Traffic Service: ACTIVE</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-teal-500/40 backdrop-blur-md shadow-lg text-xs font-semibold text-teal-300">
          <Anchor className="w-3.5 h-3.5 text-cyan-400" />
          <span>6 Active Berths Occupied</span>
        </div>
      </div>

      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/85 border border-slate-700/80 backdrop-blur-md shadow-xl">
        <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Gate Status</div>
          <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            140 e-Passes Verified Today
          </div>
        </div>
      </div>
    </div>
  );
};
