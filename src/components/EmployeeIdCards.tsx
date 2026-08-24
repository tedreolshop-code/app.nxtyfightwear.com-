import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Employee, divisionLabel } from '../types';
import { dataStore } from '../dataStore';

/**
 * Kartu identitas karyawan siap cetak sendiri.
 *
 * Ukuran kartu mengikuti KTP (85,6 x 54 mm) supaya muat di dompet dan cocok
 * dengan plastik laminating yang dijual umum. Sepuluh kartu per lembar A4.
 *
 * QR pada kartu adalah token absensi yang SUDAH ADA (ARI-ATTENDANCE:...), sama
 * dengan yang dipakai admin saat membantu karyawan yang gagal absen mandiri.
 * Kartu hilang cukup dicetak ulang — token tidak diterbitkan ulang, sesuai
 * keputusan pemilik usaha, sehingga kartu lama tetap berlaku bila ketemu.
 */

const CARD_CSS = `
  @page { size: A4; margin: 8mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .lembar { display: flex; flex-wrap: wrap; gap: 4mm; }
  .kartu {
    width: 85.6mm; height: 54mm; border: 0.3mm dashed #bbb; border-radius: 3mm;
    padding: 3.5mm; display: flex; gap: 3mm; overflow: hidden; page-break-inside: avoid;
  }
  .kiri { width: 20mm; flex: 0 0 20mm; }
  .foto, .foto-kosong {
    width: 20mm; height: 26mm; border-radius: 1.5mm; border: 0.3mm solid #ddd; background: #f1f5f9;
  }
  .foto { object-fit: cover; }
  .foto-kosong { display: flex; align-items: center; justify-content: center; font-size: 8mm; font-weight: 800; color: #94a3b8; }
  .tengah { flex: 1; display: flex; flex-direction: column; min-width: 0; }
  .brand { display: flex; align-items: center; gap: 1.5mm; border-bottom: 0.4mm solid currentColor; padding-bottom: 1mm; }
  .brand img { height: 4.5mm; width: auto; }
  .brand-nama {
    font-size: 2.9mm; font-weight: 800; letter-spacing: 0.2mm; text-transform: uppercase;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  /* Nama panjang mengecil sendiri, bukan dipotong — kartu identitas tidak boleh
     memenggal nama orang. Tiga baris cukup untuk nama terpanjang di daftar. */
  .nama {
    font-size: 3.6mm; font-weight: 800; margin-top: 1.5mm; line-height: 1.15; color: #0f172a;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
  }
  .nama.panjang { font-size: 3mm; }
  .nomor {
    font-size: 2.9mm; font-family: ui-monospace, "Courier New", monospace; font-weight: 700;
    margin-top: 1mm; white-space: nowrap;
  }
  .baris { font-size: 2.6mm; color: #475569; margin-top: 0.6mm; }
  .catatan-bawah { margin-top: auto; font-size: 2.1mm; color: #94a3b8; line-height: 1.2; }
  .kanan { width: 23mm; flex: 0 0 23mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.2mm; }
  .qr-catatan { font-size: 2.1mm; color: #64748b; text-align: center; line-height: 1.2; }
`;


export const ID_CARDS_CONTAINER_ID = 'kartu-karyawan-cetak';

export const EmployeeIdCards: React.FC<{ employees: Employee[] }> = ({ employees }) => {
  const brand = dataStore.getBrandSettings();

  return (
    <div id={ID_CARDS_CONTAINER_ID} className="hidden">
      <div className="lembar">
        {employees.map(emp => (
          <div key={emp.id} className="kartu" style={{ color: brand.primary_color }}>
            <div className="kiri">
              {emp.photo_url
                ? <img className="foto" src={emp.photo_url} alt="" />
                : <div className="foto-kosong">{emp.name[0]}</div>}
            </div>

            <div className="tengah">
              <div className="brand">
                {brand.logo_data_url && <img src={brand.logo_data_url} alt="" />}
                <span className="brand-nama">{brand.company_name}</span>
              </div>
              <div className={`nama${emp.name.length > 20 ? ' panjang' : ''}`}>{emp.name}</div>
              <div className="nomor">{emp.employee_number || '—'}</div>
              <div className="baris">{divisionLabel(emp.department_id, 'Umum / HQ')}</div>
              {emp.join_date && <div className="baris">Masuk: {emp.join_date}</div>}
              <div className="catatan-bawah">Kartu milik {brand.company_name}. Kembalikan bila berhenti bekerja.</div>
            </div>

            <div className="kanan">
              {emp.attendance_qr_token
                ? <QRCodeSVG value={`ARI-ATTENDANCE:${emp.attendance_qr_token}`} size={96} level="M" />
                : <div className="qr-catatan">QR belum tersedia</div>}
              <div className="qr-catatan">Kartu absensi</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Cetak lewat iframe tersembunyi: dokumen kartu berdiri sendiri dengan @page A4,
 * sehingga aturan cetak aplikasi (ukuran kertas dot matrix) tidak ikut terbawa.
 */
export const printIdCards = (): void => {
  const source = document.getElementById(ID_CARDS_CONTAINER_ID);
  if (!source) return;

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const doc = frame.contentWindow?.document;
  if (!doc) { frame.remove(); return; }

  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Kartu Karyawan</title><style>${CARD_CSS}</style></head><body>${source.innerHTML}</body></html>`);
  doc.close();

  // Beri kesempatan foto (data URL) selesai dipasang sebelum dialog cetak muncul
  const cetak = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1000);
  };
  if (doc.readyState === 'complete') window.setTimeout(cetak, 200);
  else frame.onload = () => window.setTimeout(cetak, 200);
};
