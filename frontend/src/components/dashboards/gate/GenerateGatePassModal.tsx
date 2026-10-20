import React, { useState, useEffect } from 'react';
import { Modal } from '../../common/Modal';
import { apiFetch } from '../../../services/api';
import { 
  BackendContainer, 
  BackendTruck, 
  BackendDriver, 
  BackendGate, 
  BackendGatePass 
} from '../../../types';
import { 
  Truck as TruckIcon, 
  UserCheck, 
  MapPin, 
  Boxes, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Plus, 
  Info, 
  ShieldCheck, 
  Mail, 
  Phone, 
  IdCard,
  RefreshCw
} from 'lucide-react';

interface GenerateGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Pre-selected containers to include
  selectedContainers: BackendContainer[];
  // All eligible CLEARED containers available to pick from
  allClearedContainers: BackendContainer[];
  onSuccess: (gatePass: BackendGatePass) => void;
}

export const GenerateGatePassModal: React.FC<GenerateGatePassModalProps> = ({
  isOpen,
  onClose,
  selectedContainers: initialSelected,
  allClearedContainers,
  onSuccess
}) => {
  // Master data lists
  const [trucks, setTrucks] = useState<BackendTruck[]>([]);
  const [drivers, setDrivers] = useState<BackendDriver[]>([]);
  const [gates, setGates] = useState<BackendGate[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Form selections
  const [selectedTruckId, setSelectedTruckId] = useState<number | ''>('');
  const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
  const [selectedGateId, setSelectedGateId] = useState<number | ''>('');
  const [includedContainerIds, setIncludedContainerIds] = useState<number[]>([]);
  const [validHours, setValidHours] = useState<number>(24);
  const [remarks, setRemarks] = useState<string>('');

  // Inline creation states
  const [showAddTruck, setShowAddTruck] = useState<boolean>(false);
  const [newTruckNumber, setNewTruckNumber] = useState<string>('');
  const [newTruckCompany, setNewTruckCompany] = useState<string>('');
  const [truckSubmitting, setTruckSubmitting] = useState<boolean>(false);

  const [showAddDriver, setShowAddDriver] = useState<boolean>(false);
  const [newDriverName, setNewDriverName] = useState<string>('');
  const [newDriverLicense, setNewDriverLicense] = useState<string>('');
  const [newDriverPhone, setNewDriverPhone] = useState<string>('');
  const [newDriverEmail, setNewDriverEmail] = useState<string>('');
  const [driverSubmitting, setDriverSubmitting] = useState<boolean>(false);

  // Submission & feedback
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Initialize selected containers when modal opens or initialSelected changes
  useEffect(() => {
    if (isOpen) {
      if (initialSelected && initialSelected.length > 0) {
        setIncludedContainerIds(initialSelected.map(c => c.container_id));
      } else if (allClearedContainers && allClearedContainers.length > 0) {
        setIncludedContainerIds([allClearedContainers[0].container_id]);
      } else {
        setIncludedContainerIds([]);
      }
      setSelectedGateId('');
      setFormError('');
    }
  }, [isOpen, initialSelected, allClearedContainers]);

  // Load trucks, drivers, and gates from backend
  const loadMasterData = async () => {
    setLoadingData(true);
    try {
      const [trucksRes, driversRes, gatesRes] = await Promise.all([
        apiFetch('/api/gate/trucks/'),
        apiFetch('/api/gate/drivers/'),
        apiFetch('/api/gate/gates/')
      ]);

      if (trucksRes.ok) {
        const json = await trucksRes.json();
        const activeTrucks = (json.data || []).filter((t: BackendTruck) => t.truck_status === 'ACTIVE');
        setTrucks(activeTrucks);
        if (activeTrucks.length > 0 && !selectedTruckId) {
          setSelectedTruckId(activeTrucks[0].truck_id);
        }
      }

      if (driversRes.ok) {
        const json = await driversRes.json();
        const activeDrivers = (json.data || []).filter((d: BackendDriver) => d.driver_status === 'ACTIVE');
        setDrivers(activeDrivers);
        if (activeDrivers.length > 0 && !selectedDriverId) {
          setSelectedDriverId(activeDrivers[0].driver_id);
        }
      }

      if (gatesRes.ok) {
        const json = await gatesRes.json();
        const activeGates = (json.data || []).filter((g: BackendGate) => g.gate_is_active ?? (g as any).is_active ?? true);
        setGates(activeGates);
      }
    } catch {
      setFormError('Failed to load dispatch master records (trucks, drivers, gates).');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMasterData();
    }
  }, [isOpen]);

  // Selected entities resolution
  const currentTruck = trucks.find(t => t.truck_id === selectedTruckId);
  const currentDriver = drivers.find(d => d.driver_id === selectedDriverId);
  const currentGate = gates.find(g => g.gate_id === selectedGateId);

  // Selected container objects
  const containersMap = new Map<number, BackendContainer>();
  [...allClearedContainers, ...initialSelected].forEach(c => containersMap.set(c.container_id, c));
  const activeChosenContainers = includedContainerIds
    .map(id => containersMap.get(id))
    .filter((c): c is BackendContainer => Boolean(c));

  // Toggle container selection
  const handleToggleContainer = (containerId: number) => {
    setIncludedContainerIds(prev => {
      if (prev.includes(containerId)) {
        return prev.filter(id => id !== containerId);
      } else {
        return [...prev, containerId];
      }
    });
  };

  // Quick register truck
  const handleQuickAddTruck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTruckNumber.trim()) return;
    setTruckSubmitting(true);
    setFormError('');
    try {
      const res = await apiFetch('/api/gate/trucks/', {
        method: 'POST',
        body: JSON.stringify({
          truck_number: newTruckNumber.trim().toUpperCase(),
          transport_company: newTruckCompany.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        const created: BackendTruck = json.data;
        setTrucks(prev => [created, ...prev]);
        setSelectedTruckId(created.truck_id);
        setShowAddTruck(false);
        setNewTruckNumber('');
        setNewTruckCompany('');
      } else {
        setFormError(json.message || 'Failed to register truck.');
      }
    } catch {
      setFormError('Error connecting to truck registry.');
    } finally {
      setTruckSubmitting(false);
    }
  };

  // Quick register driver
  const handleQuickAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverName.trim() || !newDriverLicense.trim() || !newDriverEmail.trim()) {
      setFormError('Driver name, driving licence / ID reference, and registered email are required.');
      return;
    }
    setDriverSubmitting(true);
    setFormError('');
    try {
      const res = await apiFetch('/api/gate/drivers/', {
        method: 'POST',
        body: JSON.stringify({
          driver_name: newDriverName.trim(),
          driver_license: newDriverLicense.trim().toUpperCase(),
          driver_license_number: newDriverLicense.trim().toUpperCase(),
          driver_phone: newDriverPhone.trim(),
          driver_email: newDriverEmail.trim()
        })
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        const created: BackendDriver = json.data;
        setDrivers(prev => [created, ...prev]);
        setSelectedDriverId(created.driver_id);
        setShowAddDriver(false);
        setNewDriverName('');
        setNewDriverLicense('');
        setNewDriverPhone('');
        setNewDriverEmail('');
      } else {
        setFormError(json.message || 'Failed to register driver.');
      }
    } catch {
      setFormError('Error connecting to driver registry.');
    } finally {
      setDriverSubmitting(false);
    }
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedTruckId) {
      setFormError('Please select or register a transport truck.');
      return;
    }
    if (!selectedDriverId) {
      setFormError('Please select or register an assigned driver.');
      return;
    }
    if (!selectedGateId) {
      setFormError('Please select the designated port exit gate.');
      return;
    }
    if (includedContainerIds.length === 0) {
      setFormError('You must select at least one customs-cleared container for this gate movement.');
      return;
    }

    if (!currentDriver?.driver_email) {
      setFormError('Selected driver does not have a registered email address. Please update driver profile.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        truck_id: selectedTruckId,
        driver_id: selectedDriverId,
        gate_id: selectedGateId,
        container_ids: includedContainerIds,
        valid_hours: validHours,
        remarks: remarks.trim()
      };

      const res = await apiFetch('/api/gate/passes/generate/', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.status === 'success') {
        onSuccess(json.data);
      } else {
        const msg = json.message || (json.errors && Object.values(json.errors).flat().join(' ')) || 'Failed to generate digital gate pass.';
        setFormError(msg);
      }
    } catch {
      setFormError('Communication error while generating digital gate pass.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Digital Gate Pass"
      subtitle="Assign truck & driver to a specific gate movement and authorize exit for eligible containers"
      icon={<TruckIcon className="w-5 h-5 text-teal-600" />}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {formError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Validation Notice</span>
              <span>{formError}</span>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 1. TRUCK SELECTION */}
        {/* ===================================================================== */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <TruckIcon className="w-4 h-4 text-teal-600" />
              <span>1. Designated Transport Truck *</span>
            </label>
            <button
              type="button"
              onClick={() => setShowAddTruck(!showAddTruck)}
              className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{showAddTruck ? 'Select Existing' : 'Register New Truck'}</span>
            </button>
          </div>

          {showAddTruck ? (
            <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-teal-500/30 space-y-2.5">
              <div className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
                Register New Heavy Commercial Truck
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Registration Plate *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KL-05-AB-7824"
                    value={newTruckNumber}
                    onChange={(e) => setNewTruckNumber(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Haulage / Logistics Company
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Malabar Freight Logistics"
                    value={newTruckCompany}
                    onChange={(e) => setNewTruckCompany(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddTruck(false)}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={truckSubmitting || !newTruckNumber.trim()}
                  onClick={handleQuickAddTruck}
                  className="px-3.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {truckSubmitting ? 'Saving...' : 'Add Truck'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <select
                  required
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                >
                  <option value="">-- Select Registered Truck --</option>
                  {trucks.map(t => (
                    <option key={t.truck_id} value={t.truck_id}>
                      {t.truck_number} {t.transport_company ? `(${t.transport_company})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {currentTruck && (
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-900 dark:text-teal-200 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-mono font-black">{currentTruck.truck_number}</span>
                    <span className="text-[10px] text-teal-700 dark:text-teal-300 block">
                      {currentTruck.transport_company || 'Independent Haulier'}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white">
                    Verified
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 2. DRIVER ASSIGNMENT (SPECIFIC TO THIS GATE MOVEMENT) */}
        {/* ===================================================================== */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-purple-600" />
              <span>2. Assigned Driver for this Gate Movement *</span>
            </label>
            <button
              type="button"
              onClick={() => setShowAddDriver(!showAddDriver)}
              className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{showAddDriver ? 'Select Existing' : 'Register New Driver'}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Driver assignment is specific to this gate movement. The Digital Gate Pass and QR verification code will be <strong>automatically emailed to the driver's registered email address</strong>.
          </p>

          {showAddDriver ? (
            <div className="p-3.5 rounded-lg bg-white dark:bg-slate-900 border border-purple-500/30 space-y-2.5">
              <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                Register New Authorized Commercial Driver
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Driver Full Legal Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Arun Thomas"
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Driving Licence / Government ID Reference *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. KL07 2019004812"
                    value={newDriverLicense}
                    onChange={(e) => setNewDriverLicense(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Driver Registered Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. arun.thomas@transport.com"
                    value={newDriverEmail}
                    onChange={(e) => setNewDriverEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs"
                  />
                  <span className="text-[9px] text-purple-600 dark:text-purple-400 block mt-0.5">
                    Gate pass and QR code will be dispatched here.
                  </span>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">
                    Phone / Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98471 23456"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddDriver(false)}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={driverSubmitting || !newDriverName.trim() || !newDriverLicense.trim() || !newDriverEmail.trim()}
                  onClick={handleQuickAddDriver}
                  className="px-3.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {driverSubmitting ? 'Registering...' : 'Register Driver'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <select
                required
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="">-- Select Registered Commercial Driver --</option>
                {drivers.map(d => (
                  <option key={d.driver_id} value={d.driver_id}>
                    {d.driver_name} • {d.driver_license || d.driver_license_number} ({d.driver_email})
                  </option>
                ))}
              </select>

              {currentDriver && (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-purple-950 dark:text-purple-100">
                      {currentDriver.driver_name}
                    </span>
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-purple-600 text-white font-bold">
                      {currentDriver.driver_license || currentDriver.driver_license_number}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-purple-800 dark:text-purple-300">
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span className="font-mono font-semibold truncate">
                        {currentDriver.driver_email}
                      </span>
                    </div>
                    {currentDriver.driver_phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="font-mono">{currentDriver.driver_phone}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-purple-700 dark:text-purple-400 font-medium pt-1 border-t border-purple-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span>PORTIDE will automatically dispatch Digital Gate Pass + QR to {currentDriver.driver_email}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 3. GATE / EXIT POINT & VALIDITY PERIOD */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              <span>3. Authorized Port Exit Gate *</span>
            </label>
            <select
              required
              value={selectedGateId}
              onChange={(e) => setSelectedGateId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            >
              <option value="">-- Select Gate Point --</option>
              {gates.map(g => (
                <option key={g.gate_id} value={g.gate_id}>
                  {g.gate_name} ({g.gate_code})
                </option>
              ))}
            </select>
            {currentGate && (
              <span className="text-[10px] text-slate-400 block">
                Gate Code: {currentGate.gate_code} • Type: {currentGate.gate_type_display || currentGate.gate_type || 'Outbound'}
              </span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Gate Pass Validity Window</span>
            </label>
            <select
              value={validHours}
              onChange={(e) => setValidHours(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
            >
              <option value={12}>12 Hours (Express Dispatch)</option>
              <option value={24}>24 Hours (Standard Shift)</option>
              <option value={48}>48 Hours (Extended Transport Window)</option>
              <option value={72}>72 Hours (Weekend / Heavy Haul)</option>
            </select>
            <span className="text-[10px] text-slate-400 block">
              Pass will automatically expire after this period.
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 4. MULTI-CONTAINER SELECTION & ELIGIBILITY VERIFICATION */}
        {/* ===================================================================== */}
        <div className="space-y-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-[#D49A24]" />
              <span>4. Authorized Containers ({activeChosenContainers.length} Selected) *</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">
              Multiple containers per truck supported
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            A single truck movement may carry multiple authorized containers. Only containers with verified customs clearance (<strong>CLEARED</strong>) are eligible for inclusion.
          </p>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {allClearedContainers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-300 dark:border-slate-700">
                No customs-cleared containers currently eligible for release.
              </div>
            ) : (
              allClearedContainers.map(container => {
                const isSelected = includedContainerIds.includes(container.container_id);
                const hasExistingPass = Boolean(container.gate_pass && container.gate_pass.gate_pass_status === 'ACTIVE');

                return (
                  <div
                    key={container.container_id}
                    onClick={() => {
                      if (!hasExistingPass) handleToggleContainer(container.container_id);
                    }}
                    className={`p-2.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-100 shadow-2xs'
                        : hasExistingPass
                        ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        disabled={hasExistingPass}
                        checked={isSelected}
                        onChange={() => {
                          if (!hasExistingPass) handleToggleContainer(container.container_id);
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-mono font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{container.container_number}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-sans font-normal">
                            {container.container_type_display || container.container_type} • {container.teu_equivalent} TEU
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          Weight: {container.container_gross_weight} MT • Cargo: {container.cargo_context?.cargo_description || 'Consignment'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {hasExistingPass ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                          Active Pass: {container.gate_pass?.gate_pass_id}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>CLEARED</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 5. REMARKS */}
        {/* ===================================================================== */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Dispatch Notes / Security Instructions (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Authorized for heavy transport route via North Highway corridor"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* ===================================================================== */}
        {/* 6. VERIFICATION SUMMARY CARD */}
        {/* ===================================================================== */}
        <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] space-y-2">
          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>Gate Movement Pre-Generation Summary</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div>
              <span className="text-slate-400 block font-medium">Truck Plate</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {currentTruck ? currentTruck.truck_number : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Assigned Driver</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {currentDriver ? currentDriver.driver_name : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Driver Email</span>
              <span className="font-mono text-purple-600 dark:text-purple-400 truncate block">
                {currentDriver?.driver_email || '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Authorized Gate</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                {currentGate ? currentGate.gate_name : '—'}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 pt-1 border-t border-slate-200 dark:border-slate-700">
            <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span>
              Generating will create an ACTIVE pass, generate a secure verification QR code, and automatically email the pass manifest to {currentDriver?.driver_email || 'driver'}.
            </span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* FOOTER ACTIONS */}
        {/* ===================================================================== */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || loadingData || activeChosenContainers.length === 0 || !selectedTruckId || !selectedDriverId}
            className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Generating Gate Pass & Dispatching Email...</span>
              </>
            ) : (
              <>
                <TruckIcon className="w-3.5 h-3.5" />
                <span>Generate Digital Gate Pass ({activeChosenContainers.length})</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
