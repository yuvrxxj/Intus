import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { DoctorReport as Report } from './doctor.ts';
import './print.css';

/**
 * The printable page. It is drawn into its own element at the end of the page, and the print stylesheet hides
 * everything else, so the browser's print dialog (or "Save as PDF") gets only this.
 */
export function DoctorReport({ report, onDone }: { report: Report; onDone: () => void }) {
  useEffect(() => {
    const after = () => onDone();
    window.addEventListener('afterprint', after);
    // let the portal paint before the dialog opens
    const t = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('afterprint', after);
    };
  }, [onDone]);

  return createPortal(
    <div className="print-only doctor-report">
      <header>
        <h1>{report.title}</h1>
        <p>{report.person ? `${report.person}. ` : ''}Printed {report.generated} from Intus.</p>
        <p>
          Each result is shown against the reference range printed on the lab report where there was one ("report"), or
          the usual range otherwise ("usual"). {report.outside} of {report.rows.length} latest results are outside their range.
        </p>
      </header>
      <table>
        <thead>
          <tr><th>Marker</th><th>Latest</th><th>Date</th><th>Range</th><th>Status</th><th>Previous</th></tr>
        </thead>
        <tbody>
          {report.rows.map((r) => (
            <tr key={`${r.group}-${r.marker}`} className={/^(Critical|Below|Above)/.test(r.status) ? 'out' : ''}>
              <td>{r.marker}</td>
              <td>{r.latest}</td>
              <td>{r.date}</td>
              <td>{r.range}{r.rangeFrom ? <span className="from"> ({r.rangeFrom})</span> : null}</td>
              <td>{r.status}</td>
              <td>{r.previous}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Supplements</h2>
      {report.supplements.length === 0 ? (
        <p>None recorded.</p>
      ) : (
        <ul>
          {report.supplements.map((s, i) => (
            <li key={i}><strong>{s.name}</strong>{s.detail ? `, ${s.detail}` : ''} ({s.dates})</li>
          ))}
        </ul>
      )}
      <footer>Entered or uploaded by the person, and checked by them before saving. Not a laboratory report.</footer>
    </div>,
    document.body,
  );
}
