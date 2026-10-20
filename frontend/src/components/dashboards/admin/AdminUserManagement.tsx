import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { Modal } from '../../common/Modal';
import { checkPasswordRequirements } from '../../../utils/passwordValidation';
import { InternationalPhoneInput } from '../../common/InternationalPhoneInput';
import { PasswordRequirementChecklist } from '../../common/PasswordRequirementChecklist';

import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Edit, 
  Shield, 
  Building2, 
  Mail, 
  Phone, 
  X, 
  RefreshCw,
  AlertTriangle,
  IdCard,
  Eye,
  EyeOff,
  Trash2
} from 'lucide-react';

interface BackendUser {
  user_id: number;
  user_full_name: string;
  email: string;
  user_phone: string;
  user_employee_id: string | null;
  user_department: string | null;
  user_designation: string | null;
  role: string;
  user_status: string;
  user_created_at: string;
  user_updated_at: string;
}

export const AdminUserManagement: React.FC = () => {
  const { addToast } = useApp();

  const [dbUsers, setDbUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Create Staff Modal State
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState<boolean>(false);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [formError, setFormError] = useState<string>('');

  // Form Fields for Create Staff User
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [createPhoneValid, setCreatePhoneValid] = useState<boolean>(true);
  const [employeeId, setEmployeeId] = useState<string>('POO-2026-001');
  const [role, setRole] = useState<string>('port_operations_officer');
  const [department, setDepartment] = useState<string>('Port Operations');

  // Selected User Modal for Viewing Profile Details
  const [selectedUser, setSelectedUser] = useState<BackendUser | null>(null);

  // User Deletion Modal State
  const [userToDelete, setUserToDelete] = useState<BackendUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  // Edit Staff User Modal State
  const [userToEdit, setUserToEdit] = useState<BackendUser | null>(null);
  const [editFullName, setEditFullName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  const [editPhoneValid, setEditPhoneValid] = useState<boolean>(true);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editFormError, setEditFormError] = useState<string>('');


  const handleOpenEditModal = (user: BackendUser) => {
    setUserToEdit(user);
    setEditFullName(user.user_full_name || '');
    setEditPhone(user.user_phone || '');
    setEditFormError('');
  };

  const handleEditUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditFormError('');

    if (!userToEdit) return;

    const trimmedName = editFullName.trim();
    if (!trimmedName) {
      setEditFormError('Full Name is required and cannot be empty.');
      return;
    }

    if (editPhone && !editPhoneValid) {
      setEditFormError('Please enter a valid phone number for the selected country.');
      return;
    }


    setEditLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userToEdit.user_id}/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': 'port_administrator'
        },
        body: JSON.stringify({
          user_full_name: trimmedName,
          user_phone: editPhone.trim()
        })
      });

      const result = await response.json();
      setEditLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'User Updated', 'User information updated successfully.');
        setUserToEdit(null);
        fetchUsers();
      } else {
        const errorDetail = result.errors ? Object.values(result.errors).flat().join(' ') : result.message;
        setEditFormError(errorDetail || 'Failed to update user information.');
      }
    } catch (err) {
      setEditLoading(false);
      setEditFormError('Unable to connect to server. Please try again.');
    }
  };


  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    setDeleteLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/${userToDelete.user_id}/`, {
        method: 'DELETE',
        headers: {
          'X-User-Role': 'port_administrator'
        }
      });

      const result = await response.json();
      setDeleteLoading(false);

      if (response.ok && result.status === 'success') {
        addToast('success', 'User Deleted', 'User deleted successfully.');
        setDbUsers(prev => prev.filter(u => u.user_id !== userToDelete.user_id));
        setUserToDelete(null);
        fetchUsers();
      } else {
        addToast('error', 'Deletion Failed', result.message || 'User deletion failed. Please try again.');
        setUserToDelete(null);
      }
    } catch (err) {
      setDeleteLoading(false);
      addToast('error', 'Deletion Error', 'User deletion failed. Please try again.');
      setUserToDelete(null);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/users/', {
        headers: {
          'X-User-Role': 'port_administrator'
        }
      });
      const result = await response.json();

      if (response.ok && result.status === 'success') {
        setDbUsers(result.data || []);
      } else {
        setError(result.message || 'Failed to load user list.');
      }
    } catch (err) {
      setError('Unable to connect to Django server. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const [fetchingNextId, setFetchingNextId] = useState<boolean>(false);

  // Compute next available unique Employee ID based on database records
  const computeFallbackEmployeeId = (targetRole: string) => {
    const prefixMap: Record<string, string> = {
      port_operations_officer: 'POO',
      customs_officer: 'CUS',
      terminal_logistics_operator: 'TLO',
      gate_truck_officer: 'GTO',
    };
    const prefix = prefixMap[targetRole] || 'EMP';
    const year = new Date().getFullYear();
    const pattern = `${prefix}-${year}-`;

    let maxNum = 0;
    dbUsers.forEach(u => {
      if (u.user_employee_id && u.user_employee_id.toUpperCase().startsWith(pattern)) {
        const rawSuffix = u.user_employee_id.substring(pattern.length);
        const match = rawSuffix.match(/^(\d+)/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          if (!isNaN(parsed) && parsed > maxNum) {
            maxNum = parsed;
          }
        }
      }
    });

    const nextNum = maxNum + 1;
    const formatted = `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
    setEmployeeId(formatted);
  };

  // Fetch guaranteed unique Employee ID directly from backend registry API
  const fetchNextEmployeeId = async (targetRole: string) => {
    setFetchingNextId(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/admin/users/next-employee-id/?role=${targetRole}`, {
        headers: {
          'X-User-Role': 'port_administrator'
        }
      });
      const data = await response.json();
      if (response.ok && data.employee_id) {
        setEmployeeId(data.employee_id);
      } else {
        computeFallbackEmployeeId(targetRole);
      }
    } catch {
      computeFallbackEmployeeId(targetRole);
    } finally {
      setFetchingNextId(false);
    }
  };

  // Update default employee ID prefix and department when role changes in form
  const handleRoleChange = (selectedRole: string) => {
    setRole(selectedRole);
    switch (selectedRole) {
      case 'port_operations_officer':
        setDepartment('Port Operations');
        break;
      case 'customs_officer':
        setDepartment('Customs');
        break;
      case 'terminal_logistics_operator':
        setDepartment('Terminal & Logistics');
        break;
      case 'gate_truck_officer':
        setDepartment('Gate Operations');
        break;
      default:
        break;
    }
    fetchNextEmployeeId(selectedRole);
  };

  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName || !email || !employeeId || !department) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (phone && !createPhoneValid) {
      setFormError('Please enter a valid phone number for the selected country.');
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/admin/users/staff/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': 'port_administrator'
        },
        body: JSON.stringify({
          user_full_name: fullName.trim(),
          user_email: email.trim().toLowerCase(),
          user_phone: phone.trim(),
          user_employee_id: employeeId.trim(),
          user_department: department.trim(),
          user_role: role
        })
      });

      const result = await response.json();
      setCreateLoading(false);

      if (response.ok && result.status === 'success') {
        const userEmail = email.trim().toLowerCase();
        if (result.email_sent === false) {
          addToast('warning', 'Staff Account Created', 'Staff account created successfully, but the notification email could not be sent.');
        } else {
          addToast('success', 'Staff Account Created', `Staff account created successfully. Temporary login credentials have been sent to ${userEmail}.`);
        }
        
        // Reset Form
        setFullName('');
        setEmail('');
        setPhone('');
        setEmployeeId('');
        setIsCreateStaffOpen(false);

        fetchUsers();
      } else {
        const errorDetail = result.errors ? Object.values(result.errors).flat().join(' ') : result.message;
        setFormError(errorDetail || 'Failed to create staff user.');
      }
    } catch (err) {
      setCreateLoading(false);
      setFormError('Unable to connect to server. Please try again.');
    }
  };

  // Filtered DB Users (Excludes Port Administrator accounts)
  const filteredUsers = dbUsers.filter(u => {
    if (u.role === 'port_administrator' || u.role === 'admin' || u.role === 'administrator') return false;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = !query || 
      (u.user_full_name && u.user_full_name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query)) ||
      (u.user_employee_id && u.user_employee_id.toLowerCase().includes(query)) ||
      (u.user_department && u.user_department.toLowerCase().includes(query));

    return matchesRole && matchesSearch;
  });

  const getRoleBadge = (roleStr: string) => {
    switch (roleStr) {
      case 'port_administrator':
      case 'admin':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#D49A24]/10 text-[#D49A24] border border-[#D49A24]/30">Port Administrator</span>;
      case 'shipping_company':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">Shipping Company</span>;
      case 'port_operations_officer':
      case 'operations_officer':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Port Operations Officer</span>;
      case 'customs_officer':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">Customs Officer</span>;
      case 'terminal_logistics_operator':
      case 'terminal_operator':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">Terminal & Logistics Operator</span>;
      case 'gate_truck_officer':
      case 'gate_officer':
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">Gate & Truck Operations Officer</span>;
      default:
        return <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">{roleStr}</span>;
    }
  };

  const getRoleDisplayName = (roleStr: string) => {
    switch (roleStr) {
      case 'port_operations_officer':
      case 'operations_officer':
        return 'Port Operations Officer';
      case 'customs_officer':
        return 'Customs Officer';
      case 'terminal_logistics_operator':
      case 'terminal_operator':
        return 'Terminal & Logistics Operator';
      case 'gate_truck_officer':
      case 'gate_officer':
        return 'Gate & Truck Operations Officer';
      case 'shipping_company':
        return 'Shipping Company';
      case 'port_administrator':
      case 'admin':
        return 'Port Administrator';
      default:
        return roleStr;
    }
  };


  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 font-sans selection:bg-[#D49A24] selection:text-white animate-fade-in">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D49A24] mb-1">
            <Shield className="w-4 h-4" />
            <span>Port Governance & RBAC Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            User Management & Staff Creation
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            Create internal staff accounts, assign operational roles with initial passwords, and monitor system user profiles.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
            title="Refresh Users List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => {
              setIsCreateStaffOpen(true);
              setFormError('');
              fetchNextEmployeeId(role || 'port_operations_officer');
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-[#D49A24] hover:bg-[#b8831b] transition-all flex items-center gap-2 cursor-pointer shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create Staff User</span>
          </button>
        </div>
      </div>

      {/* SEARCH & ROLE FILTER BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex-1 relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, employee ID, or department..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-[#D49A24] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 shrink-0">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-500">Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
          >
            <option value="all">All Operational Roles</option>
            <option value="port_operations_officer">Port Operations Officer</option>
            <option value="customs_officer">Customs Officer</option>
            <option value="terminal_logistics_operator">Terminal & Logistics Operator</option>
            <option value="gate_truck_officer">Gate & Truck Operations Officer</option>
            <option value="shipping_company">Shipping Company</option>
          </select>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchUsers} className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700">
            Retry
          </button>
        </div>
      )}

      {/* USERS DATABASE TABLE */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-8 h-8 mx-auto text-[#D49A24] animate-spin" />
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Loading user database from PostgreSQL...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No user records found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              No active or staff user accounts match the current filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider text-[11px]">
                  <th className="p-4">User Info</th>
                  <th className="p-4">Employee ID</th>
                  <th className="p-4">System Role</th>
                  <th className="p-4">Department</th>
                  <th className="p-4">Contact Phone</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-300">
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.user_id} 
                    onClick={() => setSelectedUser(user)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    title="Click row to view user details"
                  >
                    
                    {/* User Info */}
                    <td className="p-4">
                      <div 
                        className="flex items-center gap-2.5 font-bold text-slate-900 dark:text-white group-hover:text-[#D49A24] dark:group-hover:text-[#D49A24] transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#D49A24]/10 border border-[#D49A24]/30 text-[#D49A24] font-black flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition-transform">
                          {user.user_full_name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <div className="group-hover:underline">{user.user_full_name}</div>
                          <div className="text-[11px] text-slate-400 font-normal">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="p-4 font-mono font-bold text-[#D49A24]">
                      {user.user_employee_id || '—'}
                    </td>

                    {/* System Role */}
                    <td className="p-4">
                      {getRoleBadge(user.role)}
                    </td>

                    {/* Department */}
                    <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">
                      {user.user_department || user.user_designation || 'General Operations'}
                    </td>

                    {/* Contact Phone */}
                    <td className="p-4 text-slate-500 font-mono">
                      {user.user_phone || '—'}
                    </td>

                    {/* Account Status */}
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        user.user_status === 'ACTIVE'
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : user.user_status === 'PENDING'
                          ? 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400'
                          : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.user_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {user.user_status}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="p-4 text-slate-500 text-[11px]">
                      {formatDate(user.user_created_at)}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedUser(user); }}
                        className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        title="View User Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(user); }}
                        className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
                        title="Edit User"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setUserToDelete(user); }}
                        className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>


                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE INTERNAL STAFF USER MODAL */}
      <Modal
        isOpen={isCreateStaffOpen}
        onClose={() => setIsCreateStaffOpen(false)}
        title="Create Internal Staff User"
        subtitle="Assign role permissions and employee identification"
        icon={<UserPlus className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="3xl"
      >
        <form onSubmit={handleCreateStaffSubmit} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* 2-Column Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Test Port Operations Officer"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. portops.test@example.com"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Employee ID *
                </label>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Auto-Generated & Unique
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. CUS-2026-0001"
                  className="w-full pl-3 pr-10 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 font-mono font-bold text-[#D49A24] text-xs focus:outline-none focus:border-[#D49A24]"
                />
                <button
                  type="button"
                  onClick={() => fetchNextEmployeeId(role)}
                  title="Refresh / Generate Next Unique ID"
                  disabled={fetchingNextId}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#D49A24] transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchingNextId ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                Guaranteed non-repeating identifier automatically allocated from the port registry.
              </p>
            </div>

            <div>
              <InternationalPhoneInput
                label="Phone Number"
                value={phone}
                defaultCountry="IN"
                onChange={(e164, isValid) => {
                  setPhone(e164);
                  setCreatePhoneValid(isValid);
                }}
              />
            </div>


            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Internal Staff Role *
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#D49A24] cursor-pointer"
              >
                <option value="port_operations_officer">Port Operations Officer</option>
                <option value="customs_officer">Customs Officer</option>
                <option value="terminal_logistics_operator">Terminal & Logistics Operator</option>
                <option value="gate_truck_officer">Gate & Truck Operations Officer</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Department
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={department}
                placeholder="Auto-populated department"
                className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed select-none"
              />
            </div>

            {/* Automatic Temporary Password Generation Informational Note */}
            <div className="col-span-1 md:col-span-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <Shield className="w-4 h-4 shrink-0 text-[#D49A24] mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-slate-800 dark:text-white">
                  Automatic Temporary Password Generation
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  PORTIDE will automatically generate a secure temporary password.
                  The temporary password will be sent to the user's registered email.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreateStaffOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createLoading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D49A24] hover:bg-[#b8831b] transition-all shadow-md cursor-pointer disabled:opacity-50 border border-[#D49A24]"
            >
              {createLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT USER MODAL */}
      <Modal
        isOpen={!!userToEdit}
        onClose={() => setUserToEdit(null)}
        title="Edit User"
        subtitle={`Modify contact details for ${userToEdit?.user_full_name || 'staff user'}`}
        icon={<Edit className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="2xl"
      >
        {userToEdit && (
          <form onSubmit={handleEditUserSubmit} className="space-y-4">
            {editFormError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{editFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
              {/* EDITABLE FIELD 1: FULL NAME */}
              <div>
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:border-[#D49A24]"
                />
              </div>

              {/* EDITABLE FIELD 2: PHONE NUMBER */}
              <div>
                <InternationalPhoneInput
                  label="Phone Number"
                  value={editPhone}
                  defaultCountry="IN"
                  onChange={(e164, isValid) => {
                    setEditPhone(e164);
                    setEditPhoneValid(isValid);
                  }}
                />
              </div>


              {/* READ-ONLY FIELD: EMPLOYEE ID */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Employee ID
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Read Only</span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={userToEdit.user_employee_id || 'N/A'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-mono font-bold text-[#D49A24] text-xs cursor-not-allowed select-none opacity-80"
                />
              </div>

              {/* READ-ONLY FIELD: EMAIL */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Email Address
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Read Only</span>
                </div>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={userToEdit.email}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed select-none opacity-80"
                />
              </div>

              {/* READ-ONLY FIELD: ROLE */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Role
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Read Only</span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={getRoleDisplayName(userToEdit.role)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-not-allowed select-none opacity-80"
                />
              </div>

              {/* READ-ONLY FIELD: DEPARTMENT */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Department
                  </label>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Read Only</span>
                </div>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={userToEdit.user_department || userToEdit.user_designation || 'N/A'}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 cursor-not-allowed select-none opacity-80"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setUserToEdit(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#D49A24] hover:bg-[#b8831b] transition-all shadow-md cursor-pointer disabled:opacity-50 border border-[#D49A24]"
              >
                {editLoading ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* VIEW USER DETAILS MODAL */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="User Account Details"
        subtitle={selectedUser?.email}
        icon={<Users className="w-4 h-4 text-[#D49A24]" />}
        maxWidth="2xl"
      >
        {selectedUser && (
          <div className="space-y-4">
            {/* Top User Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#D49A24]/10 border border-[#D49A24]/30 text-[#D49A24] font-black flex items-center justify-center text-lg shrink-0">
                  {selectedUser.user_full_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedUser.user_full_name}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                    <Mail className="w-3 h-3 text-slate-400" />
                    <span>{selectedUser.email}</span>
                  </div>
                </div>
              </div>
              <div className="self-start sm:self-center">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  selectedUser.user_status === 'ACTIVE'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : selectedUser.user_status === 'PENDING'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedUser.user_status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {selectedUser.user_status}
                </span>
              </div>
            </div>

            {/* Profile Information */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-[#D49A24] dark:text-[#D49A24] border-b border-slate-200 dark:border-slate-800 pb-1">
                1. System Identity & Access
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Employee ID:</div>
                  <div className="font-mono font-bold text-[#D49A24] text-xs mt-0.5">
                    {selectedUser.user_employee_id || 'N/A'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">System Role:</div>
                  <div className="mt-1">
                    {getRoleBadge(selectedUser.role)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Internal ID:</div>
                  <div className="font-mono font-bold text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                    USR-00{selectedUser.user_id}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & Organizational Details */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                2. Organization & Contact Information
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Department:</div>
                  <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedUser.user_department || 'General Operations'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Designation / Title:</div>
                  <div className="font-semibold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedUser.user_designation || 'Staff Member'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Phone Contact:</div>
                  <div className="font-mono font-semibold text-slate-900 dark:text-white text-xs mt-0.5">
                    {selectedUser.user_phone || '—'}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Email Address:</div>
                  <div className="font-medium text-slate-900 dark:text-white text-xs mt-0.5 truncate">
                    {selectedUser.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Audit & Timeline */}
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                3. Timeline & Auditing
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Account Registered:</div>
                  <div className="font-medium text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                    {formatDate(selectedUser.user_created_at)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800">
                  <div className="text-slate-400 text-[10px] font-medium">Last Profile Update:</div>
                  <div className="font-medium text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                    {formatDate(selectedUser.user_updated_at)}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const u = selectedUser;
                  setSelectedUser(null);
                  handleOpenEditModal(u);
                }}
                className="px-4 py-2 rounded-xl bg-[#D49A24] hover:bg-[#b88218] text-white font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit User</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DELETE USER CONFIRMATION MODAL */}
      <Modal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        title="Delete User?"
        subtitle="Permanent Account Removal"
        icon={<AlertTriangle className="w-4 h-4 text-rose-600" />}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            Are you sure you want to permanently delete this user? This action cannot be undone.
          </p>

          {userToDelete && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white text-xs">{userToDelete.user_full_name}</div>
              <div className="text-[11px] text-slate-500">{userToDelete.email}</div>
              <div className="text-[11px] font-mono text-[#D49A24]">Employee ID: {userToDelete.user_employee_id || 'N/A'}</div>
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setUserToDelete(null)}
              disabled={deleteLoading}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteUserConfirm}
              disabled={deleteLoading}
              className="px-4 py-2 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 text-xs shadow-md disabled:opacity-50 cursor-pointer"
            >
              {deleteLoading ? 'Deleting User...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
