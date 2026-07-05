import React, { useRef, useState } from 'react';
import { Employee } from '../types';
import { dataStore, hashPin } from '../dataStore';
import { Camera, KeyRound, Phone, Save, User } from 'lucide-react';

interface ProfileModuleProps {
  employee: Employee;
  onUpdated: (emp: Employee) => void;
}

// Halaman "Profil Saya" — setiap karyawan bisa memasang foto,
// memperbarui nomor HP, dan mengganti PIN sendiri.
export const ProfileModule: React.FC<ProfileModuleProps> = ({ employee, onUpdated }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [phone, setPhone] = useState(employee.phone_number || '');
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const departments = dataStore.getDepartments();
  const deptName = departments.find(d => d.id === employee.department_id)?.name || 'Umum';

  const saveEmployee = (patch: Partial<Employee>, successText: string) => {
    const updated = dataStore.getEmployees().map(e =>
      e.id === employee.id ? { ...e, ...patch } : e
    );
    dataStore.setEmployees(updated);
    const fresh = updated.find(e => e.id === employee.id)!;
    onUpdated(fresh);
    setMessage({ text: successText, error: false });
  };

  // Unggah foto: dikecilkan ke 256x256 (crop tengah) lalu disimpan sebagai data URL
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      URL.revokeObjectURL(img.src);
      saveEmployee({ photo_url: dataUrl }, 'Foto profil berhasil diperbarui!');
    };
    img.onerror = () => setMessage({ text: 'File gambar tidak valid.', error: true });
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  const handleSavePhone = () => {
    saveEmployee({ phone_number: phone.trim() }, 'Nomor HP berhasil diperbarui!');
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (!dataStore.verifyEmployeePin(employee.id, oldPin)) {
      setMessage({ text: 'PIN lama salah.', error: true });
      return;
    }
    if (newPin.length !== 4) {
      setMessage({ text: 'PIN baru harus 4 digit angka.', error: true });
      return;
    }
    if (newPin !== newPin2) {
      setMessage({ text: 'Konfirmasi PIN baru tidak sama.', error: true });
      return;
    }
    saveEmployee({ pin: hashPin(newPin), pin_hashed: true }, 'PIN berhasil diganti!');
    setOldPin('');
    setNewPin('');
    setNewPin2('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Kartu identitas */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-[#1F4B36] flex items-center justify-center border-4 border-emerald-100">
            {employee.photo_url ? (
              <img src={employee.photo_url} alt={employee.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-3xl font-black text-amber-400">{employee.name[0]}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            title="Ganti foto profil"
            className="absolute -bottom-1 -right-1 bg-[#1F4B36] hover:bg-[#163826] text-white p-2 rounded-full border-2 border-white cursor-pointer transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>
        <div className="text-center sm:text-left min-w-0">
          <h2 className="text-xl font-bold text-gray-800 truncate">{employee.name}</h2>
          <p className="text-sm text-gray-500 font-mono">@{employee.username}</p>
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded text-xs font-semibold">{deptName}</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 border border-gray-200 rounded text-xs font-semibold capitalize">{employee.role}</span>
          </div>
        </div>
      </div>

      {message && (
        <p className={`text-sm rounded-lg p-3 text-center border ${
          message.error
            ? 'text-rose-700 bg-rose-50 border-rose-100'
            : 'text-emerald-700 bg-emerald-50 border-emerald-100'
        }`}>
          {message.text}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Nomor HP */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#1F4B36]" /> Nomor HP / WhatsApp
          </h3>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08xxxxxxxxxx"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <button
            onClick={handleSavePhone}
            className="bg-[#1F4B36] hover:bg-[#163826] text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-4 h-4" /> Simpan
          </button>
        </div>

        {/* Ganti PIN */}
        <form onSubmit={handleChangePin} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#1F4B36]" /> Ganti PIN Login
          </h3>
          <input
            type="password" inputMode="numeric" maxLength={4} placeholder="PIN lama"
            value={oldPin} onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <input
            type="password" inputMode="numeric" maxLength={4} placeholder="PIN baru (4 digit)"
            value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <input
            type="password" inputMode="numeric" maxLength={4} placeholder="Ulangi PIN baru"
            value={newPin2} onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-[#1F4B36]"
          />
          <button
            type="submit"
            disabled={!oldPin || !newPin || !newPin2}
            className={`text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 ${
              !oldPin || !newPin || !newPin2
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#1F4B36] hover:bg-[#163826] text-white cursor-pointer'
            }`}
          >
            <User className="w-4 h-4" /> Ganti PIN
          </button>
        </form>
      </div>
    </div>
  );
};
