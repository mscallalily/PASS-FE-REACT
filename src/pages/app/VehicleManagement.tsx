import { useTopicVersion } from '../../lib/liveSync';
import { formatCampusDate } from '../../lib/datetime';
import { jsonFetch, jsonRequest } from '../../lib/http';
import { PAGE_SECTIONS, selectedSection, sectionPath } from '../../lib/pageSections';
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { REGULAR_USER_ROLES, useAuth } from '../../context/AuthContext';
import { PageHeader, Card, Badge, statusBadge, Button, Table, SearchBar, Select, Modal, Input,  Toast, EmptyState } from '../../components/ui';
import { Car, Plus, AlertTriangle, RefreshCw } from 'lucide-react';
import DriverLicenseVerification from '../../components/DriverLicenseVerification';
import LicenseReviewQueue from '../../components/LicenseReviewQueue';
import { useLicense, licenseOnFile as isLicenseOnFile } from '../../context/LicenseContext';
import { ApiError, apiBlob } from '../../lib/apiClient';
import FileUpload, { IMAGE_ACCEPT } from '../../components/FileUpload';
import DocumentAutofill, { type DocumentStatus, type ExtractedFields, type FieldFlag } from '../../components/DocumentAutofill';
import { type VehicleDetails, EMPTY_DETAILS, DETAIL_LABEL, combineReadings, reviewStatus, sourceOf as detailSource } from '../../lib/orcrReview';

/** What was read from one OR/CR photo ("reading" until the server answers). */
type DocReading = { status: DocumentStatus | 'reading'; fields: ExtractedFields; flags: Record<string, FieldFlag>; notes: Record<string, string> };
const READING: DocReading = { status: 'reading', fields: {}, flags: {}, notes: {} };

type AuthorizationStatus = 'pending' | 'approved' | 'rejected' | 'revoked' | 'expired' | 'suspended';

// Fields shared by the staff list and the owner's own vehicle list.
interface VehicleRecord {
  authorization_id: number | null;
  sticker_number: string | null;
  authorization_status: AuthorizationStatus | null;
  document_check_status?: DocumentCheckStatus | null;
  approval_source?: 'automatic' | 'staff' | null;
  valid_from: string | null;
  valid_until: string | null;
  requested_at: string | null;
  reviewed_at: string | null;
  remarks: string | null;
  vehicle_id: number;
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  year_model: number | null;
  vehicle_type: string | null;
  parking_area: string | null;
}

interface VehicleAuthorizationRow extends VehicleRecord {
  authorization_id: number;
  authorization_status: AuthorizationStatus;
  owner_code: string | null;
  owner_kind: 'user' | 'visitor';
  owner_name: string | null;
}

// Vehicle approval is automatic (OR/CR check); staff can only suspend or lift a suspension.
type AuthAction = { kind: 'suspend' | 'lift'; row: VehicleAuthorizationRow };

const AUTH_STATUS_LABEL: Record<AuthorizationStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  revoked: 'Revoked',
  expired: 'Expired',
  suspended: 'Suspended',
};

const AUTH_STATUS_VARIANT: Record<AuthorizationStatus, 'success' | 'warning' | 'danger' | 'default' | 'purple'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  revoked: 'danger',
  expired: 'default',
  suspended: 'purple',
};

