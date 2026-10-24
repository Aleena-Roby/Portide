import React, { useState, useEffect } from 'react';
import {
  Search,
  Truck,
  RotateCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Eye,
  Edit3,
  X,
  User,
  Calendar,
  MapPin,
  ShieldAlert,
  Check
} from 'lucide-react';
import { DeliveryContainerListItem, DeliverySummaryCounts, DeliveryTrackingStatus } from '../../../types';
import { deliveryApi, getStoredSession } from '../../../services/api';
import { ContainerTrackingModal } from '../../modals/ContainerTrackingModal';
import { formatTrackingDateTime } from '../../../utils/trackingFormatters';

interface UpdateDeliveryModalProps {
  container: DeliveryContainerListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UpdateDeliveryModal: React.FC<UpdateDeliveryModalProps> = ({
  container,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<'TRANSITION' | 'EXCEPTION'>('TRANSITION');
  const [remarks, setRemarks] = useState('');
  const [location, setLocation] = useState('');
  const [recipient, setRecipient] = useState('');
  const [destination, setDestination] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [exceptionReason, setExceptionReason] = useState('DELIVERY_DELAYED');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Exception resolution target status
  const [resolveTargetStatus, setResolveTargetStatus] = useState<DeliveryTrackingStatus>('IN_TRANSIT');

  useEffect(() => {
    if (isOpen) {
      setMode('TRANSITION');
      setRemarks('');
      setLocation('');
      setRecipient('');
      setDestination(container?.container_delivery_destination || container?.destination || '');
      const rawExp = container?.expected_delivery_datetime || container?.expected_delivery_date;
      if (rawExp) {
        try {
          const d = new Date(rawExp);
          if (!isNaN(d.getTime())) {
            const pad = (n: number) => n.toString().padStart(2, '0');
            setExpectedDeliveryDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
          } else {
            setExpectedDeliveryDate('');
          }
        } catch {
          setExpectedDeliveryDate('');
        }
      } else {
        setExpectedDeliveryDate('');
      }
      setExceptionReason('DELIVERY_DELAYED');
      setFormError(null);
      setResolveTargetStatus('IN_TRANSIT');
    }
  }, [isOpen, container]);

  if (!isOpen || !container) return null;

  const currentStatus: DeliveryTrackingStatus =
    container.container_delivery_status || container.current_status || 'RELEASED';
  const currentStatusDisplay =
    container.container_delivery_status_display ||
    container.current_status_display ||
    currentStatus.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

  // Determine next allowed sequential status
  let nextStatus: DeliveryTrackingStatus | null = null;
  let nextStatusLabel: string = '';

  if (currentStatus === 'RELEASED') {
    nextStatus = 'PICKED_UP';
    nextStatusLabel = 'Picked Up';
  } else if (currentStatus === 'PICKED_UP' || currentStatus === 'DEPARTED_PORT') {
    nextStatus = 'IN_TRANSIT';
    nextStatusLabel = 'In Transit';
  } else if (currentStatus === 'IN_TRANSIT') {
    nextStatus = 'OUT_FOR_DELIVERY';
    nextStatusLabel = 'Out for Delivery';
  } else if (currentStatus === 'OUT_FOR_DELIVERY') {
    nextStatus = 'DELIVERED';
    nextStatusLabel = 'Delivered';
  } else if (currentStatus === 'DELIVERY_EXCEPTION') {
    nextStatus = resolveTargetStatus;
    nextStatusLabel = resolveTargetStatus.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  const session = getStoredSession();
  const operatorName = session?.name || session?.email || 'Terminal & Logistics Operator';
  const currentTimestamp = formatTrackingDateTime(new Date()).full;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (mode === 'EXCEPTION') {
        if (!exceptionReason.trim()) {
          setFormError('Please select a valid exception reason.');
          setSubmitting(false);
          return;
        }
        if (!remarks.trim()) {
          setFormError('Exception details / remarks are required.');
          setSubmitting(false);
          return;
        }

        const res = await deliveryApi.reportException(container.container_id, {
          exception_type: exceptionReason,
          remarks: remarks.trim(),
          location: location.trim() || undefined,
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setFormError(res.message || 'Failed to record delivery exception.');
        }
      } else {
        if (!nextStatus) {
          setFormError('No next sequential transition available for this container.');
          setSubmitting(false);
          return;
        }

        let res;
        if (nextStatus === 'DELIVERED') {
          const finalLoc = location.trim() || destination.trim() || container.container_delivery_destination || container.destination || 'Consignee Delivery Facility';
          res = await deliveryApi.confirmDelivery(container.container_id, {
            delivery_location: finalLoc,
            delivered_location: finalLoc,
            recipient_name: recipient.trim(),
            delivered_to: recipient.trim(),
            remarks: remarks.trim() || undefined,
          });
        } else {
          let expDateIso: string | undefined = undefined;
          if (expectedDeliveryDate) {
            try {
              expDateIso = new Date(expectedDeliveryDate).toISOString();
            } catch {
              expDateIso = undefined;
            }
          }
          res = await deliveryApi.updateStatus(container.container_id, {
            status: nextStatus as any,
            remarks: remarks.trim() || undefined,
            location: location.trim() || undefined,
            destination: destination.trim() || undefined,
            expected_delivery_date: expDateIso,
          });
        }

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setFormError(res.message || 'Failed to update delivery status.');
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Network error occurred while updating delivery.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-5 bg-linear-to-r from-[#064e43] to-[#04332c] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Truck className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                  Terminal & Logistics Operator
                </span>
              </div>
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                Update Delivery
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white/15 text-white">
                  {container.container_number}
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setMode('TRANSITION')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
              mode === 'TRANSITION'
                ? 'border-[#064e43] text-[#064e43]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Advance Delivery Status</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('EXCEPTION')}
            className={`pb-3 px-4 text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-b-2 ${
              mode === 'EXCEPTION'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Report Exception</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Read-Only Summary Grid: Container, Operator, Timestamp */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Container Number
              </span>
              <span className="font-mono font-black text-slate-900 text-sm">
                {container.container_number}
              </span>
              <span className="text-[11px] text-slate-500 block truncate">
                {container.cargo_description || 'General Cargo'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Vessel & Gate Pass
              </span>
              <span className="font-bold text-slate-800 block truncate">
                {container.vessel_name || '—'}
              </span>
              <span className="text-[11px] font-mono text-emerald-700 font-semibold block">
                {container.gate_pass_number ? `GP: ${container.gate_pass_number}` : 'Pass Cleared'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Updated By
              </span>
              <span className="font-bold text-slate-800 block truncate">
                {operatorName}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Date & Time
              </span>
              <span className="font-semibold text-slate-700 block">
                {currentTimestamp}
              </span>
            </div>
          </div>

          {mode === 'TRANSITION' ? (
            <>
              {/* Sequential Transition Visualizer */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#064e43] block mb-2">
                  Sequential Status Transition
                </span>

                <div className="flex items-center justify-between gap-3">
                  {/* Current Status Box */}
                  <div className="flex-1 p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Current Status
                    </span>
                    <span className="text-xs font-black text-slate-800 block mt-0.5">
                      {currentStatusDisplay}
                    </span>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#064e43] flex items-center justify-center shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>

                  {/* Next Allowed Status Box */}
                  <div className="flex-1 p-3 rounded-xl bg-[#064e43] text-white shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                      Next Allowed Status
                    </span>
                    <span className="text-xs font-black block mt-0.5">
                      {nextStatusLabel || 'Delivered'}
                    </span>
                  </div>
                </div>

                {currentStatus === 'DELIVERY_EXCEPTION' && (
                  <div className="mt-3">
                    <label className="text-[11px] font-bold text-slate-700 block mb-1">
                      Select Resumption Target:
                    </label>
                    <select
                      value={resolveTargetStatus}
                      onChange={(e) => setResolveTargetStatus(e.target.value as DeliveryTrackingStatus)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-[#064e43]/20"
                    >
                      <option value="PICKED_UP">Resume Picked Up</option>
                      <option value="IN_TRANSIT">Resume In Transit</option>
                      <option value="OUT_FOR_DELIVERY">Resume Out for Delivery</option>
                      <option value="DELIVERED">Confirm Delivered</option>
                    </select>
                  </div>
                )}

                <p className="text-[11px] text-emerald-800/80 font-medium mt-2.5">
                  ✓ Strict sequential progression enforced: Released → Picked Up → In Transit → Out for Delivery → Delivered.
                </p>
              </div>

              {/* Location Input (Optional) */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Location (Optional)
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={
                      nextStatus === 'PICKED_UP'
                        ? 'e.g. Gate Checkpoint Alpha'
                        : nextStatus === 'IN_TRANSIT'
                        ? 'e.g. NH-66 Transit Corridor'
                        : nextStatus === 'OUT_FOR_DELIVERY'
                        ? 'e.g. Regional Distribution Hub'
                        : 'e.g. Consignee Warehouse'
                    }
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
                  />
                </div>
              </div>

              {/* Destination Input (Optional) */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Destination Facility (Optional)
                </label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Kochi Distribution Facility"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
                />
              </div>

              {/* Expected Delivery Schedule (Optional, when not advancing to DELIVERED) */}
              {nextStatus !== 'DELIVERED' && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Expected Delivery Schedule (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
                  />
                </div>
              )}

              {/* Recipient Input (Optional, shown when advancing to DELIVERED) */}
              {nextStatus === 'DELIVERED' && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                    Received By / Recipient Officer (Optional)
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="e.g. Warehouse Supervisor J. Paul"
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
                    />
                  </div>
                </div>
              )}

              {/* Remarks Input */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1">
                  Remarks / Operational Notes
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Record delivery remarks or milestone verification notes..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
                />
              </div>
            </>
          ) : (
            <>
              {/* Exception Form */}
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 block">
                  Delivery Exception Details
                </span>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Exception Reason <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={exceptionReason}
                    onChange={(e) => setExceptionReason(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-rose-300 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    <option value="DELIVERY_DELAYED">Delivery delayed</option>
                    <option value="VEHICLE_BREAKDOWN">Vehicle breakdown</option>
                    <option value="DAMAGED_CONTAINER">Damaged container</option>
                    <option value="DELIVERY_REJECTED">Delivery rejected</option>
                    <option value="DESTINATION_ISSUE">Destination issue</option>
                    <option value="RECEIVER_UNAVAILABLE">Receiver unavailable</option>
                    <option value="OTHER">Other operational issue</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Incident Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Highway Mile 42 / Hub Checkpoint"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Exception Reason Details & Remarks <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    required
                    rows={3}
                    placeholder="Detail the issue, impact on shipment timeline, and required corrective action..."
                    className="w-full px-3 py-2 rounded-xl border border-rose-300 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (mode === 'TRANSITION' && !nextStatus && currentStatus === 'DELIVERED')}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'EXCEPTION'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-[#064e43] hover:bg-[#053d34]'
              }`}
            >
              {submitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : mode === 'EXCEPTION' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Record Exception</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm Status Update</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface DeliveryAddressModalProps {
  container: DeliveryContainerListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryAddressModal: React.FC<DeliveryAddressModalProps> = ({
  container,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [destinationAddress, setDestinationAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && container) {
      setDestinationAddress(container.container_delivery_destination || container.destination || '');
      setRecipientName(container.container_delivery_recipient || '');
      setError(null);
    }
  }, [isOpen, container]);

  if (!isOpen || !container) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!destinationAddress.trim()) {
      setError('Please provide a valid final delivery destination address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await deliveryApi.updateAddress(container.container_id, {
        destination_address: destinationAddress.trim(),
        recipient_name: recipientName.trim() || undefined,
      });

      if (res.status === 'success') {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Failed to save delivery address.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while updating delivery address.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-[#064e43] to-[#04332c] text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MapPin className="w-5 h-5 text-emerald-300" />
            <div>
              <h3 className="text-base font-black uppercase tracking-tight">
                {container.container_delivery_destination ? 'Edit Delivery Address' : 'Add Delivery Address'}
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Container {container.container_number} • Import Cargo
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Operational Separation Info Banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Port Operations &amp; Separation of Locations
            </div>
            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block">Port Yard Location:</span>
                <span className="font-semibold text-slate-800">
                  {container.yard_location || 'Port Terminal Yard'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Physical Port Exit:</span>
                <span className="font-semibold text-slate-800">
                  {container.port_exit_point || 'Pending Gate Exit Checkpoint'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 border-t border-slate-200/80 pt-1.5 mt-1">
              Final delivery destination is managed independently from port yard slots and gate exit points.
            </p>
          </div>

          {/* Consignee / Recipient Input */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
              Consignee / Recipient Name (Optional)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Cochin Logistics Distribution / J. Paul"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
              />
            </div>
          </div>

          {/* Final Destination Address */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block mb-1">
              Final Destination Address <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={destinationAddress}
              onChange={(e) => setDestinationAddress(e.target.value)}
              placeholder="e.g. Plot 14, Kalamassery Industrial Estate, Kochi, Kerala - 683104"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/15"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Enter the exact inland facility or consignee delivery address for this import container.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#064e43] hover:bg-[#053d34] text-white text-xs font-bold uppercase tracking-wider transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Delivery Address</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const DeliveryTracking: React.FC = () => {
  const [deliveryContainers, setDeliveryContainers] = useState<DeliveryContainerListItem[]>([]);
  const [summary, setSummary] = useState<DeliverySummaryCounts>({
    all: 0,
    released: 0,
    gate_pass_generated: 0,
    picked_up: 0,
    departed_port: 0,
    in_transit: 0,
    out_for_delivery: 0,
    delivered: 0,
    delivery_exception: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Selected container tracking detail modal
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  // Update Delivery Modal state
  const [selectedUpdateContainer, setSelectedUpdateContainer] = useState<DeliveryContainerListItem | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Add / Edit Delivery Address Modal state
  const [selectedAddressContainer, setSelectedAddressContainer] = useState<DeliveryContainerListItem | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const fetchDeliveryContainers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await deliveryApi.getContainers({
        status: selectedStatus,
        search: searchQuery,
      });

      let records: DeliveryContainerListItem[] = [];

      if (Array.isArray(res)) {
        records = res;
      } else if (res && typeof res === 'object') {
        if (Array.isArray(res.data?.containers)) {
          records = res.data.containers;
        } else if (Array.isArray(res.results)) {
          records = res.results;
        } else if (Array.isArray(res.data)) {
          records = res.data;
        } else if (Array.isArray(res.containers)) {
          records = res.containers;
        }
      }

      if (res && (res.status === 'error' || res.detail) && records.length === 0) {
        setError(res.message || res.detail || 'Failed to load delivery containers.');
        setDeliveryContainers([]);
        return;
      }

      setDeliveryContainers(records);

      const summaryData = res?.data?.summary || res?.summary;
      if (summaryData && typeof summaryData === 'object') {
        setSummary({
          all: summaryData.all ?? summaryData.total ?? records.length,
          released: summaryData.released ?? 0,
          gate_pass_generated: summaryData.gate_pass_generated ?? 0,
          picked_up: summaryData.picked_up ?? 0,
          departed_port: summaryData.departed_port ?? 0,
          in_transit: summaryData.in_transit ?? 0,
          out_for_delivery: summaryData.out_for_delivery ?? 0,
          delivered: summaryData.delivered ?? 0,
          delivery_exception: summaryData.delivery_exception ?? summaryData.exceptions ?? 0,
        });
      } else {
        const counts: DeliverySummaryCounts = {
          all: records.length,
          released: 0,
          gate_pass_generated: 0,
          picked_up: 0,
          departed_port: 0,
          in_transit: 0,
          out_for_delivery: 0,
          delivered: 0,
          delivery_exception: 0,
        };
        for (const item of records) {
          const st = item.container_delivery_status || item.current_status || 'RELEASED';
          if (st === 'RELEASED' || st === 'GATE_PASS_GENERATED') counts.released++;
          else if (st === 'PICKED_UP') counts.picked_up++;
          else if (st === 'DEPARTED_PORT' || st === 'IN_TRANSIT' || st === 'OUT_FOR_DELIVERY') counts.departed_port++;
          else if (st === 'DELIVERED') counts.delivered++;
          else if (st === 'DELIVERY_EXCEPTION') counts.delivery_exception++;
        }
        setSummary(counts);
      }
    } catch (err: any) {
      setError(err?.message || 'Network error occurred while fetching delivery containers.');
      setDeliveryContainers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeliveryContainers();
  }, [selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeliveryContainers();
  };

  const handleOpenTrackingModal = (containerId: number) => {
    setSelectedContainerId(containerId);
    setIsTrackingModalOpen(true);
  };

  const handleOpenUpdateModal = (container: DeliveryContainerListItem) => {
    setSelectedUpdateContainer(container);
    setIsUpdateModalOpen(true);
  };

  const handleOpenAddressModal = (container: DeliveryContainerListItem) => {
    setSelectedAddressContainer(container);
    setIsAddressModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-widest text-[#064e43]">
              IMPORT LOGISTICS &amp; INLAND DISTRIBUTION
            </span>
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-[#08192d]">
            Import Delivery Tracking
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Monitor collection and inland destination delivery for released import containers.
          </p>
        </div>

        <button
          onClick={fetchDeliveryContainers}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#064e43]' : ''}`} />
          <span>Refresh Tracking</span>
        </button>
      </div>

      {/* 2. SUMMARY CARDS (5 simple statuses) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* 1. Released */}
        <div
          onClick={() => setSelectedStatus('RELEASED')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'RELEASED'
              ? 'bg-[#064e43] text-white border-[#064e43] shadow-md ring-2 ring-[#064e43]/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              selectedStatus === 'RELEASED' ? 'text-emerald-100' : 'text-slate-400'
            }`}
          >
            Released
          </span>
          <div className="text-2xl font-black mt-1">{summary.released}</div>
        </div>

        {/* 2. Picked Up */}
        <div
          onClick={() => setSelectedStatus('PICKED_UP')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'PICKED_UP'
              ? 'bg-[#064e43] text-white border-[#064e43] shadow-md ring-2 ring-[#064e43]/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              selectedStatus === 'PICKED_UP' ? 'text-emerald-100' : 'text-slate-400'
            }`}
          >
            Picked Up
          </span>
          <div className="text-2xl font-black mt-1">{summary.picked_up}</div>
        </div>

        {/* 3. Departed Port */}
        <div
          onClick={() => setSelectedStatus('DEPARTED_PORT')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'DEPARTED_PORT'
              ? 'bg-indigo-700 text-white border-indigo-800 shadow-md ring-2 ring-indigo-700/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              selectedStatus === 'DEPARTED_PORT' ? 'text-indigo-100' : 'text-slate-400'
            }`}
          >
            Departed Port
          </span>
          <div className="text-2xl font-black mt-1">{summary.departed_port}</div>
        </div>

        {/* 4. Delivered */}
        <div
          onClick={() => setSelectedStatus('DELIVERED')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'DELIVERED'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-md ring-2 ring-emerald-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              selectedStatus === 'DELIVERED' ? 'text-emerald-100' : 'text-slate-400'
            }`}
          >
            Delivered
          </span>
          <div className="text-2xl font-black mt-1">{summary.delivered}</div>
        </div>

        {/* 5. Exception */}
        <div
          onClick={() => setSelectedStatus('EXCEPTION')}
          className={`p-4 rounded-xl border transition-all cursor-pointer ${
            selectedStatus === 'EXCEPTION'
              ? 'bg-rose-600 text-white border-rose-700 shadow-md ring-2 ring-rose-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${
              selectedStatus === 'EXCEPTION' ? 'text-rose-100' : 'text-slate-400'
            }`}
          >
            Exception
          </span>
          <div className="text-2xl font-black mt-1">{summary.delivery_exception}</div>
        </div>
      </div>

      {/* 3. SEARCH & STATUS FILTER TOOLBAR */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search form */}
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Container Number, Cargo, Vessel, Gate Pass ID..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold placeholder-slate-400 focus:outline-none focus:border-[#064e43] focus:ring-2 focus:ring-[#064e43]/10"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#064e43] hover:bg-[#053d34] text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-xs transition-colors shrink-0"
            >
              Search
            </button>
          </form>

          {/* Simple Status Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 text-xs font-bold shrink-0">
            {[
              { id: 'ALL', label: 'All Containers' },
              { id: 'RELEASED', label: 'Released' },
              { id: 'PICKED_UP', label: 'Picked Up' },
              { id: 'DEPARTED_PORT', label: 'Departed Port' },
              { id: 'DELIVERED', label: 'Delivered' },
              { id: 'EXCEPTION', label: 'Exception' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-3 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
                  selectedStatus === st.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. PROFESSIONAL IMPORT DELIVERY CONTAINER TABLE */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-4">Container &amp; Cargo</th>
                <th className="py-3.5 px-4">Vessel &amp; Gate Pass</th>
                <th className="py-3.5 px-4">Yard &amp; Port Exit</th>
                <th className="py-3.5 px-4">Delivery Destination</th>
                <th className="py-3.5 px-4">Current Status</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCw className="w-6 h-6 animate-spin text-[#064e43]" />
                      <span>Loading import delivery containers...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-rose-600 font-semibold">
                    {error}
                  </td>
                </tr>
              ) : (deliveryContainers || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600">No import containers matching current filter.</p>
                    <p className="text-[11px] mt-1">Import containers appear here after being authorized for collection.</p>
                  </td>
                </tr>
              ) : (
                (deliveryContainers || []).map((c) => {
                  const statusColors: Record<DeliveryTrackingStatus, string> = {
                    RELEASED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    GATE_PASS_GENERATED: 'bg-teal-50 text-teal-800 border-teal-200',
                    PICKED_UP: 'bg-sky-50 text-sky-800 border-sky-200',
                    DEPARTED_PORT: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                    IN_TRANSIT: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                    OUT_FOR_DELIVERY: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                    DELIVERED: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
                    DELIVERY_EXCEPTION: 'bg-rose-100 text-rose-900 border-rose-300 font-bold',
                  };

                  const currentSt: DeliveryTrackingStatus =
                    c.container_delivery_status || c.current_status || 'RELEASED';
                  const currentStDisplay =
                    c.container_delivery_status_display ||
                    c.current_status_display ||
                    currentSt.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

                  const destinationAddress =
                    c.container_delivery_destination?.trim() ||
                    c.destination?.trim() ||
                    null;

                  return (
                    <tr key={c.container_id} className="hover:bg-slate-50/80 transition-colors">
                      {/* 1. Container & Cargo */}
                      <td className="py-3.5 px-4 font-mono text-slate-900">
                        <span className="font-black text-sm block">{c.container_number}</span>
                        <span className="text-[10px] font-sans text-slate-500 block">
                          {c.container_type || 'General'} • {c.container_gross_weight || '—'} MT
                        </span>
                        <span className="text-[11px] font-sans text-slate-700 block truncate max-w-[180px] mt-0.5">
                          {c.cargo_description || 'Import Cargo'}
                        </span>
                      </td>

                      {/* 2. Vessel & Gate Pass */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <span className="font-bold text-slate-800 block">{c.vessel_name || '—'}</span>
                        <div className="mt-1 space-y-0.5 text-[10px]">
                          <span className="font-mono text-emerald-800 block font-semibold">
                            Pass: {c.gate_pass_number || '—'}
                          </span>
                          {c.truck_number && (
                            <span className="text-slate-500 block">
                              Truck: {c.truck_number}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 3. Yard & Port Exit (Physically separated from destination) */}
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="space-y-1">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Yard Location
                            </span>
                            <span className="font-semibold text-slate-800 text-[11px] block">
                              {c.yard_location || '—'}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Port Exit Checkpoint
                            </span>
                            <span className="text-slate-600 font-mono text-[11px] block">
                              {c.port_exit_point || 'Pending Gate Release'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 4. Delivery Destination (Final inland consignee address) */}
                      <td className="py-3.5 px-4">
                        {destinationAddress ? (
                          <div className="max-w-[210px] space-y-0.5">
                            <div className="flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                              <span
                                className="font-semibold text-slate-800 text-xs line-clamp-2"
                                title={destinationAddress}
                              >
                                {destinationAddress}
                              </span>
                            </div>
                            {c.container_delivery_recipient && (
                              <span className="text-[10px] text-slate-500 pl-4.5 block truncate">
                                Recipient: {c.container_delivery_recipient}
                              </span>
                            )}
                            <button
                              onClick={() => handleOpenAddressModal(c)}
                              className="text-[10px] text-[#064e43] hover:underline font-bold pl-4.5 block cursor-pointer"
                            >
                              Edit Address
                            </button>
                          </div>
                        ) : (
                          <div className="max-w-[190px] space-y-1">
                            <span className="text-slate-400 italic text-[11px] block">
                              Destination address not provided
                            </span>
                            <button
                              onClick={() => handleOpenAddressModal(c)}
                              className="px-2 py-0.5 rounded text-[10px] font-bold text-[#064e43] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <MapPin className="w-3 h-3 text-[#064e43]" />
                              <span>+ Add Address</span>
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 5. Current Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            statusColors[currentSt] || 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {currentStDisplay}
                        </span>
                      </td>

                      {/* 6. Last Updated */}
                      <td className="py-3.5 px-4 text-slate-600 text-[11px]">
                        <div>
                          {(() => {
                            const formatted = formatTrackingDateTime(c.last_updated_iso || c.last_updated, c.last_updated);
                            return formatted.full && !formatted.full.toLowerCase().includes('unavailable') ? formatted.full : (c.last_updated || '—');
                          })()}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          By: {c.last_updated_by || 'Operations'}
                        </span>
                      </td>

                      {/* 7. Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Address Action */}
                          <button
                            onClick={() => handleOpenAddressModal(c)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#064e43] border border-emerald-200 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                            title="Add or update destination address"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Address</span>
                          </button>

                          {/* Update Delivery Action */}
                          {currentSt !== 'DELIVERED' && (
                            <button
                              onClick={() => handleOpenUpdateModal(c)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#064e43] hover:bg-[#053d34] text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                              title="Update delivery status or report exception"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Update</span>
                            </button>
                          )}

                          {/* View Tracking Action */}
                          <button
                            onClick={() => handleOpenTrackingModal(c.container_id)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                            title="View timeline history"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Track</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Add / Edit Delivery Address Modal */}
      <DeliveryAddressModal
        container={selectedAddressContainer}
        isOpen={isAddressModalOpen}
        onClose={() => {
          setIsAddressModalOpen(false);
          setSelectedAddressContainer(null);
        }}
        onSuccess={() => {
          fetchDeliveryContainers();
        }}
      />

      {/* 6. Update Delivery Action Modal */}
      <UpdateDeliveryModal
        container={selectedUpdateContainer}
        isOpen={isUpdateModalOpen}
        onClose={() => {
          setIsUpdateModalOpen(false);
          setSelectedUpdateContainer(null);
        }}
        onSuccess={() => {
          fetchDeliveryContainers();
        }}
      />

      {/* 7. Detailed Tracking & Timeline Modal */}
      {selectedContainerId && (
        <ContainerTrackingModal
          containerId={selectedContainerId}
          isOpen={isTrackingModalOpen}
          onClose={() => {
            setIsTrackingModalOpen(false);
            setSelectedContainerId(null);
          }}
          onStatusUpdated={() => {
            fetchDeliveryContainers();
          }}
        />
      )}
    </div>
  );
};

