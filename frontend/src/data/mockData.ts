import { Vessel, Berth, Container, CustomsDocument, GatePass, PortUser, NotificationItem, ActivityLog, UserRoleInfo } from '../types';

export const USER_ROLES_INFO: UserRoleInfo[] = [
  {
    id: 'admin',
    name: 'Port Administrator',
    title: 'Port Executive & System Admin',
    description: 'Full administrative control over port operations, user permissions, global analytics, terminal configuration, and system audit logs.',
    icon: 'ShieldCheck',
    color: 'from-blue-600 to-indigo-800'
  },
  {
    id: 'port_administrator',
    name: 'Port Administrator',
    title: 'Port Executive & System Admin',
    description: 'Full administrative control over port operations, user permissions, global analytics, terminal configuration, and system audit logs.',
    icon: 'ShieldCheck',
    color: 'from-blue-600 to-indigo-800'
  },
  {
    id: 'shipping_company',
    name: 'Shipping Company / Shipping Agent',
    title: 'Vessel Operator & Freight Agent',
    description: 'Register fleet vessels, request berth slots, submit electronic cargo manifests, track schedule adherence, and manage shipping documentation.',
    icon: 'Ship',
    color: 'from-cyan-600 to-blue-700'
  },
  {
    id: 'operations_officer',
    name: 'Port Operations Officer',
    title: 'Harbour Master & Berth Planner',
    description: 'Real-time berth allocation, vessel traffic control, tugboat & pilotage dispatch, quay crane assignment, and channel depth monitoring.',
    icon: 'Compass',
    color: 'from-emerald-600 to-teal-800'
  },
  {
    id: 'port_operations_officer',
    name: 'Port Operations Officer',
    title: 'Harbour Master & Berth Planner',
    description: 'Real-time berth allocation, vessel traffic control, tugboat & pilotage dispatch, quay crane assignment, and channel depth monitoring.',
    icon: 'Compass',
    color: 'from-emerald-600 to-teal-800'
  },
  {
    id: 'customs_officer',
    name: 'Customs Officer',
    title: 'Border & Maritime Inspection',
    description: 'Process import/export declarations, verify cargo manifests, flag high-risk containers, schedule physical inspections, and grant clearances.',
    icon: 'FileCheck2',
    color: 'from-amber-600 to-orange-700'
  },
  {
    id: 'terminal_operator',
    name: 'Terminal & Logistics Operator',
    title: 'Yard Manager & Stevedore Supervisor',
    description: 'Container yard stacking layout, reach stacker & gantry crane scheduling, loading/unloading throughput optimisation, and yard storage capacity.',
    icon: 'Boxes',
    color: 'from-purple-600 to-indigo-700'
  },
  {
    id: 'terminal_logistics_operator',
    name: 'Terminal & Logistics Operator',
    title: 'Yard Manager & Stevedore Supervisor',
    description: 'Container yard stacking layout, reach stacker & gantry crane scheduling, loading/unloading throughput optimisation, and yard storage capacity.',
    icon: 'Boxes',
    color: 'from-purple-600 to-indigo-700'
  },
  {
    id: 'gate_officer',
    name: 'Gate & Truck Operations Officer',
    title: 'Port Entry/Exit & Logistics Inspector',
    description: 'Validate e-gate passes, verify RFID truck registration, perform driver licence optical scan, inspect seal integrity, and log gate throughput.',
    icon: 'Truck',
    color: 'from-rose-600 to-red-700'
  },
  {
    id: 'gate_truck_officer',
    name: 'Gate & Truck Operations Officer',
    title: 'Port Entry/Exit & Logistics Inspector',
    description: 'Validate e-gate passes, verify RFID truck registration, perform driver licence optical scan, inspect seal integrity, and log gate throughput.',
    icon: 'Truck',
    color: 'from-rose-600 to-red-700'
  }
];

export const INITIAL_USERS: PortUser[] = [];
export const INITIAL_VESSELS: Vessel[] = [];
export const INITIAL_BERTHS: Berth[] = [];
export const INITIAL_CONTAINERS: Container[] = [];
export const INITIAL_CUSTOMS_DOCS: CustomsDocument[] = [];
export const INITIAL_GATE_PASSES: GatePass[] = [];
export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_ACTIVITY_LOGS: ActivityLog[] = [];

export const MONTHLY_VESSEL_ARRIVALS: { month: string; containerVessels: number; bulkCarriers: number; tankers: number }[] = [];
export const STORAGE_UTILIZATION_DATA: { zone: string; occupied: number; capacity: number }[] = [];
export const HOURLY_TRUCK_TRAFFIC: { hour: string; entries: number; exits: number }[] = [];
