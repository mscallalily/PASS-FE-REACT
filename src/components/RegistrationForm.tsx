
﻿import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  AlertCircle,
  Car,
  User,
  Briefcase,
  IdCard,
} from 'lucide-react';
import FileUpload from './FileUpload';

export const REGISTRATION_STEPS = [
  'Account Info',
  'ID Verification',
  'User Details',
  'Vehicle',
  'Review',
] as const;

const USER_TYPES = [
  { value: 'student', label: 'Student' },
  { value: 'faculty', label: 'Faculty' },
  { value: 'employee', label: 'Employee' },
  { value: 'other', label: 'Other Authorized' },
];

interface Department {
  department_id: number;
  department_code: string;
  department_name: string;
}

const VEHICLE_TYPES = [
  'Sedan',
  'SUV',
  'Hatchback',
  'Pickup',
  'Van',
  'Motorcycle',
];

const LICENSE_TYPES = [
  { value: 'student_permit', label: 'Student Permit' },
  { value: 'non_professional', label: 'Non-Professional' },
  { value: 'professional', label: 'Professional' },
  { value: 'international', label: 'International' },
];

interface FormState {
  fullName: string;
  idNum: string;
  email: string;
  password: string;
  confirmPwd: string;
  idFile: File | null;
  userType: string;
  dept: string;
  contact: string;
  hasVehicle: boolean | null;
  vehicleType: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  licenseNo: string;
  licenseType: string;
  licenseExpiry: string;
  licenseFile: File | null;
  agree: boolean;
}

const INITIAL: FormState = {
  fullName: '',
  idNum: '',
  email: '',
  password: '',
  confirmPwd: '',
  idFile: null,
  userType: 'student',
  dept: '',
  contact: '',
  hasVehicle: null,
  vehicleType: 'Sedan',
  plate: '',
  make: '',
  model: '',
  color: '',
  licenseNo: '',
  licenseType: 'non_professional',
  licenseExpiry: '',
  licenseFile: null,
  agree: false,
};

/**
 * Reads and logs an API response before parsing it.
 * This helps identify responses that contain PHP errors,
 * HTML, Markdown, or other content instead of JSON.
 */

async function readJsonResponse(
  response: Response,
  endpoint: string,
): Promise<any> {
  const responseText = await response.text();

  console.log(`[${endpoint}] STATUS:`, response.status);
  console.log(
    `[${endpoint}] CONTENT-TYPE:`,
    response.headers.get('content-type'),
  );

  if (!responseText.trim()) {
    throw new Error(`[${endpoint}] The server returned an empty response.`);
  }

  const cleanedText = responseText
    .trim()
    .replace(/^```(?:json|php)?[ \t]*\r?\n?/i, '')
    .replace(/\r?\n?```[ \t]*$/, '')
    .trim();

  try {
    return JSON.parse(cleanedText);
  } catch {
    console.error(`[${endpoint}] Failed to parse the server response as JSON.`);

    throw new Error(
      `[${endpoint}] The server returned invalid JSON. Check the backend response.`,
    );
  }
}


