import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function Donation() {
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);

  // Mock PIX payload generator (Structure is correct, but keys are dummy)
  const generatePix = (val: string) => {
    return `00020126580014BR.GOV.BCB.PIX0136123e4567-e89b-12d3-a456-426614174000520400005303986540${Number(val).toFixed(2)}5802BR5913VolleyManager6008Brasilia62070503***6304ABCD`;
  };

  const pixCode = amount ? generatePix(amount) : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Support the Team</h2>
      <p className="text-slate-500 text-sm mb-6">Enter an amount to generate a PIX QR Code.</p>

      <div className="relative max-w-xs mx-auto mb-6">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">R$</span>
        <input 
          type="number" 
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pl-12 pr-4 text-2xl font-bold text-slate-800 focus:ring-2 focus:ring-green-500 outline-none"
          placeholder="0.00"
        />
      </div>

      {amount && Number(amount) > 0 && (
        <div className="space-y-4 animate-fade-in">
          <div className="w-48 h-48 bg-slate-900 mx-auto rounded-xl flex items-center justify-center text-white text-xs">
            [ QR CODE PLACEHOLDER ]
          </div>
          
          <div className="bg-slate-100 p-3 rounded-lg flex items-center justify-between gap-2 text-left">
            <div className="font-mono text-xs text-slate-500 truncate flex-1">
              {pixCode}
            </div>
            <button onClick={handleCopy} className="text-blue-600 hover:text-blue-700">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
          </div>
          <p className="text-xs text-slate-400">Copy the code above and pay via your banking app.</p>
        </div>
      )}
    </div>
  );
}
