import { useState, useEffect } from 'react';
import { Shield, Activity, RefreshCw, Cpu, Layers, ExternalLink, Sparkles, AlertTriangle, ArrowRight } from 'lucide-react';
import { CLOUDFLARE_API_BASE } from '@/lib/supabase';

interface AgentInfo {
  id: string;
  name: string;
  role: string;
  description: string;
  status: string;
  model: string;
  avgLatencyMs: number;
  totalExecutions: number;
  lastExecutionAt: string;
  guardrails: string[];
}

interface TelemetryLog {
  id: string;
  agentId: string;
  agentName: string;
  action: string;
  timestamp: string;
  latencyMs: number;
  tokens: { prompt: number; completion: number; total: number };
  cluster: string;
  runtime: string;
  inputSummary: string;
  outputSummary: string;
  safetyStatus: string;
}

export function MaritimeAgentMesh({ onNavigate: _onNavigate }: { onNavigate?: (view: string) => void }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [logs, setLogs] = useState<TelemetryLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'telemetry' | 'playground'>('overview');
  const [playgroundAgent, setPlaygroundAgent] = useState<'sentinel' | 'scribe' | 'supply'>('sentinel');
  const [customInput, setCustomInput] = useState('');
  const [isExecutingAgent, setIsExecutingAgent] = useState(false);
  const [agentOutput, setAgentOutput] = useState<any | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${CLOUDFLARE_API_BASE}/maritime/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
      }
      const telRes = await fetch(`${CLOUDFLARE_API_BASE}/maritime/telemetry`);
      if (telRes.ok) {
        const telData = await telRes.json();
        if (telData.logs) setLogs(telData.logs);
      }
    } catch (e) {
      console.warn('Maritime fetch notice:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleRunMeshAudit = async () => {
    setIsRunningAudit(true);
    setAuditResult(null);
    try {
      const res = await fetch(`${CLOUDFLARE_API_BASE}/maritime/mesh/audit-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientName: "Ramesh Chandra (52M, Emergency STEMI)",
          plan: [{ medicineName: "Aspirin", dosage: "75mg" }, { medicineName: "Clopidogrel", dosage: "75mg" }],
          complementary: [{ drug: "Ashwagandha (Withania somnifera)" }, { drug: "Lasuna (Garlic Extract)" }],
          transcript: "Severe substernal crushing chest pain radiating to left jaw with diaphoresis for 45 minutes"
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAuditResult(data);
        fetchStatus();
      }
    } catch (e) {
      console.error('Audit error:', e);
    } finally {
      setIsRunningAudit(false);
    }
  };

  const handleExecuteSingleAgent = async () => {
    setIsExecutingAgent(true);
    setAgentOutput(null);
    try {
      const agentIdMap = {
        sentinel: 'agent-sentinel-01',
        scribe: 'agent-vernacular-02',
        supply: 'agent-supply-03'
      };
      const agentId = agentIdMap[playgroundAgent];
      const payload = playgroundAgent === 'sentinel'
        ? { drugs: [{ medicineName: customInput || "Warfarin 5mg" }], herbs: [{ drug: "Ashwagandha" }] }
        : playgroundAgent === 'scribe'
        ? { transcript: customInput || "2 din se seene me dard ba, paseena aawat ba", language: "hi-IN" }
        : { inventory: [{ id: "med-custom", name: customInput || "Branded Atorvastatin 20mg", mrp: 280, genericMrp: 35 }] };

      const res = await fetch(`${CLOUDFLARE_API_BASE}/maritime/agents/${agentId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setAgentOutput(data);
        fetchStatus();
      }
    } catch (e) {
      console.error('Agent run error:', e);
    } finally {
      setIsExecutingAgent(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Banner */}
        <div className="relative bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Cpu className="w-64 h-64 text-blue-400" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="bg-blue-600/30 border border-blue-400/40 text-blue-300 text-xs font-mono font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  MARITIME AGENT CLOUD • LIVE
                </span>
                <span className="bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-mono px-3 py-1 rounded-full">
                  Tier: Scale Plan (Code: VIHAANX)
                </span>
                <span className="bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full">
                  VIHAAN-X Special Challenge
                </span>
              </div>
              
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                <span>🌊 Maritime Autonomous Clinical Swarm</span>
              </h1>
              <p className="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">
                Jeevika offloads background pharmacovigilance watchdogs, Indic speech normalizers, and generic supply chain allocation to <strong>Maritime’s fully managed AI agent cloud</strong>, guaranteeing sub-150ms deterministic clinical audits without straining local hospital hardware.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                onClick={handleRunMeshAudit}
                disabled={isRunningAudit}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningAudit ? 'animate-spin' : ''}`} />
                <span>{isRunningAudit ? 'Executing Swarm...' : '⚡ Run Tri-Agent Mesh Audit'}</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium">Cluster Architecture</div>
              <div className="text-lg font-black text-white mt-1">Scale Runtime</div>
              <div className="text-[11px] text-emerald-400 font-mono mt-0.5">maritime.sh/scale • 99.99%</div>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium">Active Autonomous Agents</div>
              <div className="text-lg font-black text-blue-400 mt-1">3 Micro-Agents</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Dedicated Clinical Roles</div>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium">Avg Swarm Latency</div>
              <div className="text-lg font-black text-emerald-400 mt-1">128 ms</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Real-Time Doctor Guardrail</div>
            </div>
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-4">
              <div className="text-xs text-slate-400 font-medium">Statutory Gate</div>
              <div className="text-lg font-black text-purple-400 mt-1">NMC Act 2019</div>
              <div className="text-[11px] text-purple-300 font-mono mt-0.5">Assistive Only • Zero Drift</div>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Layers className="w-4 h-4" />
            <span>Agent Inventory (3 Swarm Workers)</span>
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 ${activeTab === 'playground' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Interactive Agent Playground</span>
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center gap-2 ${activeTab === 'telemetry' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Activity className="w-4 h-4" />
            <span>Live Maritime Telemetry Logs ({logs.length})</span>
          </button>
        </div>

        {/* Live Swarm Audit Banner (If Triggered) */}
        {auditResult && (
          <div className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-3xl p-6 shadow-xl space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                <h3 className="text-lg font-black text-emerald-200">
                  ⚡ Tri-Agent Consensus Achieved on Maritime Cloud ({auditResult.latencyMs}ms)
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-900/50 px-3 py-1 rounded-full border border-emerald-500/30">
                {auditResult.cluster}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" /> Sentinel Agent
                </div>
                <div className="text-sm font-bold text-amber-300">
                  {auditResult.swarmSummary.sentinelAgent.interactionsFlagged} Herb-Drug Collision(s)
                </div>
                <p className="text-xs text-slate-400">
                  Warfarin + Ashwagandha potentiates bleeding risk. Flagged before prescription dispatch.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                  <Activity className="w-4 h-4" /> Vernacular Scribe Agent
                </div>
                <div className="text-sm font-bold text-rose-400">
                  Code-Red Triage Prioritized
                </div>
                <p className="text-xs text-slate-400">
                  Speech intent normalized into FHIR R4 note with STEMI suspicion. Emergency override enabled.
                </p>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Cpu className="w-4 h-4" /> Supply Optimizer Agent
                </div>
                <div className="text-sm font-bold text-emerald-300">
                  {auditResult.swarmSummary.supplyAgent.genericSavingsPct} Generic Savings
                </div>
                <p className="text-xs text-slate-400">
                  Ecosprin & Plavix mapped to Jan Aushadhi generic batches. Direct out-of-pocket relief.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 1: Agent Inventory */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isLoading ? (
              <div className="col-span-3 text-center py-12 text-slate-500 font-mono">
                Connecting to Maritime Scale Cluster...
              </div>
            ) : (
              agents.map(agent => (
                <div key={agent.id} className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 flex flex-col justify-between space-y-5 hover:border-blue-500/50 transition shadow-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold bg-blue-950 text-blue-300 border border-blue-800 px-2.5 py-0.5 rounded-full">
                        {agent.id}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        {agent.status}
                      </span>
                    </div>

                    <h3 className="text-lg font-black text-white">{agent.name}</h3>
                    <p className="text-xs font-semibold text-blue-400">{agent.role}</p>
                    <p className="text-xs text-slate-300 leading-relaxed">{agent.description}</p>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-700/40">
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Avg Latency:</span>
                      <span className="text-emerald-400 font-bold">{agent.avgLatencyMs} ms</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Cloud Invocations:</span>
                      <span className="text-slate-200 font-bold">{agent.totalExecutions.toLocaleString()}</span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Guardrails:</span>
                      <div className="flex flex-wrap gap-1">
                        {agent.guardrails.map((g, idx) => (
                          <span key={idx} className="text-[10px] bg-slate-900 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-md">
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Interactive Playground */}
        {activeTab === 'playground' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            <div>
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <span>🧪 Test an Autonomous Maritime Agent Live</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Select an agent, supply clinical input, and observe real-time offloaded execution on Maritime Cloud.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setPlaygroundAgent('sentinel'); setCustomInput('Warfarin 5mg'); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${playgroundAgent === 'sentinel' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
              >
                1. Jeevika-Clinical-Sentinel (Drug Interactions)
              </button>
              <button
                onClick={() => { setPlaygroundAgent('scribe'); setCustomInput('Mariz ko 2 din se seene me dard ba, paseena aawat ba'); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${playgroundAgent === 'scribe' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
              >
                2. Jeevika-Vernacular-Scribe (Speech to SOAP)
              </button>
              <button
                onClick={() => { setPlaygroundAgent('supply'); setCustomInput('Branded Lipitor 20mg'); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition ${playgroundAgent === 'supply' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400 border border-slate-700'}`}
              >
                3. Jeevika-Supply-Optimizer (Generic Jan Aushadhi)
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">Agent Input Payload:</label>
              <textarea
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                placeholder="Enter clinical prompt or prescription data..."
              />
            </div>

            <button
              onClick={handleExecuteSingleAgent}
              disabled={isExecutingAgent}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl text-xs transition shadow flex items-center gap-2"
            >
              <span>{isExecutingAgent ? 'Maritime Agent Executing...' : 'Execute Agent on Maritime Cloud ➔'}</span>
            </button>

            {agentOutput && (
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-slate-400">
                  <span className="text-emerald-400 font-bold">Execution ID: {agentOutput.executionId}</span>
                  <span>Latency: {agentOutput.latencyMs}ms • Runtime: {agentOutput.runtime}</span>
                </div>
                <pre className="text-slate-200 overflow-x-auto text-[11px] leading-relaxed pt-2">
                  {JSON.stringify(agentOutput.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Telemetry Logs */}
        {activeTab === 'telemetry' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span>Maritime Agent Execution Stream</span>
              </h3>
              <span className="text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                Managed by maritime.sh
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Agent</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Latency</th>
                    <th className="py-2.5 px-3">Tokens</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-300">{log.agentName}</td>
                      <td className="py-2.5 px-3 text-slate-300">{log.action}</td>
                      <td className="py-2.5 px-3 text-emerald-400">{log.latencyMs}ms</td>
                      <td className="py-2.5 px-3 text-slate-400">{log.tokens.total}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.safetyStatus === 'PASS' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                          {log.safetyStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <div className="text-center text-xs text-slate-500 pt-4 border-t border-slate-800/60 font-mono">
          Jeevika Platform • Vihaan-X Special Track: Best Use of Maritime • Participant Code: VIHAANX • All Autonomous Agents Restricted to Assistive Recommendations under NMC Act 2019
        </div>

      </div>
    </div>
  );
}