function AuthStatusBadge({ status }: { status: AuthorizationStatus | null }) {
  if (!status) return <Badge variant="default">Not Requested</Badge>;

  return (
    <Badge variant={AUTH_STATUS_VARIANT[status] ?? 'default'}>
      {AUTH_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

function vehicleDescription(r: VehicleRecord) {
  return [r.year_model, r.make, r.model].filter(Boolean).join(' ') || '—';
}

function getToken(): string | null {
  return (
    localStorage.getItem('pass_auth_token') ||
    sessionStorage.getItem('pass_auth_token')
  );
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  if (!token) {
    throw new Error('Your session has expired. Please log in again.');
  }

  return jsonRequest<T>(url, {
    ...options,
    headers: {
      Accept: 'application/json', Authorization: `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  }, options.method === 'POST' && /^\/api\/vehicles(?:\/\d+\/(?:photo|resubmit|document-check\/retry))?$/.test(url) ? 120000 : 30000);

}

function formatDate(value: string | null) {
  return formatCampusDate(value);
}

type DocumentCheckStatus = 'processing' | 'passed' | 'retake_required' | 'needs_correction' | 'unavailable';
interface DocumentCheck { status: DocumentCheckStatus; reasons: string[]; checkedAt: string | null; approvalSource: string | null }
const DOCUMENT_CHECK_LABEL: Record<DocumentCheckStatus, string> = {
  processing: 'Automatic OR/CR check in progress', passed: 'OR/CR check passed', retake_required: 'Clearer OR/CR photos needed',
  needs_correction: 'Correction needed', unavailable: 'Check could not finish',
};

interface VehicleRow {
  hasPhoto?: boolean;
  rejectionReason?: string | null;
  canResubmit?: boolean;
  hasOr?: boolean;
  hasCr?: boolean;
  documentCheck?: DocumentCheck | null;
  selectedForUse?: boolean;
  switchLocked?: boolean;
  id: string;
  plate: string;
  owner: string;
  make: string;
  model: string;
  year: number | string | null;
  type: string;
  color: string;
  rfid: string | null;
  /** issued | assigned (collect from Admin) | pending_assignment (no sticker available yet) */
  rfidStatus?: 'issued' | 'assigned' | 'pending_assignment' | null;
  status: string;
  registrationStatus?: string;
  authorizationStatus?: string | null;
  validity?: string | null;
}

interface VehiclesApiResponse {
  vehicles?: VehicleRow[];
  message?: string;
}


/** RFID shown to the owner: the UID once assigned, with its hand-over state. */
function rfidLabel(vehicle: VehicleRow): string {
  if (vehicle.rfid && vehicle.rfidStatus === 'assigned') return `${vehicle.rfid} · collect your sticker from the PASS Admin office`;
  if (vehicle.rfid) return vehicle.rfid;
  return vehicle.rfidStatus === 'pending_assignment' ? 'Pending RFID Assignment' : 'Not assigned';
}

async function fetchVehicles(): Promise<VehicleRow[]> {
  const token = getToken();

  if (!token) {
    throw new Error('Session expired. Please log in again.');
  }

  const response = await jsonFetch('/api/vehicles', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data: VehiclesApiResponse = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status}).`);
  }

  return data.vehicles ?? [];
}

function VehiclePhotoPanel({ id, editable, onSaved, hasPhoto }: { id: string | number; editable: boolean; onSaved: () => void; hasPhoto?: boolean }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    setUrl(''); setError('');
    if (hasPhoto === false && version === 0) return () => { cancelled = true; };
    apiBlob(`/api/vehicles/${id}/photo`).then(blob => {
      if (!cancelled) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to load photo.'); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, version, hasPhoto]);
  async function save() {
    if (!file || busy) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.append('vehicle_photo', file);
      await apiRequest(`/api/vehicles/${id}/photo`, { method: 'POST', body });
      setFile(null); setVersion(v => v + 1); onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    {hasPhoto === false && version === 0 && <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No vehicle photo on file.</p>}
    {url && <img src={url} alt="Submitted vehicle photo for PASS staff reference" className="max-h-80 w-full rounded-xl object-contain bg-slate-50" />}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {editable && <>
      <FileUpload accept="image/jpeg,image/png" label="Vehicle photo — show the plate clearly (JPG/PNG)" file={file} onChange={setFile} onError={setError} />
      <Button onClick={save} disabled={!file || busy}>{busy ? 'Submitting…' : 'Submit vehicle photo'}</Button>
      <p className="text-xs text-slate-500">Replacing the photo re-runs the automatic OR/CR check with the documents on file. RFID assignment remains separate.</p>
    </>}
  </div>;
}

export default function VehicleManagement() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const vehicleVersion = useTopicVersion(['vehicles']);
  const license = useLicense();
  const licenseOnFile = isLicenseOnFile(license.status);
  const isRegularUser = REGULAR_USER_ROLES.includes(user?.role ?? null);
  const navigate = useNavigate();
  const sections = isRegularUser ? PAGE_SECTIONS.vehicleUser : PAGE_SECTIONS.vehicleStaff;
  const tab = selectedSection(sections, pathname);
  const setTab = (label: string) => navigate(sectionPath(sections, label));
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [correctingVehicle, setCorrectingVehicle] = useState<VehicleRow | null>(null);
  const [photoVehicleId, setPhotoVehicleId] = useState<number | null>(null);
  const [orFile, setOrFile] = useState<File | null>(null);
  const [crFile, setCrFile] = useState<File | null>(null);
  // What was read from each document; null when no photo is selected.
  const [orReading, setOrReading] = useState<DocReading | null>(null);
  const [crReading, setCrReading] = useState<DocReading | null>(null);
  // Only the details the owner corrected; everything else comes from the OR/CR.
  const [detailEdits, setDetailEdits] = useState<Partial<VehicleDetails>>({});
  const [editingDetails, setEditingDetails] = useState(false);
  // Low-certainty values the owner confirmed against the document (kept by value, so a new reading needs a new check).
  const [checkedDetails, setCheckedDetails] = useState<Partial<VehicleDetails>>({});
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [authRows, setAuthRows] = useState<VehicleAuthorizationRow[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSearch, setAuthSearch] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [authReloadKey, setAuthReloadKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<AuthAction | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const [myRows, setMyRows] = useState<VehicleRecord[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');
  const [myReloadKey, setMyReloadKey] = useState(0);

  const showToast = (message: string, type: 'success' | 'error' = 'success', ms?: number) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), ms ?? (type === 'error' ? 5000 : 3000));
  };

  // Staff "Authorization" tab: all authorizations, filtered server-side.
  useEffect(() => {
    if (isRegularUser || tab !== 'Authorization') return;

    let cancelled = false;

    const loadAuthorizations = async () => {
      setAuthLoading(true);
      setAuthError('');

      try {
        const params = new URLSearchParams();
        if (authStatus) params.set('status', authStatus);
        if (authSearch.trim()) params.set('search', authSearch.trim());
        const query = params.toString();

        const data = await apiRequest<{ data: VehicleAuthorizationRow[] }>(
          `/api/vehicles/authorizations${query ? `?${query}` : ''}`
        );

        if (!cancelled) setAuthRows(data.data ?? []);
      } catch (err) {
        if (!cancelled) setAuthError(err instanceof Error ? err.message : 'Unable to load vehicle authorizations.');
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    // Debounce so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(loadAuthorizations, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isRegularUser, tab, authSearch, authStatus, authReloadKey, vehicleVersion]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [switchingVehicle, setSwitchingVehicle] = useState<string | null>(null);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleReloadKey, setVehicleReloadKey] = useState(0);
  const [registerBusy, setRegisterBusy] = useState(false);
  const [registerError, setRegisterError] = useState('');
  // The registration details: the owner's corrections, else the OR and CR readings
  // combined field by field (either document may supply a detail), else (when
  // correcting a saved record) its current values. A replaced photo's old values
  // disappear with its reading, so they never linger.
  const fromDocuments = useMemo(() => combineReadings(orReading, crReading), [orReading, crReading]);
  const savedDetails: VehicleDetails = correctingVehicle ? { plate_number: correctingVehicle.plate, vehicle_type: correctingVehicle.type,
    year_model: correctingVehicle.year == null ? '' : String(correctingVehicle.year), make: correctingVehicle.make, model: correctingVehicle.model, color: correctingVehicle.color } : EMPTY_DETAILS;
  const details = Object.fromEntries((Object.keys(EMPTY_DETAILS) as (keyof VehicleDetails)[]).map(key =>
    [key, detailEdits[key] ?? (fromDocuments[key].value || (fromDocuments[key].state === 'conflict' ? '' : savedDetails[key])) ?? ''])) as VehicleDetails;
  // One review status for the whole OR/CR result (see lib/orcrReview): OCR certainty
  // ("check") is kept apart from real problems (mismatch, missing detail, retake).
  const review = reviewStatus({ or: orReading, cr: crReading, hasOr: !!orFile, hasCr: !!crFile, combined: fromDocuments, details, edits: detailEdits, checked: checkedDetails });
  const readingDocuments = review.tone === 'reading';
  const { conflicts: conflictDetails, missing: missingDetails, toCheck: uncertainDetails, plateConflict, plateTaken } = review;
  const orPlate = fromDocuments.plate_number.or, crPlate = fromDocuments.plate_number.cr;
  const sourceOf = (key: keyof VehicleDetails) => detailSource(key, { combined: fromDocuments, edits: detailEdits, checked: checkedDetails, details });
  const confirmChecked = () => setCheckedDetails(c => ({ ...c, ...Object.fromEntries(uncertainDetails.map(key => [key, details[key]])) }));

  function openRegistration(vehicle: VehicleRow | null = null) {
    setSelected(null); setCorrectingVehicle(vehicle); setOrFile(null); setCrFile(null); setOrReading(null); setCrReading(null);
    setDetailEdits({}); setCheckedDetails({}); setEditingDetails(false); setRegisterError('');
    setShowRegister(true);
  }
  function closeRegistration() {
    if (registerBusy) return;
    setShowRegister(false); setCorrectingVehicle(null);
  }
  async function retryDocumentCheck(vehicle: VehicleRow) {
    if (retryingId) return;
    setRetryingId(vehicle.id);
    try {
      const data = await apiRequest<{ message: string; document_check?: DocumentCheck | null }>(`/api/vehicles/${vehicle.id}/document-check/retry`, { method: 'POST' });
      showToast(data.message, data.document_check?.status === 'passed' ? 'success' : 'error');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The check could not be restarted.', 'error');
    } finally {
      setRetryingId(null); setSelected(null); setVehicleReloadKey(k => k + 1); setMyReloadKey(k => k + 1);
    }
  }
  function correctionAction(vehicle: VehicleRow) {
    if (!isRegularUser || !['pending', 'rejected'].includes(vehicle.authorizationStatus || vehicle.status)) return null;
    const check = vehicle.documentCheck;
    return <div className="space-y-2">
      {check && <div className={`rounded-xl border p-3 text-sm break-words ${check.status === 'processing' ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
        <p className="font-semibold">{DOCUMENT_CHECK_LABEL[check.status] ?? check.status}</p>
        {check.reasons.length > 0 && <ul className="mt-1 list-disc pl-5 space-y-0.5">{check.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      </div>}
      {!check && vehicle.rejectionReason && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 break-words"><span className="font-semibold">Correction requested: </span>{vehicle.rejectionReason}</p>}
      {check?.status === 'unavailable' && <Button className="w-full min-h-12" variant="outline" disabled={!!retryingId} onClick={() => retryDocumentCheck(vehicle)}>{retryingId === vehicle.id ? 'Checking…' : 'Retry automatic check'}</Button>}
      {check?.status !== 'processing' && <Button className="w-full min-h-12" onClick={() => openRegistration(vehicle)}>{check?.status === 'retake_required' ? 'Retake or re-upload OR/CR' : 'Correct & resubmit'}</Button>}
      <p className="text-xs text-slate-500">Correct this record and upload the OR and CR again. Approval is automatic once every check passes.</p>
    </div>;
  }

  async function registerVehicle() {
    if (registerBusy) return;
    if (!orFile || !crFile) { setRegisterError('Upload photos of both the Official Receipt (OR) and the Certificate of Registration (CR).'); return; }
    if (readingDocuments) { setRegisterError('Wait until both documents have been read.'); return; }
    if (plateConflict) { setRegisterError(`The OR shows plate ${orPlate} but the CR shows ${crPlate}. Upload the OR and CR of the same vehicle.`); return; }
    if (plateTaken) { setRegisterError(`Plate ${details.plate_number} is already registered to another account. Correct the plate if it was misread, or contact PASS staff.`); return; }
    if (conflictDetails.length) {
      setEditingDetails(true);
      setRegisterError(`The OR and CR show different ${conflictDetails.map(key => DETAIL_LABEL[key].toLowerCase()).join(', ')}. Enter the value printed on your documents below, or retake the photo that was misread.`);
      return;
    }
    if (missingDetails.length) {
      setEditingDetails(true);
      setRegisterError(`${missingDetails.map(key => DETAIL_LABEL[key]).join(', ')} could not be read. Retake the photo or enter ${missingDetails.length > 1 ? 'them' : 'it'} below.`);
      return;
    }
    if (uncertainDetails.length) { setRegisterError(`${review.message} Use “These values match my documents” or Correct details.`); return; }
    setRegisterBusy(true); setRegisterError('');
    try {
      const body = new FormData();
      Object.entries(details).forEach(([key, value]) => { if (value.trim()) body.append(key, key === 'vehicle_type' ? value : value.trim().toUpperCase()); });
      body.append('or_document', orFile); body.append('cr_document', crFile);
      const data = await apiRequest<{ message: string; document_check?: DocumentCheck | null }>(correctingVehicle ? `/api/vehicles/${correctingVehicle.id}/resubmit` : '/api/vehicles', { method: 'POST', body });
      // Reached only after the server saved the registration and its documents.
      setOrFile(null); setCrFile(null); setOrReading(null); setCrReading(null); setDetailEdits({}); setCheckedDetails({});
      setShowRegister(false); setCorrectingVehicle(null); setSelected(null);
      setAuthReloadKey(k => k + 1); setVehicleReloadKey(k => k + 1); setMyReloadKey(k => k + 1);
      const check = data.document_check?.status === 'passed' ? 'It was approved automatically after the OR/CR check.'
        : `${data.message}${data.document_check?.reasons?.length ? ' ' + data.document_check.reasons.join(' ') : ''}`;
      showToast(correctingVehicle
        ? `Vehicle registration updated. ${check}`
        : `Vehicle Registration Successful! Your vehicle details have been read from your OR/CR and successfully registered. ${check}`, 'success', 9000);
    } catch (error) {
      // The selected files and details stay in place so the owner can retry. When the OR/CR
      // did not confirm the details nothing was saved; open the editor beside the reasons.
      if (error instanceof ApiError && error.fieldErrors.documents) setEditingDetails(true);
      setRegisterError(error instanceof ApiError && Object.keys(error.fieldErrors).length ? Object.values(error.fieldErrors).join(' ') : error instanceof Error ? error.message : 'Vehicle registration failed. Your documents are still selected; try again.');
    } finally { setRegisterBusy(false); }
  }


  // Regular user "Authorization Status" tab: only the signed-in user's vehicles.
  useEffect(() => {
    if (!isRegularUser || tab !== 'Authorization Status') return;

    let cancelled = false;

    const loadMyVehicles = async () => {
      setMyLoading(true);
      setMyError('');

      try {
        const data = await apiRequest<{ data: VehicleRecord[] }>('/api/vehicles/my-authorizations');
        if (!cancelled) setMyRows(data.data ?? []);
      } catch (err) {
        if (!cancelled) setMyError(err instanceof Error ? err.message : 'Unable to load your vehicle authorizations.');
      } finally {
        if (!cancelled) setMyLoading(false);
      }
    };

    loadMyVehicles();

    // Pick up changes made by staff when the user returns to this window.
    const onFocus = () => setMyReloadKey(k => k + 1);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [isRegularUser, tab, myReloadKey, vehicleVersion]);

  const openAction = (action: AuthAction) => {
    setPendingAction(action);
    setActionReason('');
    setActionError('');
  };

  const closeAction = () => {
    if (actionBusy) return;
    setPendingAction(null);
  };

  const confirmAction = async () => {
    if (!pendingAction) return;

    const { kind, row } = pendingAction;
    const endpoint = kind === 'suspend' ? 'suspend' : 'lift-suspension';

    setActionBusy(true);
    setActionError('');

    try {
      const result = await apiRequest<{ message: string; data: VehicleAuthorizationRow | null }>(
        `/api/vehicles/authorizations/${row.authorization_id}/${endpoint}`,
        {
          method: 'PATCH',
          body: JSON.stringify(kind === 'suspend' ? { reason: actionReason.trim() || null } : {}),
        }
      );

      // Show the new status right away, then refetch so filters stay accurate.
      if (result.data) {
        const updated = result.data;
        setAuthRows(rows => rows.map(r => (r.authorization_id === updated.authorization_id ? updated : r)));
      }
      setAuthReloadKey(k => k + 1);

      setPendingAction(null);
      showToast(`${result.message} (${row.plate_number})`);
    } catch (err) {
      // The row on screen is out of date: the record was removed/replaced (404)
      // or its status changed elsewhere (409). Reload so the table matches MySQL.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) {
        setPendingAction(null);
        setAuthReloadKey(k => k + 1);
        showToast(
          err.status === 404
            ? `The authorization shown for ${row.plate_number} no longer exists. The list has been refreshed; please try again.`
            : `${err.message} The list has been refreshed to show the current status.`,
          'error'
        );
        return;
      }

      // Keep the dialog open so the reason (e.g. expired validity) stays visible.
      setActionError(err instanceof Error ? err.message : 'The request could not be completed.');
    } finally {
      setActionBusy(false);
    }
  };



  async function selectVehicleForUse(vehicle: VehicleRow) {
    if (switchingVehicle) return;
    setSwitchingVehicle(vehicle.id); setVehicleError('');
    try {
      const result = await apiRequest<{ message: string }>(`/api/vehicles/${vehicle.id}/select-for-use`, { method: 'POST' });
      showToast(result.message);
      setSelected(null);
      setVehicleReloadKey(key => key + 1);
    } catch (error) {
      setVehicleError(error instanceof Error ? error.message : 'Unable to switch vehicles.');
      setVehicleReloadKey(key => key + 1);
      showToast(error instanceof Error ? error.message : 'Unable to switch vehicles.');
    } finally { setSwitchingVehicle(null); }
  }
  function vehicleUseControl(vehicle: VehicleRow) {
    return <div className="space-y-2" onClick={event => event.stopPropagation()}>
      <Badge variant={vehicle.selectedForUse ? 'success' : 'default'}>{vehicle.selectedForUse ? 'Selected for use' : 'Inactive for entry'}</Badge>
      {!vehicle.selectedForUse && <div><Button className="w-full min-h-12 text-base" disabled={!!switchingVehicle || vehicle.switchLocked || !vehicle.rfid || vehicle.status !== 'approved' || vehicle.registrationStatus !== 'registered'} onClick={() => selectVehicleForUse(vehicle)}>{switchingVehicle === vehicle.id ? 'Switching…' : 'Use this vehicle'}</Button></div>}
      {vehicle.switchLocked && <p className="text-xs text-amber-700">Exit first to switch vehicles.</p>}
      {!vehicle.rfid && <p className="text-xs text-slate-400">{vehicle.rfidStatus === 'pending_assignment' ? 'Pending RFID Assignment: a sticker is assigned automatically when one is available.' : 'Active RFID assignment required.'}</p>}
      {vehicle.rfid && vehicle.rfidStatus === 'assigned' && <p className="text-xs text-amber-700">Collect your RFID sticker from the PASS Admin office. It works at the gate after Admin confirms the hand-over.</p>}
    </div>;
  }

  useEffect(() => {
  let cancelled = false;

  async function loadVehicles() {
    setLoadingVehicles(true);
    setVehicleError('');

    try {
      const data = await fetchVehicles();

      if (!cancelled) {
        setVehicles(data);
      }
    } catch (error) {
      if (!cancelled) {
        setVehicleError(
          error instanceof Error
            ? error.message
            : 'Failed to load vehicles.'
        );
      }
    } finally {
      if (!cancelled) {
        setLoadingVehicles(false);
      }
    }
  }

  loadVehicles();

  return () => {
    cancelled = true;
  };
}, [vehicleReloadKey, vehicleVersion]);

  useEffect(() => {
    if (selected?.id) {
      const current = vehicles.find(v => v.id === selected.id);
      if (current) setSelected(current);
    }
  }, [vehicles, selected?.id]);

  const roleScopedVehicles = vehicles;
  const filtered = roleScopedVehicles.filter(v => {
    const q = search.toLowerCase();
    const matchQ = v.plate.toLowerCase().includes(q) || v.owner.toLowerCase().includes(q) || v.make.toLowerCase().includes(q);
    const matchType = !filterType || v.type === filterType;
    const matchStatus = !filterStatus || v.status === filterStatus;
    return matchQ && matchType && matchStatus;
  });

  return (
    <div className="animate-fadein">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <PageHeader backToDashboard
        title={tab === 'My Vehicles' ? 'My Vehicle' : tab === 'Authorization' ? 'Vehicle Authorization' : tab}
        subtitle={isRegularUser ? 'Manage your vehicle, driver information, and authorization status' : 'Review campus vehicle records and authorization status'}
        action={isRegularUser ? <Button onClick={() => openRegistration()}><Plus size={16} /> Register Vehicle</Button> : undefined}
      />



      {tab === 'My Vehicles' && isRegularUser && !licenseOnFile && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <p className="flex-1 min-w-[200px] text-sm text-amber-800">Submit your driver’s license before registering a vehicle.</p>
          <Button size="sm" onClick={() => setTab('Driver & License')}>Submit License</Button>
        </div>
      )}

      {tab === 'My Vehicles' && (
        <Card>
          {isRegularUser && <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap gap-3 justify-between items-center"><div className="text-sm text-slate-600"><p className="font-semibold text-[#080677]">Selected vehicle: <span className="font-mono">{vehicles.find(vehicle => vehicle.selectedForUse)?.plate || 'None selected'}</span></p><p className="mt-1 text-xs">Only your selected vehicle can enter. Switching is locked while any of your vehicles is inside. License and authorization checks still apply.</p></div><Button size="sm" variant="outline" onClick={() => setVehicleReloadKey(key => key + 1)}>Refresh status</Button></div>}
          <div className="p-5 border-b border-slate-50">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by plate, owner, or make...">
              <Select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Types</option>
                {['Sedan', 'SUV', 'Hatchback', 'Motorcycle', 'Van'].map(t => <option key={t}>{t}</option>)}
              </Select>
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                {['approved', 'pending', 'suspended', 'rejected'].map(s => <option key={s}>{s}</option>)}
              </Select>
            </SearchBar>
          </div>
          {loadingVehicles && (
  <p className="px-5 py-3 text-sm text-slate-500">
    Loading vehicles...
  </p>
)}

{vehicleError && (
  <p className="px-5 py-3 text-sm text-red-600">
    {vehicleError}
  </p>
)}
          {isRegularUser ? <div className="grid min-w-0 gap-4 p-4 sm:p-5 xl:grid-cols-2">
            {!loadingVehicles && !filtered.length && <p className="p-6 text-sm text-slate-500">No vehicles match your filters.</p>}
            {filtered.map(vehicle => <article key={vehicle.id} aria-label={`Vehicle ${vehicle.plate}`} className={`min-w-0 overflow-hidden rounded-2xl border-2 ${vehicle.selectedForUse ? 'border-[#080677] shadow-sm' : 'border-slate-200'}`}>
              <div className={`flex items-start gap-3 p-4 sm:p-5 ${vehicle.selectedForUse ? 'bg-[#080677] text-white' : 'bg-slate-50 text-[#080677]'}`}>
                <Car size={28} className="shrink-0 mt-1"/>
                <div className="min-w-0 flex-1"><p className="font-mono text-xl font-bold break-words">{vehicle.plate}</p><p className={`text-sm mt-1 break-words ${vehicle.selectedForUse ? 'text-blue-100' : 'text-slate-500'}`}>{[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}</p></div>
              </div>
              <div className="p-4 sm:p-5 space-y-4">
                <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${vehicle.selectedForUse ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{vehicle.selectedForUse ? '✓ Selected for use' : 'Inactive for entry'}</div>
                <dl className="grid grid-cols-2 gap-3 text-sm"><div className="min-w-0"><dt className="text-xs text-slate-400">Vehicle type</dt><dd className="mt-1 break-words">{vehicle.type}</dd></div><div><dt className="text-xs text-slate-400">Authorization</dt><dd className="mt-1"><Badge variant={statusBadge(vehicle.status)}>{vehicle.status}</Badge></dd></div><div className="col-span-2 min-w-0"><dt className="text-xs text-slate-400">Assigned RFID</dt><dd className="font-mono text-xs mt-1 break-all">{rfidLabel(vehicle)}</dd></div></dl>
                {!vehicle.selectedForUse && <Button className="w-full min-h-12 text-base" disabled={!!switchingVehicle || vehicle.switchLocked || !vehicle.rfid || vehicle.status !== 'approved' || vehicle.registrationStatus !== 'registered'} onClick={() => selectVehicleForUse(vehicle)}>{switchingVehicle === vehicle.id ? 'Switching…' : 'Use this vehicle'}</Button>}
                {vehicle.selectedForUse && <p className="text-xs leading-relaxed text-slate-500">This is your selected vehicle for entry. Normal RFID, license and authorization checks still apply.</p>}
                {vehicle.switchLocked && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">A vehicle is still inside. Record its exit, then refresh to switch vehicles.</p>}
                {!vehicle.rfid && <p className="text-xs text-slate-500">{vehicle.rfidStatus === 'pending_assignment' ? 'Pending RFID Assignment: a sticker is assigned automatically when one is available.' : 'Staff must assign an active RFID before you can select this vehicle.'}</p>}
                {correctionAction(vehicle)}
                <Button className="w-full" variant="outline" onClick={() => setSelected(vehicle)}>View vehicle details</Button>
              </div>
            </article>)}
          </div> : <Table
            columns={[
              { key: 'plate', label: 'Plate No.', render: v => <span className="font-mono font-bold text-[#080677]">{v.plate}</span> },
              { key: 'vehicle', label: 'Vehicle', render: v => `${v.year} ${v.make} ${v.model}` },
              { key: 'type', label: 'Type' },
              { key: 'color', label: 'Color' },
              { key: 'rfid', label: 'RFID', render: v => v.rfid ? <span className="text-xs font-mono text-slate-500">{v.rfid}{v.rfidStatus === 'assigned' ? ' · not issued' : ''}</span> : <span className="text-xs text-slate-300">{v.rfidStatus === 'pending_assignment' ? 'Pending RFID Assignment' : 'Unassigned'}</span> },
              { key: 'status', label: 'Authorization', render: v => <Badge variant={statusBadge(v.status)}>{v.status}</Badge> },
              ...(isRegularUser ? [{ key: 'entry_selection', label: 'Entry selection', render: (v: VehicleRow) => vehicleUseControl(v) }] : []),
              { key: 'actions', label: 'Actions', render: v => <Button size="sm" variant="ghost" onClick={() => setSelected(v)}>View</Button> },
            ]}
            data={filtered}
            onRowClick={setSelected}
          />}
        </Card>
      )}

      {tab === 'RFID Assignment' && isRegularUser && (
        <Card className="p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-[#080677]">RFID Assignment</h3>
            <p className="text-sm text-slate-500 mt-1">When a new vehicle registration is approved, PASS assigns an RFID sticker to it automatically if one is available; otherwise it shows Pending RFID Assignment. Collect the physical sticker from the PASS Admin office: it works at the gate after Admin confirms the hand-over.</p>
          </div>
          {loadingVehicles && <p role="status" className="text-sm text-slate-500">Loading assigned tags…</p>}
          {vehicleError && <p role="alert" className="text-sm text-red-700">{vehicleError}</p>}
          {!loadingVehicles && !vehicleError && <Table columns={[
            { key: 'plate', label: 'Vehicle Plate' },
            { key: 'status', label: 'Authorization', render: (vehicle: VehicleRow) => <Badge variant={statusBadge(vehicle.status)}>{vehicle.status}</Badge> },
            { key: 'rfid', label: 'RFID Tag', render: (vehicle: VehicleRow) => <span className="font-mono text-xs break-all">{vehicle.rfid || (vehicle.rfidStatus === 'pending_assignment' ? 'Pending RFID Assignment' : 'Not assigned')}</span> },
            { key: 'rfidStatus', label: 'Sticker', render: (vehicle: VehicleRow) => vehicle.rfidStatus === 'issued' ? <Badge variant="success">Issued</Badge> : vehicle.rfidStatus === 'assigned' ? <Badge variant="warning">Assigned · collect from Admin</Badge> : vehicle.rfidStatus === 'pending_assignment' ? <Badge variant="info">Pending RFID Assignment</Badge> : <span className="text-xs text-slate-300">—</span> },
          ]} data={roleScopedVehicles} />}
          <p className="text-xs text-slate-500">A tag assignment does not record an entry. Choose your vehicle under My Vehicles before using it at the gate.</p>
          <Button variant="outline" onClick={() => setTab('My Vehicles')}>View my vehicles</Button>
        </Card>
      )}

      {tab === 'Driver & License' && isRegularUser && (
        <Card className="p-5 sm:p-6">
          <DriverLicenseVerification variant="web" owner={user?.name ?? 'User'} />
        </Card>
      )}

      {tab === 'License Verification' && !isRegularUser && <LicenseReviewQueue onToast={showToast} />}

      {tab === 'Authorization' && !isRegularUser && (
        <Card>
          <div className="p-5 border-b border-slate-50">
            <SearchBar value={authSearch} onChange={setAuthSearch} placeholder="Search by plate, sticker, owner, or ID...">
              <Select value={authStatus} onChange={e => setAuthStatus(e.target.value)}>
                <option value="">All Status</option>
                {(Object.keys(AUTH_STATUS_LABEL) as AuthorizationStatus[]).map(s => (
                  <option key={s} value={s}>{AUTH_STATUS_LABEL[s]}</option>
                ))}
              </Select>
            </SearchBar>
          </div>
          {authError && (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">Unable to load vehicle authorizations: {authError}</p>
            </div>
          )}
          {authLoading && authRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Loading vehicle authorizations...</p>
          ) : (
            <Table
              columns={[
                { key: 'plate_number', label: 'Plate No.', render: (r: VehicleAuthorizationRow) => <span className="font-mono font-bold text-[#080677]">{r.plate_number}</span> },
                { key: 'vehicle', label: 'Vehicle', render: (r: VehicleAuthorizationRow) => (
                  <div>
                    <p className="text-slate-700">{vehicleDescription(r)}</p>
                    {r.color && <p className="text-xs text-slate-400">{r.color}</p>}
                  </div>
                )},
                { key: 'vehicle_type', label: 'Type', render: (r: VehicleAuthorizationRow) => r.vehicle_type || '—' },
                { key: 'owner', label: 'Owner', render: (r: VehicleAuthorizationRow) => (
                  <div>
                    <p className="text-slate-700">{r.owner_name || '—'}</p>
                    <p className="text-xs text-slate-400">{r.owner_kind === 'visitor' ? 'Visitor' : r.owner_code || 'User'}</p>
                  </div>
                )},
                { key: 'parking_area', label: 'Parking Area', render: (r: VehicleAuthorizationRow) => r.parking_area || 'All areas' },
                { key: 'sticker_number', label: 'Sticker No.', render: (r: VehicleAuthorizationRow) => r.sticker_number
                  ? <span className="text-xs font-mono text-slate-500">{r.sticker_number}</span>
                  : <span className="text-xs text-slate-300">None</span> },
                { key: 'authorization_status', label: 'Auth Status', render: (r: VehicleAuthorizationRow) => (
                  <AuthStatusBadge status={r.authorization_status} />
                )},
                { key: 'validity', label: 'Validity', render: (r: VehicleAuthorizationRow) => (
                  r.valid_from || r.valid_until
                    ? <span className="whitespace-nowrap">{formatDate(r.valid_from)} – {formatDate(r.valid_until)}</span>
                    : '—'
                )},
                { key: 'photo', label: 'Photo', render: (r: VehicleAuthorizationRow) => <Button size="sm" variant="outline" onClick={() => setPhotoVehicleId(r.vehicle_id)}>View photo</Button> },
                { key: 'actions', label: 'Actions', render: (r: VehicleAuthorizationRow) => {
                  if (r.authorization_status === 'pending') {
                    // No manual approval: show where the automatic check stands.
                    return <span className="text-xs text-slate-500">{r.document_check_status ? DOCUMENT_CHECK_LABEL[r.document_check_status] ?? r.document_check_status : 'Awaiting OR/CR upload'}</span>;
                  }
                  if (r.authorization_status === 'approved') {
                    return (
                      <Button size="sm" variant="danger" onClick={() => openAction({ kind: 'suspend', row: r })}>Suspend</Button>
                    );
                  }

                  if (r.authorization_status === 'suspended') {
                    return (
                      <Button size="sm" variant="outline" onClick={() => openAction({ kind: 'lift', row: r })}>Lift Suspension</Button>
                    );
                  }

                  return <span className="text-xs text-slate-300">—</span>;
                }},
              ]}
              data={authRows}
            />
          )}
        </Card>
      )}

      {tab === 'Authorization Status' && isRegularUser && (
        <Card>
          <div className="p-5 border-b border-slate-50 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-slate-500">Authorization status of the vehicles registered under your account.</p>
            <Button size="sm" variant="outline" disabled={myLoading} onClick={() => setMyReloadKey(k => k + 1)}>
              <RefreshCw size={14} className={myLoading ? 'animate-spin' : ''} /> Refresh
            </Button>
          </div>
          {myError && (
            <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">Unable to load your vehicle authorizations: {myError}</p>
            </div>
          )}
          {myLoading && myRows.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-400">Loading your vehicle authorizations...</p>
          ) : !myError && myRows.length === 0 ? (
            <EmptyState
              title="No registered vehicles"
              description="You have no vehicles registered under your account yet. Once you register a vehicle, its authorization status will appear here."
            />
          ) : (
            <Table
              columns={[
                { key: 'plate_number', label: 'Plate No.', render: (r: VehicleRecord) => <span className="font-mono font-bold text-[#080677]">{r.plate_number}</span> },
                { key: 'vehicle', label: 'Vehicle', render: (r: VehicleRecord) => (
                  <div>
                    <p className="text-slate-700">{vehicleDescription(r)}</p>
                    {r.color && <p className="text-xs text-slate-400">{r.color}</p>}
                  </div>
                )},
                { key: 'vehicle_type', label: 'Type', render: (r: VehicleRecord) => r.vehicle_type || '—' },
                { key: 'authorization_status', label: 'Auth Status', render: (r: VehicleRecord) => <AuthStatusBadge status={r.authorization_status} /> },
                { key: 'parking_area', label: 'Parking Area', render: (r: VehicleRecord) => r.authorization_id ? (r.parking_area || 'All areas') : '—' },
                { key: 'sticker_number', label: 'Sticker No.', render: (r: VehicleRecord) => r.sticker_number
                  ? <span className="text-xs font-mono text-slate-500">{r.sticker_number}</span>
                  : <span className="text-xs text-slate-300">None</span> },
                { key: 'validity', label: 'Validity', render: (r: VehicleRecord) => (
                  r.valid_from || r.valid_until
                    ? <span className="whitespace-nowrap">{formatDate(r.valid_from)} – {formatDate(r.valid_until)}</span>
                    : '—'
                )},
                { key: 'actions', label: 'Actions', render: (r: VehicleRecord) => {
                  if (!['pending', 'rejected'].includes(r.authorization_status || '')) return <span className="text-xs text-slate-400">—</span>;
                  const vehicle = vehicles.find(v => v.id === String(r.vehicle_id)) || {
                    id: String(r.vehicle_id), plate: r.plate_number, type: r.vehicle_type || '', owner: '',
                    make: r.make || '', model: r.model || '', year: r.year_model, color: r.color || '', rfid: null,
                    status: r.authorization_status || 'pending', authorizationStatus: r.authorization_status,
                    rejectionReason: r.authorization_status === 'rejected' ? r.remarks : null,
                  };
                  return <Button size="sm" onClick={() => openRegistration(vehicle)}>{r.authorization_status === 'rejected' ? 'Correct & resubmit' : 'Update & resubmit'}</Button>;
                }},
                { key: 'requested_at', label: 'Requested', render: (r: VehicleRecord) => formatDate(r.requested_at) },
                { key: 'remarks', label: 'Remarks', render: (r: VehicleRecord) => r.remarks
                  ? <span className="block max-w-xs truncate text-slate-500" title={r.remarks}>{r.remarks}</span>
                  : <span className="text-xs text-slate-300">—</span> },
              ]}
              data={myRows}
            />
          )}
        </Card>
      )}

      {/* Suspend / Lift Suspension confirmation */}
      <Modal
        open={!!pendingAction}
        onClose={closeAction}
        title={pendingAction?.kind === 'lift' ? 'Lift Suspension' : 'Suspend Vehicle Authorization'}
        size="sm"
      >
        {pendingAction && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {pendingAction.kind === 'suspend' ? (
                <>Suspend the authorization for <span className="font-mono font-bold text-[#080677]">{pendingAction.row.plate_number}</span>? The vehicle will be treated as unauthorized until the suspension is lifted.</>
              ) : (
                <>Lift the suspension for <span className="font-mono font-bold text-[#080677]">{pendingAction.row.plate_number}</span>? The authorization will return to Approved if the vehicle still meets all approval and access requirements.</>
              )}
            </p>
            {pendingAction.kind === 'suspend' && (
              <Input
                label="Reason (optional)"
                placeholder="e.g. Parking violation under review"
                maxLength={255}
                value={actionReason}
                onChange={e => setActionReason(e.target.value)}
                disabled={actionBusy}
              />
            )}
            {actionError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-600">{actionError}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={closeAction} disabled={actionBusy}>Cancel</Button>
              <Button
                variant={pendingAction.kind === 'suspend' ? 'danger' : 'primary'}
                onClick={confirmAction}
                disabled={actionBusy}
              >
                {actionBusy
                  ? 'Saving...'
                  : pendingAction.kind === 'suspend' ? 'Suspend' : 'Lift Suspension'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Vehicle Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Vehicle Details">
        {selected && (
          <div className="space-y-4">
            <div className="bg-[#F4F7FB] rounded-xl p-5 flex items-center gap-4">
              <div className="w-16 h-16 bg-[#2563EB]/10 rounded-2xl flex items-center justify-center">
                <Car size={32} className="text-[#2563EB]" />
              </div>
              <div>
                <p className="font-mono font-bold text-2xl text-[#080677]">{selected.plate}</p>
                <p className="text-slate-500">{selected.year} {selected.make} {selected.model}</p>
                <Badge variant={statusBadge(selected.status)}>{selected.status}</Badge>
              </div>
            </div>
            {[['Owner', selected.owner], ['Vehicle Type', selected.type], ['Color', selected.color], ['RFID Tag', rfidLabel(selected)], ['Registration Status', selected.registrationStatus || 'registered'], ['Authorization Status', selected.authorizationStatus || selected.status]].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-slate-50 pb-2">
                <span className="text-slate-400">{k}</span>
                <span className="font-medium text-slate-700">{v || '—'}</span>
              </div>
            ))}
            {isRegularUser && vehicleUseControl(selected)}
            {correctionAction(selected)}
            <VehiclePhotoPanel key={selected.id} id={selected.id} hasPhoto={selected.hasPhoto} editable={false} onSaved={() => {}} />
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={photoVehicleId !== null} onClose={() => setPhotoVehicleId(null)} title="Vehicle photo">
        {photoVehicleId !== null && <VehiclePhotoPanel key={photoVehicleId} id={photoVehicleId} editable={false} onSaved={() => {}} />}
      </Modal>

      {/* Register Vehicle Modal */}
      <Modal open={showRegister} onClose={closeRegistration} title={correctingVehicle ? 'Correct & resubmit vehicle' : 'Register Vehicle'} size="md">
        {license.status !== 'verified' ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle size={18} className="shrink-0 mt-0.5" />
              <p>Complete driver’s license verification before registering a vehicle. Your license must be verified and unexpired before you submit a vehicle.</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setShowRegister(false); setTab('Driver & License'); }}>Go to Driver & License</Button>
              <Button variant="outline" onClick={() => setShowRegister(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {correctingVehicle && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 break-words">{correctingVehicle.rejectionReason || 'Review and correct this existing vehicle registration.'}</p>}
            <p className="text-sm text-slate-600">{correctingVehicle ? 'Upload the OR and CR again; the details are read from them for you to review. Your previous submission stays in history.' : 'Upload or take photos of your Official Receipt (OR) and Certificate of Registration (CR). The plate number and vehicle description are read from them for you to review.'} Approval is automatic when the OR and CR agree with the reviewed details, the registration is valid and your license is verified.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FileUpload accept={IMAGE_ACCEPT} capture preview disabled={registerBusy} label="Official Receipt (OR)" file={orFile}
                  onChange={f => { setOrFile(f); setOrReading(f ? READING : null); setRegisterError(''); }} onError={setRegisterError} />
                <DocumentAutofill compact file={orFile} documentType="vehicle_or" onFields={(fields, flags, status, notes) => setOrReading({ status, fields, flags, notes })} />
              </div>
              <div className="space-y-2">
                <FileUpload accept={IMAGE_ACCEPT} capture preview disabled={registerBusy} label="Certificate of Registration (CR)" file={crFile}
                  onChange={f => { setCrFile(f); setCrReading(f ? READING : null); setRegisterError(''); }} onError={setRegisterError} />
                <DocumentAutofill compact file={crFile} documentType="vehicle_cr" onFields={(fields, flags, status, notes) => setCrReading({ status, fields, flags, notes })} />
              </div>
            </div>
            {(orFile || crFile) && (
              <section aria-label="Review vehicle details" className="rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-semibold text-[#080677]">Review vehicle details</h4>
                  {!readingDocuments && (
                    <button type="button" disabled={registerBusy} onClick={() => setEditingDetails(v => !v)} className="text-sm font-semibold text-[#2563EB] hover:underline disabled:opacity-50">
                      {editingDetails ? 'Done' : 'Correct details'}
                    </button>
                  )}
                </div>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="font-medium text-slate-500">Plate Number</dt>
                  <dd className={`break-words ${!details.plate_number || uncertainDetails.includes('plate_number') ? 'text-amber-800' : 'font-semibold text-slate-800'}`}>
                    {details.plate_number || (readingDocuments ? 'Reading…' : plateConflict ? `OR: ${orPlate} · CR: ${crPlate}` : 'Not read on the OR or CR; enter it below')}
                    {details.plate_number && sourceOf('plate_number') && <span className="font-normal text-slate-500"> ({sourceOf('plate_number')})</span>}
                  </dd>
                  <dt className="font-medium text-slate-500">Vehicle Description</dt>
                  <dd className={`break-words ${(['make', 'model', 'color', 'vehicle_type'] as const).some(key => !details[key] || uncertainDetails.includes(key)) ? 'text-amber-800' : 'font-semibold text-slate-800'}`}>
                    {[[details.make, details.model].filter(Boolean).join(' '), details.color, details.year_model, details.vehicle_type].filter(Boolean).join(' · ') || (readingDocuments ? 'Reading…' : 'Not read; enter it below')}
                    {!readingDocuments && (['make', 'model', 'color', 'vehicle_type'] as const).some(key => !details[key]) && (details.make || details.model) && ' (some details missing)'}
                  </dd>
                  {(['make', 'model'] as const).map(key => (
                    <React.Fragment key={key}>
                      <dt className="font-medium text-slate-500 sm:pl-3">{key === 'make' ? 'Make' : 'Model / Series'}</dt>
                      <dd className={`break-words ${!details[key] || uncertainDetails.includes(key) || conflictDetails.includes(key) ? 'text-amber-800' : 'text-slate-800'}`}>
                        {details[key] || (readingDocuments ? 'Reading…' : conflictDetails.includes(key) ? `OR: ${fromDocuments[key].or} · CR: ${fromDocuments[key].cr} (documents differ; enter the correct value)` : 'Not read; enter it below')}
                        {details[key] && sourceOf(key) && <span className="text-slate-500"> ({sourceOf(key)})</span>}
                      </dd>
                    </React.Fragment>
                  ))}
                  <dt className="font-medium text-slate-500">Parking</dt>
                  <dd className="text-slate-700">{details.vehicle_type ? (details.vehicle_type === 'Motorcycle' ? 'Motorcycle lot' : 'Car lot (four-wheel vehicles)') : 'Decided by the vehicle type'}</dd>
                  <dt className="font-medium text-slate-500">OR/CR Result</dt>
                  <dd role="status" className={{ reading: 'text-blue-800', problem: 'text-red-700', check: 'text-blue-800', success: 'text-green-700' }[review.tone]}>
                    <span className="font-semibold">{review.title}</span>{review.tone !== 'reading' && <span className="block font-normal">{review.message}</span>}
                    {(review.tone === 'success' || review.tone === 'check') && review.basis.length > 0 && <span className="block text-xs font-normal text-slate-500">{review.basis.join(' ')}</span>}
                  </dd>
                </dl>
                {!readingDocuments && review.missingNotes.length > 0 && (
                  <ul className="list-disc space-y-0.5 rounded-xl border border-amber-200 bg-amber-50 py-2 pl-7 pr-3 text-sm text-amber-900">
                    {review.missingNotes.map(note => <li key={note}>{note}</li>)}
                  </ul>
                )}
                {review.tone === 'check' && (
                  <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
                    <span>Compare the values marked “check this value” with your documents.</span>
                    <div className="flex shrink-0 gap-2">
                      <Button size="sm" disabled={registerBusy} onClick={confirmChecked}>These values match my documents</Button>
                      <Button size="sm" variant="outline" disabled={registerBusy} onClick={() => setEditingDetails(true)}>Correct</Button>
                    </div>
                  </div>
                )}
                {(editingDetails || (!readingDocuments && missingDetails.length + conflictDetails.length > 0)) && (
                  <fieldset disabled={registerBusy} className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
                    <Input label="Plate Number" placeholder="ABC 1234" value={details.plate_number} error={!details.plate_number ? 'Not read from the OR/CR.' : undefined}
                      onChange={e => setDetailEdits(d => ({ ...d, plate_number: e.target.value.toUpperCase() }))} />
                    <Select label="Vehicle Type" value={details.vehicle_type} onChange={e => setDetailEdits(d => ({ ...d, vehicle_type: e.target.value }))}>
                      <option value="">Choose vehicle type…</option><option>Sedan</option><option>SUV</option><option>Hatchback</option><option>Pickup</option><option>Motorcycle</option><option>Van</option>
                    </Select>
                    <Input label="Make" placeholder="SUZUKI" value={details.make} error={!details.make ? (conflictDetails.includes('make') ? 'The OR and CR differ; enter the correct make.' : 'Not read from the OR/CR.') : undefined}
                      onChange={e => setDetailEdits(d => ({ ...d, make: e.target.value.toUpperCase() }))} />
                    <Input label="Model / Series" placeholder="FU150MFZ" value={details.model} error={!details.model ? (conflictDetails.includes('model') ? 'The OR and CR differ; enter the correct model.' : 'Not read from the OR/CR.') : undefined}
                      onChange={e => setDetailEdits(d => ({ ...d, model: e.target.value.toUpperCase() }))} />
                    <Input label="Color" placeholder="BLACK" value={details.color} error={!details.color ? 'Not read from the OR/CR.' : undefined}
                      onChange={e => setDetailEdits(d => ({ ...d, color: e.target.value.toUpperCase() }))} />
                    <Input label="Year" placeholder="2024" type="number" value={details.year_model}
                      onChange={e => setDetailEdits(d => ({ ...d, year_model: e.target.value }))} />
                  </fieldset>
                )}
              </section>
            )}
            <p className="text-xs text-slate-500">Readable OR/CR text does not prove ownership or authenticity; PASS checks that the documents agree with the reviewed details. If a check fails you will see what to retake or correct. RFID assignment is a separate step after approval.</p>
            {registerError && <p role="alert" className="text-sm text-red-700">{registerError}</p>}
            <div className="flex gap-3 pt-2">
              <Button onClick={registerVehicle} disabled={registerBusy || readingDocuments || !orFile || !crFile}>
                {registerBusy ? 'Registering…' : readingDocuments ? 'Reading documents…' : correctingVehicle ? 'Submit corrected registration' : 'Register Vehicle'}
              </Button>
              <Button variant="outline" disabled={registerBusy} onClick={closeRegistration}>Cancel</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

