import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 lg:px-8 py-2 text-xs text-amber-900 flex items-center justify-between w-full">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="leading-tight">
          <span className="font-semibold">Educational &amp; Demonstration Prototype:</span> DripConnect is a software prototype. All patient details, infusion parameters, sensor readings and notification workflows are simulated. This system is not a certified medical device and must not be used to make clinical decisions or monitor actual patients.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-700 hover:text-amber-900 p-1 hover:bg-amber-100 rounded transition-colors shrink-0 ml-2"
        title="Dismiss disclaimer"
        aria-label="Dismiss disclaimer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
