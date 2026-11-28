import { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  X,
  AlertTriangle,
  FileText,
  Stethoscope,
  Activity,
  Pill,
  ShieldCheck,
  Languages,
} from 'lucide-react';
import type { PrescriptionItem } from './DoctorConsultation';

interface AmbientClinicalScribeProps {
  activePatientName: string;
  isOpen: boolean;
  onClose: () => void;
  onApplyDraft: (draft: {
    subjective: string;
    objective: string;
    assessment: string;
    planItems: PrescriptionItem[];
  }) => void;
}

interface ParsedDraft {
  subjective: string;
  objective: string;
  assessment: string;
  planItems: PrescriptionItem[];
}

type OnDeviceRecognizer = {
  processLocally: boolean;
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type Recognizer = {
  new (): OnDeviceRecognizer;
  available?: (input: { langs: string[]; processLocally: true }) => Promise<string>;
};

export function AmbientClinicalScribe({
  activePatientName,
  isOpen,
  onClose,
  onApplyDraft,
}: AmbientClinicalScribeProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [selectedMeds, setSelectedMeds] = useState<Record<number, boolean>>({});

  const recognitionRef = useRef<OnDeviceRecognizer>();
  const recordingAttempt = useRef(0);
  const [checking, setChecking] = useState(false);
  const [simulation, setSimulation] = useState(false);

  useEffect(() => () => {
    recordingAttempt.current++;
    recognitionRef.current?.abort();
  }, []);

  async function toggleListening() {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const attempt = ++recordingAttempt.current;
    const browser = window as Window & { SpeechRecognition?: Recognizer; webkitSpeechRecognition?: Recognizer };
    const Speech = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    setSpeechError(null);
    setChecking(true);
    try {
      if (!Speech?.available || (await Speech.available({ langs: ["hi-IN"], processLocally: true })) !== "available") {
        throw new Error("On-device speech recognition is unavailable. Type or paste the transcript.");
      }
      if (attempt !== recordingAttempt.current) return;
      recognitionRef.current?.abort();
      const recognition = new Speech();
      if (!("processLocally" in recognition)) {
        throw new Error("On-device speech recognition is unavailable. Type or paste the transcript.");
      }
      recognitionRef.current = recognition;
      recognition.processLocally = true;
      recognition.lang = "hi-IN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = ({ results }) => {
        if (attempt === recordingAttempt.current) {
          setTranscript(Array.from(results, (result) => result[0]?.transcript ?? "").join(" ").trim());
          setSimulation(false);
        }
      };
      recognition.onerror = ({ error }) => {
        if (attempt !== recordingAttempt.current) return;
        setSpeechError(error === "not-allowed" || error === "service-not-allowed"
          ? "Microphone permission denied. Type or paste the transcript."
          : "Speech recognition stopped. Review or type the transcript.");
        setIsListening(false);
      };
      recognition.onend = () => {
        if (attempt === recordingAttempt.current) setIsListening(false);
      };
      recognition.start();
      setIsListening(true);
    } catch (error) {
      if (attempt !== recordingAttempt.current) return;
      setSpeechError(error instanceof Error ? error.message : "Microphone unavailable.");
      setIsListening(false);
    } finally {
      if (attempt === recordingAttempt.current) setChecking(false);
    }
  }

  // Dynamic Rule-Based Clinical Parser
  const parseClinicalTranscript = (text: string): ParsedDraft => {
    if (!text.trim()) {
      return {
        subjective: '',
        objective: '',
        assessment: '',
        planItems: [],
      };
    }

    const lower = text.toLowerCase();

    // 1. Objective Vitals Parsing
    let bp = '';
    const bpMatch = text.match(/(?:bp|blood pressure|pressure)\s*(?:is|was|around|of)?\s*(\d{2,3})[\s/]+(\d{2,3})/i) ||
                    text.match(/(\d{2,3})\s*over\s*(\d{2,3})/i);
    if (bpMatch) {
      bp = `BP: ${bpMatch[1]}/${bpMatch[2]} mmHg`;
    }

    let pulse = '';
    const pulseMatch = text.match(/(?:pulse|heart rate|hr|rate)\s*(?:is|of)?\s*(\d{2,3})/i);
    if (pulseMatch) {
      pulse = `Pulse: ${pulseMatch[1]} bpm (Regular)`;
    }

    let spo2 = '';
    const spo2Match = text.match(/(?:spo2|oxygen|saturation)\s*(?:is|of)?\s*(\d{2,3})%?/i);
    if (spo2Match) {
      spo2 = `SpO2: ${spo2Match[1]}% on room air`;
    }

    let temp = '';
    const tempMatch = text.match(/(?:temp|temperature|fever)\s*(?:is|of)?\s*(\d{2,3}(?:\.\d)?)\s*(?:f|c)?/i);
    if (tempMatch) {
      temp = `Temperature: ${tempMatch[1]}°F`;
    }

    const vitalsList = [bp, pulse, spo2, temp].filter(Boolean);
    const objectiveText = vitalsList.length > 0
      ? vitalsList.join(' • ') + ' • Systemic cardiovascular & chest auscultation conducted.'
      : 'Vitals stable on physical examination. Bilateral air entry clear, S1/S2 heard.';

    // 2. Subjective Chief Complaints & Duration
    let subjectiveText = '';
    if (lower.includes('chest pain') || lower.includes('seene') || lower.includes('chhati') || lower.includes('angina')) {
      subjectiveText = `Patient presents with acute retrosternal chest pain and heavy pressure radiating to left shoulder/arm. Associated with diaphoresis (cold sweats) and mild dyspnea on exertion. Verbatim doctor-patient intake captured.`;
    } else if (lower.includes('knee') || lower.includes('joint') || lower.includes('ghutne')) {
      subjectiveText = `Patient reports bilateral knee joint achiness, morning stiffness, and difficulty walking or squatting for several months. Aggravated by weight-bearing.`;
    } else if (lower.includes('acidity') || lower.includes('gas') || lower.includes('pet me jalan') || lower.includes('heartburn')) {
      subjectiveText = `Patient complains of burning epigastric discomfort, retrosternal acidity, and postprandial fullness for past 2-3 weeks. No black stools or hematemesis.`;
    } else if (lower.includes('fever') || lower.includes('bukhar') || lower.includes('chills')) {
      subjectiveText = `Patient presents with acute febrile illness, generalized body ache, chills, and mild dry cough for past 3 days.`;
    } else {
      subjectiveText = `Verbatim consultation transcription: "${text.trim()}". Clinical evaluation for presenting complaints.`;
    }

    // 3. Clinical Assessment & ICD-11 Mapping
    let assessmentText = '';
    if (lower.includes('chest pain') || lower.includes('seene') || lower.includes('heart') || lower.includes('stemi')) {
      assessmentText = `Acute Coronary Syndrome Rule-Out (ICD-11: BA41 / Acute Myocardial Infarction). Urgent 12-Lead ECG & Stat Troponin-I protocol initiated per AHA/ACC 2023 Guidelines.`;
    } else if (lower.includes('knee') || lower.includes('joint') || lower.includes('ghutne')) {
      assessmentText = `Bilateral Knee Osteoarthritis / Degenerative Joint Disease (ICD-11: FA00). Mild functional restriction.`;
    } else if (lower.includes('acidity') || lower.includes('gas') || lower.includes('gerd')) {
      assessmentText = `Gastroesophageal Reflux Disease (GERD) with Non-Ulcer Dyspepsia (ICD-11: DA22).`;
    } else if (lower.includes('fever') || lower.includes('bukhar')) {
      assessmentText = `Acute Viral Syndrome / Pyrexia of Unknown Origin Rule-Out (ICD-11: MG26).`;
    } else {
      assessmentText = `Clinical Evaluation in Progress. Primary Symptom Complex Evaluated per NMC RMP Standards.`;
    }

    // 4. Prescribed Medication Extraction
    const candidateMeds: PrescriptionItem[] = [];

    // Aspirin / Ecosprin
    if (lower.includes('ecosprin') || lower.includes('aspirin') || lower.includes('seene') || lower.includes('chest pain')) {
      candidateMeds.push({
        drug: 'Tab Ecosprin 150mg',
        dosage: '150mg',
        frequency: '1-0-0',
        duration: '30 days',
        instructions: 'After food with full glass of water',
        availableInClinic: true,
        genericName: 'Aspirin (Dispersible)',
        brandName: 'Ecosprin 150 (USV)',
        genericPrice: 12,
        brandPrice: 38,
        isGenericSubstituted: true,
        shelfLocation: 'Rack A-04 (Emergency Cardiac)',
      });
    }

    // Atorvastatin
    if (lower.includes('atorvastatin') || lower.includes('statin') || lower.includes('seene') || lower.includes('chest pain')) {
      candidateMeds.push({
        drug: 'Tab Atorvastatin 40mg',
        dosage: '40mg',
        frequency: '0-0-1',
        duration: '30 days',
        instructions: 'At bedtime after dinner',
        availableInClinic: true,
        genericName: 'Atorvastatin Calcium',
        brandName: 'Atorva 40 (Zydus)',
        genericPrice: 28,
        brandPrice: 195,
        isGenericSubstituted: true,
        shelfLocation: 'Rack B-12 (Lipid Lowering)',
      });
    }

    // Pantoprazole / PPI
    if (lower.includes('pantoprazole') || lower.includes('pantocid') || lower.includes('pan-d') || lower.includes('acidity') || lower.includes('gas') || candidateMeds.length > 0) {
      candidateMeds.push({
        drug: 'Cap Pantoprazole 40mg',
        dosage: '40mg',
        frequency: '1-0-0',
        duration: '15 days',
        instructions: 'Empty stomach 30 mins before breakfast',
        availableInClinic: true,
        genericName: 'Pantoprazole Sodium',
        brandName: 'Pantocid 40 (Sun Pharma)',
        genericPrice: 18,
        brandPrice: 110,
        isGenericSubstituted: true,
        shelfLocation: 'Rack C-02 (Gastroenterology)',
      });
    }

    // Paracetamol / Dolo
    if (lower.includes('dolo') || lower.includes('paracetamol') || lower.includes('fever') || lower.includes('pain') || lower.includes('bukhar') || lower.includes('dard')) {
      candidateMeds.push({
        drug: 'Tab Dolo 650mg',
        dosage: '650mg',
        frequency: '1-0-1',
        duration: '5 days',
        instructions: 'After food (SOS for pain/fever > 100°F)',
        availableInClinic: true,
        genericName: 'Paracetamol',
        brandName: 'Dolo 650 (Micro Labs)',
        genericPrice: 14,
        brandPrice: 34,
        isGenericSubstituted: true,
        shelfLocation: 'Rack A-01 (Analgesics)',
      });
    }

    // Telmisartan (Hypertension)
    if (lower.includes('telmisartan') || lower.includes('telma') || (bpMatch && parseInt(bpMatch[1] ?? '0', 10) >= 140)) {
      candidateMeds.push({
        drug: 'Tab Telmisartan 40mg',
        dosage: '40mg',
        frequency: '1-0-0',
        duration: '30 days',
        instructions: 'Morning after breakfast with water',
        availableInClinic: true,
        genericName: 'Telmisartan',
        brandName: 'Telma 40 (Glenmark)',
        genericPrice: 22,
        brandPrice: 140,
        isGenericSubstituted: true,
        shelfLocation: 'Rack B-08 (Antihypertensive)',
      });
    }

    // Joint care / Shallaki for knee complaints
    if (lower.includes('knee') || lower.includes('ghutne') || lower.includes('shallaki') || lower.includes('joint')) {
      candidateMeds.push({
        drug: 'Tab Shallaki (Boswellia serrata) 500mg',
        dosage: '500mg',
        frequency: '1-0-1',
        duration: '30 days',
        instructions: 'After food with warm water (AYUSH Classical Regimen)',
        availableInClinic: true,
        genericName: 'Shallaki Extract',
        brandName: 'Himalaya Shallaki',
        genericPrice: 85,
        brandPrice: 180,
        isGenericSubstituted: false,
        shelfLocation: 'Rack AY-03 (Ayush Ortho)',
      });
    }

    return {
      subjective: subjectiveText,
      objective: objectiveText,
      assessment: assessmentText,
      planItems: candidateMeds,
    };
  };

  const parsedDraft = simulation ? parseClinicalTranscript(transcript) : {
    subjective: transcript.trim(),
    objective: "",
    assessment: "",
    planItems: [],
  };

  // Initialize selected meds on draft generation
  useEffect(() => {
    const initialSelection: Record<number, boolean> = {};
    parsedDraft.planItems.forEach((_, idx) => {
      initialSelection[idx] = true;
    });
    setSelectedMeds(initialSelection);
  }, [transcript]);

  const handleApply = () => {
    if (simulation || isListening || !transcript.trim()) return;
    onApplyDraft({
      subjective: transcript.trim(),
      objective: "",
      assessment: "",
      planItems: [],
    });
    onClose();
  };

  const loadPreset = (presetText: string) => {
    recordingAttempt.current++;
    recognitionRef.current?.abort();
    setChecking(false);
    setIsListening(false);
    setSimulation(true);
    setTranscript(presetText);
    setSpeechError(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Ambient Clinical Scribe" className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col animate-fadeIn">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${isListening ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-indigo-50 text-indigo-700'}`}>
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-slate-900 text-base leading-tight">
                  Ambient Clinical Scribe & Medical Stenographer
                </h3>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full">
                  On-device transcription
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Clinician review required
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Live Doctor-Patient Consultation Audio Transcription for <span className="font-bold text-slate-800">{activePatientName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-sm p-1.5 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clinical Guardrail & Acoustic Metrics Bar */}
        <div className="bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-xl flex items-center justify-between text-[11px] text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">Review the spoken transcript</span>
            <span>•</span>
            <span>Typed entry is also supported</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Clinical draft
          </span>
        </div>

        {/* Mode Switch & Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => void toggleListening()}
              disabled={checking}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition ${
                isListening
                  ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span>{isListening ? 'Stop Recording' : checking ? 'Checking microphone…' : 'Start Ambient Recording (Mic)'}</span>
            </button>

            {isListening && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl text-[11px] font-mono font-bold border border-rose-200">
                <div className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Listening Live (Hindi / English)...</span>
              </div>
            )}
          </div>

          {/* Quick Simulation Presets */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">Simulation presets</span>
            <button
              onClick={() =>
                loadPreset(
                  'Patient Ramesh reports severe retrosternal chest pain with left shoulder radiation and cold sweats since 2 hours. BP is 150 over 95, pulse 94 regular. Start Tab Ecosprin 150mg once daily after food, Tab Atorvastatin 40mg at bedtime, and Cap Pantoprazole 40mg before breakfast.'
                )
              }
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 rounded-lg text-[10px] font-bold border border-slate-200 transition inline-flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>Acute STEMI (Ramesh)</span>
            </button>
            <button
              onClick={() =>
                loadPreset(
                  'Patient has burning retrosternal acidity, sour belching and gas after meals for 3 weeks. BP is 124 over 82, pulse 76. Start Cap Pantoprazole 40mg daily morning empty stomach and Tab Dolo 650mg SOS for headache.'
                )
              }
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 rounded-lg text-[10px] font-bold border border-slate-200 transition inline-flex items-center gap-1"
            >
              <Activity className="w-3 h-3 text-amber-500" />
              <span>GERD / Acidity</span>
            </button>
          </div>
        </div>

        {speechError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>{speechError}</span>
            </div>
            <button
              onClick={() => setSpeechError(null)}
              className="text-[10px] font-bold text-amber-700 underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Live Audio Transcript Box */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
              <Languages className="w-3.5 h-3.5 text-indigo-600" />
              Live Consultation Audio Transcript (Spoken Text):
            </label>
            {transcript && (
              <button
                onClick={() => { setTranscript(''); setSimulation(false); }}
                className="text-[10px] text-slate-400 hover:text-rose-600 font-bold"
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            rows={2}
            aria-label="Consultation transcript"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Click 'Start Ambient Recording' and speak freely in Hindi or English, or paste consultation dialogue here..."
            className="w-full p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white focus:outline-none transition font-medium"
          />
        </div>

        {/* Extracted Clinical Draft Sections (Scrollable) */}
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          <div className="p-2.5 bg-indigo-50/70 border border-indigo-200/90 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
              <span className="font-bold">{simulation ? "Simulation preview" : "Transcript draft"}</span>
            </div>
            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded font-bold border border-indigo-200 text-indigo-700">
              Draft · Subject to RMP Signature
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Subjective */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-600" />
                <span>Subjective (S) - Chief Complaint</span>
              </div>
              <p className="text-slate-800 font-medium leading-relaxed">
                {parsedDraft.subjective || <span className="text-slate-400 italic">No subjective history extracted yet.</span>}
              </p>
            </div>

            {/* Objective */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Objective (O) - Physical Exam & Vitals</span>
              </div>
              <p className="text-slate-800 font-medium leading-relaxed">
                {parsedDraft.objective || <span className="text-slate-400 italic">No vitals extracted yet.</span>}
              </p>
            </div>
          </div>

          {/* Assessment */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
              <span>Assessment (A) - Clinical Impression & ICD-11</span>
            </div>
            <p className="text-slate-800 font-medium leading-relaxed">
              {parsedDraft.assessment || <span className="text-slate-400 italic">No assessment extracted yet.</span>}
            </p>
          </div>

          {/* Prescribed Medications Draft */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 text-teal-600" />
                <span>Plan (P) - Extracted Medications ({parsedDraft.planItems.length})</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold">Select items to include in prescription</span>
            </div>

            {parsedDraft.planItems.length === 0 ? (
              <p className="text-slate-600 italic py-2">{simulation ? "No medications in this simulation." : "Enter medicines in the prescription planner."}</p>
            ) : (
              <div className="space-y-1.5">
                {parsedDraft.planItems.map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-lg border transition cursor-pointer ${
                      selectedMeds[idx] ? 'bg-white border-teal-400 shadow-xs' : 'bg-slate-100 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedMeds[idx])}
                        onChange={(e) => setSelectedMeds({ ...selectedMeds, [idx]: e.target.checked })}
                        className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
                      />
                      <div>
                        <span className="font-bold text-slate-900">{item.drug}</span>
                        <span className="text-[11px] text-slate-500 ml-2 font-mono">({item.frequency})</span>
                        <div className="text-[10px] text-slate-500">{item.instructions}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded border border-teal-200">
                        ₹{item.genericPrice || 15} Jan Aushadhi
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Regulatory Safeguard Notice */}
        <div className="p-2.5 bg-slate-100 rounded-xl text-[10px] text-slate-600 flex items-center gap-2 border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            {simulation ? "Simulation content cannot be applied to this encounter. Clear the transcript to start a clinical draft."
              : "Review the transcript before applying it to SOAP. Enter measurements, assessment, and orders separately."}
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 font-bold rounded-xl text-xs transition"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!transcript.trim() || simulation || isListening || checking}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Apply Transcript to SOAP</span>
          </button>
        </div>

      </div>
    </div>
  );
}
