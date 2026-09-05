import React, { useEffect, useRef, useState } from 'react';

/**
 * Lembar A4 (210x297mm, padding 15mm) untuk modal "Pratinjau Slip".
 *
 * Di layar sempit (HP), lebar fisik lembar (~794px @96dpi) tidak mungkin muat.
 * Daripada min-w-[640px] yang memaksa scroll/terpotong, lembar di-scale down
 * (transform CSS) supaya selalu utuh selebar kontainer; isi cetak tidak berubah
 * karena pratinjau memakai class no-print.
 *
 * Scale dihitung dari lebar kontainer terhadap lebar lembar (batas maks 1), dan
 * tinggi pembungkus mengikuti tinggi konten asli × scale supaya slip yang lebih
 * panjang dari satu halaman tetap bisa di-scroll sampai bawah. ResizeObserver
 * agar skala ikut menyesuaikan saat orientasi HP diputar atau modal dibuka di
 * ukuran layar berbeda.
 */
export const A4_SHEET_WIDTH_PX = 794; // 210mm @ 96dpi
export const A4_SHEET_HEIGHT_PX = 1123; // 297mm @ 96dpi

interface A4PreviewSheetProps {
  children: React.ReactNode;
}

export function A4PreviewSheet({ children }: A4PreviewSheetProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(A4_SHEET_HEIGHT_PX);

  useEffect(() => {
    const wrap = wrapRef.current;
    const sheet = sheetRef.current;
    if (!wrap || !sheet) return;

    const measure = () => {
      setScale(Math.min(1, wrap.clientWidth / A4_SHEET_WIDTH_PX));
      setContentHeight(Math.max(A4_SHEET_HEIGHT_PX, sheet.offsetHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(sheet);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="w-full min-w-0">
      <div
        style={{ height: `${contentHeight * scale}px` }}
        className="w-full flex justify-center"
      >
        <div
          ref={sheetRef}
          style={{
            width: A4_SHEET_WIDTH_PX,
            minHeight: A4_SHEET_HEIGHT_PX,
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            flexShrink: 0,
          }}
          className="bg-white shadow-lg p-[15mm] box-border"
        >
          {children}
        </div>
      </div>
    </div>
  );
}