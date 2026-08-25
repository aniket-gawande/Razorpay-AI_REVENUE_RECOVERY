import React, { useState, useEffect } from 'react';

export default function App() {
  const [benchmark, setBenchmark] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [chatMessage, setChatMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchTransactions = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/recovery/transactions');
      const data = await res.json();
      setTransactions(data);
      if (data.length > 0 && !selectedTx) setSelectedTx(data[0]);
    } catch (e) {
      console.error(e);
    }
  };

  const runBenchmark = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/benchmark/run');
      const data = await res.json();
      setBenchmark(data.summary);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const simulateFailure = async () => {
    await fetch('http://localhost:5000/api/webhooks/razorpay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-razorpay-event-id': `evt_${Date.now()}`
      },
      body: JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: `pay_${Math.random().toString(36).substring(7)}`,
              order_id: `order_${Math.random().toString(36).substring(7)}`,
              amount: 349900,
              contact: '+919876543210',
              email: 'shopper@test.com',
              error_code: 'PAYMENT_CANCELLED_BY_USER'
            }
          }
        }
      })
    });
    fetchTransactions();
  };

  const sendAgentMessage = async () => {
    if (!selectedTx || !chatMessage) return;
    setLoading(true);
    try {
      await fetch('http://localhost:5000/api/recovery/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: selectedTx.id, userMessage: chatMessage })
      });
      setChatMessage('');
      fetchTransactions();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      {/* Top Header */}
      <div className="flex justify-between items-center pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Razorpay DunningCore <span className="text-xs bg-blue-900 border border-blue-700 text-blue-300 px-2 py-0.5 rounded">AI Recovery Engine</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Autonomous, bounded payment recovery & compliance supervisor</p>
        </div>
        <div className="flex gap-3">
          <button onClick={simulateFailure} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm font-medium transition">
            + Ingest Payment Failure Webhook
          </button>
          <button onClick={runBenchmark} disabled={loading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm font-medium transition">
            {loading ? 'Running...' : 'Run 100-Case Benchmark'}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {benchmark && (
        <div className="grid grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <div className="text-xs text-slate-400 uppercase font-semibold">GTV At Risk</div>
            <div className="text-2xl font-bold mt-1">₹{benchmark.totalRevenueAtRisk.toLocaleString()}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <div className="text-xs text-slate-400 uppercase font-semibold">Net Recovered</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">₹{benchmark.netRevenueWonBack.toLocaleString()}</div>
            <div className="text-xs text-emerald-500/80 mt-0.5">{benchmark.recoveryRatePercent}% recovery rate</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <div className="text-xs text-slate-400 uppercase font-semibold">Operating Cost</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">₹{benchmark.totalChannelCost}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
            <div className="text-xs text-slate-400 uppercase font-semibold">Economics Gatekeeper</div>
            <div className="text-2xl font-bold text-slate-300 mt-1">{benchmark.blockedByUnitEconomics} Dropped</div>
          </div>
        </div>
      )}

      {/* Main Execution Split */}
      <div className="grid grid-cols-12 gap-6 mt-6">
        {/* Left: Stream */}
        <div className="col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h2 className="text-lg font-semibold mb-4">Transaction Recovery Stream</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                onClick={() => setSelectedTx(tx)}
                className={`p-3 rounded border cursor-pointer transition ${selectedTx?.id === tx.id ? 'bg-slate-800 border-blue-500' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-slate-400">{tx.razorpayOrderId}</span>
                  <span className="font-semibold">₹{(tx.amountInPaisa / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="text-slate-400">{tx.failureCode}</span>
                  <span className="bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded font-mono">
                    {tx.recoveryStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Multi-turn Chat & Audit Trail */}
        <div className="col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">Live Agent Inspection & Multi-Turn Log</h2>
            <div className="bg-slate-950 border border-slate-800 rounded p-4 mb-4 min-h-[220px] max-h-[300px] overflow-y-auto space-y-2 text-xs">
              {selectedTx?.auditLogs?.map((log: any) => (
                <div key={log.id} className="border-b border-slate-900 pb-2">
                  <div className="text-blue-400 font-bold">{log.nodeName} ➔ {log.actionTaken}</div>
                  <div className="text-slate-300 mt-0.5">{log.reasoning}</div>
                </div>
              ))}
            </div>

            <label className="text-xs text-slate-400 block mb-1">Simulate Multi-Turn Customer Response:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="e.g. 'Can you give 40% off?' or 'Will pay on Friday'"
                className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={sendAgentMessage}
                disabled={loading || !chatMessage}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-sm font-medium transition disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}