import { ConsentLockIcon } from "./shared";

export function PatientAccessNotice() {
  return (
    <div className="flex max-w-[440px] items-center gap-3.5 rounded-2xl border border-[#E4E3D8] bg-[#FDFBF6]/95 px-4 py-3 shadow-[0_2px_10px_rgba(14,36,32,0.04)] backdrop-blur-xs">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#E7F2E8] text-[#047C61]">
        <ConsentLockIcon className="size-5" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-[13px] font-bold leading-snug text-[#0E2420]">
          Patient features unlock after sign-in.
        </p>
        <p className="mt-0.5 text-[12px] leading-snug text-[#4B5D57]">
          Sign in to access records, care journey, and personalized tools.
        </p>
      </div>
    </div>
  );
}
