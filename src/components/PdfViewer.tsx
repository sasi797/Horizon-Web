'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export default function PdfViewer({
  url, initialPage = 1, packageCount = 0,
}: {
  url: string;
  initialPage?: number;
  /** Number of package lines on the current HAWB — assumes one page per package,
   *  starting at initialPage, so the pager can show "Package X of Y" instead of a
   *  raw page number while browsing this HAWB's own pages. */
  packageCount?: number;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(initialPage);
  const [width, setWidth] = useState(0);

  // Jump to the relevant HAWB's page whenever the caller tells us to (e.g. switching
  // to a sibling job from the same document via Prev/Next HAWB navigation).
  // Adjusted during render (not an effect) per https://react.dev/learn/you-might-not-need-an-effect.
  const [syncedFor, setSyncedFor] = useState({ url, initialPage });
  if (syncedFor.url !== url || syncedFor.initialPage !== initialPage) {
    setSyncedFor({ url, initialPage });
    setPageNumber(initialPage);
  }

  const packageIndex = pageNumber - initialPage;
  const withinPackageRange = packageCount > 0 && packageIndex >= 0 && packageIndex < packageCount;
  const pagerLabel = withinPackageRange
    ? `Package ${packageIndex + 1} of ${packageCount}`
    : `Page ${pageNumber} of ${numPages}`;

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div
        className="flex-1 overflow-auto flex justify-center p-3"
        ref={el => { if (el && width === 0) setWidth(el.clientWidth - 24); }}
      >
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          loading={<div className="text-xs text-gray-400 dark:text-slate-500 py-10">Loading PDF…</div>}
          error={<div className="text-xs text-red-400 py-10">Failed to load PDF.</div>}
        >
          <Page pageNumber={pageNumber} width={width || undefined} />
        </Document>
      </div>

      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="text-[11px] font-bold text-gray-500 dark:text-slate-400 disabled:opacity-40 px-2 py-1"
          >
            ← Prev
          </button>
          <span className="text-[11px] text-gray-500 dark:text-slate-400 font-medium">{pagerLabel}</span>
          <button
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="text-[11px] font-bold text-gray-500 dark:text-slate-400 disabled:opacity-40 px-2 py-1"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
