import React, { useState } from 'react';
import { useApp } from '@/src/context/AppContext';

export function BrandLogo({ dark = false }: { dark?: boolean }) {
  const { siteSettings } = useApp();
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      {siteSettings.logoUrl && !imgFailed ? (
        <img
          src={siteSettings.logoUrl}
          alt={siteSettings.brandName}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-8 h-8 rounded-xl object-cover border border-slate-200/70"
        />
      ) : (
        <span className="w-8 h-8 rounded-xl bg-pink-600 flex items-center justify-center shrink-0 shadow-sm shadow-pink-600/20">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-4.5 h-4.5 text-white"
            aria-hidden="true"
          >
            <path
              d="M4 7.5C4 5.567 5.567 4 7.5 4h9A3.5 3.5 0 0 1 20 7.5v2.25a1.25 1.25 0 0 1-1.25 1.25H13.5a2.5 2.5 0 0 0 0 5h5.25A1.25 1.25 0 0 1 20 17.25v.25A2.5 2.5 0 0 1 17.5 20h-10A3.5 3.5 0 0 1 4 16.5v-9Z"
              fill="currentColor"
              fillOpacity="0.92"
            />
            <circle cx="14.5" cy="13.5" r="1.35" fill="#0F172A" />
          </svg>
        </span>
      )}
      <span
        className={`font-display text-lg font-bold tracking-tight ${
          dark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {siteSettings.brandName || 'PayTasker'}
      </span>
    </span>
  );
}
