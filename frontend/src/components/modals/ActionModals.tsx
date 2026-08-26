import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';
import { UserRole } from '../../types';
import { 
  Ship, 
  Anchor, 
  QrCode, 
  UserPlus
} from 'lucide-react';

/* ================= 1. REGISTER VESSEL MODAL ================= */
export const RegisterVesselModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { registerVessel, currentUser } = useApp();
  const [name, setName] = useState('');
  const [imo, setImo] = useState('');
  const [type, setType] = useState<'Container Ship' | 'Bulk Carrier' | 'Tanker' | 'Ro-Ro' | 'General Cargo'>('Container Ship');
  const [flag, setFlag] = useState('');
  const [lengthMeters, setLengthMeters] = useState<number | ''>('');
  const [draftMeters, setDraftMeters] = useState<number | ''>('');
  const [cargoType, setCargoType] = useState('');
  const [cargoVolumeTonnes, setCargoVolumeTonnes] = useState<number | ''>('');
  const [eta, setEta] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerVessel({
      name,
      imo,
      type,
      flag,
      lengthMeters: Number(lengthMeters),
      draftMeters: Number(draftMeters),
      grossTonnage: 120000,
      shippingCompany: currentUser.organisation || 'Pacific Freight Lines',
      status: 'Scheduled',
      eta,
      etd: '2026-08-04 18:00',
      cargoType,
      cargoVolumeTonnes: Number(cargoVolumeTonnes)
    });
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Register Fleet Vessel Arrival" 
      subtitle="Submit IMO declaration & requested ETA schedule"
      icon={<Ship className="w-4 h-4" />}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Vessel Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MV Atlantic Leader"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              IMO Number *
            </label>
            <input
              type="text"
              required
              value={imo}
              onChange={(e) => setImo(e.target.value)}
              placeholder="e.g. IMO 9821034"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Vessel Category *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            >
              <option value="Container Ship">Container Ship</option>
              <option value="Bulk Carrier">Bulk Carrier</option>
              <option value="Tanker">Tanker</option>
              <option value="Ro-Ro">Ro-Ro Vehicle</option>
              <option value="General Cargo">General Cargo</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Flag State *
            </label>
            <input
              type="text"
              required
              value={flag}
              onChange={(e) => setFlag(e.target.value)}
              placeholder="e.g. Singapore"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Max Draft Depth (Meters)
            </label>
            <input
              type="number"
              step="0.1"
              value={draftMeters}
              onChange={(e) => setDraftMeters(Number(e.target.value))}
              placeholder="e.g. 14.5"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Estimated Arrival (ETA)
            </label>
            <input
              type="text"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="e.g. 2026-08-25 14:00"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Cargo Summary & Manifest Description
            </label>
            <input
              type="text"
              value={cargoType}
              onChange={(e) => setCargoType(e.target.value)}
              placeholder="e.g. Containerized electronics and automotive parts"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D49A24] hover:bg-[#b8831b] shadow-md transition-all flex items-center gap-2 cursor-pointer border border-[#D49A24]"
          >
            <Ship className="w-4 h-4" />
            Submit Vessel Registration
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ================= 2. ASSIGN BERTH MODAL ================= */
export const AssignBerthModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { vessels, berths, assignBerth } = useApp();
  const [vesselId, setVesselId] = useState(vessels[0]?.id || '');
  const [berthId, setBerthId] = useState(berths[0]?.id || '');

  const availableBerths = berths;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (vesselId && berthId) {
      assignBerth(vesselId, berthId);
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Allocate Berth Slot" 
      subtitle="Assign deepwater quay berth to arriving vessel"
      icon={<Anchor className="w-4 h-4" />}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Select Vessel *
            </label>
            <select
              value={vesselId}
              onChange={(e) => setVesselId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            >
              {vessels.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.imo}) • Draft: {v.draftMeters}m • {v.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Select Quay Berth Slot *
            </label>
            <select
              value={berthId}
              onChange={(e) => setBerthId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            >
              {availableBerths.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.terminal}) • Max Draft: {b.maxDraftMeters}m • Status: {b.status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <Anchor className="w-4 h-4" />
            Confirm Berth Allocation
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ================= 3. GENERATE GATE PASS MODAL ================= */
export const GenerateGatePassModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { generateGatePass, containers } = useApp();
  const [truckPlate, setTruckPlate] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverLicence, setDriverLicence] = useState('');
  const [transportCompany, setTransportCompany] = useState('');
  const [containerId, setContainerId] = useState(containers[0]?.id || '');
  const [passType, setPassType] = useState<'Pickup' | 'Drop-off'>('Pickup');
  const [timeSlot, setTimeSlot] = useState('');
  const [gateNumber, setGateNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (driverName) {
      generateGatePass({
        truckPlate,
        driverName,
        driverLicence,
        transportCompany,
        containerId,
        passType,
        timeSlot,
        gateNumber
      });
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Generate Truck Gate e-Pass" 
      subtitle="Issue RFID e-Pass and QR code authorization for port entry"
      icon={<QrCode className="w-4 h-4" />}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Truck Licence Plate *
            </label>
            <input
              type="text"
              required
              value={truckPlate}
              onChange={(e) => setTruckPlate(e.target.value)}
              placeholder="e.g. SGP-8891-X"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Driver Full Name *
            </label>
            <input
              type="text"
              required
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="e.g. Marcus Vance"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Driver Licence No. *
            </label>
            <input
              type="text"
              required
              value={driverLicence}
              onChange={(e) => setDriverLicence(e.target.value)}
              placeholder="e.g. DL-99210-A"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Transport Operator Company *
            </label>
            <input
              type="text"
              required
              value={transportCompany}
              onChange={(e) => setTransportCompany(e.target.value)}
              placeholder="e.g. TransPort Logistics Inc."
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Associated Container ID
            </label>
            <select
              value={containerId}
              onChange={(e) => setContainerId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            >
              {containers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.id} ({c.type}) • Yard: {c.yardZone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Pass Operation Type
            </label>
            <select
              value={passType}
              onChange={(e) => setPassType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            >
              <option value="Pickup">Pickup (Gate-Out)</option>
              <option value="Drop-off">Drop-off (Gate-In)</option>
            </select>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            Issue E-Pass & Generate QR
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ================= 4. MANAGE USERS MODAL ================= */
export const ManageUsersModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { addUser } = useApp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('operations_officer');
  const [organisation, setOrganisation] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && email) {
      addUser({
        name,
        email,
        role,
        organisation,
        phone,
        status: 'active'
      });
      onClose();
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Add Enterprise System User" 
      subtitle="Assign role permissions and RBAC access"
      icon={<UserPlus className="w-4 h-4" />}
      maxWidth="3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inspect. James Sterling"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Corporate Email *
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="james.sterling@port.gov"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Role Category *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24]"
            >
              <option value="admin">Port Administrator</option>
              <option value="shipping_company">Shipping Company</option>
              <option value="operations_officer">Port Operations Officer</option>
              <option value="customs_officer">Customs Officer</option>
              <option value="terminal_operator">Terminal Operator</option>
              <option value="gate_officer">Gate Officer</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Organisation Entity
            </label>
            <input
              type="text"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              placeholder="e.g. PORTIDE Port Authority"
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 shadow-md transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Create Account
          </button>
        </div>
      </form>
    </Modal>
  );
};
