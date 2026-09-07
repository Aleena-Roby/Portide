import React, { useState, useEffect } from 'react';
import { BackendVessel, BerthAvailabilityEvaluation } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { cleanBerthDisplayName } from '../../../utils/berthUtils';
import { 
  Anchor, 
  Check, 
  X, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Ship, 
  Wrench, 
  CheckCircle2, 
  XCircle, 
  Compass, 
  Layers,
  ChevronRight,
  Info
} from 'lucide-react';

interface GraphicalBerthSelectionProps {
  vessel?: BackendVessel | null;
  selectedVessel?: BackendVessel | null;
  arrivalDate: string;
  arrivalTime: string;
  departureDate: string;
  departureTime: string;
  durationHours?: number;
  selectedBerthId: number | null;
  onSelectBerth: (berthId: number | null, berth: BerthAvailabilityEvaluation | null) => void;
}

export const GraphicalBerthSelection: React.FC<GraphicalBerthSelectionProps> = ({
  vessel,
  selectedVessel,
  arrivalDate,
  arrivalTime,
  departureDate,
  departureTime,
  durationHours = 0,
  selectedBerthId,
  onSelectBerth
}) => {
  const effectiveVessel = vessel || selectedVessel || null;
  const { currentUser, addToast } = useApp();

  const [evaluations, setEvaluations] = useState<BerthAvailabilityEvaluation[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [inspectedBerth, setInspectedBerth] = useState<BerthAvailabilityEvaluation | null>(null);

  const fetchAvailability = async () => {
    if (!effectiveVessel || !arrivalDate || !arrivalTime || !departureDate || !departureTime) {
      return;
    }

    setLoading(true);
    setError('');

    const isoArrival = `${arrivalDate}T${arrivalTime}:00`;
    const isoDeparture = `${departureDate}T${departureTime}:00`;

    try {
      const query = new URLSearchParams({
        vessel_id: String(effectiveVessel.vessel_id),
        arrival_at: isoArrival,
        departure_at: isoDeparture
      });

      const response = await fetch(`http://127.0.0.1:8000/api/berths/check-availability/?${query.toString()}`, {
        headers: {
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'shipping_company',
          'X-User-Id': currentUser?.id || ''
        }
      });

      const json = await response.json();
      setLoading(false);

      if (response.ok && json.status === 'success') {
        const berthsData: BerthAvailabilityEvaluation[] = json.data?.berths || [];
        setEvaluations(berthsData);

        // Keep inspected berth in sync if already selected
        if (selectedBerthId) {
          const matching = berthsData.find(b => b.berth_id === selectedBerthId);
          if (matching) {
            setInspectedBerth(matching);
            // If the previously selected berth is no longer available/suitable, notify user
            if (!matching.can_select_as_preferred) {
              onSelectBerth(null, null);
              addToast('warning', 'Berth Availability Changed', `Selected berth ${cleanBerthDisplayName(matching.berth_name)} is no longer available for this time window.`);
            }
          }
        }
      } else {
        setError(json.message || 'Failed to check berth availability.');
      }
    } catch (err) {
      setLoading(false);
      setError('Unable to retrieve berth availability. Please ensure server is running.');
    }
  };

  useEffect(() => {
    if (effectiveVessel?.vessel_id && arrivalDate && arrivalTime && departureDate && departureTime) {
      fetchAvailability();
    } else {
      setEvaluations([]);
      setInspectedBerth(null);
    }
  }, [effectiveVessel?.vessel_id, arrivalDate, arrivalTime, departureDate, departureTime]);

  if (!effectiveVessel) {
    return (
      <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2.5">
        <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto">
          <Ship className="w-5 h-5" />
        </div>
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
          Select a Registered Vessel Above
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Please select a vessel from the dropdown to check physical dimensions, draft clearance, and quayside berth availability in real time.
        </p>
      </div>
    );
  }

  const selectedEvaluation = evaluations.find(b => b.berth_id === selectedBerthId);

  const handleBerthCardClick = (berth: BerthAvailabilityEvaluation) => {
    setInspectedBerth(berth);
  };

  const handleConfirmPreferredSelection = (berth: BerthAvailabilityEvaluation) => {
    if (!berth.can_select_as_preferred) return;

    if (selectedBerthId === berth.berth_id) {
      // Toggle off
      onSelectBerth(null, null);
      addToast('info', 'Berth Selection Cleared', 'Preferred berth selection removed.');
    } else {
      onSelectBerth(berth.berth_id, berth);
      addToast('success', 'Preferred Berth Selected', `${cleanBerthDisplayName(berth.berth_name)} selected as your preferred berth.`);
    }
  };

  return (
    <div className="space-y-4">
      {/* SECTION HEADER & REFRESH */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 rounded-xl bg-slate-900 text-white shadow-sm border border-slate-800">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-400">
            <Compass className="w-3.5 h-3.5" />
            <span>Graphical Berth Selection Engine</span>
          </div>
          <h4 className="text-sm font-black tracking-tight text-white mt-0.5">
            Port Quayside & Berth Availability
          </h4>
          <p className="text-[11px] text-slate-400">
            Evaluating suitability for <strong className="text-white">{effectiveVessel.vessel_name}</strong> (Length: {effectiveVessel.vessel_length}m, Draft: {effectiveVessel.vessel_draft}m).
          </p>
        </div>

        <button
          type="button"
          onClick={fetchAvailability}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
          title="Refresh current berth availability from backend"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-sky-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* LOADING STATE */}
      {loading ? (
        <div className="p-10 text-center space-y-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-7 h-7 mx-auto text-sky-500 animate-spin" />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Checking berth dimensions, physical draft, and operational schedules...
          </p>
          <p className="text-[10px] text-slate-400">Verifying live PostgreSQL time-window allocations</p>
        </div>
      ) : (
        <>
          {/* BERTH PIERS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {evaluations.map((berth) => {
              const isSelected = selectedBerthId === berth.berth_id;
              const isInspected = inspectedBerth?.berth_id === berth.berth_id;

              // Card styling depending on suitability status
              let cardTheme = '';
              let badgeColor = '';
              let statusLabel = '';

              switch (berth.suitability_status) {
                case 'AVAILABLE':
                  cardTheme = isSelected 
                    ? 'border-sky-500 ring-2 ring-sky-500 bg-sky-500/10 dark:bg-sky-950/40' 
                    : 'border-emerald-500/40 hover:border-emerald-500 bg-white dark:bg-slate-900 hover:shadow-md cursor-pointer';
                  badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
                  statusLabel = 'Suitable & Available';
                  break;

                case 'SUITABLE_PENDING':
                  cardTheme = isSelected
                    ? 'border-amber-500 ring-2 ring-amber-500 bg-amber-500/10 dark:bg-amber-950/40'
                    : 'border-amber-500/40 hover:border-amber-500 bg-white dark:bg-slate-900 hover:shadow-md cursor-pointer';
                  badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
                  statusLabel = 'Pending Allocation';
                  break;

                case 'OCCUPIED':
                  cardTheme = 'border-rose-300 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 opacity-80 cursor-not-allowed';
                  badgeColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
                  statusLabel = 'Occupied / Allocated';
                  break;

                case 'MAINTENANCE':
                  cardTheme = 'border-purple-300 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 opacity-75 cursor-not-allowed border-dashed';
                  badgeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30';
                  statusLabel = 'Maintenance';
                  break;

                case 'INACTIVE':
                  cardTheme = 'border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 opacity-60 cursor-not-allowed';
                  badgeColor = 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30';
                  statusLabel = 'Inactive';
                  break;

                case 'NOT_SUITABLE':
                default:
                  cardTheme = 'border-rose-200 dark:border-rose-900/40 bg-slate-50/80 dark:bg-slate-900/60 opacity-75 cursor-not-allowed';
                  badgeColor = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
                  statusLabel = 'Not Suitable';
                  break;
              }

              return (
                <div
                  key={berth.berth_id}
                  onClick={() => handleBerthCardClick(berth)}
                  className={`relative p-3.5 rounded-2xl border transition-all flex flex-col justify-between select-none ${cardTheme}`}
                >
                  {/* TOP ROW: Berth Name & Status Pill */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        <Anchor className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="font-black text-slate-900 dark:text-white text-xs leading-none">
                          {cleanBerthDisplayName(berth.berth_name)}
                        </div>
                        {berth.berth_code && (
                          <span className="font-mono text-[9px] text-slate-400">
                            Code: {berth.berth_code}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${badgeColor}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* SPECIFICATIONS & VESSEL MATCH METRICS */}
                  <div className="my-2.5 p-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 space-y-1 text-[10px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Max Vessel Length:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {berth.berth_max_length}m
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Max Berth Draft:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-200">
                        {berth.berth_max_draft}m
                      </span>
                    </div>

                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between font-medium">
                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${
                        berth.is_length_compatible ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {berth.is_length_compatible ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                        <span>Length {berth.is_length_compatible ? 'OK' : 'Exceeded'}</span>
                      </span>

                      <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${
                        berth.is_draft_compatible ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {berth.is_draft_compatible ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                        <span>Draft {berth.is_draft_compatible ? 'OK' : 'Exceeded'}</span>
                      </span>
                    </div>
                  </div>

                  {/* REJECTION REASON OR STATUS NOTE */}
                  {berth.rejection_reasons.length > 0 && (
                    <div className="text-[9px] text-rose-600 dark:text-rose-400 font-medium line-clamp-2 mb-2 leading-tight">
                      ⚠️ {berth.rejection_reasons[0]}
                    </div>
                  )}

                  {berth.suitability_status === 'SUITABLE_PENDING' && (
                    <div className="text-[9px] text-amber-600 dark:text-amber-400 font-medium mb-2 leading-tight">
                      🟡 {berth.pending_request_count} pending request(s) exist. Final approval by Port Ops.
                    </div>
                  )}

                  {/* BOTTOM ACTION: SELECT OR VIEW */}
                  <div className="pt-1 flex items-center justify-between gap-1">
                    {berth.can_select_as_preferred ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleConfirmPreferredSelection(berth);
                        }}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-sm'
                            : 'bg-slate-200 dark:bg-slate-800 hover:bg-sky-600 hover:text-white text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Preferred Berth</span>
                          </>
                        ) : (
                          <span>Select as Preferred</span>
                        )}
                      </button>
                    ) : (
                      <div className="w-full text-center py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Not Selectable
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* INSPECTED BERTH DETAILS DRAWER / CARD */}
          {inspectedBerth && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 animate-fade-in">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Berth Operational Specifications
                  </div>
                  <h5 className="font-black text-slate-900 dark:text-white text-sm">
                    {cleanBerthDisplayName(inspectedBerth.berth_name)}
                  </h5>
                </div>

                <div className="flex items-center gap-2">
                  {inspectedBerth.can_select_as_preferred && (
                    <button
                      type="button"
                      onClick={() => handleConfirmPreferredSelection(inspectedBerth)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectedBerthId === inspectedBerth.berth_id
                          ? 'bg-rose-600 hover:bg-rose-700 text-white'
                          : 'bg-sky-600 hover:bg-sky-700 text-white'
                      }`}
                    >
                      {selectedBerthId === inspectedBerth.berth_id ? (
                        <>
                          <X className="w-3 h-3" />
                          <span>Remove Preferred</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Set as Preferred Berth</span>
                        </>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setInspectedBerth(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase font-bold">Max Length</div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                    {inspectedBerth.berth_max_length} m
                  </div>
                  <div className="text-[9px] text-slate-500">Vessel: {effectiveVessel.vessel_length}m</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase font-bold">Max Draft</div>
                  <div className="font-mono font-bold text-emerald-600 mt-0.5">
                    {inspectedBerth.berth_max_draft} m
                  </div>
                  <div className="text-[9px] text-slate-500">Vessel: {effectiveVessel.vessel_draft}m</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase font-bold">Time Window</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {durationHours} Hours
                  </div>
                  <div className="text-[9px] text-slate-500">{arrivalDate} → {departureDate}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-[9px] text-slate-400 uppercase font-bold">Status</div>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {inspectedBerth.suitability_status}
                  </div>
                  <div className="text-[9px] text-slate-500">
                    {inspectedBerth.can_select_as_preferred ? 'Selectable' : 'Unavailable'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE SELECTION SUMMARY BANNER */}
          {selectedEvaluation && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent border border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Nominated Preferred Berth
                  </div>
                  <div className="font-black text-slate-900 dark:text-white text-sm">
                    {cleanBerthDisplayName(selectedEvaluation.berth_name)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Final allocation will be reviewed and assigned by the Port Operations Officer.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => onSelectBerth(null, null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
            </div>
          )}

          {/* VISUAL LEGEND */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Legend:</span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Suitable & Available</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Pending Allocation</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-rose-600 dark:text-rose-400">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Occupied / Allocated</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-purple-600 dark:text-purple-400">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Maintenance</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>Not Suitable</span>
            </span>
          </div>
        </>
      )}
    </div>
  );
};
