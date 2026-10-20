import React, { useState } from 'react';
import { BackendGatePass } from '../../types';
import { Modal } from './Modal';
import { apiFetch } from '../../services/api';
import {
  Truck,
  UserCheck,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  Download,
  Mail,
  AlertTriangle,
  RotateCw,
  Boxes,
  ShieldCheck,
  XCircle
} from 'lucide-react';

interface DigitalGatePassModalProps {
  gatePass: BackendGatePass | null;
  isOpen: boolean;
  onClose: () => void;
  onPassUpdated?: (updatedPass: BackendGatePass) => void;
  onResendSuccess?: (updatedPass: BackendGatePass) => void;
  allowResendEmail?: boolean;
}

export const DigitalGatePassModal: React.FC<DigitalGatePassModalProps> = ({
  gatePass,
  isOpen,
  onClose,
  onPassUpdated,
  onResendSuccess,
  allowResendEmail = true
}) => {
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendMessage, setResendMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  if (!gatePass) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PORTIDE Digital Gate Pass - ${gatePass.gate_pass_pass_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 32px; background: #fff; color: #0f172a; max-width: 750px; margin: 0 auto; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .title { font-size: 24px; font-weight: 800; letter-spacing: 1px; margin: 0; color: #0f172a; }
    .sub { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
    .pass-num { font-size: 20px; font-family: monospace; font-weight: 700; color: #0284c7; margin-top: 6px; }
    .qr-container { text-align: center; margin: 20px 0; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; }
    .label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748b; margin-bottom: 4px; }
    .val { font-size: 14px; font-weight: 700; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; color: #475569; }
    .notice { margin-top: 24px; padding: 12px 16px; background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px; font-size: 12px; text-align: center; color: #1e40af; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="sub">Maritime Port Operations Intelligence Platform</div>
    <h1 class="title">DIGITAL GATE PASS</h1>
    <div class="pass-num">${gatePass.gate_pass_pass_number}</div>
    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Movement Ref: ${gatePass.gate_pass_movement_number} &bull; Status: <strong>${gatePass.gate_pass_status_display}</strong></div>
  </div>

  <div class="qr-container">
    ${gatePass.qr_svg || ''}
    <div style="font-size: 12px; font-weight: 700; color: #334155; margin-top: 8px;">Present this QR code at the designated port gate</div>
    <div style="font-family: monospace; font-size: 11px; color: #64748b;">Ref: ${gatePass.gate_pass_verification_code}</div>
  </div>

  <div class="grid">
    <div class="card">
      <div class="label">Truck Number</div>
      <div class="val" style="font-family: monospace;">${gatePass.truck.truck_number}</div>
      <div style="font-size: 11px; color: #64748b;">${gatePass.truck.truck_company_name || 'Independent Carrier'}</div>
    </div>
    <div class="card">
      <div class="label">Assigned Driver</div>
      <div class="val">${gatePass.driver.driver_name}</div>
      <div style="font-size: 11px; color: #64748b;">License: ${gatePass.driver.driver_license_number}</div>
      <div style="font-size: 11px; color: #64748b;">Email: ${gatePass.driver.driver_email}</div>
    </div>
    <div class="card">
      <div class="label">Authorized Gate / Exit Point</div>
      <div class="val">${gatePass.gate.gate_name}</div>
      <div style="font-size: 11px; color: #64748b;">Code: ${gatePass.gate.gate_code}</div>
    </div>
    <div class="card">
      <div class="label">Validity Period</div>
      <div class="val" style="color: #b45309;">${formatDateTime(gatePass.gate_pass_valid_until)}</div>
      <div style="font-size: 11px; color: #64748b;">Issued: ${formatDateTime(gatePass.gate_pass_issued_at)}</div>
    </div>
  </div>

  <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #0f172a; margin-top: 16px;">
    Authorized Releasable Containers (${gatePass.containers.length})
  </div>
  <table>
    <thead>
      <tr>
        <th>Container #</th>
        <th>Type</th>
        <th>Gross Weight</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${gatePass.containers.map(c => `
        <tr>
          <td style="font-family: monospace; font-weight: bold;">${c.container_number}</td>
          <td>${c.container_type_display || c.container_type}</td>
          <td>${c.container_gross_weight} T</td>
          <td style="color: #059669; font-weight: 600;">${c.container_status_display || c.container_status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="notice">
    <strong>Instructions for Driver & Gate Control:</strong><br />
    1. Driver must present physical license (${gatePass.driver.driver_license_number}) and valid truck (${gatePass.truck.truck_number}).<br />
    2. Gate Officer must scan the QR code and authorize release on the terminal control platform.<br />
    3. Unauthorized or unlisted containers will be detained at the gate.
  </div>

  <div class="footer">
    PORTIDE Intelligence Platform &bull; Official Digital Gate Pass Document &bull; Document Verified
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PORTIDE_GATE_PASS_${gatePass.gate_pass_pass_number}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleResendEmail = async () => {
    setResendingEmail(true);
    setResendMessage(null);
    try {
      const res = await apiFetch(`/api/gate/passes/${gatePass.gate_pass_id}/resend-email/`, {
        method: 'POST'
      });
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setResendMessage({ text: `Email dispatched successfully to ${gatePass.driver.driver_email}`, type: 'success' });
        const updatedPass = {
          ...gatePass,
          gate_pass_email_status: 'SENT' as const,
          gate_pass_email_status_display: 'Sent'
        };
        if (onPassUpdated) {
          onPassUpdated(updatedPass);
        }
        if (onResendSuccess) {
          onResendSuccess(updatedPass);
        }
      } else {
        setResendMessage({ text: json.message || 'Failed to dispatch email.', type: 'error' });
      }
    } catch {
      setResendMessage({ text: 'Network communication error while requesting email resend.', type: 'error' });
    } finally {
      setResendingEmail(false);
    }
  };

  function formatDateTime(iso?: string | null) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return iso;
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>ACTIVE &bull; AUTHORIZED</span>
          </span>
        );
      case 'USED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/30 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
            <span>USED &bull; RELEASED</span>
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span>EXPIRED</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>CANCELLED</span>
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Digital Gate Pass Authorization" maxWidth="3xl">
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Pass Header Card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white border border-slate-800 relative overflow-hidden shadow-lg">
          <div className="absolute right-0 top-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#D49A24]">
                  PORTIDE INTELLIGENCE PLATFORM
                </span>
                <span className="text-slate-400 text-xs">&bull;</span>
                <span className="text-slate-300 text-xs font-mono">Exit Pass</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                <span>DIGITAL GATE PASS</span>
              </h2>
              <div className="mt-2 flex items-center gap-3 flex-wrap">
                <span className="px-3 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 font-mono font-bold text-sm">
                  {gatePass.gate_pass_pass_number}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Movement: {gatePass.gate_pass_movement_number}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              {getStatusBadge(gatePass.gate_pass_status)}
              <span className="text-[11px] text-slate-400 font-mono">
                Valid Until: {formatDateTime(gatePass.gate_pass_valid_until)}
              </span>
            </div>
          </div>
        </div>

        {/* Central Display: QR Code + Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* QR Code Section */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center shadow-sm">
            <div className="w-48 h-48 rounded-xl bg-slate-50 dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-inner">
              {gatePass.qr_svg ? (
                <div
                  className="w-full h-full flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: gatePass.qr_svg }}
                />
              ) : (
                <div className="text-xs text-slate-400">QR Code Rendering</div>
              )}
            </div>
            <div className="mt-3 text-xs font-bold text-slate-900 dark:text-white">
              Present QR Code at Port Gate
            </div>
            <div className="mt-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={gatePass.gate_pass_verification_code}>
              Ref: {gatePass.gate_pass_verification_code}
            </div>
          </div>

          {/* Core Dispatch Details */}
          <div className="md:col-span-2 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Truck Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Truck className="w-3.5 h-3.5 text-teal-500" />
                  <span>Assigned Truck</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono">
                  {gatePass.truck.truck_number}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {gatePass.truck.truck_company_name || 'Independent Freight Carrier'}
                </div>
              </div>

              {/* Driver Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Authorized Driver</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {gatePass.driver.driver_name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  License: {gatePass.driver.driver_license_number}
                </div>
              </div>

              {/* Gate Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  <span>Designated Exit Gate</span>
                </div>
                <div className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                  {gatePass.gate.gate_name}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Code: {gatePass.gate.gate_code}
                </div>
              </div>

              {/* Validity Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  <span>Validity & Schedule</span>
                </div>
                <div className="text-xs text-slate-900 dark:text-white font-medium">
                  Issued: <span className="font-mono">{formatDateTime(gatePass.gate_pass_issued_at)}</span>
                </div>
                <div className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                  Expires: <span className="font-mono">{formatDateTime(gatePass.gate_pass_valid_until)}</span>
                </div>
              </div>
            </div>

            {/* Email Dispatch Status Banner */}
            <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
              gatePass.gate_pass_email_status === 'SENT'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : gatePass.gate_pass_email_status === 'FAILED'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0 text-slate-500" />
                <div>
                  <span className="font-bold">Driver Email Notification:</span>{' '}
                  <span className="font-mono">{gatePass.driver.driver_email}</span>{' '}
                  <span className="font-bold uppercase tracking-wider ml-1">
                    ({gatePass.gate_pass_email_status_display})
                  </span>
                  {gatePass.gate_pass_email_error && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                      Error: {gatePass.gate_pass_email_error}
                    </div>
                  )}
                </div>
              </div>

              {allowResendEmail && (
                <button
                  onClick={handleResendEmail}
                  disabled={resendingEmail}
                  className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer text-slate-800 dark:text-slate-200"
                >
                  <RotateCw className={`w-3 h-3 ${resendingEmail ? 'animate-spin' : ''}`} />
                  <span>{resendingEmail ? 'Resending...' : 'Resend Email'}</span>
                </button>
              )}
            </div>

            {resendMessage && (
              <div className={`p-2.5 rounded-lg text-xs font-medium ${
                resendMessage.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}>
                {resendMessage.text}
              </div>
            )}
          </div>
        </div>

        {/* Authorized Containers List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-sky-500" />
              <span>Authorized Containers ({gatePass.containers.length})</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Only authorized containers may exit through this pass
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3.5">Container #</th>
                  <th className="py-2.5 px-3.5">Type</th>
                  <th className="py-2.5 px-3.5">Gross Weight</th>
                  <th className="py-2.5 px-3.5">Vessel / Cargo</th>
                  <th className="py-2.5 px-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {gatePass.containers.map(c => (
                  <tr key={c.container_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      {c.container_number}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-300">
                      {c.container_type_display || c.container_type}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-slate-600 dark:text-slate-300">
                      {c.container_gross_weight} T
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                      {c.vessel_name || c.cargo_description || '—'}
                    </td>
                    <td className="py-2.5 px-3.5">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{c.container_status_display || c.container_status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Remarks if any */}
        {gatePass.gate_pass_remarks && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
            <span className="font-bold text-slate-600 dark:text-slate-300">Remarks: </span>
            <span className="text-slate-500 dark:text-slate-400">{gatePass.gate_pass_remarks}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Pass</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download HTML</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};
