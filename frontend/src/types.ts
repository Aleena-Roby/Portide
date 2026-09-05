export type UserRole = 
  | 'admin' 
  | 'port_administrator'
  | 'shipping_company' 
  | 'operations_officer' 
  | 'port_operations_officer'
  | 'customs_officer' 
  | 'terminal_operator' 
  | 'terminal_logistics_operator'
  | 'gate_officer'
  | 'gate_truck_officer';

export interface UserRoleInfo {
  id: UserRole;
  name: string;
  title: string;
  description: string;
  icon: string;
  color: string;
}

export interface PortUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organisation: string;
  orgId?: string;
  phone: string;
  employeeId?: string;
  department?: string;
  status: 'active' | 'pending' | 'suspended';
  avatar?: string;
  createdAt: string;
}

export interface Vessel {
  id: string;
  imo: string;
  name: string;
  type: 'Container Ship' | 'Bulk Carrier' | 'Tanker' | 'Ro-Ro' | 'General Cargo';
  flag: string;
  lengthMeters: number;
  draftMeters: number;
  capacityTeu?: number;
  grossTonnage: number;
  shippingCompany: string;
  status: 'Scheduled' | 'Anchored' | 'Berth Assigned' | 'At Berth' | 'Departed' | 'Delayed';
  eta: string;
  etd: string;
  assignedBerthId?: string;
  assignedBerthName?: string;
  cargoType: string;
  cargoVolumeTonnes: number;
}

export interface BackendVessel {
  vessel_id: number;
  vessel_shipping_company_id: number;
  company_name?: string;
  company_email?: string;
  vessel_name: string;
  vessel_imo_number: string;
  vessel_type: string;
  vessel_flag: string;
  vessel_call_sign?: string;
  vessel_length: number | string;
  vessel_draft: number | string;
  vessel_capacity: number;
  vessel_status: 'ACTIVE' | 'INACTIVE';
  vessel_created_at: string;
  vessel_updated_at: string;
}

export interface BackendBerth {
  berth_id: number;
  berth_name: string;
  berth_code?: string | null;
  berth_type?: string;
  berth_type_display?: string;
  berth_max_length?: number | string;
  berth_max_draft: number | string;
  berth_capacity_teu: number;
  berth_status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
  berth_is_active?: boolean;
  current_vessel?: {
    vessel_id: number;
    vessel_name: string;
    vessel_imo_number: string;
    vessel_type: string;
    vessel_length: string;
    vessel_draft: string;
    company_name: string;
    cargo_type: string;
    cargo_quantity: string;
  } | null;
  current_schedule?: {
    vessel_schedule_id: number;
    vessel_schedule_status: 'SCHEDULED' | 'ARRIVED' | 'AT_BERTH' | 'DEPARTED';
    scheduled_arrival_at: string;
    scheduled_departure_at: string;
    actual_arrival_at?: string | null;
    actual_at_berth_at?: string | null;
    actual_departure_at?: string | null;
    operational_remarks?: string | null;
  } | null;
  berth_created_at: string;
  berth_updated_at: string;
}

export interface BackendVesselSchedule {
  vessel_schedule_id: number;
  vessel_schedule_arrival_request_id: number;
  vessel_schedule_berth_id: number;
  berth_name?: string;
  berth?: BackendBerth;
  vessel_name?: string | null;
  vessel_imo_number?: string | null;
  company_name?: string | null;
  vessel_schedule_scheduled_arrival_at: string;
  vessel_schedule_scheduled_departure_at: string;
  vessel_schedule_actual_arrival_at?: string | null;
  vessel_schedule_actual_at_berth_at?: string | null;
  vessel_schedule_actual_departure_at?: string | null;
  vessel_schedule_status: 'SCHEDULED' | 'ARRIVED' | 'AT_BERTH' | 'DEPARTED';
  vessel_schedule_operational_remarks?: string | null;
  vessel_schedule_created_by?: number | null;
  created_by_name?: string | null;
  vessel_schedule_created_at: string;
  vessel_schedule_updated_at: string;
}

export interface BackendVesselArrivalRequest {
  vessel_arrival_request_id: number;
  vessel_arrival_request_vessel_id: number;
  vessel?: BackendVessel;
  vessel_arrival_request_requested_arrival_at: string;
  vessel_arrival_request_requested_departure_at: string;
  vessel_arrival_request_cargo_type: string;
  vessel_arrival_request_cargo_quantity: number | string;
  vessel_arrival_request_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  vessel_arrival_request_submitted_at: string;
  vessel_arrival_request_reviewed_at?: string | null;
  vessel_arrival_request_reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  vessel_arrival_request_remarks?: string | null;
  schedule?: BackendVesselSchedule | null;
  scheduling_status?: string;
}

export interface Berth {
  id: string;
  name: string; // e.g. "Berth B-01"
  terminal: string; // "Container Terminal 1", "Bulk Terminal A", etc.
  maxDraftMeters: number;
  maxLengthMeters: number;
  status: 'Available' | 'Occupied' | 'Maintenance' | 'Reserved';
  currentVesselId?: string;
  currentVesselName?: string;
  occupancyPercent: number;
  cranesAvailable: number;
  nextAvailableTime?: string;
}

export interface Container {
  id: string; // Container Number e.g. "MSKU-782910-4"
  type: '20ft Standard' | '40ft High Cube' | '40ft Reefer' | '20ft Open Top' | 'Hazardous Tank';
  size: '20ft' | '40ft';
  weightKg: number;
  vesselId: string;
  vesselName: string;
  shippingLine: string;
  sealNumber: string;
  status: 'In Yard' | 'Loaded' | 'Unloading' | 'Gate Out Approved' | 'Customs Hold' | 'In Transit';
  yardZone: string; // e.g., "Zone C-14-3"
  baySlot: string;  // "B12-R04-T02"
  destination: string;
  customsStatus: 'Cleared' | 'Pending' | 'Flagged' | 'Rejected';
  arrivalDate: string;
}

export interface CustomsDocument {
  id: string; // e.g. "CUST-2026-8831"
  vesselId: string;
  vesselName: string;
  declarant: string; // Shipping line or Agent
  manifestNo: string;
  totalItems: number;
  declaredValueUsd: number;
  hazardClass?: string;
  status: 'Pending Review' | 'Approved' | 'Physical Inspection' | 'Rejected';
  submissionDate: string;
  rejectionReason?: string;
  officerNotes?: string;
}

export interface GatePass {
  id: string; // e.g., "GP-9012"
  truckPlate: string;
  driverName: string;
  driverLicence: string;
  transportCompany: string;
  containerId: string;
  passType: 'Pickup' | 'Drop-off';
  status: 'Generated' | 'Entry Approved' | 'In Terminal' | 'Exit Approved' | 'Completed' | 'Expired';
  timeSlot: string;
  issuedAt: string;
  gateNumber: string;
  qrCodeUrl?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  roleTarget?: UserRole | 'all';
}

export interface ActivityLog {
  id: string;
  user: string;
  role: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'vessel' | 'berth' | 'customs' | 'gate' | 'user' | 'system';
}

export interface ToastAlert {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}
