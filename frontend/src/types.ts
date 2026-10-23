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
  mustChangePassword?: boolean;
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
  vessel_id?: number;
  vessel?: BackendVessel;
  shipping_company?: any;
  vessel_arrival_request_requested_arrival_at: string;
  vessel_arrival_request_requested_departure_at: string;
  vessel_arrival_request_cargo_type: string;
  vessel_arrival_request_cargo_quantity: number | string;
  vessel_arrival_request_preferred_berth_id?: number | null;
  preferred_berth?: BackendBerth | null;
  vessel_arrival_request_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  vessel_arrival_request_submitted_at: string;
  vessel_arrival_request_reviewed_at?: string | null;
  vessel_arrival_request_reviewed_by?: number | null;
  reviewed_by_name?: string | null;
  vessel_arrival_request_remarks?: string | null;
  schedule?: BackendVesselSchedule | null;
  scheduling_status?: string;
  duration_hours?: number;
  is_cargo_eligible?: boolean;
  is_expired?: boolean;
}

export interface BackendPort {
  port_id: number;
  port_code: string;
  port_name: string;
  port_country: string;
  port_country_code: string;
  port_is_active: boolean;
  display_name?: string;
}

export interface BackendCargo {
  cargo_id: number;
  cargo_arrival_request_id: number;
  cargo_description: string;
  cargo_type: 'CONTAINERIZED' | 'GENERAL_CARGO' | 'BULK_CARGO';
  cargo_type_display?: string;
  cargo_direction?: 'IMPORT' | 'EXPORT';
  cargo_direction_display?: string;
  cargo_quantity: number | string;
  cargo_unit: 'TEU' | 'FEU' | 'TONNES' | 'KG' | 'UNITS' | 'PACKAGES' | string;
  cargo_unit_display?: string;
  cargo_weight: number | string;
  cargo_origin_port_id?: number | null;
  cargo_destination_port_id?: number | null;
  origin_port?: BackendPort | null;
  destination_port?: BackendPort | null;
  cargo_origin: string;
  cargo_destination: string;
  cargo_status: 'REGISTERED' | 'IN_PORT' | 'COMPLETED';
  cargo_status_display?: string;
  cargo_created_at: string;
  cargo_updated_at: string;
  arrival_request_summary?: {
    arrival_request_id: number;
    vessel_id?: number;
    vessel_name: string;
    vessel_imo_number: string;
    vessel_type?: string;
    company_name?: string;
    company_id?: number;
    requested_arrival_at?: string | null;
    requested_departure_at?: string | null;
    status: string;
  } | null;
}

export type ContainerType = '20FT' | '40FT' | '40FT_HC';
export type ContainerStatus = 'REGISTERED' | 'ARRIVED' | 'AT_TERMINAL' | 'AWAITING_CUSTOMS' | 'UNDER_INSPECTION' | 'CUSTOMS_HOLD' | 'CLEARED' | 'RELEASED' | 'LOADED';

export interface CustomsInspectionData {
  customs_inspection_id: number;
  customs_inspection_container_id: number;
  customs_inspection_officer_id?: number | null;
  officer_name?: string | null;
  officer_email?: string | null;
  customs_inspection_officer_name?: string;
  customs_inspection_officer_email?: string;
  customs_inspection_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'ON_HOLD';
  customs_inspection_status_display?: string;
  customs_inspection_result?: 'PENDING' | 'CLEARED' | 'HOLD' | 'ADDITIONAL_INFORMATION_REQUIRED' | 'UNDER_INSPECTION' | null;
  customs_inspection_result_display?: string;
  customs_inspection_document_status: 'PENDING' | 'VERIFIED' | 'ISSUE_FOUND';
  customs_inspection_document_status_display?: string;
  customs_inspection_remarks?: string | null;
  customs_inspection_hold_reason?: string | null;
  customs_inspection_hold_reason_display?: string;
  customs_inspection_started_at?: string | null;
  customs_inspection_completed_at?: string | null;
  customs_inspection_clearance_date?: string | null;
  customs_inspection_created_at: string;
  customs_inspection_updated_at: string;
}

export interface GateReleaseData {
  release_id: number;
  previous_status: string;
  new_status: string;
  truck_number: string;
  driver_name: string;
  driver_license: string;
  exit_point: string;
  remarks?: string;
  officer_id?: number | null;
  officer_name?: string | null;
  officer_email?: string | null;
  release_time?: string | null;
}

export interface GateInData {
  gate_in_id: number;
  previous_status: string;
  new_status: string;
  truck_number: string;
  driver_name: string;
  driver_license: string;
  driver_phone?: string;
  entry_point: string;
  seal_number?: string;
  gate_id?: number | null;
  gate_name?: string;
  gate_code?: string;
  remarks?: string;
  officer_id?: number | null;
  officer_name?: string | null;
  officer_email?: string | null;
  gate_in_time?: string | null;
}