function validateStep(step: number, f: FormState): Record<string, string> {
  const e: Record<string, string> = {};

  if (step === 0) {
    if (!f.fullName.trim() || f.fullName.trim().split(/\s+/).length < 2) {
      e.fullName = 'Enter your complete name.';
    }

    if (!f.idNum.trim()) {
      e.idNum = 'Institutional ID number is required.';
    }

    if (!f.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) {
      e.email = 'Enter a valid email address.';
    }

    if (f.password.length < 8) {
      e.password = 'Password must be at least 8 characters.';
    }

    if (f.password !== f.confirmPwd) {
      e.confirmPwd = 'Passwords do not match.';
    }
  }

  if (step === 1) {
    if (!f.idFile) {
      e.idFile = 'Upload a photo or scan of your school ID.';
    }
  }

  if (step === 2) {
    if (!f.userType) {
      e.userType = 'Select a user type.';
    }

    if (!f.dept) {
      e.dept = 'Department is required.';
    }

    if (!f.contact.trim()) {
      e.contact = 'Contact number is required.';
    }
  }

  if (step === 3) {
    if (f.hasVehicle === null) {
      e.hasVehicle = 'Please choose Yes or No.';
    }

    if (f.hasVehicle === true) {
      if (!f.plate.trim()) {
        e.plate = 'Plate number is required.';
      }

      if (!f.make.trim()) {
        e.make = 'Vehicle make is required.';
      }

      if (!f.model.trim()) {
        e.model = 'Vehicle model is required.';
      }

      if (!f.color.trim()) {
        e.color = 'Vehicle color is required.';
      }

      if (!f.licenseNo.trim()) {
        e.licenseNo = "Driver's license number is required.";
      }

      if (!f.licenseType) {
        e.licenseType = 'License type is required.';
      }

      if (!f.licenseExpiry) {
        e.licenseExpiry = 'License expiry date is required.';
      } else {
        const expiry = new Date(`${f.licenseExpiry}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (expiry < today) {
          e.licenseExpiry = 'This license is already expired.';
        }
      }

      if (!f.licenseFile) {
        e.licenseFile = "Upload a photo or scan of your driver's license.";
      }
    }
  }

  return e;
}

export default function RegistrationForm({
  variant = 'web',
  onBackToLogin,
  onExit,
}: {
  variant?: 'web' | 'mobile';
  onBackToLogin: () => void;
  onExit?: () => void;
}) {
  const m = variant === 'mobile';

  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [emailVerificationSent, setEmailVerificationSent] =
    useState<boolean | null>(null);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [departmentsError, setDepartmentsError] = useState('');

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        setDepartmentsLoading(true);
        setDepartmentsError('');

        const response = await fetch('/api/departments', {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        const result = await readJsonResponse(response, 'DEPARTMENTS');

        if (!response.ok) {
          throw new Error(
            result?.message ||
              `Unable to load departments. HTTP ${response.status}.`,
          );
        }

        if (!result) {
          throw new Error(
            'The departments API returned invalid JSON. Check the browser Console.',
          );
        }

        const departmentData = Array.isArray(result)
          ? result
          : result.data;

        if (!Array.isArray(departmentData)) {
          console.error('UNEXPECTED DEPARTMENT DATA:', result);

          throw new Error('Invalid department data received.');
        }

        setDepartments(departmentData);
      } catch (error) {
        console.error('LOAD DEPARTMENTS ERROR:', error);

        setDepartmentsError(
          error instanceof Error
            ? error.message
            : 'Unable to load departments. Please try again.',
        );
      } finally {
        setDepartmentsLoading(false);
      }
    };

    void loadDepartments();
  }, []);

  const last = REGISTRATION_STEPS.length - 1;

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(f => ({ ...f, [key]: val }));

    if (errors[key as string]) {
      setErrors(e => {
        const n = { ...e };
        delete n[key as string];
        return n;
      });
    }

    if (submitError) {
      setSubmitError('');
    }
  };

  const next = () => {
    const e = validateStep(step, form);
    setErrors(e);

    if (Object.keys(e).length === 0) {
      setStep(s => Math.min(s + 1, last));
      setSubmitError('');
    }
  };

  const prev = () => {
    setErrors({});

    if (step === 0) {
      onExit?.();
    } else {
      setStep(s => s - 1);
    }
  };

  const inputCls = (key: string, extra = '') =>
    `w-full border ${
      errors[key] ? 'border-red-400' : 'border-slate-200'
    } rounded-xl px-4 ${
      m ? 'py-3.5' : 'py-3'
    } text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB] bg-white ${extra}`;

  const labelCls = 'text-sm font-medium text-slate-700 block mb-1.5';

  const err = (key: string) =>
    errors[key] && (
      <p className="text-xs text-red-500 mt-1">{errors[key]}</p>
    );

  const choiceCls = (on: boolean) =>
    `py-3 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
      on
        ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
        : 'border-slate-200 text-slate-500 hover:border-blue-200'
    }`;

  const text = (
    label: string,
    key: keyof FormState,
    placeholder: string,
    type = 'text',
  ) => (
    <div key={key as string}>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        value={form[key] as string}
        onChange={e => set(key, e.target.value as never)}
        placeholder={placeholder}
        className={inputCls(key as string)}
      />
      {err(key as string)}
    </div>
  );

  const fileField = (
    label: string,
    field: 'idFile' | 'licenseFile',
  ) => (
    <FileUpload
      label={label}
      file={form[field]}
      error={errors[field]}
      onChange={f => set(field, f as never)}
      onError={msg => setErrors(e => ({ ...e, [field]: msg }))}
    />
  );

  const submitRegistration = async () => {
    if (!form.agree || isSubmitting) {
      return;
    }

    const allErrors = {
      ...validateStep(0, form),
      ...validateStep(1, form),
      ...validateStep(2, form),
      ...validateStep(3, form),
    };

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);

      const firstInvalidStep = [0, 1, 2, 3].find(s => {
        return Object.keys(validateStep(s, form)).length > 0;
      });

      if (firstInvalidStep !== undefined) {
        setStep(firstInvalidStep);
      }

      setSubmitError(
        'Please correct the highlighted information before submitting.',
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    setErrors({});

    try {
      const data = new FormData();

      data.append('full_name', form.fullName.trim());
      data.append('user_code', form.idNum.trim());
      data.append('email', form.email.trim());
      data.append('password', form.password);
      data.append('password_confirmation', form.confirmPwd);
      data.append('user_type', form.userType);
      data.append('department', form.dept);
      data.append('contact_number', form.contact.trim());
      data.append('has_vehicle', form.hasVehicle ? '1' : '0');

      if (form.idFile) {
        data.append('school_id_file', form.idFile);
      }

      if (form.hasVehicle) {
        data.append('vehicle_type', form.vehicleType);
        data.append('plate_number', form.plate.trim().toUpperCase());
        data.append('make', form.make.trim());
        data.append('model', form.model.trim());
        data.append('color', form.color.trim());
        data.append('license_number', form.licenseNo.trim());
        data.append('license_type', form.licenseType);
        data.append('license_expiry', form.licenseExpiry);

        if (form.licenseFile) {
          data.append('license_file', form.licenseFile);
        }
      }

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: data,
      });

      const result = await readJsonResponse(response, 'REGISTRATION');

      if (!response.ok) {
        if (result?.errors) {
          const messages = Object.values(
            result.errors as Record<string, string[]>,
          ).flat();

          throw new Error(
            messages.join(' ') ||
              result.message ||
              'Please check your registration details.',
          );
        }

        throw new Error(
          result?.message ||
            `Registration failed. HTTP ${response.status}. Check the Console for the server response.`,
        );
      }

      if (!result) {
        throw new Error(
          'The registration API returned invalid JSON. Check the browser Console.',
        );
      }

      setEmailVerificationSent(result.email_verification_sent === true);
      setResendMessage('');
      setResendError('');
      setSubmitted(true);
    } catch (error) {
      console.error('REGISTRATION ERROR:', error);

      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to submit registration. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (isResendingVerification) {
      return;
    }

    setIsResendingVerification(true);
    setResendMessage('');
    setResendError('');

    try {
      const response = await fetch('/api/email/verification-notification', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email.trim(),
        }),
      });

      const result = await readJsonResponse(
        response,
        'RESEND VERIFICATION EMAIL',
      );

      if (!response.ok) {
        throw new Error(
          result?.message ||
            `Unable to resend the verification email. HTTP ${response.status}.`,
        );
      }

      if (!result) {
        throw new Error(
          'The email verification API returned invalid JSON. Check the browser Console.',
        );
      }

      setResendMessage(
        result.message ||
          'If your account exists and is not yet verified, a verification email will be sent.',
      );
    } catch (error) {
      console.error('RESEND VERIFICATION ERROR:', error);

      setResendError(
        error instanceof Error
          ? error.message
          : 'Unable to connect to PASS. Please try again.',
      );
    } finally {
      setIsResendingVerification(false);
    }
  };

  if (submitted) {
    return (
      <div
        className={`text-center ${
          m
            ? 'px-6 py-12 flex flex-col items-center justify-center min-h-full'
            : 'py-4'
        }`}
      >
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Check size={36} className="text-green-600" />
        </div>

        <h2 className="text-2xl font-bold text-[#080677] mb-3">
          Registration Submitted!
        </h2>

        {emailVerificationSent ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
            A verification email was sent to {form.email.trim()}. Please check
            your inbox and spam folder.
          </p>
        ) : (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            Your registration was submitted, but we could not confirm that the
            verification email was sent. You can request another email below.
          </p>
        )}

        <div className="mb-5 w-full">
          <button
            type="button"
            onClick={resendVerificationEmail}
            disabled={isResendingVerification}
            className="w-full py-3 border border-[#2563EB] text-[#2563EB] font-semibold rounded-xl hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isResendingVerification
              ? 'Sending...'
              : 'Resend Verification Email'}
          </button>

          {resendMessage && (
            <p role="status" className="text-sm text-green-700 mt-3">
              {resendMessage}
            </p>
          )}

          {resendError && (
            <p role="alert" className="text-sm text-red-600 mt-3">
              {resendError}
            </p>
          )}
        </div>

        <p className="text-slate-500 mb-2">
          Your account is pending review by the PASS administrator.
        </p>

        {form.hasVehicle ? (
          <p className="text-sm text-slate-400 mb-2">
            Your vehicle and driver's license will be reviewed separately. No
            RFID is issued until the vehicle is authorized.
          </p>
        ) : (
          <p className="text-sm text-slate-400 mb-2">
            You can add a vehicle later from <strong>My Vehicle</strong> once
            your account is approved.
          </p>
        )}

        <button
          type="button"
          onClick={onBackToLogin}
          className="w-full py-3 bg-[#2563EB] text-white font-semibold rounded-xl hover:bg-[#1D4ED8] transition-colors"
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  const progress = m ? (
    <div className="mb-6">
      <p className="text-slate-400 text-sm mb-2">
        Step {step + 1} of {REGISTRATION_STEPS.length} Â·{' '}
        <span className="text-[#080677] font-medium">
          {REGISTRATION_STEPS[step]}
        </span>
      </p>

      <div className="flex gap-1.5">
        {REGISTRATION_STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${
              i <= step ? 'bg-[#2563EB]' : 'bg-slate-100'
            }`}
          />
        ))}
      </div>
    </div>
  ) : (
    <div className="flex items-center justify-center mb-8 px-2">
      {REGISTRATION_STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                i < step
                  ? 'bg-green-500 border-green-500 text-white'
                  : i === step
                    ? 'bg-[#2563EB] border-[#2563EB] text-white'
                    : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              {i < step ? <Check size={16} /> : i + 1}
            </div>

            <span
              className={`text-[10px] mt-1 font-medium whitespace-nowrap hidden sm:block ${
                i === step ? 'text-[#2563EB]' : 'text-slate-400'
              }`}
            >
              {s}
            </span>
          </div>

          {i < REGISTRATION_STEPS.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-2 ${
                i < step ? 'bg-green-500' : 'bg-slate-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const h = (icon: React.ReactNode, title: string) => (
    <h2 className="font-semibold text-[#080677] text-lg flex items-center gap-2">
      {icon} {title}
    </h2>
  );

  const reviewRows: { label: string; value: string }[] = [
    { label: 'Full Name', value: form.fullName },
    { label: 'ID Number', value: form.idNum },
    { label: 'Email', value: form.email },
    { label: 'School ID Upload', value: form.idFile?.name ?? '' },
    {
      label: 'User Type',
      value:
        USER_TYPES.find(t => t.value === form.userType)?.label ??
        form.userType,
    },
    { label: 'Department', value: form.dept },
    { label: 'Contact', value: form.contact },
    ...(form.hasVehicle
      ? [
          {
            label: 'Vehicle',
            value: `${form.vehicleType} â€” ${form.make} ${form.model}, ${form.color}`,
          },
          { label: 'Plate Number', value: form.plate.toUpperCase() },
          { label: "Driver's License No.", value: form.licenseNo },
          {
            label: 'License Type',
            value:
              LICENSE_TYPES.find(t => t.value === form.licenseType)?.label ??
              form.licenseType,
          },
          { label: 'License Expiry', value: form.licenseExpiry },
          { label: 'License Upload', value: form.licenseFile?.name ?? '' },
        ]
      : [{ label: 'Vehicle', value: 'None to register now' }]),
  ];

  return (
    <div>
      {progress}

      <div className="space-y-5">
        {step === 0 && (
          <>
            {h(<User size={18} />, 'Account Information')}

            {text('Full Name', 'fullName', 'Juan dela Cruz')}
            {text('Institutional ID Number', 'idNum', '2024-00001')}
            {text('Email Address', 'email', 'juan@university.edu', 'email')}

            <div>
              <label className={labelCls}>Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Minimum 8 characters"
                  className={inputCls('password', 'pr-12')}
                />

                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {err('password')}
            </div>

            <div>
              <label className={labelCls}>Confirm Password</label>
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.confirmPwd}
                onChange={e => set('confirmPwd', e.target.value)}
                placeholder="Repeat password"
                className={inputCls('confirmPwd')}
              />
              {err('confirmPwd')}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            {h(<IdCard size={18} />, 'Identity Verification')}

            <p className="text-sm text-slate-500">
              Upload a clear photo or scan of your school ID. The administrator
              uses it to confirm your affiliation with DYCI.
            </p>

            {fileField('School ID (front)', 'idFile')}
          </>
        )}

        {step === 2 && (
          <>
            {h(<Briefcase size={18} />, 'User Details')}

            <div>
              <label className={labelCls}>User Type</label>

              <div className="grid grid-cols-2 gap-3">
                {USER_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => set('userType', t.value)}
                    className={choiceCls(form.userType === t.value)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {err('userType')}
            </div>

            <div>
              <label className={labelCls}>Department / College</label>

              <select
                value={form.dept}
                onChange={e => set('dept', e.target.value)}
                className={inputCls('dept')}
                disabled={departmentsLoading || departmentsError !== ''}
              >
                <option value="">
                  {departmentsLoading
                    ? 'Loading departments...'
                    : departmentsError
                      ? 'Departments unavailable'
                      : 'Select department'}
                </option>

                {departments.map(department => (
                  <option
                    key={department.department_id}
                    value={department.department_name}
                  >
                    {department.department_name}
                  </option>
                ))}
              </select>

              {departmentsError && (
                <p role="alert" className="text-xs text-red-500 mt-1">
                  {departmentsError}
                </p>
              )}

              {err('dept')}
            </div>

            {text('Contact Number', 'contact', '09XX XXX XXXX', 'tel')}
          </>
        )}

        {step === 3 && (
          <>
            {h(<Car size={18} />, 'Vehicle (optional)')}

            <div>
              <label className={labelCls}>
                Do you have a vehicle to register?
              </label>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => set('hasVehicle', true)}
                  className={choiceCls(form.hasVehicle === true)}
                >
                  Yes
                </button>

                <button
                  type="button"
                  onClick={() => set('hasVehicle', false)}
                  className={choiceCls(form.hasVehicle === false)}
                >
                  No, not now
                </button>
              </div>

              {err('hasVehicle')}

              {form.hasVehicle === false && (
                <p className="text-xs text-slate-500 mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  No problem. You can still submit your account registration.
                  Once your account is approved, you can register a vehicle
                  later under My Vehicle.
                </p>
              )}
            </div>

            {form.hasVehicle === true && (
              <>
                <div>
                  <label className={labelCls}>Vehicle Type</label>

                  <div className="grid grid-cols-3 gap-2">
                    {VEHICLE_TYPES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => set('vehicleType', t)}
                        className={`py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          form.vehicleType === t
                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                            : 'border-slate-200 text-slate-500 hover:border-blue-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {text('Plate Number', 'plate', 'ABC-1234')}
                {text('Make (Brand)', 'make', 'Toyota, Honda, Mitsubishi...')}
                {text('Model', 'model', 'Vios, Civic, Mirage...')}
                {text('Color', 'color', 'White, Silver, Black...')}

                <div className="pt-2 border-t border-slate-100">
                  <p className="text-sm font-semibold text-[#080677] mt-4 mb-3">
                    Driver's License
                  </p>

                  <div className="space-y-5">
                    {text('License Number', 'licenseNo', 'N01-23-456789')}

                    <div>
                      <label className={labelCls}>License Type</label>

                      <select
                        value={form.licenseType}
                        onChange={e => set('licenseType', e.target.value)}
                        className={inputCls('licenseType')}
                      >
                        {LICENSE_TYPES.map(t => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>

                      {err('licenseType')}
                    </div>

                    {text('Expiry Date', 'licenseExpiry', '', 'date')}
                    {fileField("Driver's License (front)", 'licenseFile')}
                    
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            {h(<Check size={18} />, 'Review & Confirm')}

            <div className="space-y-1">
              {reviewRows.map(r => (
                <div
                  key={r.label}
                  className="flex justify-between gap-4 py-2 border-b border-slate-50 text-sm"
                >
                  <span className="text-slate-400 font-medium shrink-0">
                    {r.label}
                  </span>

                  <span className="text-slate-700 font-semibold text-right break-all">
                    {r.value || 'â€”'}
                  </span>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.agree}
                onChange={e => set('agree', e.target.checked)}
                className="mt-1 rounded"
              />

              <span>
                I agree to the PASS{' '}
                <span className="text-[#2563EB]">Terms and Conditions</span>{' '}
                and{' '}
                <span className="text-[#2563EB]">Privacy Notice</span>. I
                certify that all information and documents provided are
                accurate.
              </span>
            </label>

            {!form.agree && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-xl">
                <AlertCircle size={14} />
                Please agree to the terms to submit your registration.
              </div>
            )}
          </>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-8">
        {(step > 0 || onExit) && (
          <button
            type="button"
            onClick={prev}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}

        <div className="flex-1" />

        {step < last ? (
          <button
            type="button"
            onClick={next}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] transition-colors text-sm"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submitRegistration}
            disabled={!form.agree || isSubmitting}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
          >
            <Check size={16} />
            {isSubmitting ? 'Submitting...' : 'Submit Registration'}
          </button>
        )}
      </div>
    </div>
  );
}
