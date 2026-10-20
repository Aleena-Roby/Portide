import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../common/Modal';
import { apiFetch } from '../../../services/api';
import { useApp } from '../../../context/AppContext';
import { 
  BackendContainer, 
  CustomsDocumentItem, 
  CustomsDocumentType 
} from '../../../types';
import { 
  FileText, 
  UploadCloud, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Download, 
  Eye, 
  FileCheck, 
  Trash2, 
  ShieldCheck, 
  CheckCircle,
  XCircle,
  Plus,
  Edit3,
  History,
  FileQuestion,
  HelpCircle,
  AlertCircle
} from 'lucide-react';

interface SubmitCustomsDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  container: BackendContainer | null;
  onDocumentUploaded?: () => void;
}

export const DOCUMENT_TYPES: { value: CustomsDocumentType; label: string; description: string }[] = [
  { value: 'BILL_OF_LADING', label: 'Bill of Lading (B/L)', description: 'Master or House Bill of Lading contract of carriage' },
  { value: 'COMMERCIAL_INVOICE', label: 'Commercial Invoice', description: 'Commercial value, seller, and buyer transaction invoice' },
  { value: 'PACKING_LIST', label: 'Packing List', description: 'Itemized consignment packaging breakdown, weight and volume' },
  { value: 'CERTIFICATE_OF_ORIGIN', label: 'Certificate of Origin', description: 'Chamber of commerce proof of origin certification' },
  { value: 'CUSTOMS_IMPORT_DECLARATION', label: 'Customs Import Declaration / Bill of Entry', description: 'Formal single administrative customs import filing document' },
  { value: 'DELIVERY_ORDER', label: 'Delivery Order (DO)', description: 'Carrier release authorization for cargo dispatch' },
  { value: 'PHYTOSANITARY_CERTIFICATE', label: 'Phytosanitary Certificate', description: 'Agricultural or plant health inspection certificate' },
  { value: 'HAZMAT_DECLARATION', label: 'Dangerous Goods / Hazmat Declaration', description: 'IMO dangerous goods class and emergency response documentation' },
  { value: 'OTHER', label: 'Other Supporting Document', description: 'Technical specifications, inspection certificates, or receipts' },
];

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'doc', 'docx'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export interface SelectedUploadItem {
  id: string;
  file: File;
  documentType: CustomsDocumentType | '';
  error?: string | null;
}

