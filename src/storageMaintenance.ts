/**
 * Perawatan penyimpanan browser.
 *
 * localStorage hanya menyediakan ~5 MB per origin (iOS Safari paling ketat) dan
 * aplikasi ini dipakai harian, jadi beban mati terbesar adalah foto yang masih
 * tersimpan sebagai base64 (`data:image/...`): satu foto resi bisa memakan ratusan
 * KB dan ikut tersalin ke setiap perangkat.
 *
 * Foto seperti itu dipindahkan ke Supabase Storage lalu diganti URL publiknya —
 * tampilan di aplikasi tidak berubah, tetapi cache lokal dan badan sinkronisasi
 * menyusut. Bila unggahan gagal (offline / bucket belum siap) data aslinya
 * dibiarkan apa adanya, tidak ada yang hilang.
 */
import { dataStore } from './dataStore';
import { isCloudEnabled } from './cloudSync';
import { uploadPackingPhoto } from './packingPhoto';

export interface LegacyProofPhoto {
  scope: 'order' | 'marketplace';
  id: string;
  orderNumber: string;
  bytes: number;
}

export interface MigrasiHasil {
  moved: number;
  failed: number;
  freedBytes: number;
}

/** Kuota localStorage yang dianggap aman: iOS Safari paling ketat (±5 MB). */
export const STORAGE_BUDGET_BYTES = 5 * 1024 * 1024;

const ukuranDataUrl = (value: string) => value.length * 2;

/** Foto bukti pengiriman yang masih base64 di cache lokal (bukan URL cloud). */
export const findLegacyProofPhotos = (): LegacyProofPhoto[] => {
  const hasil: LegacyProofPhoto[] = [];
  for (const order of dataStore.getOrders()) {
    if (!order.shipping_proof_url?.startsWith('data:')) continue;
    hasil.push({
      scope: 'order',
      id: order.id,
      orderNumber: order.order_number || order.id,
      bytes: ukuranDataUrl(order.shipping_proof_url),
    });
  }
  // Satu order marketplace punya banyak baris item dengan foto yang sama:
  // cukup dihitung dan dipindahkan sekali per nomor order.
  const sudahDihitung = new Set<string>();
  for (const item of dataStore.getMarketplaceItemSales()) {
    if (!item.shipping_proof_url?.startsWith('data:') || sudahDihitung.has(item.order_number)) continue;
    sudahDihitung.add(item.order_number);
    hasil.push({
      scope: 'marketplace',
      id: item.order_number,
      orderNumber: item.order_number,
      bytes: ukuranDataUrl(item.shipping_proof_url),
    });
  }
  return hasil;
};

const dataUrlKeFile = async (dataUrl: string, nama: string): Promise<File> => {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], nama, { type: blob.type || 'image/jpeg' });
};

/**
 * Pindahkan semua foto bukti pengiriman yang masih base64 ke cloud storage.
 * Aman dipanggil kapan saja: hanya baris yang benar-benar base64 yang disentuh.
 */
export const migrateLegacyProofPhotos = async (): Promise<MigrasiHasil> => {
  const hasil: MigrasiHasil = { moved: 0, failed: 0, freedBytes: 0 };
  if (!isCloudEnabled) return hasil;

  for (const foto of findLegacyProofPhotos()) {
    const dataUrl = foto.scope === 'order'
      ? dataStore.getOrders().find(order => order.id === foto.id)?.shipping_proof_url
      : dataStore.getMarketplaceItemSales().find(item => item.order_number === foto.id)?.shipping_proof_url;
    if (!dataUrl?.startsWith('data:')) continue;

    try {
      const url = await uploadPackingPhoto(foto.orderNumber, await dataUrlKeFile(dataUrl, 'bukti-pengiriman.jpg'));
      if (!url) {
        hasil.failed++;
        continue;
      }
      if (foto.scope === 'order') {
        dataStore.updateOrderShipping(foto.id, { shipping_proof_url: url });
      } else {
        dataStore.setMarketplaceShippingProof(foto.orderNumber, url);
      }
      hasil.moved++;
      hasil.freedBytes += foto.bytes;
    } catch (error) {
      console.error('[storage] Gagal memindahkan foto bukti pengiriman ke cloud:', error);
      hasil.failed++;
    }
  }

  if (hasil.moved > 0) {
    dataStore.logAudit('update', 'storage',
      `Memindahkan ${hasil.moved} foto bukti pengiriman dari cache lokal ke cloud (membebaskan ±${Math.round(hasil.freedBytes / 1024)} KB)`);
  }
  return hasil;
};