export interface BackendGateIn {
  gate_in_id: number;
  gate_in_container_id: number;
  container_number?: string;
  container_type?: string;
  container_type_display?: string;
  container_gross_weight?: string | number;
  cargo_description?: string;
  vessel_name?: string | null;
  gate_in_truck_id?: number | null;
  gate_in_driver_id?: number | null;
  gate_in_gate_id?: number | null;
  gate_name?: string;
  gate_code?: string;
  gate_in_officer_id?: number | null;
  officer_name?: string | null;
  officer_email?: string | null;
  gate_in_previous_status: string;
  gate_in_new_status: string;
  gate_in_truck_number: string;
  gate_in_driver_name: string;
  gate_in_driver_license: string;
  gate_in_driver_phone?: string;
  gate_in_entry_point: string;
  gate_in_seal_number?: string;
  gate_in_remarks?: string | null;
  gate_in_time: string;
  gate_in_created_at: string;
  gate_in_updated_at: string;
}

export type CustomsDocumentType =
  | 'BILL_OF_LADING'
  | 'COMMERCIAL_INVOICE'
  | 'PACKING_LIST'
  | 'CERTIFICATE_OF_ORIGIN'
  | 'CUSTOMS_IMPORT_DECLARATION'
  | 'DELIVERY_ORDER'
  | 'PHYTOSANITARY_CERTIFICATE'
  | 'HAZMAT_DECLARATION'
  | 'OTHER';

export type CustomsDocumentWorkflow = 'NORMAL' | 'PRE_ARRIVAL';
export type CustomsDocumentReviewStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'SUPERSEDED' | 'WITHDRAWN';

export interface CustomsDocumentItem {
  document_id: number;
  container_id: number;
  container_number?: string;
  inspection_id?: number | null;
  pre_arrival_declaration_id?: number | null;
  document_declaration_id?: number | null;
  document_type: CustomsDocumentType;
  document_type_display: string;
  workflow_type: CustomsDocumentWorkflow;
  workflow_type_display: string;
  document_name?: string;
  original_filename: string;
  file_size?: number;
  file_size_bytes?: number;
  formatted_file_size?: string;
  file_size_formatted: string;
  mime_type?: string;
  file_type?: string;
  file_extension?: string;
  document_version?: number;
  version?: number;
  document_is_active?: boolean;
  is_active?: boolean;
  document_amendment_reason?: string;
  amendment_reason?: string;
  replaced_by_id?: number | null;
  can_delete?: boolean;
  can_replace?: boolean;
  is_editable?: boolean;
  review_status: CustomsDocumentReviewStatus;
  document_review_status?: string;
  review_status_display: string;
  review_remarks?: string;
  document_review_remarks?: string;
  notes?: string;
  document_notes?: string;
  uploader_name?: string;
  uploaded_by_name?: string;
  reviewer_name?: string;
  reviewed_by_name?: string;
  submitted_at: string;
  document_uploaded_at?: string;
  reviewed_at?: string | null;
  document_reviewed_at?: string | null;
  file_url?: string;
  download_url: string;
}

export interface BackendContainer {
  container_id: number;
  container_cargo_id: number;
  container_number: string;
  container_type: ContainerType;
  container_type_display?: string;
  container_gross_weight: number | string;
  trade_direction?: 'IMPORT' | 'EXPORT';
  container_status: ContainerStatus;
  container_status_display?: string;
  container_customs_status?: string;
  container_customs_status_display?: string;
  is_customs_cleared?: boolean;
  customs_declaration?: any;
  customs_documents?: CustomsDocumentItem[];
  direct_transfer?: any;
  container_created_at: string;
  container_updated_at: string;
  teu_equivalent: number;
  yard_location?: YardLocationDetail | null;
  latest_customs_inspection?: CustomsInspectionData | null;
  customs_inspection?: {
    inspection_id?: number;
    inspection_status?: string;
    inspection_status_display?: string;
    inspection_result?: string | null;
    inspection_result_display?: string | null;
    document_verification_status?: string;
    document_verification_status_display?: string;
    inspection_remarks?: string;
    hold_reason?: string | null;
    hold_reason_display?: string | null;
    officer_id?: number | null;
    officer_name?: string | null;
    officer_email?: string | null;
    inspection_date?: string | null;
    clearance_date?: string | null;
    completed_at?: string | null;
  } | null;
  gate_release?: GateReleaseData | null;
  gate_in?: GateInData | null;
  gate_pass?: {
    gate_pass_id: number;
    id?: number;
    pass_number: string;
    gate_pass_pass_number?: string;
    movement_number: string;
    status: GatePassStatus;
    gate_pass_status?: GatePassStatus;
    status_display: string;
    truck_number?: string | null;
    driver_name?: string | null;
    driver_phone?: string | null;
    driver_email?: string | null;
    gate_name?: string | null;
    issued_at?: string | null;
    valid_until?: string | null;
    gate_pass_valid_until?: string | null;
    gate_pass_used_at?: string | null;
    is_valid: boolean;
  } | null;
  cargo_context?: {
    cargo_id: number;
    cargo_description: string;
    cargo_type: string;
    cargo_type_display?: string;
    cargo_quantity: number | string;
    cargo_unit: string;
    cargo_weight: number | string;
    cargo_origin: string;
    cargo_destination: string;
    arrival_request_id?: number | null;
    vessel_id?: number | null;
    vessel_name?: string;
    vessel_imo_number?: string;
    vessel_type?: string;
    company_id?: number | null;
    company_name?: string;
  } | null;
}

