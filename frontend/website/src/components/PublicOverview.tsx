import { Link } from "react-router-dom";
import {
  ArrowRight,
  ShieldCheck,
  Heart,
  Stethoscope,
  Home as HomeIcon,
  UserCheck,
  Activity,
  Package,
  Building2,
  Sparkles,
  Lock,
  CheckCircle2,
  ChevronRight
} from "lucide-react";

export function PublicOverview() {
  return (
    <main id="public-main" tabIndex={-1} className="w-full pb-20 focus:outline-none">
      {/* ───────────────────────────────────────────────────────────
          1. HERO SECTION (Exact Reference Visuals & Styling)
         ─────────────────────────────────────────────────────────── */}
      <section className="relative w-full overflow-hidden bg-[#FAF8F5] pt-8 pb-16 lg:py-20 border-b border-[#EAE6DF]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Copy & Actions */}
            <div className="lg:col-span-6 space-y-6 max-w-2xl">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F3ECD9]/90 border border-[#EEE6D2] text-xs font-semibold text-[#485C50] shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[#087F72] animate-pulse" />
                <span>A more connected kind of care</span>
              </div>

              {/* Bold Headline matching reference */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#182724] leading-[1.12]">
                Healthcare, <br />
                finally <span className="text-[#087F72] font-serif italic font-medium">connected.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-[#536159] leading-relaxed max-w-xl">
                One continuous journey from first symptom to recovery. Built for patients, care teams, and everyone in between.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/kiosk"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#087F72] hover:bg-[#06695F] text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  <span>Explore Jeevika</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#ds-platform"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/90 hover:bg-[#F1F5F2] text-[#182724] border border-[#DFE5DA] font-semibold text-sm sm:text-base shadow-sm transition-all"
                >
                  <span>View platform</span>
                </a>
              </div>

              {/* Reassurance Sub-bullet */}
              <div className="flex items-center gap-2 pt-2 text-xs font-medium text-[#5D7364]">
                <ShieldCheck className="w-4 h-4 text-[#087F72]" />
                <span>Built around people. Guided by clinical oversight.</span>
              </div>
            </div>

            {/* Right Column: Reference Hero Artwork with Floating Badges */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto max-w-lg lg:max-w-none rounded-3xl overflow-hidden shadow-2xl border-4 border-white/80 bg-white">
                {/* Master Reference Image */}
                <img
                  src="/assets/design/care-continuum.jpg"
                  alt="An Indian female doctor sharing a warm reassuring moment with a smiling child in a yellow dress and her mother"
                  width="1400"
                  height="933"
                  className="w-full h-auto object-cover object-center transform hover:scale-[1.01] transition-transform duration-500"
                  fetchPriority="high"
                />

                {/* Soft gradient bottom vignette */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/20 via-transparent to-transparent" />

                {/* Floating Badge 1: Prevention (Top Left) */}
                <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/95 backdrop-blur-md border border-white/90 text-[#2B493C] text-xs sm:text-sm font-bold shadow-lg transform -rotate-1 hover:rotate-0 transition-transform">
                  <Heart className="w-4 h-4 text-[#087F72] fill-[#087F72]/20" />
                  <span>Prevention</span>
                </div>

                {/* Floating Badge 2: Consultation (Middle Right) */}
                <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:right-6 flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/95 backdrop-blur-md border border-white/90 text-[#2B493C] text-xs sm:text-sm font-bold shadow-lg transform rotate-1 hover:rotate-0 transition-transform">
                  <Stethoscope className="w-4 h-4 text-[#087F72]" />
                  <span>Consultation</span>
                </div>

                {/* Floating Badge 3: Care Continues (Bottom Left) */}
                <div className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white/95 backdrop-blur-md border border-white/90 text-[#2B493C] text-xs sm:text-sm font-bold shadow-lg">
                  <HomeIcon className="w-4 h-4 text-[#087F72]" />
                  <span>Care continues</span>
                </div>

                {/* Floating Mission Card (Bottom Right) */}
                <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 hidden sm:flex flex-col gap-0.5 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-[#D2E4DA] text-left shadow-xl max-w-[200px]">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F72] flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-[#087F72]" />
                    Shared Mission
                  </span>
                  <span className="font-serif italic text-sm text-[#1A382B] font-semibold leading-tight">
                    Healthier tomorrow, together.
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          2. FOUNDATION 4-METRIC STRIP
         ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 -mt-6 sm:-mt-8 max-w-5xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 sm:p-6 rounded-2xl bg-[#FFFDF6] border border-[#E9E8DA] shadow-lg">
          <div className="flex items-center gap-3.5 sm:border-r border-[#E9E8DA] sm:pr-4">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#256356]">5</span>
            <div className="text-xs text-[#61716B] leading-tight">
              <strong className="block text-[#182724]">Connected</strong> workspaces
            </div>
          </div>
          <div className="flex items-center gap-3.5 md:border-r border-[#E9E8DA] md:pr-4">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#256356]">4</span>
            <div className="text-xs text-[#61716B] leading-tight">
              <strong className="block text-[#182724]">Deterministic</strong> core engines
            </div>
          </div>
          <div className="flex items-center gap-3.5 sm:border-r border-[#E9E8DA] sm:pr-4">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#256356]">5</span>
            <div className="text-xs text-[#61716B] leading-tight">
              <strong className="block text-[#182724]">Intake</strong> language choices
            </div>
          </div>
          <div className="flex items-center gap-3.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#256356] font-serif">One</span>
            <div className="text-xs text-[#61716B] leading-tight">
              <strong className="block text-[#182724]">Continuous</strong> care journey
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          3. HUMAN HEALTHCARE STORIES: SMILING CHILD, CARING DOCTOR, HAPPY RECOVERY
         ─────────────────────────────────────────────────────────── */}
      <section id="ds-journey" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8B6E47] block mb-2">
            Care without the gaps
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#182724] tracking-tight">
            One platform. Every stage of human care.
          </h2>
          <p className="text-[#61716B] text-base mt-3 leading-relaxed">
            Healthcare works best when technology handles the handoffs, leaving clinicians and patients free to build trust.
          </p>
        </div>

        {/* 3 Story Cards with Warm Photos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Story 1: Smiling Child - Welcoming Intake */}
          <div className="group rounded-3xl bg-white border border-[#E3EAE6] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
            <div className="relative h-60 overflow-hidden bg-[#FAF8F5]">
              <img
                src="/assets/design/happy-child-patient.jpg"
                alt="A smiling young Indian girl on a clinic bed receiving reassuring care"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-[#087F72] border border-white">
                01 · A warm welcome
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  A stress-free welcome in your mother tongue
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  Every patient begins with care they can understand. Touchless voice intake, ABHA lookup, and queue tokens eliminate registration stress.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-[#F1F5F2]">
                <Link
                  to="/kiosk"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087F72] hover:text-[#06695F]"
                >
                  <span>Experience patient kiosk</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Story 2: Doctor Talking Warmly with Patient */}
          <div className="group rounded-3xl bg-white border border-[#E3EAE6] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
            <div className="relative h-60 overflow-hidden bg-[#FAF8F5]">
              <img
                src="/assets/design/doctor-patient-consultation.jpg"
                alt="An Indian female doctor talking warmly with an elderly smiling patient across a clinic consultation desk"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-[#087F72] border border-white">
                02 · The patient story
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Clinicians who listen with full context
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  Before the patient sits down, doctors see pre-consult vitals, past encounters, and verified allergies. Decision support works quietly in the background.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-[#F1F5F2]">
                <Link
                  to="/app?view=doctor-consultation"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087F72] hover:text-[#06695F]"
                >
                  <span>Explore OPD consultation</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Story 3: Patient Smiling at Home - Recovery & Continuity */}
          <div className="group rounded-3xl bg-white border border-[#E3EAE6] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col">
            <div className="relative h-60 overflow-hidden bg-[#FAF8F5]">
              <img
                src="/assets/design/patient-recovery-smile.jpg"
                alt="A smiling Indian patient recovering comfortably at home with mobile health tracker"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-bold text-[#087F72] border border-white">
                03 · Care continues
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Relief and follow-up that stays with you
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  Care doesn't end at the clinic door. Verified e-prescriptions, daily recovery check-ins, and preventive alerts protect patient well-being at home.
                </p>
              </div>
              <div className="pt-5 mt-4 border-t border-[#F1F5F2]">
                <Link
                  to="/home/sign-in"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#087F72] hover:text-[#06695F]"
                >
                  <span>Open patient account</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          4. WORKSPACES DIRECTORY ("Where would you like to begin?")
         ─────────────────────────────────────────────────────────── */}
      <section id="ds-workspaces" className="bg-[#FFFDF9] py-20 border-t border-b border-[#EAE6DF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B6E47] block mb-2">
              Your place in the care journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#182724] tracking-tight">
              Where would you like to begin?
            </h2>
            <p className="text-[#61716B] text-base mt-2">
              Choose your portal. Each workspace brings a specialized part of clinical and operational care into focus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. Patient Intake Kiosk */}
            <Link
              to="/kiosk"
              className="group p-6 rounded-3xl bg-white border border-[#E3EAE6] hover:border-[#087F72]/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-[#E6F4EF] text-[#087F72] group-hover:scale-110 transition-transform">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    PORTAL 01
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Patient Intake Kiosk
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  A welcoming first step. Touchless voice intake in 5 Indian languages, ABHA verification, and instant queue tokens.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F1F5F2] flex items-center justify-between text-xs font-bold text-[#087F72]">
                <span>Begin patient intake</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 2. Doctor Consultation */}
            <Link
              to="/app?view=doctor-consultation"
              className="group p-6 rounded-3xl bg-white border border-[#E3EAE6] hover:border-[#087F72]/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-[#E6F4EF] text-[#087F72] group-hover:scale-110 transition-transform">
                    <Stethoscope className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    PORTAL 02
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Doctor Consultation (OPD)
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  Clinician OPD cockpit. Real-time pre-consult vitals, clinical notes, and Sentinel drug-allergy contraindication checks.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F1F5F2] flex items-center justify-between text-xs font-bold text-[#087F72]">
                <span>Open clinician workspace</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 3. Emergency Triage */}
            <Link
              to="/app?view=emergency-triage"
              className="group p-6 rounded-3xl bg-white border border-[#E3EAE6] hover:border-rose-400 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
                    <Activity className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-200">
                    PORTAL 03 · STAT
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#182724] group-hover:text-rose-600 transition-colors">
                  Emergency Triage
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  Clear color-coded priorities when every second matters. Rapid GCS calculation, shock index alerts, and trauma protocol.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F1F5F2] flex items-center justify-between text-xs font-bold text-rose-600">
                <span>Open emergency triage</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 4. Clinic Operations */}
            <Link
              to="/app?view=clinic-admin"
              className="group p-6 rounded-3xl bg-white border border-[#E3EAE6] hover:border-[#087F72]/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-blue-50 text-blue-700 group-hover:scale-110 transition-transform">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                    PORTAL 04
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Clinic Operations & POS
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  Keep dispensary shelves, batch tracking, and counter billing in sync with Rx-to-Shelf automated routing.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F1F5F2] flex items-center justify-between text-xs font-bold text-[#087F72]">
                <span>Open operations</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 5. Headquarters Command */}
            <Link
              to="/app?view=admin"
              className="group p-6 rounded-3xl bg-white border border-[#E3EAE6] hover:border-[#087F72]/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-700 group-hover:scale-110 transition-transform">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200">
                    PORTAL 05
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Headquarters Command
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  A connected view of your entire healthcare network. Monitor clinical drift, patient volume, and quality indicators across facilities.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F1F5F2] flex items-center justify-between text-xs font-bold text-[#087F72]">
                <span>Explore headquarters</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 6. Patient Portal */}
            <Link
              to="/home/sign-in"
              className="group p-6 rounded-3xl bg-white border border-[#E3EAE6] hover:border-[#087F72]/50 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 rounded-2xl bg-[#FAF8F5] text-[#087F72] group-hover:scale-110 transition-transform">
                    <Heart className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    PATIENT PORTAL
                  </span>
                </div>
                <h3 className="text-xl font-bold text-[#182724] group-hover:text-[#087F72] transition-colors">
                  Health Thread & Check-in
                </h3>
                <p className="text-sm text-[#61716B] mt-2 leading-relaxed">
                  View past clinic encounters, active prescriptions, and submit daily symptom check-ins to your doctor from home.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#F1F5F2] flex items-center justify-between text-xs font-bold text-[#087F72]">
                <span>Access patient account</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          5. PLATFORM & ETHICAL SAFETY SECTION
         ─────────────────────────────────────────────────────────── */}
      <section id="ds-safety" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-5 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8B6E47]">
              Technology with care
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#182724] tracking-tight">
              Human decisions. <br />
              Deterministic safety.
            </h2>
            <p className="text-[#61716B] text-base leading-relaxed">
              We believe AI should never make unilateral medical decisions. In JEEVIKA, rule engines execute safety protocols while language models merely translate and format.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E3EAE6] shadow-sm">
              <ShieldCheck className="w-6 h-6 text-[#087F72] mb-3" />
              <h3 className="font-bold text-[#182724] text-base">Clinical Oversight</h3>
              <p className="text-xs text-[#61716B] mt-1.5 leading-relaxed">
                Decision support keeps the clinician fully in the driver's seat. All recommendations require doctor confirmation.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E3EAE6] shadow-sm">
              <Lock className="w-6 h-6 text-[#087F72] mb-3" />
              <h3 className="font-bold text-[#182724] text-base">Zero PHI Leaks</h3>
              <p className="text-xs text-[#61716B] mt-1.5 leading-relaxed">
                A hard redaction gate strips all identifiable names, phones, and identifiers before any text reaches external services.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E3EAE6] shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-[#087F72] mb-3" />
              <h3 className="font-bold text-[#182724] text-base">Consent With Clarity</h3>
              <p className="text-xs text-[#61716B] mt-1.5 leading-relaxed">
                Patients understand exactly what records are shared with their care team, backed by transparent ABDM consent options.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E3EAE6] shadow-sm">
              <Sparkles className="w-6 h-6 text-[#087F72] mb-3" />
              <h3 className="font-bold text-[#182724] text-base">Explainable by Design</h3>
              <p className="text-xs text-[#61716B] mt-1.5 leading-relaxed">
                Every medication alert, triage score, and inventory suggestion has clear audit provenance linked to clinical guidelines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          6. CLOSING CTA BANNER
         ─────────────────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 mb-8">
        <div className="rounded-3xl bg-gradient-to-br from-[#087F72] to-[#05574F] text-white p-8 sm:p-12 text-center shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-xl mx-auto space-y-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#A8E5D3] block">
              From the first hello to the next healthy day
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Let's bring care together.
            </h2>
            <p className="text-white/80 text-sm sm:text-base">
              Experience the unified healthcare operating system designed for human dignity, safety, and continuity.
            </p>
            <div className="pt-4 flex flex-wrap justify-center gap-3">
              <Link
                to="/kiosk"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-[#087F72] font-bold text-sm shadow hover:bg-[#F1F5F2] transition-colors"
              >
                <span>Try patient kiosk</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#06695F] text-white font-bold text-sm border border-white/20 hover:bg-[#05574F] transition-colors"
              >
                <span>Staff login</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
          7. WARM COMPASSIONATE FOOTER
         ─────────────────────────────────────────────────────────── */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 border-t border-[#EAE6DF] text-xs text-[#61716B] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/assets/logo-jeevika.png"
            alt="Jeevika"
            className="h-6 w-auto object-contain"
          />
          <span className="font-bold text-[#182724]">JEEVIKA</span>
          <span>— One thread from first symptom to recovery.</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="hover:text-[#087F72]">Privacy & Consent</Link>
          <Link to="/support" className="hover:text-[#087F72]">Support</Link>
          <a href="#public-main" className="hover:text-[#087F72]">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