export const SubmitCustomsDocumentModal: React.FC<SubmitCustomsDocumentModalProps> = ({
  isOpen,
  onClose,
  container,
  onDocumentUploaded
}) => {
  const { addToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const rowReplaceInputRef = useRef<HTMLInputElement | null>(null);

  const [notes, setNotes] = useState<string>('');
  const [uploadQueue, setUploadQueue] = useState<SelectedUploadItem[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<CustomsDocumentItem[]>([]);
  const [rowReplacingId, setRowReplacingId] = useState<string | null>(null);
  
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Document Deletion Confirmation State
  const [documentToDelete, setDocumentToDelete] = useState<CustomsDocumentItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Document Replacement / Amendment State
  const [documentToReplace, setDocumentToReplace] = useState<CustomsDocumentItem | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementDocType, setReplacementDocType] = useState<CustomsDocumentType>('BILL_OF_LADING');
  const [replacementReason, setReplacementReason] = useState<string>('');
  const [replacementNotes, setReplacementNotes] = useState<string>('');
  const [replacementError, setReplacementError] = useState<string>('');
  const [replacing, setReplacing] = useState<boolean>(false);

  // Infer best-guess category from filename, returning empty string if unmatched
  const inferDocumentType = (fileName: string): CustomsDocumentType | '' => {
    const lower = fileName.toLowerCase();
    if (lower.includes('invoice') || lower.includes('inv')) return 'COMMERCIAL_INVOICE';
    if (lower.includes('packing') || lower.includes('pkg') || lower.includes('pack')) return 'PACKING_LIST';
    if (lower.includes('origin') || lower.includes('coo')) return 'CERTIFICATE_OF_ORIGIN';
    if (lower.includes('bill_of_entry') || lower.includes('boe') || lower.includes('entry') || lower.includes('import_dec')) return 'CUSTOMS_IMPORT_DECLARATION';
    if (lower.includes('delivery_order') || lower.includes('do_') || lower.includes('do.')) return 'DELIVERY_ORDER';
    if (lower.includes('phyto') || lower.includes('plant') || lower.includes('fumigation')) return 'PHYTOSANITARY_CERTIFICATE';
    if (lower.includes('hazmat') || lower.includes('dangerous') || lower.includes('dg') || lower.includes('msds')) return 'HAZMAT_DECLARATION';
    if (lower.includes('lading') || lower.includes('bl_') || lower.includes('bl.')) return 'BILL_OF_LADING';
    return '';
  };

  // Fetch existing documents whenever modal opens for a container
  const fetchExistingDocuments = async () => {
    if (!container) return;
    setLoadingExisting(true);
    try {
      const res = await apiFetch(`/api/customs/containers/${container.container_id}/documents/`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        setExistingDocuments(json.data || []);
      }
    } catch {
      if (container.customs_documents) {
        setExistingDocuments(container.customs_documents);
      }
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (isOpen && container) {
      setUploadQueue([]);
      setNotes('');
      setErrorMessage('');
      setDocumentToDelete(null);
      setDocumentToReplace(null);
      fetchExistingDocuments();
    }
  }, [isOpen, container?.container_id]);

  const validateFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported extension (.${ext || 'unknown'}). Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `File exceeds 15MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`;
    }
    return null;
  };

  const handleFilesAdded = (files: FileList | File[]) => {
    setErrorMessage('');
    const newItems: SelectedUploadItem[] = [];

    Array.from(files).forEach((file) => {
      // Check if file already in queue with identical name and size
      if (!uploadQueue.some(item => item.file.name === file.name && item.file.size === file.size)) {
        const error = validateFile(file);
        newItems.push({
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          file,
          documentType: inferDocumentType(file.name),
          error
        });
      }
    });

    if (newItems.length > 0) {
      setUploadQueue(prev => [...prev, ...newItems]);
    }
  };

  const handleRemoveQueueItem = (id: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== id));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpdateItemDocType = (id: string, newType: CustomsDocumentType | '') => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, documentType: newType } : item));
  };

  // Replace a specific file in the queue before submitting
  const handleInitiateRowReplace = (id: string) => {
    setRowReplacingId(id);
    rowReplaceInputRef.current?.click();
  };

  const handleRowFileReplaced = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && rowReplacingId) {
      const newFile = e.target.files[0];
      const error = validateFile(newFile);
      const inferred = inferDocumentType(newFile.name);
      setUploadQueue(prev => prev.map(item => {
        if (item.id === rowReplacingId) {
          return {
            ...item,
            file: newFile,
            documentType: inferred || item.documentType || '',
            error
          };
        }
        return item;
      }));
    }
    setRowReplacingId(null);
    if (rowReplaceInputRef.current) {
      rowReplaceInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  // Submit all files in the upload queue
  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!container) return;

    if (uploadQueue.length === 0) {
      setErrorMessage('Please select at least one supporting document file to upload.');
      return;
    }

    const missingTypeItem = uploadQueue.find(item => !item.documentType);
    if (missingTypeItem) {
      setErrorMessage(`Please select a required Document Type for "${missingTypeItem.file.name}". All attachments must have a document category.`);
      return;
    }

    const hasInvalidFiles = uploadQueue.some(item => item.error);
    if (hasInvalidFiles) {
      const invalidItem = uploadQueue.find(item => item.error);
      setErrorMessage(`File "${invalidItem?.file.name}" is invalid: ${invalidItem?.error}. Please remove or replace it before submitting.`);
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('container_id', String(container.container_id));
      formData.append('container_number', container.container_number);
      if (notes.trim()) {
        formData.append('notes', notes.trim());
      }

      // Build manifest linking each file to its document type
      const manifest = uploadQueue.map(item => ({
        filename: item.file.name,
        document_type: item.documentType,
        notes: notes.trim()
      }));
      formData.append('document_manifest', JSON.stringify(manifest));

      // Append files and parallel document types
      uploadQueue.forEach((item) => {
        formData.append('files', item.file);
        formData.append('document_types', item.documentType);
      });

      const res = await apiFetch(`/api/customs/containers/${container.container_id}/documents/upload/`, {
        method: 'POST',
        body: formData,
      });

      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (res.ok && json && json.status === 'success') {
        const count = json.documents?.length || uploadQueue.length;
        addToast(`Successfully submitted ${count} customs supporting document(s) for ${container.container_number}.`, 'success');
        setUploadQueue([]);
        setNotes('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        await fetchExistingDocuments();
        if (onDocumentUploaded) {
          onDocumentUploaded();
        }
      } else {
        const errorDetail = json?.errors 
          ? Object.entries(json.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
          : json?.message || (res.status === 404 ? 'Customs upload endpoint not found.' : `Server error (${res.status}). Failed to upload documents.`);
        setErrorMessage(errorDetail);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network communication failed during document upload. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Document Deletion
  const confirmDeleteDocument = async () => {
    if (!documentToDelete) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/customs/documents/${documentToDelete.document_id}/delete/`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Failed to delete document.');
      }
      addToast(`Document "${documentToDelete.original_filename || documentToDelete.document_name}" deleted successfully.`, 'success');
      setDocumentToDelete(null);
      await fetchExistingDocuments();
      if (onDocumentUploaded) {
        onDocumentUploaded();
      }
    } catch (err: any) {
      addToast(err?.message || 'Error deleting document.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Open Document Replacement Modal
  const openReplaceModal = (doc: CustomsDocumentItem) => {
    setDocumentToReplace(doc);
    setReplacementFile(null);
    setReplacementDocType(doc.document_type || 'BILL_OF_LADING');
    setReplacementReason('');
    setReplacementNotes(doc.notes || '');
    setReplacementError('');
  };

  // Execute Document Replacement / Amendment
  const handleExecuteReplace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentToReplace) return;

    if (!replacementFile) {
      setReplacementError('Please select a replacement file.');
      return;
    }

    const isVerifiedOrCleared = documentToReplace.review_status === 'VERIFIED' || container?.is_customs_cleared;
    if (isVerifiedOrCleared && !replacementReason.trim()) {
      setReplacementError('An official amendment reason is mandatory for verified or cleared shipments.');
      return;
    }

    setReplacing(true);
    setReplacementError('');

    try {
      const formData = new FormData();
      formData.append('file', replacementFile);
      formData.append('document_type', replacementDocType);
      formData.append('amendment_reason', replacementReason.trim());
      if (replacementNotes.trim()) {
        formData.append('notes', replacementNotes.trim());
      }

      const res = await apiFetch(`/api/customs/documents/${documentToReplace.document_id}/replace/`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || data?.status === 'error') {
        throw new Error(data?.message || 'Failed to replace document.');
      }

      addToast(data?.message || 'Document replaced and new version submitted successfully!', 'success');
      setDocumentToReplace(null);
      setReplacementFile(null);
      await fetchExistingDocuments();
      if (onDocumentUploaded) {
        onDocumentUploaded();
      }
    } catch (err: any) {
      setReplacementError(err?.message || 'Replacement failed. Previous file remains intact.');
    } finally {
      setReplacing(false);
    }
  };

  const handleDownloadDoc = async (doc: CustomsDocumentItem, preview: boolean = false) => {
    setDownloadingDocId(doc.document_id);
    try {
      const res = await apiFetch(`/api/customs/documents/${doc.document_id}/download/?preview=${preview ? 'true' : 'false'}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addToast(err.message || 'Failed to download document.', 'error');
        return;
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      if (preview) {
        window.open(blobUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = doc.original_filename || doc.document_name || 'customs_document.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
    } catch {
      addToast('Network error while retrieving document file.', 'error');
    } finally {
      setDownloadingDocId(null);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTimestamp = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  if (!container) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Submit Customs Supporting Documents"
        subtitle={`Container #${container.container_number} • Post-Arrival Customs Procedure`}
        icon={<UploadCloud className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
        maxWidth="4xl"
      >
        <div className="space-y-6">
          {/* Hidden file input for row replacement */}
          <input
            ref={rowReplaceInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.tif,.doc,.docx"
            onChange={handleRowFileReplaced}
            className="hidden"
          />

          {/* Context Summary Banner */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Container</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {container.container_number}
              </span>
              <span className="text-[10px] text-slate-500 block">
                {container.container_type_display || container.container_type}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Gross Weight</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {container.container_gross_weight} MT
              </span>
              <span className="text-[10px] text-slate-500 block">
                {container.teu_equivalent} TEU
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Physical Status</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {container.container_status_display || container.container_status}
              </span>
              <span className="text-[10px] text-slate-500 block">
                Discharged / At Port
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Customs Status</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block mt-0.5 ${
                container.is_customs_cleared
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                  : container.container_customs_status === 'CUSTOMS_HOLD'
                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
              }`}>
                {container.container_customs_status_display || container.container_customs_status || 'Awaiting Docs'}
              </span>
            </div>
          </div>

          {/* Existing Uploaded Documents Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />
                <span>Persisted Customs Attachments ({existingDocuments.length})</span>
              </h4>
              <button
                type="button"
                onClick={fetchExistingDocuments}
                disabled={loadingExisting}
                className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingExisting ? 'animate-spin' : ''}`} />
                <span>Refresh List</span>
              </button>
            </div>

            {loadingExisting ? (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Loading uploaded documents...</span>
              </div>
            ) : existingDocuments.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
                No customs supporting documents have been submitted for this container yet. Upload multiple supporting files below.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {existingDocuments.map((doc) => {
                  const isPending = doc.review_status === 'PENDING' || doc.document_review_status === 'PENDING';
                  const isVerified = doc.review_status === 'VERIFIED' || doc.document_review_status === 'VERIFIED';
                  const isSuperseded = doc.review_status === 'SUPERSEDED' || doc.document_review_status === 'SUPERSEDED';
                  const isRejected = doc.review_status === 'REJECTED' || doc.document_review_status === 'REJECTED';
                  const canDelete = isPending && !container.is_customs_cleared && !isSuperseded;

                  return (
                    <div
                      key={doc.document_id}
                      className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
                        isSuperseded 
                          ? 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800 opacity-60' 
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isSuperseded 
                            ? 'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400' 
                            : 'bg-teal-500/10 text-teal-600 dark:text-teal-400'
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {doc.original_filename || doc.document_name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({doc.file_size_formatted || doc.formatted_file_size || formatFileSize(doc.file_size_bytes || doc.file_size)})
                            </span>
                            
                            {/* Version Badge */}
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              v{doc.version || doc.document_version || 1}
                            </span>

                            {/* Workflow badge */}
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              doc.workflow_type === 'PRE_ARRIVAL'
                                ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                : 'bg-teal-500/10 text-teal-600 border border-teal-500/20'
                            }`}>
                              {doc.workflow_type_display || doc.workflow_type}
                            </span>
                          </div>
                          
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {doc.document_type_display || doc.document_type}
                            </span>
                            <span>•</span>
                            <span>Uploaded by {doc.uploaded_by_name || doc.uploader_name || 'Shipping Line'}</span>
                            <span>•</span>
                            <span className="font-mono">{formatTimestamp(doc.submitted_at || doc.document_uploaded_at)}</span>
                          </div>

                          {doc.amendment_reason && (
                            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                              <History className="w-3 h-3 shrink-0" />
                              <span>Amendment Note: {doc.amendment_reason}</span>
                            </div>
                          )}

                          {doc.review_remarks && (
                            <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              Review Remarks: {doc.review_remarks}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1 ${
                          isVerified
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                            : isRejected
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                            : isSuperseded
                            ? 'bg-slate-400/10 text-slate-500 border border-slate-400/30'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                        }`}>
                          {isVerified && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                          {isRejected && <XCircle className="w-3 h-3 text-rose-500" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-500" />}
                          {isSuperseded && <History className="w-3 h-3 text-slate-400" />}
                          <span>{doc.review_status_display || doc.review_status}</span>
                        </span>

                        {/* Preview */}
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc, true)}
                          disabled={downloadingDocId === doc.document_id}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                          title="Preview Document in New Tab"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Download */}
                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc, false)}
                          disabled={downloadingDocId === doc.document_id}
                          className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors cursor-pointer"
                          title="Download Secure Document File"
                        >
                          {downloadingDocId === doc.document_id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Replace / Amend */}
                        {!isSuperseded && (
                          <button
                            type="button"
                            onClick={() => openReplaceModal(doc)}
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                            title={isVerified ? "Submit Official Amendment / Correction" : "Replace with Corrected File"}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete */}
                        {!isSuperseded && (
                          <button
                            type="button"
                            onClick={() => setDocumentToDelete(doc)}
                            disabled={!canDelete}
                            className={`p-1.5 rounded-lg transition-colors ${
                              canDelete
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 cursor-pointer'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                            }`}
                            title={canDelete ? "Delete this unreviewed document" : "Verified or cleared documents cannot be deleted"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload New Documents Form */}
          <form onSubmit={handleSubmitAll} className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
                <span>Upload Multiple Supporting Documents</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Assign an individual document type to each attachment
              </span>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Drag & Drop File Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-teal-500 bg-teal-500/10'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 hover:border-teal-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.tif,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFilesAdded(e.target.files);
                  }
                }}
                className="hidden"
              />
              <UploadCloud className="w-8 h-8 text-teal-600 dark:text-teal-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Click to browse multiple files or drag & drop them here
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Supported formats: PDF, PNG, JPG, JPEG, WEBP, TIFF, DOC, DOCX • Max 15MB per file
              </div>
            </div>

            {/* Multiple Files Attachment Table */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Attachment List ({uploadQueue.length} file{uploadQueue.length > 1 ? 's' : ''} staged)
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add More Files</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">File Name</th>
                        <th className="py-2.5 px-3">Document Category / Type *</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {uploadQueue.map((item) => (
                        <tr 
                          key={item.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${
                            item.error ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-sm">
                                  {item.file.name}
                                </div>
                                {item.error && (
                                  <div className="text-[10px] text-rose-600 font-semibold mt-0.5 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span>{item.error}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="space-y-1">
                              <select
                                id={`doc-type-select-${item.id}`}
                                value={item.documentType}
                                onChange={(e) => handleUpdateItemDocType(item.id, e.target.value as (CustomsDocumentType | ''))}
                                className={`w-full sm:w-64 px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-colors focus:outline-none ${
                                  !item.documentType
                                    ? 'bg-rose-50 border-2 border-rose-400 text-rose-800 dark:bg-rose-950/30 dark:border-rose-500 dark:text-rose-200 focus:border-rose-500'
                                    : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-teal-500'
                                }`}
                              >
                                <option value="">-- Select Document Type (Required) * --</option>
                                {DOCUMENT_TYPES.map((dt) => (
                                  <option key={dt.value} value={dt.value}>
                                    {dt.label}
                                  </option>
                                ))}
                              </select>
                              {!item.documentType && (
                                <div className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span>Document category required *</span>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatFileSize(item.file.size)}
                          </td>

                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleInitiateRowReplace(item.id)}
                                className="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                                title="Replace this file with another"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveQueueItem(item.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                                title="Remove file from upload list"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Optional Common Notes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Submission Notes / Remarks (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Complete commercial dossier certified for customs examination"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Regulatory Notice */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Customs Officer Verification:</strong> Submitting documents associates them with container <strong>#{container.container_number}</strong> and alerts Customs Control. Document submission alone <em>does not</em> grant automatic clearance; official clearance requires inspection decision.
              </span>
            </div>

            {/* Submit Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={submitting || uploadQueue.length === 0 || uploadQueue.some(item => !item.documentType || !!item.error)}
                className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-[#064e43] hover:bg-[#053d34] disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting {uploadQueue.length} Document{uploadQueue.length === 1 ? '' : 's'}...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>Submit {uploadQueue.length} Document{uploadQueue.length === 1 ? '' : 's'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* DOCUMENT DELETION CONFIRMATION MODAL */}
      <Modal
        isOpen={!!documentToDelete}
        onClose={() => setDocumentToDelete(null)}
        title="Confirm Document Deletion"
        icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
        maxWidth="md"
      >
        {documentToDelete && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete the following customs supporting document?
            </p>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {documentToDelete.original_filename || documentToDelete.document_name}
              </div>
              <div className="text-slate-500 flex items-center gap-2 text-[11px]">
                <span>Type: <strong>{documentToDelete.document_type_display || documentToDelete.document_type}</strong></span>
                <span>•</span>
                <span>Size: {documentToDelete.file_size_formatted || formatFileSize(documentToDelete.file_size_bytes)}</span>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300">
              Only unreviewed (pending) documents can be deleted. Deleting this attachment will not affect other documents uploaded for this container.
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDocumentToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteDocument}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* DOCUMENT REPLACEMENT / AMENDMENT MODAL */}
      <Modal
        isOpen={!!documentToReplace}
        onClose={() => setDocumentToReplace(null)}
        title={documentToReplace?.review_status === 'VERIFIED' ? "Official Document Amendment" : "Replace Customs Document"}
        subtitle={`Container #${container.container_number} • Target: ${documentToReplace?.original_filename || documentToReplace?.document_name}`}
        icon={<Edit3 className="w-5 h-5 text-indigo-600" />}
        maxWidth="lg"
      >
        {documentToReplace && (
          <form onSubmit={handleExecuteReplace} className="space-y-4">
            {replacementError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{replacementError}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="font-semibold text-slate-500">Current Active Document:</div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{documentToReplace.original_filename || documentToReplace.document_name}</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 dark:bg-slate-700">v{documentToReplace.version || 1}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Status: {documentToReplace.review_status_display || documentToReplace.review_status} • {documentToReplace.document_type_display}
              </div>
            </div>

            {/* Document Type Selector */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Document Category / Type
              </label>
              <select
                value={replacementDocType}
                onChange={(e) => setReplacementDocType(e.target.value as CustomsDocumentType)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-bold text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              >
                {DOCUMENT_TYPES.map((dt) => (
                  <option key={dt.value} value={dt.value}>
                    {dt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Replacement File Picker */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Choose Replacement File *
              </label>
              <input
                ref={replaceFileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.tif,.doc,.docx"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setReplacementFile(e.target.files[0]);
                  }
                }}
                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              />
              {replacementFile && (
                <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selected: {replacementFile.name} ({formatFileSize(replacementFile.size)})</span>
                </div>
              )}
            </div>

            {/* Amendment Reason */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Reason for Replacement / Correction {documentToReplace.review_status === 'VERIFIED' ? '*' : '(Recommended)'}
              </label>
              <textarea
                rows={2}
                value={replacementReason}
                onChange={(e) => setReplacementReason(e.target.value)}
                placeholder="e.g. Corrected invoice valuation and updated carrier manifest per customs request"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                The original document will be retained in history as superseded (v{(documentToReplace.version || 1)}), and the new version (v{(documentToReplace.version || 1) + 1}) will be marked pending review.
              </span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setDocumentToReplace(null)}
                disabled={replacing}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={replacing || !replacementFile}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {replacing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading Replacement...</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Submit Replacement (v{(documentToReplace.version || 1) + 1})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
};