export interface ContainerSummaryStats {
  total_containers: number;
  total_teu: number;
  status_breakdown: {
    REGISTERED: number;
    ARRIVED: number;
    AT_TERMINAL: number;
    AWAITING_CUSTOMS?: number;
    UNDER_INSPECTION: number;
    CUSTOMS_HOLD?: number;
    CLEARED: number;
    RELEASED: number;
  };
  declared_cargo_quantity: number;
  declared_cargo_unit: string;
  capacity_mismatch: boolean;
  mismatch_message?: string | null;
}

export interface BerthAvailabilityEvaluation {
  berth_id: number;
  berth_name: string;
  berth_code?: string | null;
  berth_type: string;
  berth_type_display: string;
  berth_max_length: number;
  berth_max_draft: number;
  berth_status: string;
  berth_is_active: boolean;
  is_length_compatible: boolean;
  is_draft_compatible: boolean;
  is_operational: boolean;
  has_approved_conflict: boolean;
  has_pending_requests: boolean;
  pending_request_count: number;
  suitability_status: 'AVAILABLE' | 'SUITABLE_PENDING' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE' | 'NOT_SUITABLE';
  can_select_as_preferred: boolean;
  rejection_reasons: string[];
  conflicting_schedule?: {
    vessel_name?: string | null;
    scheduled_arrival_at: string;
    scheduled_departure_at: string;
  } | null;
}

export interface Berth {
  id: string;
  name: string; // e.g. "Berth B-01"
  code?: string;
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

export interface BackendTruck {
  truck_id: number;
  truck_number: string;
  truck_company_name?: string | null;
  transport_company?: string | null;
  transport_company_name?: string | null;
  truck_status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  truck_created_at?: string;
  truck_updated_at?: string;
}

export interface BackendDriver {
  driver_id: number;
  driver_name: string;
  driver_license_number: string;
  driver_license?: string;
  driver_phone: string;
  driver_email: string;
  driver_status: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  driver_created_at?: string;
  driver_updated_at?: string;
}

export interface BackendGate {
  gate_id: number;
  gate_name: string;
  gate_code: string;
  gate_type: 'INBOUND' | 'OUTBOUND' | 'BIDIRECTIONAL';
  gate_type_display?: string;
  gate_is_active: boolean;
  gate_created_at?: string;
}

export interface BackendGatePassContainer {
  gate_pass_container_id: number;
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display?: string;
  container_gross_weight: string | number;
  container_status: string;
  container_status_display?: string;
  cargo_description?: string;
  vessel_name?: string;
  shipping_company_name?: string;
  teu_equivalent?: number;
  gate_pass_container_created_at?: string;
}

export type GatePassStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'CANCELLED';

export interface BackendGatePass {
  gate_pass_id: number;
  id?: number;
  gate_pass_pass_number: string;
  gate_pass_movement_number: string;
  truck: BackendTruck;
  truck_details?: BackendTruck;
  driver: BackendDriver;
  driver_details?: BackendDriver;
  gate: BackendGate;
  gate_details?: BackendGate;
  issued_by_name?: string;
  gate_pass_status: GatePassStatus;
  gate_pass_status_display: string;
  gate_pass_type?: 'STANDARD_YARD' | 'DIRECT_TRANSFER';
  gate_pass_type_display?: string;
  gate_pass_verification_code: string;
  gate_pass_qr_code: string;
  qr_svg?: string;
  gate_pass_issued_at: string;
  gate_pass_valid_until: string;
  gate_pass_verified_at?: string | null;
  gate_pass_used_at?: string | null;
  gate_pass_cancelled_at?: string | null;
  gate_pass_remarks?: string | null;
  gate_pass_email_status: 'PENDING' | 'SENT' | 'FAILED';
  gate_pass_email_status_display: string;
  gate_pass_email_sent_at?: string | null;
  gate_pass_email_error?: string | null;
  email_status?: { dispatched: boolean };
  containers: BackendGatePassContainer[];
  container_count?: number;
  is_valid: boolean;
  gate_pass_created_at: string;
  gate_pass_updated_at: string;
}

export interface DeliveryTimelineStep {
  step: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  is_completed: boolean;
  is_current: boolean;
  is_pending: boolean;
  timestamp: string | null;
  location?: string | null;
}

export interface PublicContainerTrackingResult {
  is_delivery_stage?: boolean;
  container_number: string;
  cargo_description: string;
  cargo_type: string;
  vessel_name: string;
  arrival_request_id: string;
  current_status: string;
  current_status_display: string;
  status_message?: string;
  destination?: string;
  origin_port?: string;
  destination_port?: string;
  last_known_location?: string;
  last_updated: string;
  last_updated_iso?: string;
  expected_delivery_date?: string | null;
  timeline?: DeliveryTimelineStep[];
}

export type DeliveryTrackingStatus =
  | 'RELEASED'
  | 'GATE_PASS_GENERATED'
  | 'PICKED_UP'
  | 'DEPARTED_PORT'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'DELIVERY_EXCEPTION';

export interface TrackingEventRecord {
  tracking_event_id: number;
  container_id?: number;
  container_number?: string;
  tracking_event_container_id?: number;
  tracking_event_gate_pass_id?: number | null;
  gate_pass_id?: number | null;
  gate_pass_number?: string | null;

