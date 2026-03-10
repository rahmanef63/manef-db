export const APP_ERROR_DEFINITIONS = {
  AUTH_SERVICE_UNAVAILABLE: {
    feature: "auth",
    title: "Layanan login sedang tidak tersedia",
    description:
      "Aplikasi tidak bisa menjangkau backend autentikasi. Coba lagi beberapa saat. Jika berulang, periksa koneksi backend dan TLS domain ggdb.",
  },
  COMMON_UNAUTHENTICATED: {
    feature: "common",
    title: "Sesi login dibutuhkan",
    description:
      "Aksi ini membutuhkan sesi pengguna yang valid. Silakan login ulang lalu coba lagi.",
  },
  COMMON_PERMISSION_DENIED: {
    feature: "common",
    title: "Akses ditolak",
    description:
      "Akun Anda tidak memiliki izin yang dibutuhkan untuk menjalankan aksi ini pada workspace tersebut.",
  },
  WORKSPACE_NAME_REQUIRED: {
    feature: "workspaces",
    title: "Nama workspace wajib diisi",
    description:
      "Masukkan nama workspace yang jelas agar dashboard utama bisa dibuat atau diperbarui dengan benar.",
  },
  WORKSPACE_NAME_TOO_SHORT: {
    feature: "workspaces",
    title: "Nama workspace terlalu pendek",
    description:
      "Gunakan minimal 3 karakter agar nama workspace mudah dikenali dan tidak bentrok dengan slug kosong.",
  },
  WORKSPACE_NOT_FOUND: {
    feature: "workspaces",
    title: "Workspace tidak ditemukan",
    description:
      "Workspace yang diminta tidak ada, sudah dihapus, atau Anda memang tidak punya akses ke workspace tersebut.",
  },
  WORKSPACE_BOOTSTRAP_FAILED: {
    feature: "workspaces",
    title: "Workspace utama belum berhasil disiapkan",
    description:
      "Akun pengguna berhasil dibaca, tetapi workspace personal utama belum bisa dibuat atau ditemukan. Coba refresh lalu login ulang.",
  },
  MEMBERS_LAST_ADMIN: {
    feature: "members",
    title: "Workspace harus punya minimal satu admin",
    description:
      "Anda tidak bisa menghapus atau menurunkan role admin terakhir. Tetapkan admin lain terlebih dahulu.",
  },
  MEMBERS_INVITE_EMAIL_FAILED: {
    feature: "members",
    title: "Undangan anggota gagal dikirim",
    description:
      "Data undangan sudah dibuat tetapi email undangan gagal dikirim. Periksa RESEND_API_KEY, HOSTED_URL, dan inbox tujuan.",
  },
  MEMBERS_INVITE_CONFIG_MISSING: {
    feature: "members",
    title: "Konfigurasi undangan email belum lengkap",
    description:
      "Aplikasi belum bisa mengirim email undangan karena variabel lingkungan pengiriman email belum lengkap. Lengkapi RESEND_API_KEY dan HOSTED_URL di backend manef-db.",
  },
  MESSAGES_EMPTY: {
    feature: "messages",
    title: "Pesan tidak boleh kosong",
    description:
      "Isi pesan terlebih dahulu sebelum mengirim agar riwayat diskusi di workspace tetap bermakna.",
  },
};

export function getAppErrorDefinition(code) {
  return (
    APP_ERROR_DEFINITIONS[code] ?? {
      feature: "common",
      title: "Terjadi kesalahan",
      description:
        "Aplikasi menerima kesalahan yang belum dipetakan. Periksa log backend untuk detail teknisnya.",
    }
  );
}

export function createAppError(code, overrides = {}) {
  const definition = getAppErrorDefinition(code);
  return {
    code,
    feature: definition.feature,
    title: definition.title,
    description: definition.description,
    ...overrides,
  };
}

export function isAppErrorData(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    "code" in value &&
    typeof value.code === "string"
  );
}
