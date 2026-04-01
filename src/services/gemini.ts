import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const BASE_INSTRUCTION = `Kamu adalah asisten chef profesional sekaligus ahli belanja bahan makanan di pasar tradisional Indonesia.
Gunakan bahasa Indonesia yang ramah dan mudah dipahami. Pastikan harga bahan realistis sesuai harga pasar tradisional Indonesia. Buat tampilan eye catchy.

ATURAN KRITIKAL:
1. SINKRONISASI TOTAL: Semua informasi (Nutrisi, Bahan, Langkah) HARUS SINKRON satu sama lain.
2. OUTPUT EKSKLUSIF: Kamu hanya boleh mengeluarkan (output) bagian yang diminta saja. JANGAN mengulang bagian yang sudah ada di konteks sebelumnya.
3. DAFTAR BELANJA: Harus mencakup SEMUA bahan yang nantinya akan digunakan di langkah memasak.
4. LANGKAH MEMASAK: Hanya boleh menggunakan bahan-bahan yang sudah terdaftar di sesi Daftar Bahan.`;

export type RecipeStep = "INFO" | "INGREDIENTS" | "STEPS";

export async function generateRecipeStep(
  foodName: string,
  portions: number,
  step: RecipeStep,
  previousContext?: string
): Promise<string> {
  try {
    let prompt = "";
    let systemInstruction = BASE_INSTRUCTION;

    if (step === "INFO") {
      systemInstruction += `\n\nTugasmu: Berikan HANYA Informasi Umum dan Nutrisi.
Gunakan format markdown berikut:
---
## 🍽️ ${foodName.toUpperCase()}

### 📋 Informasi Umum
- **Porsi:** ${portions} Orang
- **Waktu Memasak:** [estimasi waktu]
- **Tingkat Kesulitan:** [Mudah / Sedang / Sulit]

### 🥗 Informasi Nutrisi (Per Porsi)
- **Kalori:** [jumlah] kkal
- **Protein:** [jumlah] g
- **Karbohidrat:** [jumlah] g
- **Lemak:** [jumlah] g
- **Serat:** [jumlah] g
- **Gula:** [jumlah] g
- **Sodium:** [jumlah] mg
---`;
      prompt = `Berikan informasi umum dan nutrisi untuk "${foodName}" (${portions} orang).`;
    } else if (step === "INGREDIENTS") {
      systemInstruction += `\n\nTugasmu: Berikan HANYA Daftar Bahan, Budget, dan Substitusi. JANGAN mengulang Informasi Umum/Nutrisi.
Gunakan format markdown berikut:

### 🛒 Daftar Bahan & Budget (Untuk ${portions} Porsi)

| No | Bahan | Jumlah | Harga Estimasi |
|----|-------|--------|----------------|
| 1  | ...   | ...    | Rp ...         |
| dst | ...  | ...    | Rp ...         |

**💰 Total Budget Estimasi: Rp [total]**
> *Harga berdasarkan estimasi pasar tradisional Indonesia (2024–2025)*

---

### 🔄 Substitusi Bahan
- **[Bahan Utama]**: Bisa diganti dengan [Bahan Alternatif] jika [Alasan/Kondisi].
---`;
      prompt = `Berdasarkan konteks nutrisi sebelumnya, buatkan HANYA daftar bahan dan budget yang sinkron untuk "${foodName}" (${portions} porsi).
Konteks Nutrisi:
${previousContext || ""}`;
    } else if (step === "STEPS") {
      systemInstruction += `\n\nTugasmu: Berikan HANYA Langkah-Langkah Memasak dan Tips. JANGAN mengulang Daftar Bahan atau Nutrisi.
ATURAN LANGKAH:
1. JUMLAH LANGKAH: Jangan membatasi jumlah langkah. Berikan langkah sebanyak yang diperlukan agar masakan berhasil sempurna (bisa 5, 10, 15, atau lebih tergantung kerumitan menu). JANGAN selalu memberikan 7 langkah.
2. DETAIL TEKNIS: Setiap langkah harus SANGAT DETAIL. Jelaskan teknik (misal: "teknik tumis sampai harum"), suhu api (kecil/sedang/besar), durasi waktu (misal: "diamkan 15 menit"), dan tanda visual (misal: "sampai minyak keluar" atau "sampai warna berubah cokelat keemasan").
3. BAHASA: Gunakan bahasa yang instruktif, profesional, dan mudah diikuti.

Gunakan format markdown berikut:

### 👨‍🍳 Langkah-Langkah Memasak (Sangat Detail & Lengkap)

1. **[Judul Langkah]** — [Penjelasan teknis yang sangat mendalam, panjang, dan informatif. Sertakan tips kecil di dalam penjelasan ini.]
2. **[Judul Langkah]** — [Penjelasan teknis yang sangat mendalam, panjang, dan informatif. Sertakan tips kecil di dalam penjelasan ini.]
3. ... (lanjutkan sampai selesai dengan jumlah langkah yang natural sesuai menu)

---

### 💡 Tips & Trik & Rahasia Dapur
- [Tip rahasia dapur agar rasa lebih otentik]
- [Cara penyimpanan atau penyajian]
---`;
      prompt = `Berdasarkan Daftar Bahan sebelumnya, berikan panduan memasak yang SANGAT DETAIL, TEKNIS, dan LENGKAP untuk "${foodName}" (${portions} porsi). Pastikan setiap langkah dijelaskan dengan sangat jelas sehingga tidak ada ruang untuk kesalahan.
Daftar Bahan Sebelumnya:
${previousContext || ""}`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
      },
    });

    return (
      response.text || "Maaf, saya tidak dapat menghasilkan bagian resep ini saat ini."
    );
  } catch (error: any) {
    console.error(`Error generating recipe ${step}:`, error);
    const errorMessage = error?.message || "";
    if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota exceeded")) {
      throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(`Gagal mengambil bagian ${step}. Silakan coba lagi.`);
  }
}