  // Status fields
  status: DeliveryTrackingStatus;
  status_display: string;
  tracking_event_status?: DeliveryTrackingStatus;
  tracking_event_status_display?: string;

  // Location and details
  location: string;
  tracking_event_location?: string;
  description: string;
  tracking_event_description?: string;
  exception_reason?: string | null;
  tracking_event_exception_reason?: string | null;

  // Actor / User fields
  updated_by_name: string;
  updated_by_role?: string | null;
  tracking_event_updated_by?: number | null;

  // Timestamp fields
  timestamp: string;
  timestamp_formatted?: string;
  tracking_event_timestamp?: string;
  created_at?: string;
  tracking_event_created_at?: string;
}

export interface DeliveryContainerListItem {
  container_id: number;
  container_number: string;
  container_type: string;
  container_gross_weight: string | number;
  cargo_description: string;
  vessel_name: string;
  arrival_request_id?: string;
  gate_pass_id: number | null;
  gate_pass_number: string | null;
  truck_number: string | null;
  driver_name: string | null;
  container_delivery_status: DeliveryTrackingStatus;
  container_delivery_status_display: string;
  current_status?: DeliveryTrackingStatus;
  current_status_display?: string;
  container_delivery_destination: string;
  container_delivery_location: string;
  expected_delivery_datetime?: string | null;
  expected_delivery_destination?: string;
  actual_delivery_datetime?: string | null;
  final_delivery_destination?: string | null;
  destination?: string;
  expected_delivery_date?: string | null;
  expected_delivery_date_formatted?: string | null;
  last_updated: string | null;
  last_updated_iso?: string | null;
  last_updated_by: string;
  latest_event?: TrackingEventRecord | null;
}

export interface DeliverySummaryCounts {
  all: number;
  released: number;
  gate_pass_generated: number;
  picked_up: number;
  departed_port: number;
  in_transit: number;
  out_for_delivery: number;
  delivered: number;
  delivery_exception: number;
}

export interface DeliveryContainerDetail {
  container_id: number;
  container_number: string;
  container_type: string;
  container_gross_weight: string | number;
  container_status: string;
  cargo_description: string;
  cargo_type: string;
  vessel_name: string;
  vessel_flag: string;
  shipping_company_name: string;
  arrival_request_id: string;
  gate_pass_id: number | null;
  gate_pass_number: string | null;
  truck_number: string | null;
  truck_company: string | null;
  driver_name: string | null;
  container_delivery_status: DeliveryTrackingStatus;
  container_delivery_status_display: string;
  current_status?: DeliveryTrackingStatus;
  current_status_display?: string;
  container_delivery_destination: string;
  container_delivery_location: string;
  last_known_location?: string;
  container_delivery_recipient: string | null;
  container_expected_delivery_date: string | null;
  container_delivered_at: string | null;
  container_delivered_by_name: string | null;
  container_delivery_remarks: string | null;
  expected_delivery_datetime?: string | null;
  expected_delivery_destination?: string;
  actual_delivery_datetime?: string | null;
  final_delivery_destination?: string | null;
  destination?: string;
  expected_delivery_date?: string | null;
  expected_delivery_date_formatted?: string | null;
  delivered_at?: string | null;
  delivered_at_formatted?: string | null;
  delivered_by_name?: string | null;
  delivered_by_role?: string | null;
  delivery_location?: string;
  delivery_recipient?: string | null;
  delivery_reference?: string | null;
  delivery_remarks?: string | null;
  last_updated: string | null;
  last_updated_by: string;
  timeline: DeliveryTimelineStep[];
  tracking_history: TrackingEventRecord[];
  allowed_actions: string[];
}

// ==============================================================================
// PHASE T1 — YARD MASTER MANAGEMENT TYPES
// ==============================================================================

export type YardType = 'CONTAINER_YARD' | 'EMPTY_CONTAINER_YARD' | 'REEFER_YARD' | 'GENERAL_STORAGE';
export type YardStatus = 'ACTIVE' | 'INACTIVE';
export type BlockType = 'STANDARD' | 'REEFER' | 'EMPTY' | 'HAZMAT' | 'GENERAL';
export type BlockStatus = 'ACTIVE' | 'INACTIVE';
export type SlotStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'BLOCKED' | 'INACTIVE';

export interface YardSlotItem {
  yard_slot_id: number;
  yard_slot_block_id: number;
  block_code: string;
  block_name: string;
  yard_id: number;
  yard_code: string;
  yard_name: string;
  yard_slot_code: string;
  yard_slot_row: number;
  yard_slot_bay: number;
  yard_slot_tier: number;
  yard_slot_status: SlotStatus;
  yard_slot_status_display: string;
  is_allocatable: boolean;
  yard_slot_created_at: string;
  yard_slot_updated_at: string;
}

export interface YardBlockItem {
  yard_block_id: number;
  yard_block_yard_id: number;
  yard_id: number;
  yard_code: string;
  yard_name: string;
  yard_status: string;
  yard_block_name: string;
  yard_block_code: string;
  yard_block_type: BlockType;
  yard_block_type_display: string;
  yard_block_status: BlockStatus;
  yard_block_status_display: string;
  yard_block_capacity: number;
  yard_block_occupied: number;
  available_capacity: number;
  occupancy_percentage: number;
  is_operational: boolean;
  slots_count: number;
  slots?: YardSlotItem[];
  yard_block_created_at: string;
  yard_block_updated_at: string;
}

export interface YardItem {
  yard_id: number;
  yard_name: string;
  yard_code: string;
  yard_type: YardType;
  yard_type_display: string;
  yard_status: YardStatus;
  yard_status_display: string;
  yard_capacity: number;
  yard_occupied: number;
  available_capacity: number;
  occupancy_percentage: number;
  is_operational: boolean;
  blocks_count: number;
  total_slots_count: number;
  blocks?: YardBlockItem[];
  yard_created_at: string;
  yard_updated_at: string;
}

// ==============================================================================
// PHASE T2 — CONTAINER YARD ALLOCATION & STORAGE TYPES
// ==============================================================================

export type YardAllocationStatus = 'ACTIVE' | 'RELEASED';

export interface YardLocationDetail {
  allocation_id: number;
  yard_id: number;
  yard_name: string;
  yard_code: string;
  block_id: number;
  block_name: string;
  block_code: string;
  slot_id: number;
  simple_code?: string;
  slot_code: string;
  slot_row: number;
  slot_bay: number;
  slot_tier: number;
  location_display: string;
  allocated_at: string | null;
  allocated_by_id?: number | null;
  allocated_by_name?: string | null;
  remarks?: string;
}

export interface PendingContainerItem {
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  container_gross_weight: string;
  teu_equivalent: number;
  trade_direction?: 'IMPORT' | 'EXPORT';
  container_status: string;
  container_status_display: string;
  vessel_name: string;
  vessel_imo_number: string;
  arrival_request_id: number | null;
  cargo_description: string;
  customs_status_display: string;
  has_active_allocation: boolean;
  allocation_status: 'ALLOCATED' | 'UNALLOCATED';
  is_discharged?: boolean;
  container_created_at: string;
}

export interface AvailableSlotItem {
  slot_id: number;
  simple_code?: string;
  slot_code: string;
  slot_row: number;
  slot_bay: number;
  slot_tier: number;
  slot_status: SlotStatus;
  slot_status_display: string;
  yard_slot_id: number;
  yard_slot_code: string;
  yard_slot_row: number;
  yard_slot_bay: number;
  yard_slot_tier: number;
  yard_slot_status: SlotStatus;
  block_id: number;
  block_code: string;
  block_name: string;
  block_type: BlockType;
  yard_id: number;
  yard_code: string;
  yard_name: string;
  location_display: string;
}

export interface YardAllocationItem {
  yard_allocation_id: number;
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  container_gross_weight: string;
  trade_direction?: 'IMPORT' | 'EXPORT';
  container_status: string;
  container_status_display: string;
  vessel_name: string;
  yard_id: number;
  yard_code: string;
  yard_name: string;
  block_id: number;
  block_code: string;
  block_name: string;
  slot_id: number;
  simple_code?: string;
  slot_code: string;
  slot_row: number;
  slot_bay: number;
  slot_tier: number;
  yard_slot_code: string;
  location_display: string;
  current_location: string;
  yard_allocation_status: YardAllocationStatus;
  yard_allocation_allocated_at: string;
  allocated_by_name: string;
  yard_allocation_released_at: string | null;
  released_by_name: string | null;
  yard_allocation_remarks: string;
  remarks: string;
  yard_allocation_created_at: string;
  yard_allocation_updated_at: string;
}

export interface CreateYardAllocationPayload {
  container_id: number;
  slot_id?: number;
  simple_code?: string;
  remarks?: string;
}

export interface ReleaseYardAllocationPayload {
  remarks?: string;
}

// ==============================================================================
// PHASE T3 — YARD OPERATIONS MANAGEMENT TYPES
// ==============================================================================

export interface YardMovementHistoryItem {
  yard_movement_id: number;
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  movement_type?: string;
  movement_type_display?: string;
  crane_id?: number | null;
  crane_code?: string | null;
  crane_name?: string | null;
  crane_type?: string | null;
  crane_type_display?: string | null;
  from_slot_id: number;
  from_slot_code: string;
  from_slot_row: number;
  from_slot_bay: number;
  from_slot_tier: number;
  from_block_id: number;
  from_block_code: string;
  from_block_name: string;
  from_yard_id: number;
  from_yard_code: string;
  from_yard_name: string;
  from_location_display: string;
  to_slot_id: number;
  to_slot_code: string;
  to_slot_row: number;
  to_slot_bay: number;
  to_slot_tier: number;
  to_block_id: number;
  to_block_code: string;
  to_block_name: string;
  to_yard_id: number;
  to_yard_code: string;
  to_yard_name: string;
  to_location_display: string;
  moved_by_id: number | null;
  moved_by_name: string;
  movement_timestamp: string;
  remarks: string;
  yard_movement_created_at: string;
}

export interface YardOperationContainerItem {
  container_id: number;
  container_number: string;
  container_type: string;
  container_gross_weight: string;
  container_status: string;
  container_delivery_status: string;
  storage_status: 'STORED' | 'NOT_ALLOCATED' | 'RELEASED';
  storage_status_display: string;
  current_location: YardLocationDetail | null;
  vessel_name: string;
  cargo_description: string;
  movement_count: number;
  last_relocated_at: string | null;
  container_created_at: string;
  container_updated_at: string;
}

export interface ContainerRelocationPayload {
  container_id: number;
  destination_slot_id: number;
  crane_id?: number | null;
  remarks?: string;
}

export interface YardUtilizationBlock {
  block_id: number;
  block_name: string;
  block_code: string;
  block_type: string;
  block_type_display: string;
  block_status: string;
  block_capacity: number;
  block_occupied: number;
  available_capacity: number;
  occupancy_percentage: number;
  is_operational: boolean;
}

export interface YardUtilizationYard {
  yard_id: number;
  yard_name: string;
  yard_code: string;
  yard_type: string;
  yard_type_display: string;
  yard_status: string;
  yard_capacity: number;
  yard_occupied: number;
  available_capacity: number;
  occupancy_percentage: number;
  is_operational: boolean;
  blocks: YardUtilizationBlock[];
}

export interface YardUtilizationSummary {
  overall: {
    total_capacity: number;
    total_occupied: number;
    total_available: number;
    occupancy_percentage: number;
    total_yards: number;
  };
  yards: YardUtilizationYard[];
}

// =============================================================================
// PHASE T4 — CRANE MANAGEMENT & ALLOCATION TYPES
// =============================================================================

export type CraneType = 'STS' | 'RTG' | 'RMG' | 'MHC';
export type CraneStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'INACTIVE';
export type CraneOperationType = 'UNLOADING' | 'LOADING' | 'BOTH';
export type CraneAllocationStatus = 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface CraneItem {
  crane_id: number;
  crane_code: string;
  crane_name: string;
  crane_type: CraneType;
  crane_type_display: string;
  crane_max_lifting_capacity_mt: string | number;
  crane_capacity_unit: string;
  crane_status: CraneStatus;
  crane_status_display: string;
  crane_assigned_berth_id: number | null;
  assigned_berth_name: string | null;
  assigned_berth_code: string | null;
  crane_last_maintenance_date: string | null;
  crane_next_maintenance_due: string | null;
  crane_maintenance_remarks: string | null;
  crane_is_active: boolean;
  is_operational: boolean;
  active_allocations_count: number;
  current_active_allocation?: {
    crane_allocation_id: number;
    vessel_schedule_id: number;
    vessel_name: string;
    operation_type: string;
    planned_start_at: string;
    planned_end_at: string;
    actual_start_at: string | null;
  } | null;
  crane_created_at: string;
  crane_updated_at: string;
}

export interface CraneAllocationItem {
  crane_allocation_id: number;
  crane_allocation_crane_id: number;
  crane_code: string;
  crane_name: string;
  crane_type: string;
  crane_type_display: string;
  crane_allocation_vessel_schedule_id: number;
  vessel_name: string;
  vessel_imo: string;
  crane_allocation_berth_id: number | null;
  berth_name: string;
  berth_code: string | null;
  crane_allocation_operation_type: CraneOperationType;
  operation_type_display: string;
  crane_allocation_status: CraneAllocationStatus;
  allocation_status_display: string;
  crane_allocation_planned_start_at: string;
  crane_allocation_planned_end_at: string;
  crane_allocation_actual_start_at: string | null;
  crane_allocation_actual_end_at: string | null;
  crane_allocation_assigned_by_id: number | null;
  assigned_by_name: string;
  crane_allocation_remarks: string;
  crane_allocation_created_at: string;
  crane_allocation_updated_at: string;
}

export interface EligibleVesselSchedule {
  vessel_schedule_id: number;
  vessel_name: string;
  vessel_imo: string;
  vessel_type: string;
  vessel_schedule_berth_id: number;
  berth_name: string;
  berth_code: string | null;
  vessel_schedule_status: string;
  status_display: string;
  vessel_schedule_scheduled_arrival_at: string;
  vessel_schedule_scheduled_departure_at: string;
  vessel_schedule_actual_arrival_at: string | null;
  vessel_schedule_actual_at_berth_at: string | null;
}

export interface CraneOperationsSummary {
  kpis: {
    total_cranes: number;
    available_cranes: number;
    in_use_cranes: number;
    maintenance_cranes: number;
    inactive_cranes: number;
    total_allocations: number;
    scheduled_allocations: number;
    active_allocations: number;
    completed_allocations: number;
    cancelled_allocations: number;
  };
  recent_allocations: CraneAllocationItem[];
}

// =============================================================================
// PHASE T4 / UNLOADING OPERATIONS INTEGRATION TYPES
// =============================================================================

export interface EligibleUnloadingVessel {
  vessel_schedule_id: number;
  vessel_id: number;
  vessel_name: string;
  vessel_imo_number: string;
  vessel_call_sign: string;
  shipping_company_name: string;
  berth_id: number;
  berth_name: string;
  berth_code: string;
  schedule_status: string;
  schedule_status_display: string;
  actual_at_berth_at: string | null;
  active_cranes_count: number;
  manifested_containers_count: number;
}

export interface ActiveUnloadingCrane {
  crane_allocation_id: number;
  crane_id: number;
  crane_code: string;
  crane_name: string;
  crane_type: string;
  crane_type_display: string;
  crane_status: string;
  crane_max_lifting_capacity_mt: string | number;
  berth_id: number | null;
  berth_name: string | null;
  operation_type: string;
  operation_type_display: string;
  allocation_status: string;
  allocation_status_display: string;
  crane_allocation_planned_start_at: string;
  crane_allocation_planned_end_at: string;
  crane_allocation_actual_start_at: string | null;
}

export interface ManifestUnloadingContainer {
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  container_gross_weight: string | number;
  teu_equivalent: number;
  container_status: string;
  container_status_display: string;
  cargo_id: number;
  cargo_description: string;
  customs_status_display: string;
  trade_direction?: 'IMPORT' | 'EXPORT' | 'TRANSSHIPMENT';
  container_created_at: string;
}

export interface UnloadingHistoryItem {
  yard_movement_id: number;
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  movement_type: string;
  movement_type_display: string;
  crane_id: number | null;
  crane_code: string | null;
  crane_name: string | null;
  from_location_display: string;
  to_slot_id: number | null;
  to_slot_code: string | null;
  to_yard_code: string | null;
  to_block_code: string | null;
  to_location_display: string;
  moved_by_name: string;
  movement_timestamp: string;
  remarks: string;
}

// =============================================================================
// PHASE T4-B / LOADING OPERATIONS (VESSEL STOWAGE) TYPES
// =============================================================================

export interface EligibleLoadingVessel {
  vessel_schedule_id: number;
  vessel_id: number;
  vessel_name: string;
  vessel_imo_number: string;
  vessel_call_sign: string;
  shipping_company_name: string;
  berth_id: number;
  berth_name: string;
  berth_code: string;
  schedule_status: string;
  schedule_status_display: string;
  actual_at_berth_at: string | null;
  active_cranes_count: number;
  yard_containers_count: number;
}

export interface ActiveLoadingCrane {
  crane_allocation_id: number;
  crane_id: number;
  crane_code: string;
  crane_name: string;
  crane_type: string;
  crane_type_display: string;
  crane_status: string;
  crane_max_lifting_capacity_mt: string | number;
  berth_id: number | null;
  berth_name: string | null;
  operation_type: string;
  operation_type_display: string;
  allocation_status: string;
  allocation_status_display: string;
  crane_allocation_planned_start_at: string;
  crane_allocation_planned_end_at: string;
  crane_allocation_actual_start_at: string | null;
}

export interface YardLoadingContainer {
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  container_gross_weight: string | number;
  teu_equivalent: number;
  container_status: string;
  container_status_display: string;
  cargo_id: number;
  cargo_description: string;
  slot_id: number;
  slot_code: string;
  block_code: string;
  yard_code: string;
  location_display: string;
  customs_status_display: string;
  trade_direction?: 'IMPORT' | 'EXPORT' | 'TRANSSHIPMENT';
  vessel_schedule_id?: number | null;
  vessel_name?: string | null;
  container_created_at: string;
}

export interface LoadingHistoryItem {
  yard_movement_id: number;
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  movement_type: string;
  movement_type_display: string;
  crane_id: number | null;
  crane_code: string | null;
  crane_name: string | null;
  from_location_display: string;
  to_location_display: string;
  moved_by_name: string;
  movement_timestamp: string;
  remarks: string;
}

// =============================================================================
// DIRECT SHIP-TO-TRUCK & PRE-ARRIVAL CUSTOMS CLEARANCE TYPES
// =============================================================================

export type PreArrivalCustomsStatus = 
  | 'PENDING_REVIEW'
  | 'ADDITIONAL_INFORMATION_REQUIRED'
  | 'CLEARED'
  | 'UNDER_INSPECTION'
  | 'CUSTOMS_HOLD';

export interface PreArrivalCustomsDeclaration {
  declaration_id: number;
  declaration_reference: string;
  declaration_container_id: number;
  container_number?: string;
  container_type?: string;
  declaration_vessel_schedule_id: number;
  vessel_name?: string;
  vessel_imo?: string;
  berth_name?: string;
  declaration_shipping_company_id: number;
  company_name?: string;
  declaration_status: PreArrivalCustomsStatus;
  declaration_status_display: string;
  declaration_document: string | null;
  declaration_document_name: string;
  declaration_document_type: string;
  declaration_submitted_by?: number;
  submitted_by_name?: string;
  declaration_reviewed_by?: number;
  reviewed_by_name?: string;
  declaration_review_remarks: string;
  declaration_hold_reason: string;
  declaration_notes?: string;
  declaration_review_history?: any[];
  documents?: CustomsDocumentItem[];
  declaration_submitted_at: string;
  declaration_reviewed_at: string | null;
  declaration_created_at: string;
}

export interface DeliveryOrderItem {
  delivery_order_id: number;
  delivery_order_number: string;
  delivery_order_container_id: number;
  container_number?: string;
  delivery_order_shipping_company_id: number;
  shipping_company_name?: string;
  delivery_order_trucking_company: string;
  delivery_order_truck_number: string;
  delivery_order_driver_name: string;
  delivery_order_status: 'ISSUED' | 'CANCELLED' | 'USED';
  delivery_order_status_display: string;
  delivery_order_valid_until: string;
  is_valid: boolean;
  delivery_order_remarks: string;
  delivery_order_created_at: string;
}

export type DirectTransferStatus =
  | 'INITIATED'
  | 'IN_PROGRESS'
  | 'TRANSFERRED_TO_TRUCK'
  | 'AWAITING_GATE_EXIT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface DirectShipToTruckTransferItem {
  transfer_id: number;
  transfer_reference: string;
  transfer_container_id: number;
  container_number?: string;
  container_type?: string;
  container_type_display?: string;
  container_gross_weight?: string | number;
  transfer_vessel_schedule_id: number;
  vessel_name?: string;
  transfer_berth_id: number;
  berth_name?: string;
  transfer_crane_allocation_id: number;
  transfer_crane_id: number;
  crane_code?: string;
  crane_name?: string;
  transfer_truck_id: number;
  truck_number?: string;
  transfer_driver_id: number;
  driver_name?: string;
  driver_phone?: string;
  transfer_delivery_order_id?: number | null;
  delivery_order_number?: string | null;
  transfer_gate_pass_id?: number | null;
  gate_pass_number?: string | null;
  transfer_status: DirectTransferStatus;
  transfer_status_display: string;
  transfer_remarks: string;
  initiated_by_name?: string;
  executed_by_name?: string;
  gate_verified_by_name?: string;
  transfer_initiated_at: string;
  transfer_transferred_at: string | null;
  transfer_completed_at: string | null;
  transfer_created_at: string;
}

export interface EligibleDirectTransferContainer {
  container_id: number;
  container_number: string;
  container_type: string;
  container_type_display: string;
  container_gross_weight: string | number;
  teu_equivalent: number;
  container_status: string;
  container_status_display: string;
  container_customs_status: string;
  container_customs_status_display: string;
  is_customs_cleared: boolean;
  cargo_id: number;
  cargo_description: string;
  has_delivery_order: boolean;
  delivery_order_number: string | null;
  has_active_transfer: boolean;
  has_yard_allocation: boolean;
  is_eligible_for_direct_transfer: boolean;
  ineligibility_reasons: string[];
}




