import React, { useState } from 'react';
import { 
  Search, 
  CheckCircle2, 
  Clock, 
  Ship, 
  Boxes, 
  FileCheck2, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  Anchor, 
  Truck, 
  Check, 
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../../services/api';
import { PublicContainerTrackingResult } from '../../types';

interface StageDefinition {
  key: string;
  label: string;
  subLabel: string;
  icon: React.ElementType;
}

const TRACKING_STAGES: StageDefinition[] = [
  { key: 'REGISTERED', label: 'Registered', subLabel: 'Container Registered', icon: FileCheck2 },
  { key: 'ARRIVED', label: 'Arrived', subLabel: 'Container Arrived', icon: Anchor },
  { key: 'AT_TERMINAL', label: 'At Terminal', subLabel: 'Container At Terminal', icon: Layers },
  { key: 'UNDER_INSPECTION', label: 'Under Inspection', subLabel: 'Under Customs Inspection', icon: ShieldCheck },
  { key: 'CLEARED', label: 'Customs Cleared', subLabel: 'Customs Cleared', icon: CheckCircle2 },
  { key: 'RELEASED', label: 'Gate Released', subLabel: 'Gate Released', icon: Truck },
];

export const PublicContainerTracker: React.FC = () => {
  const [containerNumberInput, setContainerNumberInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingResult, setTrackingResult] = useState<PublicContainerTrackingResult | null>(null);

  const executeTrack = async (query: string) => {
    const cleaned = query.trim();
    if (!cleaned) {
      setError('Please enter a container number to track.');
      setTrackingResult(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/containers/track/?number=${encodeURIComponent(cleaned)}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      const json = await response.json();

      if (response.ok && json.status === 'success' && json.data) {
        setTrackingResult(json.data);
        setError(null);
      } else {
        setTrackingResult(null);
        setError('Container not found. Please check the container number and try again.');
      }
    } catch {
      setTrackingResult(null);
      setError('Container not found. Please check the container number and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Support URL query parameter e.g. /?container=MSCU3456789 or /?track=MSCU3456789
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const urlQuery = searchParams.get('container') || searchParams.get('track') || searchParams.get('number');
      if (urlQuery && urlQuery.trim()) {
        const cleaned = urlQuery.trim();
        setContainerNumberInput(cleaned);
        executeTrack(cleaned);
      }
    }
  }, []);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    executeTrack(containerNumberInput);
  };

  const handleResetSearch = () => {
    setTrackingResult(null);
    setError(null);
    setContainerNumberInput('');
  };

  // Determine stage status
  const currentStatusRaw = trackingResult?.current_status?.toUpperCase() || '';
  const isHold = currentStatusRaw === 'CUSTOMS_HOLD';

  let currentStageIndex = 0;
  if (currentStatusRaw === 'RELEASED') {
    currentStageIndex = 5;
  } else if (currentStatusRaw === 'CLEARED') {
    currentStageIndex = 4;
  } else if (currentStatusRaw === 'UNDER_INSPECTION' || currentStatusRaw === 'AWAITING_CUSTOMS' || isHold) {
    currentStageIndex = 3;
  } else if (currentStatusRaw === 'AT_TERMINAL') {
    currentStageIndex = 2;
  } else if (currentStatusRaw === 'ARRIVED') {
    currentStageIndex = 1;
  } else {
    currentStageIndex = 0; // REGISTERED
  }

  return (
    <div className="w-full space-y-8">
      {/* 1. SEARCH INPUT BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-5 space-y-2">
          <span className="text-xs font-black uppercase tracking-widest text-[#064e43]">
            QUICK CONTAINER & MANIFEST TRACKER
          </span>
          <h3 className="text-2xl font-black uppercase tracking-tight text-[#08192d]">
            TRACK YOUR CARGO
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            Enter your container ID or bill of lading reference to view the current cargo status.
          </p>
        </div>

        <div className="lg:col-span-7">
          <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              id="public-container-search-input"
              placeholder="e.g. MSCU3456789"
              value={containerNumberInput}
              onChange={(e) => {
                setContainerNumberInput(e.target.value);
                if (error) setError(null);
              }}
              className="flex-1 px-5 py-4 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm font-semibold focus:outline-none focus:border-[#c88d27] focus:ring-2 focus:ring-[#c88d27]/20 transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={loading}
              id="public-container-track-btn"
              className="px-8 py-4 rounded-xl bg-[#c88d27] hover:bg-[#b57e1e] text-white text-xs font-black uppercase tracking-wider shadow-md hover:shadow-amber-500/20 flex items-center justify-center gap-2 shrink-0 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer border border-[#c88d27] disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Tracking...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>TRACK STATUS</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* 2. ERROR DISPLAY (User-friendly, no DB/tech details) */}
      {error && (
        <div 
          id="public-tracking-error"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-xs sm:text-sm font-semibold animate-in fade-in duration-200"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <p className="flex-1">{error}</p>
        </div>
      )}

      {/* 3. TRACKING RESULT DISPLAY */}
      {trackingResult && (
        <div 
          id="public-tracking-result"
          className="rounded-2xl bg-white border border-slate-200/90 shadow-xl overflow-hidden divide-y divide-slate-100 transition-all animate-in fade-in duration-300"
        >
          {/* Top Result Banner */}
          <div className="p-6 sm:p-8 bg-gradient-to-r from-slate-900 via-[#08192d] to-[#064e43] text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400/90">
                CONTAINER RECORD VERIFIED
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                  {trackingResult.container_number}
                </h4>
                {/* Status Pill */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                  isHold
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : currentStatusRaw === 'RELEASED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : currentStatusRaw === 'CLEARED'
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    isHold ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'
                  }`} />
                  {isHold ? 'CUSTOMS HOLD' : trackingResult.current_status_display.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetSearch}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Track Another Container</span>
              </button>
            </div>
          </div>

          {/* Key Information 4-Grid */}
          <div className="p-6 sm:p-8 bg-slate-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Cargo Description */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-slate-500">
                  <Boxes className="w-4 h-4 text-[#064e43]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cargo</span>
                </div>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {trackingResult.cargo_description || '—'}
                </p>
              </div>

              {/* Cargo Type */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-slate-500">
                  <Layers className="w-4 h-4 text-[#064e43]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cargo Type</span>
                </div>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {trackingResult.cargo_type || 'Containerized'}
                </p>
              </div>

              {/* Vessel Name */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-slate-500">
                  <Ship className="w-4 h-4 text-[#064e43]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vessel</span>
                </div>
                <p className="text-sm font-bold text-slate-900 truncate">
                  {trackingResult.vessel_name || '—'}
                </p>
              </div>

              {/* Arrival Request ID */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                <div className="flex items-center gap-2 text-slate-500">
                  <FileCheck2 className="w-4 h-4 text-[#064e43]" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Arrival Request</span>
                </div>
                <p className="text-sm font-bold font-mono text-sky-700 truncate">
                  {trackingResult.arrival_request_id || '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Operational Progress Stepper / Amazon-Style Delivery Timeline */}
          <div className="p-6 sm:p-8 space-y-6">
            {trackingResult.is_delivery_stage && trackingResult.timeline ? (
              /* ================= AMAZON-STYLE DELIVERY TRACKING ================= */
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200">
                  <div className="space-y-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800">
                      CONTAINER DELIVERY LIFECYCLE
                    </span>
                    <h5 className="text-base sm:text-lg font-black text-slate-900">
                      {trackingResult.status_message || 'Your container is currently moving through the post-release delivery pipeline.'}
                    </h5>
                    {trackingResult.destination && (
                      <p className="text-xs sm:text-sm text-slate-600 font-medium">
                        <strong className="text-slate-800">Destination:</strong> {trackingResult.destination}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 text-xs">
                    {trackingResult.last_known_location && (
                      <div className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold shadow-xs">
                        <span className="text-slate-400 font-normal">Location: </span>
                        {trackingResult.last_known_location}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-600 font-bold bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs shrink-0">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>{trackingResult.last_updated}</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal Stepper (Desktop) & Vertical (Mobile) */}
                <div className="py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    {trackingResult.timeline.map((item, idx) => {
                      const isCompleted = item.status === 'completed';
                      const isCurrent = item.status === 'current';
                      const isPending = item.status === 'pending';

                      return (
                        <div
                          key={item.step}
                          className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                            isCurrent
                              ? 'bg-emerald-500 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20'
                              : isCompleted
                              ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                              : 'bg-slate-50 border-slate-200 text-slate-400 opacity-75'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] font-mono font-black ${isCurrent ? 'text-emerald-100' : 'text-slate-400'}`}>
                                STEP {idx + 1}
                              </span>
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                  isCurrent
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : isCompleted
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-slate-200 text-slate-400'
                                }`}
                              >
                                {isCompleted ? (
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                ) : isCurrent ? (
                                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                                ) : (
                                  <span>○</span>
                                )}
                              </div>
                            </div>

                            <h6
                              className={`text-xs font-black uppercase tracking-wider mb-1 leading-tight ${
                                isCurrent ? 'text-white' : isCompleted ? 'text-emerald-950' : 'text-slate-500'
                              }`}
                            >
                              {item.label}
                            </h6>

                            <div className="text-[11px] font-semibold">
                              {isCurrent ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-700 text-emerald-100 text-[10px] font-black uppercase">
                                  Current Status
                                </span>
                              ) : isCompleted ? (
                                <span className="text-emerald-700 font-bold">✓ Completed</span>
                              ) : (
                                <span className="text-slate-400">Pending</span>
                              )}
                            </div>
                          </div>

                          <div className={`mt-3 pt-2 border-t text-[11px] ${
                            isCurrent ? 'border-emerald-400/50 text-emerald-100' : 'border-slate-200/60 text-slate-500'
                          }`}>
                            <div className="font-semibold truncate">
                              {item.timestamp || '—'}
                            </div>
                            {item.location && (
                              <div className="text-[10px] opacity-80 truncate">
                                {item.location}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* E-Commerce Amazon-style Checklist summary */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Verified Operational Delivery Milestones
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {trackingResult.timeline.map((step) => (
                      <div
                        key={`sum-${step.step}`}
                        className={`flex items-start gap-2 p-2 rounded-lg ${
                          step.status === 'completed'
                            ? 'bg-emerald-50/80 text-emerald-800 border border-emerald-200/80'
                            : step.status === 'current'
                            ? 'bg-emerald-600 text-white font-bold shadow-xs'
                            : 'bg-white text-slate-400 border border-slate-200/60'
                        }`}
                      >
                        <span className="font-black text-sm">
                          {step.status === 'completed' ? '✓' : step.status === 'current' ? '●' : '○'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold truncate text-[11px] uppercase tracking-wide">
                            {step.label}
                          </p>
                          <p className={`text-[10px] truncate ${step.status === 'current' ? 'text-emerald-100' : 'text-slate-500'}`}>
                            {step.timestamp || 'Pending operational milestone'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* ================= PRE-RELEASE PORT WORKFLOW ================= */
              <>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-black uppercase tracking-wider text-[#08192d]">
                      Operational Progress Lifecycle
                    </h5>
                    <p className="text-xs text-slate-500 font-medium">
                      Verified tracking timeline synchronized with PORTIDE port operations
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold bg-slate-100 px-3 py-1.5 rounded-lg shrink-0">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>Last Updated: {trackingResult.last_updated}</span>
                  </div>
                </div>

                {/* Stepper Graphic (Horizontal on Desktop, Vertical on Mobile) */}
                <div className="pt-4 pb-2">
                  <div className="relative">
                    {/* Connecting Track Line for Desktop */}
                    <div className="hidden lg:block absolute top-1/2 left-8 right-8 h-1 bg-slate-200 -translate-y-1/2 -z-0" />
                    
                    {/* Completed progress line fill */}
                    <div 
                      className="hidden lg:block absolute top-1/2 left-8 h-1 bg-emerald-500 -translate-y-1/2 -z-0 transition-all duration-500"
                      style={{
                        width: isHold
                          ? '50%'
                          : `${Math.min(100, Math.max(0, (currentStageIndex / (TRACKING_STAGES.length - 1)) * 90))}%`
                      }}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 relative z-10">
                      {TRACKING_STAGES.map((stage, idx) => {
                        const isCompleted = isHold ? idx < 3 : idx < currentStageIndex || (idx === 5 && currentStatusRaw === 'RELEASED');
                        const isCurrent = isHold ? idx === 3 : (idx === currentStageIndex && currentStatusRaw !== 'RELEASED');
                        const isHoldStage = isHold && idx === 3;

                        return (
                          <div 
                            key={stage.key} 
                            className={`p-3.5 rounded-xl border transition-all flex flex-col items-center text-center ${
                              isHoldStage
                                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
                                : isCurrent
                                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20 shadow-sm'
                                : isCompleted
                                ? 'bg-slate-50 border-emerald-200/80 shadow-2xs'
                                : 'bg-white border-slate-200 opacity-60'
                            }`}
                          >
                            {/* Icon Node */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black mb-2 transition-all ${
                              isHoldStage
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                : isCurrent
                                ? 'bg-[#064e43] text-white shadow-md shadow-[#064e43]/30 ring-4 ring-emerald-100'
                                : isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-slate-100 text-slate-400 border border-slate-300'
                            }`}>
                              {isHoldStage ? (
                                <AlertTriangle className="w-5 h-5" />
                              ) : isCompleted ? (
                                <Check className="w-5 h-5 stroke-[3]" />
                              ) : isCurrent ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                              ) : (
                                <span>○</span>
                              )}
                            </div>

                            {/* Stage Name */}
                            <span className={`text-xs font-black uppercase tracking-wider ${
                              isHoldStage 
                                ? 'text-rose-700' 
                                : isCurrent 
                                ? 'text-[#064e43]' 
                                : isCompleted 
                                ? 'text-slate-900' 
                                : 'text-slate-400'
                            }`}>
                              {isHoldStage ? 'Customs Hold' : stage.label}
                            </span>

                            {/* Status Label */}
                            <span className={`text-[10px] font-semibold mt-0.5 ${
                              isHoldStage 
                                ? 'text-rose-600 font-bold' 
                                : isCurrent 
                                ? 'text-emerald-700 font-bold' 
                                : isCompleted 
                                ? 'text-emerald-600' 
                                : 'text-slate-400'
                            }`}>
                              {isHoldStage 
                                ? 'Customs Hold' 
                                : isCurrent 
                                ? trackingResult.current_status_display 
                                : isCompleted 
                                ? 'Completed' 
                                : 'Pending'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Checklist View (Matching Requirement 5 Specification) */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Operational Checklist
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-semibold">
                    {TRACKING_STAGES.map((stage, idx) => {
                      const isCompleted = isHold ? idx < 3 : idx < currentStageIndex || (idx === 5 && currentStatusRaw === 'RELEASED');
                      const isHoldStage = isHold && idx === 3;
                      const isCurrent = isHold ? false : (idx === currentStageIndex && currentStatusRaw !== 'RELEASED');

                      return (
                        <div 
                          key={`chk-${stage.key}`}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${
                            isHoldStage
                              ? 'bg-rose-50 text-rose-800 border border-rose-200'
                              : isCurrent
                              ? 'bg-emerald-50 text-[#064e43] font-bold border border-emerald-200'
                              : isCompleted
                              ? 'text-emerald-700'
                              : 'text-slate-400'
                          }`}
                        >
                          <span className="font-mono font-black text-sm">
                            {isHoldStage ? '⚠' : isCompleted ? '✓' : isCurrent ? '▶' : '○'}
                          </span>
                          <span className="truncate">
                            {isHoldStage ? 'Customs Hold' : stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Note & Security Assurance */}
          <div className="p-4 sm:px-8 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#064e43]" />
              <span>Official PORTIDE Public Cargo Tracking • Real-time Terminal Status</span>
            </div>
            <div className="text-[11px] font-medium text-slate-400">
              Read-Only Cargo Record • Sensitive Operations Protected
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
