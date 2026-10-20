import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Clock,
  Truck,
  MapPin,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Send,
  Building,
  FileText,
  Boxes
} from 'lucide-react';
import { DeliveryContainerDetail } from '../../types';
import { deliveryApi } from '../../services/api';
import { formatTrackingDateTime, getTrackingStatusMeta, formatDeliveryScheduleDateTime } from '../../utils/trackingFormatters';

interface ContainerTrackingModalProps {
  containerId: number;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated?: () => void;
  userRole?: string;
}

/**
 * Read-Only Container Delivery Tracking & Event History Modal.
 *
 * Responsibility:
 * - Read-only monitoring of container delivery progression and chronological audit history.
 * - Displays live status, milestone timeline, operational attributes, and recorded events.
 * - Does NOT mutate delivery state (all updates belong exclusively to UpdateDeliveryModal).
 */
export const ContainerTrackingModal: React.FC<ContainerTrackingModalProps> = ({
  containerId,
  isOpen,
  onClose,
}) => {
  const [detail, setDetail] = useState<DeliveryContainerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deliveryApi.getContainerDetail(containerId);
      const data = res.data || res;
      if ((res.status === 'success' && res.data) || data?.container_id) {
        setDetail({
          ...data,
          tracking_history: data.tracking_history || data.history_events || [],
          timeline: data.timeline || [],
        });
      } else {
        setError(res.message || 'Failed to load container tracking details.');
      }
    } catch {
      setError('Unable to load tracking history. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && containerId) {
      fetchDetail();
    }
  }, [isOpen, containerId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-[#08192d] to-[#064e43] text-white flex items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                CONTAINER DELIVERY TRACKING
              </span>
              {detail && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/20 text-white">
                  {detail.container_type || 'Standard'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <h3 className="text-xl sm:text-2xl font-black font-mono tracking-wider text-white">
                {detail ? detail.container_number : 'Loading Tracking...'}
              </h3>
              {detail && (
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    detail.container_delivery_status === 'DELIVERED'
                      ? 'bg-emerald-500 text-white'
                      : detail.container_delivery_status === 'DELIVERY_EXCEPTION'
                      ? 'bg-rose-500 text-white'
                      : detail.container_delivery_status === 'OUT_FOR_DELIVERY'
                      ? 'bg-amber-400 text-slate-900 font-extrabold'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  {detail.container_delivery_status_display}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RotateCw className="w-8 h-8 animate-spin text-[#064e43]" />
              <p className="text-sm font-semibold">Loading verified tracking milestones...</p>
            </div>
          ) : error && !detail ? (
            <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 space-y-3">
              <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-rose-950">Unable to load tracking history.</h4>
                <p className="text-xs text-rose-700 mt-1">Please refresh and try again.</p>
              </div>
              <button
                onClick={fetchDetail}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-sm"
              >
                Retry
              </button>
            </div>
          ) : detail ? (
            <>
              {/* Current Milestone Status Banner */}
              {(() => {
                const currentStatusKey = detail.container_delivery_status || 'RELEASED';
                const currentMeta = getTrackingStatusMeta(currentStatusKey);
                return (
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#08192d] via-[#092923] to-[#064e43] text-white shadow-md border border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300 block">
                        Current Delivery Status
                      </span>
                      <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                        {detail.container_delivery_status_display || currentMeta.title}
                      </h4>
                      <p className="text-xs text-emerald-100/90 font-medium max-w-xl leading-relaxed">
                        <strong className="text-white">Current Milestone: </strong>
                        {currentMeta.defaultDescription}
                      </p>
                    </div>

                    <div className="sm:text-right shrink-0 sm:border-l sm:border-white/10 sm:pl-5 space-y-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Last Recorded Operational Location
                      </span>
                      <span className="text-xs font-bold text-white block">
                        {detail.container_delivery_location || detail.last_known_location || 'Port Terminal Yard'}
                      </span>
                      <span className="text-[11px] font-mono text-emerald-300 block">
                        {(() => {
                          const lastFormatted = formatTrackingDateTime((detail as any).last_updated_iso || detail.last_updated, detail.last_updated);
                          return lastFormatted.full && !lastFormatted.full.toLowerCase().includes('unavailable')
                            ? `Updated: ${lastFormatted.full}`
                            : (detail.last_updated ? `Updated: ${detail.last_updated}` : 'Status Verified');
                        })()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* 1. AMAZON-STYLE TRACKING TIMELINE */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Delivery Progression
                  </span>
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Last Updated: {(() => {
                      const lastFormatted = formatTrackingDateTime((detail as any).last_updated_iso || detail.last_updated, detail.last_updated);
                      return lastFormatted.full && !lastFormatted.full.toLowerCase().includes('unavailable')
                        ? lastFormatted.full
                        : (detail.last_updated || 'Just now');
                    })()}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                  {detail.timeline.map((step, idx) => {
                    const isCompleted = step.status === 'completed';
                    const isCurrent = step.status === 'current';

                    return (
                      <div
                        key={step.step || (step as any).key || idx}
                        className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/20'
                            : isCompleted
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                            : 'bg-white border-slate-200 text-slate-400 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-[10px] font-mono font-black ${isCurrent ? 'text-emerald-100' : 'text-slate-400'}`}>
                              #{idx + 1}
                            </span>
                            <div
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black ${
                                isCurrent
                                  ? 'bg-white text-emerald-700'
                                  : isCompleted
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-slate-100 text-slate-400'
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

                          <h5 className={`text-xs font-black uppercase tracking-wide leading-tight ${
                            isCurrent ? 'text-white' : isCompleted ? 'text-emerald-900' : 'text-slate-600'
                          }`}>
                            {step.label}
                          </h5>

                          <div className="mt-1">
                            {isCurrent ? (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-800 text-white">
                                Current Status
                              </span>
                            ) : isCompleted ? (
                              <span className="text-[10px] text-emerald-700 font-bold">✓ Completed</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">Pending</span>
                            )}
                          </div>
                        </div>

                        <div className={`mt-2 pt-1.5 border-t text-[10px] font-medium truncate ${
                          isCurrent ? 'border-emerald-500 text-emerald-100' : 'border-slate-100 text-slate-500'
                        }`}>
                          {(() => {
                            if (step.status === 'pending') {
                              return 'Pending';
                            }
                            const rawStepTs = (step as any).timestamp_iso || step.timestamp;
                            const formatted = formatTrackingDateTime(rawStepTs, step.timestamp);
                            if (formatted.full && !formatted.full.toLowerCase().includes('unavailable')) {
                              return formatted.full;
                            }
                            return step.timestamp && !step.timestamp.toLowerCase().includes('invalid') ? step.timestamp : 'Date/time unavailable';
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* COMPLETED DELIVERY SUMMARY (DELIVERED STATUS ONLY) */}
              {(() => {
                const currentStatusKey = (
                  detail.container_delivery_status ||
                  detail.current_status ||
                  'RELEASED'
                ).toUpperCase();
                const isDelivered = currentStatusKey === 'DELIVERED';

                if (!isDelivered) return null;

                const deliveredRawTimestamp =
                  detail.actual_delivery_datetime ||
                  detail.container_delivered_at ||
                  detail.delivered_at ||
                  detail.tracking_history?.find(
                    (ev) =>
                      (ev.status || ev.tracking_event_status || '').toUpperCase() === 'DELIVERED'
                  )?.timestamp;

                const actualDeliveryFormatted = formatTrackingDateTime(
                  deliveredRawTimestamp,
                  detail.delivered_at_formatted
                );

                const expectedRawTimestamp =
                  detail.expected_delivery_datetime ||
                  detail.container_expected_delivery_date ||
                  detail.expected_delivery_date;

                const expectedDeliveryFormatted = formatDeliveryScheduleDateTime(
                  expectedRawTimestamp,
                  detail.expected_delivery_date_formatted
                );

                const deliveredByName = (() => {
                  const name = detail.delivered_by_name || detail.container_delivered_by_name;
                  if (name && name.trim()) {
                    return name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
                  }
                  const delEvent = detail.tracking_history?.find(
                    (ev) => (ev.status || ev.tracking_event_status || '').toUpperCase() === 'DELIVERED'
                  );
                  if (delEvent?.updated_by_name) {
                    return delEvent.updated_by_name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
                  }
                  return 'Operations Desk';
                })();

                const deliveredByRole = (() => {
                  if (detail.delivered_by_role && detail.delivered_by_role.trim()) {
                    return detail.delivered_by_role.trim();
                  }
                  const delEvent = detail.tracking_history?.find(
                    (ev) => (ev.status || ev.tracking_event_status || '').toUpperCase() === 'DELIVERED'
                  );
                  if (delEvent?.updated_by_role) {
                    return delEvent.updated_by_role.trim();
                  }
                  return 'Terminal & Logistics Operator';
                })();

                const driverName = detail.driver_name && detail.driver_name !== '—'
                  ? detail.driver_name.trim().replace(/\b\w/g, (c) => c.toUpperCase())
                  : 'Not available';

                const vehicleNumber = detail.truck_number && detail.truck_number !== '—'
                  ? detail.truck_number
                  : 'Not available';

                const gatePassNumber = detail.gate_pass_number && detail.gate_pass_number !== '—'
                  ? detail.gate_pass_number
                  : 'Not available';

                const cargoDesc = detail.cargo_description && detail.cargo_description !== '—'
                  ? detail.cargo_description
                  : 'Not available';

                const vesselName = detail.vessel_name && detail.vessel_name !== '—'
                  ? detail.vessel_name
                  : 'Not available';

                const destinationFacility =
                  detail.final_delivery_destination ||
                  detail.container_delivery_destination ||
                  detail.destination ||
                  'Not available';

                const deliveryLocation =
                  detail.delivery_location ||
                  detail.container_delivery_location ||
                  destinationFacility ||
                  'Consignee Delivery Facility';

                const deliveryRef =
                  detail.delivery_reference ||
                  detail.container_delivery_recipient ||
                  detail.delivery_recipient ||
                  (detail.gate_pass_number && detail.gate_pass_number !== '—'
                    ? `GP-REF-${detail.gate_pass_number}`
                    : 'Not available');

                return (
                  <div className="rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/30 to-white p-5 shadow-sm space-y-4">
                    {/* Completion Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm ring-4 ring-emerald-500/15">
                          <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                          <h4 className="text-base font-black text-emerald-950 tracking-tight flex items-center gap-2">
                            Delivery Completed
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-700 text-white shadow-2xs">
                              DELIVERED
                            </span>
                          </h4>
                          <p className="text-xs text-emerald-800 font-medium pt-0.5">
                            Container successfully delivered to the recorded destination.
                          </p>
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0 bg-white/80 border border-emerald-200 px-3.5 py-2 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 block">
                          Actual Delivery Recorded
                        </span>
                        <span className="text-xs font-mono font-black text-slate-900 block">
                          {actualDeliveryFormatted.full}
                        </span>
                      </div>
                    </div>

                    {/* Section Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-emerald-800" />
                        <h5 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                          DELIVERY SUMMARY
                        </h5>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded-full">
                        Final Operational Record
                      </span>
                    </div>

                    {/* Summary Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                      {/* Container */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Container
                        </span>
                        <p className="text-sm font-mono font-black text-slate-900">
                          {detail.container_number || 'Not available'}
                        </p>
                      </div>

                      {/* Final Status */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Final Status
                        </span>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-300 px-2.5 py-0.5 rounded-lg">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            DELIVERED
                          </span>
                        </div>
                      </div>

                      {/* Delivered On */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Delivered On
                        </span>
                        <p className="text-xs font-mono font-black text-slate-900">
                          {actualDeliveryFormatted.full}
                        </p>
                      </div>

                      {/* Delivered By */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Delivered By
                        </span>
                        <p className="text-xs font-black text-slate-900">
                          {deliveredByName}
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {deliveredByRole}
                        </p>
                      </div>

                      {/* Delivery Location */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Delivery Location
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {deliveryLocation}
                        </p>
                      </div>

                      {/* Delivery Reference */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Delivery Reference
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {deliveryRef}
                        </p>
                      </div>

                      {/* Digital Gate Pass */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Digital Gate Pass
                        </span>
                        <p className="text-xs font-mono font-bold text-slate-900">
                          {gatePassNumber}
                        </p>
                      </div>

                      {/* Vehicle */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Vehicle
                        </span>
                        <p className="text-xs font-mono font-bold text-slate-900">
                          {vehicleNumber}
                        </p>
                      </div>

                      {/* Driver */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Driver
                        </span>
                        <p className="text-xs font-bold text-slate-900">
                          {driverName}
                        </p>
                      </div>

                      {/* Cargo */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Cargo
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {cargoDesc}
                        </p>
                      </div>

                      {/* Vessel */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Vessel
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {vesselName}
                        </p>
                      </div>

                      {/* Destination */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Destination
                        </span>
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {destinationFacility}
                        </p>
                      </div>

                      {/* Expected Delivery */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Expected Delivery
                        </span>
                        <p className="text-xs font-mono font-bold text-slate-900">
                          {expectedDeliveryFormatted || 'Not scheduled'}
                        </p>
                      </div>

                      {/* Actual Delivery */}
                      <div className="p-3.5 rounded-xl bg-white border border-emerald-200/90 shadow-2xs space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                          Actual Delivery
                        </span>
                        <p className="text-xs font-mono font-black text-emerald-950">
                          {actualDeliveryFormatted.full}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. READ-ONLY OPERATIONAL INFORMATION GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                {/* Container Size & Type */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <Boxes className="w-4 h-4 text-[#064e43]" />
                    <span>Container Size & Type</span>
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    {detail.container_type || 'Standard Container'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {detail.container_gross_weight ? `Gross Weight: ${detail.container_gross_weight} MT` : 'ISO Standard Freight Unit'}
                  </p>
                </div>

                {/* Cargo & Vessel */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <Building className="w-4 h-4 text-[#064e43]" />
                    <span>Cargo & Vessel</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {detail.cargo_description || 'General Cargo'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    {detail.vessel_name ? `${detail.vessel_name} • ${detail.shipping_company_name || 'Carrier'}` : 'Vessel Information Recorded'}
                  </p>
                </div>

                {/* Assigned Vehicle & Driver */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <Truck className="w-4 h-4 text-[#064e43]" />
                    <span>Assigned Vehicle & Driver</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {detail.truck_number || 'Vehicle Unassigned'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Driver: {detail.driver_name || 'Unassigned'} {detail.truck_company ? `(${detail.truck_company})` : ''}
                  </p>
                </div>

                {/* Gate Pass & Movement */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <FileText className="w-4 h-4 text-[#064e43]" />
                    <span>Digital Gate Pass</span>
                  </div>
                  <p className="text-sm font-mono font-black text-emerald-800">
                    {detail.gate_pass_number || 'N/A'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Authorized gate movement reference
                  </p>
                </div>

                {/* Destination Facility */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <Building className="w-4 h-4 text-[#064e43]" />
                    <span>Destination Facility</span>
                  </div>
                  <p className="text-sm font-black text-slate-900 truncate">
                    {detail.container_delivery_destination || detail.destination || 'Customer Warehouse / Distribution Center'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Planned inland delivery target destination
                  </p>
                </div>

                {/* Expected / Actual Delivery */}
                {(() => {
                  const currentStatusKey = (
                    detail.container_delivery_status ||
                    detail.current_status ||
                    'RELEASED'
                  ).toUpperCase();
                  const isDelivered = currentStatusKey === 'DELIVERED';

                  const expectedRawTimestamp =
                    detail.expected_delivery_datetime ||
                    detail.container_expected_delivery_date ||
                    detail.expected_delivery_date;
                  const expectedFormatted = formatDeliveryScheduleDateTime(
                    expectedRawTimestamp,
                    detail.expected_delivery_date_formatted
                  );

                  const expectedDestination =
                    detail.expected_delivery_destination ||
                    detail.container_delivery_destination ||
                    detail.destination ||
                    '';

                  const deliveredRawTimestamp =
                    detail.actual_delivery_datetime ||
                    detail.container_delivered_at ||
                    detail.delivered_at ||
                    detail.tracking_history?.find(
                      (ev) =>
                        (ev.status || ev.tracking_event_status || '').toUpperCase() === 'DELIVERED'
                    )?.timestamp;
                  const deliveredFormatted = formatDeliveryScheduleDateTime(
                    deliveredRawTimestamp,
                    detail.delivered_at_formatted
                  );

                  const finalDestination =
                    detail.final_delivery_destination ||
                    detail.container_delivery_destination ||
                    detail.delivery_location ||
                    detail.container_delivery_location ||
                    detail.destination ||
                    '';

                  if (isDelivered) {
                    return (
                      <>
                        {expectedFormatted && (
                          <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                            <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                              <Calendar className="w-4 h-4 text-[#064e43]" />
                              <span>EXPECTED DELIVERY</span>
                            </div>
                            <p className="text-sm font-black text-slate-900">
                              {expectedFormatted}
                            </p>
                            {expectedDestination ? (
                              <p className="text-[11px] text-slate-600 font-medium truncate">
                                {expectedDestination}
                              </p>
                            ) : null}
                          </div>
                        )}

                        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                          <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                            <Calendar className="w-4 h-4 text-emerald-600" />
                            <span>ACTUAL DELIVERY</span>
                          </div>
                          <p className="text-sm font-black text-slate-900">
                            {deliveredFormatted || 'Delivery recorded'}
                          </p>
                          {finalDestination ? (
                            <p className="text-[11px] text-slate-600 font-medium truncate">
                              {finalDestination}
                            </p>
                          ) : null}
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              Delivered
                            </span>
                            {detail.container_delivery_recipient || detail.delivery_recipient ? (
                              <span className="text-[11px] text-slate-500 font-medium truncate">
                                • Recipient: {detail.container_delivery_recipient || detail.delivery_recipient}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </>
                    );
                  }

                  return (
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
                      <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                        <Calendar className="w-4 h-4 text-[#064e43]" />
                        <span>EXPECTED DELIVERY</span>
                      </div>
                      <p className={`text-sm ${expectedFormatted ? 'font-black text-slate-900' : 'font-semibold text-slate-500'}`}>
                        {expectedFormatted || 'Not scheduled'}
                      </p>
                      {expectedDestination ? (
                        <p className="text-[11px] text-slate-600 font-medium truncate">
                          {expectedDestination}
                        </p>
                      ) : null}
                    </div>
                  );
                })()}

                {/* Last Recorded Operational Location */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs md:col-span-2 lg:col-span-3">
                  <div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                    <MapPin className="w-4 h-4 text-[#064e43]" />
                    <span>Last Recorded Operational Location</span>
                  </div>
                  <p className="text-sm font-black text-slate-900">
                    {detail.container_delivery_location || detail.last_known_location || 'Port Terminal Yard'}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Verified milestone operational checkpoint
                  </p>
                </div>
              </div>

              {/* 3. VERIFIED TRACKING AUDIT & EVENT HISTORY */}
              <div className="space-y-3">
                {(() => {
                  const rawHistory = detail.tracking_history || [];
                  const sortedHistory = [...rawHistory].sort((a, b) => {
                    const tA = new Date(a.timestamp || a.tracking_event_timestamp || 0).getTime();
                    const tB = new Date(b.timestamp || b.tracking_event_timestamp || 0).getTime();
                    if (tA !== tB) return tA - tB;
                    return (a.tracking_event_id || 0) - (b.tracking_event_id || 0);
                  });

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                            Chronological Tracking History
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400">
                            (Earliest → Latest)
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {sortedHistory.length} Event(s) Recorded
                        </span>
                      </div>

                      {sortedHistory.length === 0 ? (
                        <div className="py-10 px-4 text-center rounded-2xl bg-slate-50 border border-slate-200/90 text-slate-500 space-y-1.5">
                          <Clock className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
                          <p className="font-bold text-xs text-slate-700">No tracking events have been recorded yet.</p>
                          <p className="text-[11px] text-slate-400">Tracking milestones will appear here as operational events are completed.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sortedHistory.map((ev, idx) => {
                            const statusKey = (ev.status || ev.tracking_event_status || 'RELEASED').toUpperCase();
                            const meta = getTrackingStatusMeta(statusKey);
                            const eventTitle = ev.status_display || ev.tracking_event_status_display || meta.title;
                            const eventDesc = ev.description || ev.tracking_event_description || meta.defaultDescription;
                            const eventLocation = ev.location || ev.tracking_event_location || '';
                            const rawTimestamp = (ev as any).timestamp_iso || ev.timestamp || ev.tracking_event_timestamp;
                            const formattedTime = formatTrackingDateTime(rawTimestamp, ev.timestamp_formatted);
                            const userName = (ev.updated_by_name || 'Operations Desk').trim();
                            const userRole = ev.updated_by_role ? ev.updated_by_role.trim() : null;
                            const isLatest = idx === sortedHistory.length - 1;

                            // Status Icon Resolver
                            const renderStatusIcon = () => {
                              switch (statusKey) {
                                case 'DELIVERED':
                                  return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                                case 'DELIVERY_EXCEPTION':
                                case 'EXCEPTION':
                                  return <AlertTriangle className="w-4 h-4 text-rose-600" />;
                                case 'OUT_FOR_DELIVERY':
                                  return <Truck className="w-4 h-4 text-amber-600" />;
                                case 'IN_TRANSIT':
                                  return <Clock className="w-4 h-4 text-blue-600" />;
                                case 'DEPARTED_PORT':
                                case 'DEPARTED':
                                  return <Send className="w-4 h-4 text-indigo-600" />;
                                case 'PICKED_UP':
                                  return <Truck className="w-4 h-4 text-sky-600" />;
                                case 'GATE_PASS_GENERATED':
                                  return <FileText className="w-4 h-4 text-teal-600" />;
                                case 'RELEASED':
                                default:
                                  return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                              }
                            };

                            return (
                              <div
                                key={ev.tracking_event_id}
                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                                  isLatest
                                    ? 'bg-emerald-50/60 border-emerald-300 shadow-sm ring-2 ring-emerald-500/15'
                                    : 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300'
                                }`}
                              >
                                {/* Left Side: Icon + Title + Description + Location */}
                                <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                  <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                                      isLatest
                                        ? 'bg-emerald-100 border-emerald-300 ring-2 ring-emerald-500/20'
                                        : `${meta.iconBg}`
                                    }`}
                                  >
                                    {renderStatusIcon()}
                                  </div>

                                  <div className="space-y-1 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h5 className="text-sm font-black text-slate-900 tracking-tight">
                                        {eventTitle}
                                      </h5>
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.badgeClass}`}
                                      >
                                        {statusKey.replace(/_/g, ' ')}
                                      </span>
                                      {isLatest && (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-700 text-white flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                          Current Stage
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-xs text-slate-700 font-medium leading-relaxed">
                                      {eventDesc}
                                    </p>

                                    {eventLocation && (
                                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold pt-0.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="truncate">{eventLocation}</span>
                                      </div>
                                    )}

                                    {ev.exception_reason && (
                                      <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-bold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg w-fit mt-1">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        <span>Exception: {ev.exception_reason}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Right Side: Date, Time, User, Role */}
                                <div className="text-left sm:text-right shrink-0 sm:border-l sm:border-slate-100 sm:pl-5 space-y-1.5">
                                  <div className="space-y-0.5">
                                    <p className="text-xs font-black text-slate-900 font-mono">
                                      {formattedTime.date}
                                    </p>
                                    {formattedTime.time !== '—' && (
                                      <p className="text-[11px] font-bold text-slate-500 font-mono">
                                        {formattedTime.time}
                                      </p>
                                    )}
                                  </div>

                                  <div className="pt-0.5 text-xs text-slate-700 font-medium">
                                    <div className="text-slate-500">
                                      <span>By: </span>
                                      <strong className="text-slate-800">{userName}</strong>
                                    </div>
                                    {userRole && (
                                      <span className="block text-[11px] text-slate-500 font-semibold">
                                        {userRole}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </>
          ) : null}
        </div>

        {/* Modal Footer (Read-Only) */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>PORTIDE Maritime Operations Intelligence • Read-Only Tracking View</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
