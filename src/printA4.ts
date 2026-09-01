/**
 * Aturan @page global = continuous form (faktur & nota dot matrix). Slip gaji /
 * bonus dicetak A4, jadi ukuran itu ditimpa sementara lewat <style> terakhir
 * yang dibuang lagi setelah dialog cetak selesai.
 */
export const withA4PageSize = (cetak: () => void): void => {
  const style = document.createElement('style');
  style.textContent = '@media print { @page { size: A4 portrait; margin: 15mm; } }';
  document.head.appendChild(style);
  const bersihkan = () => {
    style.remove();
    window.removeEventListener('afterprint', bersihkan);
  };
  window.addEventListener('afterprint', bersihkan);
  cetak();
};
