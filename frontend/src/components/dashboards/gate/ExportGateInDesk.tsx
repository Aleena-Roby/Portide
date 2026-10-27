import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../../../services/api';
import { BackendContainer, BackendGate, BackendGateIn } from '../../../types';
import { useApp } from '../../../context/AppContext';
import {
  Truck,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  RefreshCw,
  ArrowDownRight,
  UserCheck,
  FileText,
  MapPin,
  Clock,
  Send,
  Building,
  Key,
  Calendar,
  Lock,
  ArrowRight,
  Phone
} from 'lucide-react';

interface IndianPhoneValidation {
  isValid: boolean;
  rawDigits: string;
  formatted: string;
  e164: string;
  errorMessage: string;
}

const validateIndianPhone = (input: string): IndianPhoneValidation => {
  const trimmed = (input || '').trim();
  if (!trimmed) {
    return {
      isValid: false,
      rawDigits: '',
      formatted: '',
      e164: '',
      errorMessage: ''
    };
  }

  // Remove spaces, hyphens, brackets
  let digits = trimmed.replace(/[\s\-()]/g, '');

  // Strip leading country code (+91, 91, or leading 0)
  if (digits.startsWith('+91')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  // Check if non-digits remain
  if (!/^\d*$/.test(digits)) {
    return {
      isValid: false,
      rawDigits: digits,
      formatted: trimmed,
      e164: '',
      errorMessage: 'Phone number must contain only numbers.'
    };
  }

  if (digits.length > 0 && !/^[6-9]/.test(digits)) {
    return {
      isValid: false,
      rawDigits: digits,
      formatted: trimmed,
      e164: '',
      errorMessage: 'Indian mobile numbers must start with 6, 7, 8, or 9.'
    };
  }

  if (digits.length > 0 && digits.length < 10) {
    return {
      isValid: false,
      rawDigits: digits,
      formatted: trimmed,
      e164: '',
      errorMessage: `Enter 10-digit Indian mobile number (${digits.length}/10 digits entered).`
    };
  }

  if (digits.length > 10) {
    return {
      isValid: false,
      rawDigits: digits,
      formatted: trimmed,
      e164: '',
      errorMessage: 'Indian mobile numbers must be exactly 10 digits.'
    };
  }

  return {
    isValid: true,
    rawDigits: digits,
    formatted: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
    e164: `+91${digits}`,
    errorMessage: ''
  };
};

interface ExportGateInDeskProps {
  onGateInSuccess?: () => void;
}

export const ExportGateInDesk: React.FC<ExportGateInDeskProps> = ({ onGateInSuccess }) => {
  const { addToast } = useApp();

  // State: Eligible export containers
  const [containers, setContainers] = useState<BackendContainer[]>([]);
  const [loadingContainers, setLoadingContainers] = useState<boolean>(true);
  const [containerSearch, setContainerSearch] = useState<string>('');

  // State: Gates list
  const [gates, setGates] = useState<BackendGate[]>([]);

  // State: Form Selection & Inputs
  const [selectedContainer, setSelectedContainer] = useState<BackendContainer | null>(null);
  const [containerNumberInput, setContainerNumberInput] = useState<string>('');
  const [truckNumber, setTruckNumber] = useState<string>('');
  const [truckCompany, setTruckCompany] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverLicense, setDriverLicense] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [driverPhoneTouched, setDriverPhoneTouched] = useState<boolean>(false);
  const phoneValidation = validateIndianPhone(driverPhone);
  const [selectedGateId, setSelectedGateId] = useState<number | ''>('');
  const [sealNumber, setSealNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<string>('');

  // Gate-In History
  const [history, setHistory] = useState<BackendGateIn[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Summary counts
  const [counts, setCounts] = useState<{
    awaiting_gate_in: number;
    gated_in_today: number;
    total_gated_in: number;
  }>({
    awaiting_gate_in: 0,
    gated_in_today: 0,
    total_gated_in: 0
  });

  // Fetch eligible containers
  const fetchEligibleContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const q = containerSearch.trim() ? `?search=${encodeURIComponent(containerSearch.trim())}` : '';
      const res = await apiFetch(`/api/gate/export/containers/${q}`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setContainers(json.data || []);
        if (json.counts) {
          setCounts(json.counts);
        }
      }
    } catch {
      // Ignore network errors on background refresh
    } finally {
      setLoadingContainers(false);
    }
  }, [containerSearch]);

  // Fetch active gates permitted for physical truck entry (INBOUND or BIDIRECTIONAL)
  const fetchGates = useCallback(async () => {
    try {
      const res = await apiFetch('/api/gate/gates/?direction=entry');
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        const entryGates: BackendGate[] = (json.data || []).filter(
          (g: BackendGate) =>
            g.gate_is_active &&
            (g.gate_type === 'INBOUND' || g.gate_type === 'BIDIRECTIONAL')
        );
        setGates(entryGates);
        if (entryGates.length > 0) {
          if (!entryGates.some((g) => g.gate_id === selectedGateId)) {
            setSelectedGateId(entryGates[0].gate_id);
          }
        } else {
          setSelectedGateId('');
        }
      }
    } catch {
      // Use fallback
    }
  }, [selectedGateId]);

  // Fetch gate-in history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const q = historySearch.trim() ? `?search=${encodeURIComponent(historySearch.trim())}` : '';
      const res = await apiFetch(`/api/gate/gate-in-history/${q}`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setHistory(json.data || []);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch]);

  useEffect(() => {
    fetchEligibleContainers();
    fetchGates();
    fetchHistory();
  }, [fetchEligibleContainers, fetchGates, fetchHistory]);

  // Quick-select a container from eligible list
  const handleSelectContainer = (c: BackendContainer) => {
    setSelectedContainer(c);
    setContainerNumberInput(c.container_number);
    setSubmitError('');
    setSubmitSuccess('');
  };

  // Submit Gate-In
  const handleSubmitGateIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    const targetContainerNumber = selectedContainer
      ? selectedContainer.container_number
      : containerNumberInput.trim().toUpperCase();

    if (!targetContainerNumber) {
      setSubmitError('Please select or enter an export container number.');
      return;
    }
    if (!truckNumber.trim()) {
      setSubmitError('Truck / Drayage vehicle registration number is required.');
      return;
    }
    if (!driverName.trim()) {
      setSubmitError('Driver full name is required.');
      return;
    }
    if (!driverLicense.trim()) {
      setSubmitError('Driver identification or license reference is required.');
      return;
    }
    if (!selectedGateId) {
      setSubmitError('Please select a valid arrival port gate permitted for physical entry (INBOUND or BIDIRECTIONAL).');
      return;
    }

    // Validate driver contact phone if provided
    if (driverPhone.trim()) {
      const pVal = validateIndianPhone(driverPhone);
      if (!pVal.isValid) {
        setSubmitError(
          pVal.errorMessage || 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. +91 98765 43210).'
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const pVal = validateIndianPhone(driverPhone);
      const payload: Record<string, any> = {
        truck_number: truckNumber.trim().toUpperCase(),
        truck_company: truckCompany.trim(),
        driver_name: driverName.trim(),
        driver_license: driverLicense.trim().toUpperCase(),
        driver_phone: pVal.isValid ? pVal.e164 : driverPhone.trim(),
        gate_id: Number(selectedGateId),
        seal_number: sealNumber.trim().toUpperCase(),
        remarks: remarks.trim()
      };

      if (selectedContainer) {
        payload.container_id = selectedContainer.container_id;
      } else {
        payload.container_number = targetContainerNumber;
      }

      const res = await apiFetch('/api/gate/export-gate-in/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (res.ok && json && json.status === 'success') {
        setSubmitSuccess(json.message || `Container ${targetContainerNumber} successfully gated in.`);
        addToast(
          'success',
          'Export Gate-In Confirmed',
          `Container ${targetContainerNumber} gated into terminal. Status updated to ARRIVED.`
        );

        // Reset form
        setSelectedContainer(null);
        setContainerNumberInput('');
        setTruckNumber('');
        setTruckCompany('');
        setDriverName('');
        setDriverLicense('');
        setDriverPhone('');
        setDriverPhoneTouched(false);
        setSealNumber('');
        setRemarks('');

        // Refresh tables
        fetchEligibleContainers();
        fetchHistory();

        if (onGateInSuccess) {
          onGateInSuccess();
        }
      } else {
        const errorMsg =
          json?.message ||
          (json?.errors ? Object.values(json.errors).flat().join(', ') : null) ||
          (res.status ? `Server responded with error status ${res.status}.` : 'Gate-in processing failed.');
        setSubmitError(errorMsg);
        addToast('error', 'Gate-In Denied', errorMsg);
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Network error connecting to gate-in service.';
      setSubmitError(errMsg);
      addToast('error', 'Network Error', errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Summary Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Awaiting Export Arrival
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {counts.awaiting_gate_in}
            </div>
            <p className="text-xs text-slate-500 mt-1">Containers registered for outbound voyages</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
              Gated In Today
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {counts.gated_in_today}
            </div>
            <p className="text-xs text-slate-500 mt-1">Physical truck arrivals verified today</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Total Export Gate-Ins
            </span>
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1">
              {counts.total_gated_in}
            </div>
            <p className="text-xs text-slate-500 mt-1">All-time recorded export gate movements</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2. Main Work Area: Left = Gate-In Entry Desk, Right = Awaiting Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 dark:text-teal-400">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Export Truck Arrival Entry
                </h3>
                <p className="text-xs text-slate-500">
                  Verify drayage vehicle, driver identity &amp; record physical gate-in before yard allocation
                </p>
              </div>
            </div>
          </div>

          {submitSuccess && (
            <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-800 dark:text-emerald-300">
                <p className="font-bold">Arrival Successfully Confirmed</p>
                <p className="mt-0.5">{submitSuccess}</p>
              </div>
            </div>
          )}

          {submitError && (
            <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-800 dark:text-rose-300">
                <p className="font-bold">Gate-In Validation Failed</p>
                <p className="mt-0.5">{submitError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmitGateIn} className="mt-5 space-y-4">
            {/* Selected Container Preview or Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Export Container Number <span className="text-rose-500">*</span>
              </label>
              {selectedContainer ? (
                <div className="p-3.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-teal-900 dark:text-teal-200">
                        {selectedContainer.container_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-200 dark:bg-teal-800 text-teal-800 dark:text-teal-200">
                        {selectedContainer.container_type_display || selectedContainer.container_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {selectedContainer.container_gross_weight} T
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Voyage: {selectedContainer.cargo_context?.vessel_name || 'Scheduled Vessel'} &bull; Cargo: {selectedContainer.cargo_context?.cargo_description || 'General Cargo'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedContainer(null);
                      setContainerNumberInput('');
                    }}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg text-slate-500 hover:text-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Boxes className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={containerNumberInput}
                      onChange={(e) => setContainerNumberInput(e.target.value.toUpperCase())}
                      placeholder="e.g. EMCU9123456"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Truck Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Truck / Vehicle Registration <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Truck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={truckNumber}
                    onChange={(e) => setTruckNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. MH-04-AB-1234"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Haulier / Transport Company
                </label>
                <div className="relative">
                  <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={truckCompany}
                    onChange={(e) => setTruckCompany(e.target.value)}
                    placeholder="e.g. FastLogistics Freight Ltd"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Driver Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Driver Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Full name"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Driver License / ID <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={driverLicense}
                    onChange={(e) => setDriverLicense(e.target.value.toUpperCase())}
                    placeholder="License number"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Driver Contact Phone
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    India (+91)
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-3 top-3 pointer-events-none flex items-center gap-1.5 text-slate-400">
                    <span className="text-sm select-none" role="img" aria-label="India Flag">🇮🇳</span>
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="tel"
                    value={driverPhone}
                    onChange={(e) => {
                      setDriverPhone(e.target.value);
                      setDriverPhoneTouched(true);
                      if (submitError) setSubmitError('');
                    }}
                    onBlur={() => {
                      setDriverPhoneTouched(true);
                      const check = validateIndianPhone(driverPhone);
                      if (check.isValid) {
                        setDriverPhone(check.formatted);
                      }
                    }}
                    placeholder="+91 98765 43210"
                    className={`w-full pl-16 pr-9 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:outline-none font-mono ${
                      driverPhone.trim() && phoneValidation.isValid
                        ? 'border-emerald-500/80 dark:border-emerald-500/80 focus:ring-emerald-500/30'
                        : driverPhone.trim() && !phoneValidation.isValid && driverPhoneTouched
                        ? 'border-rose-500/80 dark:border-rose-500/80 focus:ring-rose-500/30'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'
                    }`}
                  />
                  {driverPhone.trim() && (
                    <div className="absolute right-3 top-3">
                      {phoneValidation.isValid ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : driverPhoneTouched ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      ) : null}
                    </div>
                  )}
                </div>
                {driverPhone.trim() && !phoneValidation.isValid && driverPhoneTouched ? (
                  <p className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{phoneValidation.errorMessage}</span>
                  </p>
                ) : driverPhone.trim() && phoneValidation.isValid ? (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Valid Indian mobile ({phoneValidation.formatted})</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    10-digit Indian mobile number (e.g. +91 98765 43210)
                  </p>
                )}
              </div>
            </div>

            {/* Gate and Physical Seal */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Arrival Port Gate <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <select
                    value={selectedGateId}
                    onChange={(e) => setSelectedGateId(Number(e.target.value) || '')}
                    disabled={gates.length === 0}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border ${
                      gates.length === 0
                        ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white cursor-pointer'
                    } text-xs font-bold focus:ring-2 focus:ring-teal-500 focus:outline-none`}
                  >
                    {gates.length === 0 ? (
                      <option value="">No entry gates available (INBOUND / BIDIRECTIONAL required)</option>
                    ) : (
                      <>
                        <option value="">Select Arrival Gate...</option>
                        {gates.map((g) => (
                          <option key={g.gate_id} value={g.gate_id}>
                            {g.gate_name} ({g.gate_code}) &bull; {g.gate_type_display || g.gate_type}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                {gates.length === 0 && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    All registered port gates are currently configured as OUTBOUND (exit-only). Physical truck entry requires an INBOUND or BIDIRECTIONAL gate.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Physical Container Seal Number
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. SEAL-EXP-9921"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Officer Remarks */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Physical Inspection &amp; Gate Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                placeholder="Note any visual container damage, seal integrity, or arrival observations..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none resize-none"
              />
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Recording Arrival &amp; Verifying Gate-In...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Authorize &amp; Confirm Export Gate-In</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Panel: 5 cols = Eligible Containers awaiting gate-in */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Awaiting Gate-In Manifest
              </h3>
              <p className="text-[11px] text-slate-500">
                Export containers registered for arrival ({containers.length})
              </p>
            </div>
            <button
              onClick={fetchEligibleContainers}
              disabled={loadingContainers}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingContainers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Search filter */}
          <div className="mt-3 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={containerSearch}
              onChange={(e) => setContainerSearch(e.target.value)}
              placeholder="Search container, vessel, cargo..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
            />
          </div>

          {/* Container list scroll area */}
          <div className="mt-3 space-y-2 flex-1 overflow-y-auto max-h-[460px] pr-1">
            {loadingContainers ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                <span>Loading eligible export containers...</span>
              </div>
            ) : containers.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No export containers awaiting gate-in.
              </div>
            ) : (
              containers.map((c) => {
                const isSelected = selectedContainer?.container_id === c.container_id;
                return (
                  <div
                    key={c.container_id}
                    onClick={() => handleSelectContainer(c)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 ring-1 ring-teal-500/30'
                        : 'border-slate-100 dark:border-slate-800 hover:border-teal-500/40 bg-slate-50/50 dark:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                        {c.container_number}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        {c.container_status_display || c.container_status}
                      </span>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-2">
                      <span>{c.container_type_display || c.container_type}</span>
                      <span>&bull;</span>
                      <span>{c.container_gross_weight} T</span>
                    </div>

                    <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                      {c.cargo_context?.cargo_description || 'General Export Goods'}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="text-teal-600 dark:text-teal-400 font-semibold truncate max-w-[180px]">
                        🚢 {c.cargo_context?.vessel_name || 'Scheduled Vessel'}
                      </span>
                      <span className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                        Select <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Gate-In Audit History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Export Gate-In History &amp; Audit Trail
            </h3>
            <p className="text-xs text-slate-500">
              Verified physical arrivals recorded by authorized gate officers
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search history..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-1 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          {loadingHistory ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
              <span>Loading gate-in history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No export gate-in records found.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Gate-In #</th>
                  <th className="py-3 px-3">Container</th>
                  <th className="py-3 px-3">Truck &amp; Driver</th>
                  <th className="py-3 px-3">Entry Gate</th>
                  <th className="py-3 px-3">Seal #</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Officer</th>
                  <th className="py-3 px-3 text-right">Gate-In Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((record) => (
                  <tr key={record.gate_in_id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                      #{record.gate_in_id}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        {record.container_number}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {record.container_type_display || record.container_type || 'Export'} &bull; {record.container_gross_weight} T
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        {record.gate_in_truck_number}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {record.gate_in_driver_name} ({record.gate_in_driver_license})
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {record.gate_name || record.gate_in_entry_point}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      {record.gate_in_seal_number || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {record.gate_in_new_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {record.officer_name || 'Gate Officer'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500 text-[11px]">
                      {record.gate_in_time ? new Date(record.gate_in_time).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
