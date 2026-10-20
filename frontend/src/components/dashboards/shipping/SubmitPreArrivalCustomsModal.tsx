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
  AlertCircle,
  Ship,
  Info
} from 'lucide-react';
import { DOCUMENT_TYPES, SelectedUploadItem } from './SubmitCustomsDocumentModal';

interface SubmitPreArrivalCustomsModalProps {
  isOpen: boolean;
  onClose: () => void;
  container: BackendContainer | null;
  onDeclarationSubmitted?: () => void;
}

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'tiff', 'tif', 'doc', 'docx'];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export const SubmitPreArrivalCustomsModal: React.FC<SubmitPreArrivalCustomsModalProps> = ({
  isOpen,
  onClose,
  container,
  onDeclarationSubmitted
}) => {
  const { addToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const rowReplaceInputRef = useRef<HTMLInputElement | null>(null);

  const [declarationReference, setDeclarationReference] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [uploadQueue, setUploadQueue] = useState<SelectedUploadItem[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<CustomsDocumentItem[]>([]);
  const [existingDeclaration, setExistingDeclaration] = useState<any>(null);
  const [rowReplacingId, setRowReplacingId] = useState<string | null>(null);

  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [downloadingDocId, setDownloadingDocId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Document Deletion Confirmation State
  const [documentToDelete, setDocumentToDelete] = useState<CustomsDocumentItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Document Replacement State
  const [documentToReplace, setDocumentToReplace] = useState<CustomsDocumentItem | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementDocType, setReplacementDocType] = useState<CustomsDocumentType>('BILL_OF_LADING');
  const [replacementReason, setReplacementReason] = useState<string>('');
  const [replacementNotes, setReplacementNotes] = useState<string>('');
  const [replacementError, setReplacementError] = useState<string>('');
  const [replacing, setReplacing] = useState<boolean>(false);

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

  const fetchExistingDeclarationAndDocs = async () => {
    if (!container) return;
    setLoadingExisting(true);
    try {
      // 1. Fetch pre-arrival declaration details if available
      const declRes = await apiFetch(`/api/customs/pre-arrival/declarations/?container_id=${container.container_id}`);
      if (declRes.ok) {
        const declData = await declRes.json();
        const list = Array.isArray(declData?.data) ? declData.data : (Array.isArray(declData) ? declData : []);
        const found = list.find((d: any) => d.declaration_container_id === container.container_id || d.container_number === container.container_number);
        if (found) {
          setExistingDeclaration(found);
          if (found.declaration_reference && !declarationReference) {
            setDeclarationReference(found.declaration_reference);
          }
        }
      }

      // 2. Fetch container customs documents
      const res = await apiFetch(`/api/customs/containers/${container.container_id}/documents/`);
      const json = await res.json();
      if (res.ok && json.status === 'success') {
        const docs = json.data || [];
        // Prioritize pre-arrival documents or all container documents
        setExistingDocuments(docs);
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
      setRemarks('');
      setErrorMessage('');
      setDocumentToDelete(null);
      setDocumentToReplace(null);
      const currentYear = new Date().getFullYear();
      setDeclarationReference(`DEC-PRE-${currentYear}-${container.container_number.slice(-4)}`);
      fetchExistingDeclarationAndDocs();
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

  // Submit Pre-Arrival Declaration with all staged files
  const handleSubmitDeclaration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!container) return;

    if (!declarationReference.trim()) {
      setErrorMessage('Declaration Reference is mandatory.');
      return;
    }

    const missingTypeItem = uploadQueue.find(item => !item.documentType);
    if (missingTypeItem) {
      setErrorMessage(`Please select a required Document Type for "${missingTypeItem.file.name}". All advance attachments must have a document category.`);
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
      formData.append('declaration_reference', declarationReference.trim().toUpperCase());
      formData.append('declaration_type', 'IMPORT_PRE_ARRIVAL');
      if (remarks.trim()) {
        formData.append('notes', remarks.trim());
        formData.append('remarks', remarks.trim());
      }

      // Build manifest linking each file to its document type
      const manifest = uploadQueue.map(item => ({
        filename: item.file.name,
        document_type: item.documentType,
        notes: remarks.trim()
      }));
      formData.append('document_manifest', JSON.stringify(manifest));

      // Append files and parallel types
      uploadQueue.forEach((item) => {
        formData.append('files', item.file);
        formData.append('document_types', item.documentType);
      });

      const res = await apiFetch('/api/customs/pre-arrival/submit/', {
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
        const count = uploadQueue.length;
        addToast(`Pre-arrival customs declaration ${declarationReference} submitted successfully with ${count} supporting document(s)!`, 'success');
        setUploadQueue([]);
        setRemarks('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        await fetchExistingDeclarationAndDocs();
        if (onDeclarationSubmitted) {
          onDeclarationSubmitted();
        }
      } else {
        const errorDetail = json?.errors 
          ? Object.entries(json.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ')
          : json?.message || (res.status === 404 ? 'Customs pre-arrival submission endpoint not found.' : `Server error (${res.status}). Failed to submit declaration.`);
        setErrorMessage(errorDetail);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network communication failed during pre-arrival declaration submission.');
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
      await fetchExistingDeclarationAndDocs();
      if (onDeclarationSubmitted) {
        onDeclarationSubmitted();
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

  // Execute Document Replacement
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

      addToast(data?.message || 'Replacement document submitted successfully!', 'success');
      setDocumentToReplace(null);
      setReplacementFile(null);
      await fetchExistingDeclarationAndDocs();
      if (onDeclarationSubmitted) {
        onDeclarationSubmitted();
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
        title="Submit Pre-Arrival Customs Declaration"
        subtitle={`Container #${container.container_number} • Advance Manifest & Supporting Documents`}
        icon={<Ship className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
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
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Declaration Status</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block mt-0.5 ${
                existingDeclaration?.declaration_status === 'CLEARED'
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                  : existingDeclaration?.declaration_status === 'ADDITIONAL_INFORMATION_REQUIRED'
                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                  : existingDeclaration?.declaration_status === 'CUSTOMS_HOLD'
                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
              }`}>
                {existingDeclaration?.declaration_status_display || existingDeclaration?.declaration_status || 'New Pre-Arrival Filing'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 text-[10px] uppercase font-bold block">Direct Transfer Status</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 block mt-0.5">
                {existingDeclaration?.declaration_status === 'CLEARED' ? 'Pre-Cleared for Direct Release' : 'Pending Pre-Arrival Review'}
              </span>
            </div>
          </div>

          {/* Existing Pre-Arrival Documents Section */}
          {existingDocuments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Existing Declaration Attachments ({existingDocuments.length})</span>
                </h4>
                <button
                  type="button"
                  onClick={fetchExistingDeclarationAndDocs}
                  disabled={loadingExisting}
                  className="text-[11px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingExisting ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
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
                        <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5">
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
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              v{doc.version || doc.document_version || 1}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-purple-500/10 text-purple-600 border border-purple-500/20">
                              Pre-Arrival
                            </span>
                          </div>
                          
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              {doc.document_type_display || doc.document_type}
                            </span>
                            <span>•</span>
                            <span>Uploaded {formatTimestamp(doc.submitted_at || doc.document_uploaded_at)}</span>
                          </div>

                          {doc.amendment_reason && (
                            <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                              <History className="w-3 h-3 shrink-0" />
                              <span>Reason: {doc.amendment_reason}</span>
                            </div>
                          )}

                          {doc.review_remarks && (
                            <div className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              Officer Remarks: {doc.review_remarks}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
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

                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc, true)}
                          disabled={downloadingDocId === doc.document_id}
                          className="p-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 transition-colors cursor-pointer"
                          title="Preview Document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadDoc(doc, false)}
                          disabled={downloadingDocId === doc.document_id}
                          className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 transition-colors cursor-pointer"
                          title="Download Document"
                        >
                          {downloadingDocId === doc.document_id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {!isSuperseded && (
                          <button
                            type="button"
                            onClick={() => openReplaceModal(doc)}
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                            title="Replace / Correct Document"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

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
                            title={canDelete ? "Delete unreviewed document" : "Verified documents cannot be deleted"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Advance Filing Form */}
          <form onSubmit={handleSubmitDeclaration} className="space-y-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Declaration Reference *
                </label>
                <input
                  type="text"
                  required
                  value={declarationReference}
                  onChange={(e) => setDeclarationReference(e.target.value.toUpperCase())}
                  placeholder="e.g. DEC-PRE-2026-0001"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono font-bold text-xs uppercase text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Declaration Filing Type
                </label>
                <input
                  type="text"
                  readOnly
                  value="IMPORT_PRE_ARRIVAL (Advance Vessel Discharge Filing)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-xs text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            {/* Multiple File Upload Zone */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Supporting Document Attachments *
                </label>
                <span className="text-[11px] text-slate-400">
                  Select multiple files in one action
                </span>
              </div>

              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
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
                <UploadCloud className="w-7 h-7 text-teal-600 dark:text-teal-400 mx-auto mb-1.5" />
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click to select multiple supporting documents or drag them here
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Attach B/L, Commercial Invoice, Packing List, Phytosanitary, Hazmat, etc. (Max 15MB each)
                </div>
              </div>
            </div>

            {/* Attachment Table */}
            {uploadQueue.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Staged Attachments ({uploadQueue.length} file{uploadQueue.length > 1 ? 's' : ''})
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
                                id={`pre-arrival-doc-type-select-${item.id}`}
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
                                title="Replace this file"
                              >
                                Replace
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveQueueItem(item.id)}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                                title="Remove file"
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

            {/* Filing Remarks */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Advance Filing Remarks (Optional)
              </label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Advance manifest submitted with full commercial set for direct ship-to-truck discharge eligibility"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Direct Ship-to-Truck & Pre-Arrival Notice */}
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 text-[11px] flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <span>
                <strong>Pre-Arrival Clearance Notice:</strong> Advance submission initiates pre-clearance review before vessel berthing. Once reviewed and authorized as <strong>CLEARED</strong> by Customs, this container becomes eligible for immediate <em>Direct Ship-to-Truck transfer</em> upon vessel discharge.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !declarationReference.trim() || uploadQueue.some(item => !item.documentType || !!item.error)}
                className="px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Advance Declaration...</span>
                  </>
                ) : (
                  <>
                    <Ship className="w-3.5 h-3.5" />
                    <span>Submit Advance Declaration ({uploadQueue.length} File{uploadQueue.length === 1 ? '' : 's'})</span>
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
              Are you sure you want to delete this pre-arrival customs document?
            </p>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white">
                {documentToDelete.original_filename || documentToDelete.document_name}
              </div>
              <div className="text-slate-500 text-[11px]">
                Type: <strong>{documentToDelete.document_type_display || documentToDelete.document_type}</strong>
              </div>
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

      {/* DOCUMENT REPLACEMENT MODAL */}
      <Modal
        isOpen={!!documentToReplace}
        onClose={() => setDocumentToReplace(null)}
        title="Replace / Amend Pre-Arrival Document"
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

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Correction / Amendment Reason {documentToReplace.review_status === 'VERIFIED' ? '*' : '(Optional)'}
              </label>
              <textarea
                rows={2}
                value={replacementReason}
                onChange={(e) => setReplacementReason(e.target.value)}
                placeholder="e.g. Corrected invoice HS codes and attached revised freight receipt per customs request"
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

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
                    <span>Submit Replacement</span>
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
