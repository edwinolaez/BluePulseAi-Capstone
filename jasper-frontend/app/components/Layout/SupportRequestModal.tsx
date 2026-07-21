"use client";

import { useState } from "react";
import { HelpCircleIcon, MailIcon, PhoneIcon, SendIcon, XIcon } from "./icons";

const STATIONS = [
  "IoT Jasper-A1 (Water quality)",
  "Silt Monitor S-2 (Turbidity)",
  "Slope Sensor SL-4 (Erosion)",
  "Sentinel-2 (Remote Sensing)",
  "Central Station SEC-B4 (Live Sensors)",
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SupportRequestModal({ open, onClose }: Props) {
  const [station, setStation]         = useState(STATIONS[0]);
  const [subject, setSubject]         = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted]     = useState(false);

  if (!open) return null;

  function handleSubmit() {
    if (!subject.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setSubject("");
      setDescription("");
      onClose();
    }, 1500);
  }

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <HelpCircleIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Technical Support</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body — allows modal to fit on short phone screens */}
        <div className="overflow-y-auto flex-1">

        {/* Contact cards */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <MailIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Dispatch Desk</p>
              <a href="mailto:gis@athabasca.org" className="text-xs text-sait-sky hover:underline">
                gis@athabasca.org
              </a>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <PhoneIcon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Incident Hotline</p>
              <a href="tel:+18005550199" className="text-xs text-sait-sky hover:underline">
                +1 (800) 555-0199
              </a>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="px-6 pb-5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Affected Sensor Station
            </label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
            >
              {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Issue / Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Sensor S-2 showing unusual readings"
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2">
              Describe the Problem
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Please describe what you noticed or what went wrong..."
              className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 outline-none focus:border-sait-sky focus:ring-1 focus:ring-sait-sky transition-colors resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!subject.trim() || submitted}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-sait-red hover:bg-sait-red-deep disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            <SendIcon className="w-4 h-4" />
            {submitted ? "Submitted ✓" : "Submit Support Request"}
          </button>
        </div>

        </div>{/* end scrollable body */}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-500">Provincial Water Standards</span>
          <a href="#" className="text-xs text-sait-sky hover:underline flex items-center gap-1">
            Provincial Registry ↗
          </a>
        </div>
      </div>
    </div>
  );
}
