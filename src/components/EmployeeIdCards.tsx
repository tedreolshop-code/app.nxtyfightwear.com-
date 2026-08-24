import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Employee, divisionLabel } from '../types';
import { dataStore } from '../dataStore';

/**
 * Kartu identitas karyawan siap cetak sendiri.
 *
 * Bentuk TEGAK 54 x 85,6 mm — ukuran kartu lanyard yang umum dipakai, cocok
 * dengan plastik gantung dan tali yang dijual bebas. Sembilan kartu per A4.
 *
 * Warna mengikuti warna utama brand di Pengaturan (bawaan hijau evergreen),
 * jadi kartu ikut berubah bila perusahaan mengganti warna aplikasinya.
 *
 * QR pada kartu adalah token absensi yang SUDAH ADA (ARI-ATTENDANCE:...), sama
 * dengan yang dipakai admin saat membantu karyawan yang gagal absen mandiri.
 * Kartu hilang cukup dicetak ulang — token tidak diterbitkan ulang, sesuai
 * keputusan pemilik usaha, sehingga kartu lama tetap berlaku bila ketemu.
 */

const CARD_CSS = `
  @page { size: A4; margin: 7mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #0f172a; }
  .lembar { display: flex; flex-wrap: wrap; gap: 3mm; }

  .kartu {
    width: 54mm; height: 85.6mm; border-radius: 3mm; overflow: hidden;
    display: flex; flex-direction: column; page-break-inside: avoid;
    border: 0.3mm solid #cbd5e1; background: #fff;
  }

  /* Kepala kartu: warna dominan brand, sekaligus tempat lubang tali lanyard */
  .kepala {
    background: var(--warna); color: #fff; padding: 2.5mm 3mm 2mm;
    display: flex; flex-direction: column; align-items: center; gap: 0.8mm;
  }
  .lubang { width: 12mm; height: 1.8mm; border-radius: 1mm; background: rgba(255,255,255,0.35); }
  .brand { display: flex; align-items: center; gap: 1.2mm; margin-top: 0.5mm; }
  .brand img { height: 4.5mm; width: auto; }
  .brand-nama { font-size: 3mm; font-weight: 800; letter-spacing: 0.25mm; text-transform: uppercase; }

  .badan { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 2.5mm 3mm 0; min-height: 0; }
  .badan > * { flex: 0 0 auto; }
  .foto, .foto-kosong {
    width: 20mm; height: 25mm; border-radius: 2mm;
    border: 0.6mm solid var(--warna); background: #f1f5f9;
  }
  .foto { object-fit: cover; }
  .foto-kosong {
    display: flex; align-items: center; justify-content: center;
    font-size: 10mm; font-weight: 800; color: var(--warna); opacity: 0.55;
  }

  /* Nama panjang mengecil sendiri — kartu identitas tidak boleh memenggal nama orang */
  .nama {
    margin-top: 2mm; font-size: 3.6mm; font-weight: 800; line-height: 1.15; text-align: center;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  }
  .nama.panjang { font-size: 3mm; }

  .nomor {
    margin-top: 1.2mm; font-size: 2.8mm; font-weight: 700; white-space: nowrap;
    font-family: ui-monospace, "Courier New", monospace;
    background: var(--warna); color: #fff; padding: 0.8mm 2mm; border-radius: 1.2mm;
  }
  .divisi { margin-top: 1.2mm; font-size: 2.6mm; font-weight: 600; color: var(--warna); text-align: center; }

  .qr-blok { margin-top: auto; padding-bottom: 1.5mm; display: flex; flex-direction: column; align-items: center; gap: 0.8mm; }
  .qr-catatan { font-size: 2mm; color: #64748b; }

  /* Kaki kartu: pengingat kepemilikan, sekaligus penyeimbang warna kepala */
  .kaki {
    background: var(--warna); color: #fff;
    font-size: 1.9mm; text-align: center; padding: 1.5mm 2mm; line-height: 1.25;
  }
`;

export const ID_CARDS_CONTAINER_ID = 'kartu-karyawan-cetak';

export const EmployeeIdCards: React.FC<{ employees: Employee[] }> = ({ employees }) => {
  const brand = dataStore.getBrandSettings();

  return (
    <div id={ID_CARDS_CONTAINER_ID} className="hidden">
      <div className="lembar">
        {employees.map(emp => (
          <div key={emp.id} className="kartu" style={{ '--warna': brand.primary_color } as React.CSSProperties}>
            <div className="kepala">
              <div className="lubang" />
              <div className="brand">
                {brand.logo_data_url && <img src={brand.logo_data_url} alt="" />}
                <span className="brand-nama">{brand.company_name}</span>
              </div>
            </div>

            <div className="badan">
              {emp.photo_url
                ? <img className="foto" src={emp.photo_url} alt="" />
                : <div className="foto-kosong">{emp.name[0]}</div>}

              <div className={`nama${emp.name.length > 20 ? ' panjang' : ''}`}>{emp.name}</div>
              <div className="nomor">{emp.employee_number || '—'}</div>
              <div className="divisi">{divisionLabel(emp.department_id, 'Umum / HQ')}</div>

              <div className="qr-blok">
                {emp.attendance_qr_token
                  ? <QRCodeSVG value={`ARI-ATTENDANCE:${emp.attendance_qr_token}`} size={56} level="M" />
                  : <div className="qr-catatan">QR belum tersedia</div>}
                <div className="qr-catatan">Kartu absensi</div>
              </div>
            </div>

            <div className="kaki">
              {emp.join_date && <>Masuk {emp.join_date} · </>}Kartu milik {brand.company_name}
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
