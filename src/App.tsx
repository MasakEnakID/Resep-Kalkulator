import { useState, useRef, useEffect } from "react";
import { Search, ChefHat, ShoppingBag, Loader2, Users, Check, ArrowRightLeft, FileText, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generateRecipeStep, type RecipeStep } from "./services/gemini";
import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, VerticalAlign, TableLayoutType } from "docx";
import { saveAs } from "file-saver";

export default function App() {
  const [foodName, setFoodName] = useState("");
  const [portions, setPortions] = useState(4);
  const [recipe, setRecipe] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<RecipeStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (recipe !== null && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [recipe]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) return;

    setIsLoading(true);
    setError(null);
    setRecipe(""); // Start with empty string to trigger scroll
    setCurrentStep("INFO");

    try {
      // Step 1: Info & Nutrition
      const info = await generateRecipeStep(foodName, portions, "INFO");
      setRecipe(info);
      
      // Step 2: Ingredients & Budget
      setCurrentStep("INGREDIENTS");
      const ingredients = await generateRecipeStep(foodName, portions, "INGREDIENTS", info);
      setRecipe(prev => prev + "\n\n" + ingredients);

      // Step 3: Cooking Steps
      setCurrentStep("STEPS");
      const steps = await generateRecipeStep(foodName, portions, "STEPS", ingredients);
      setRecipe(prev => prev + "\n\n" + steps);

    } catch (err: any) {
      if (err.message === "QUOTA_EXCEEDED") {
        setShowQuotaModal(true);
      } else {
        setError(err.message || "Terjadi kesalahan.");
      }
    } finally {
      setIsLoading(false);
      setCurrentStep(null);
    }
  };

  const shareToWhatsApp = () => {
    if (!recipe) return;
    const shareText = `*Resep ${foodName} (${portions} Porsi)*\n\n${recipe}\n\nResep dibuat oleh Resep Kalkulator by https://www.instagram.com/masak_enak_id`;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  };

  const downloadAsDocx = async () => {
    if (!recipe) return;

    const parseBoldText = (text: string) => {
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return new TextRun({
            text: part.slice(2, -2),
            bold: true,
          });
        }
        return new TextRun(part);
      });
    };

    const lines = recipe.split("\n");
    const children: any[] = [
      new Paragraph({
        children: [
          new TextRun({
            text: `Resep ${foodName}`,
            bold: true,
            size: 32,
            color: "EA580C", // orange-600
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: `Porsi: ${portions} Orang`,
            italics: true,
            size: 24,
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    ];

    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      if (!line || line === "---") {
        i++;
        continue;
      }

      // Handle Tables
      if (line.startsWith("|")) {
        const tableRows: TableRow[] = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) {
          const rowText = lines[i].trim();
          // Skip separator rows like |---|---|
          if (rowText.includes("---")) {
            i++;
            continue;
          }

          const cells = rowText
            .split("|")
            .filter((cell) => cell.trim() !== "")
            .map((cell, index, array) => {
              const cellContent = cell.trim();
              const isHeader = tableRows.length === 0;
              
              // Use fixed DXA widths (1/1440 of an inch) for better compatibility
              // Total width ~9000 DXA for standard A4
              let cellWidth = 9000 / array.length;
              if (array.length === 4) {
                if (index === 0) cellWidth = 600;   // No
                if (index === 1) cellWidth = 4400;  // Bahan
                if (index === 2) cellWidth = 1800;  // Jumlah
                if (index === 3) cellWidth = 2200;  // Harga Estimasi
              }

              return new TableCell({
                width: { size: cellWidth, type: WidthType.DXA },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cellContent,
                        bold: isHeader,
                        size: 18,
                      }),
                    ],
                    alignment: index === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                    spacing: { before: 40, after: 40 },
                  }),
                ],
                shading: isHeader ? { fill: "F3F4F6" } : undefined,
                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                verticalAlign: VerticalAlign.CENTER,
              });
            });

          if (cells.length > 0) {
            tableRows.push(new TableRow({ children: cells }));
          }
          i++;
        }

        if (tableRows.length > 0) {
          children.push(
            new Table({
              rows: tableRows,
              width: { size: 9000, type: WidthType.DXA },
              layout: TableLayoutType.FIXED,
              alignment: AlignmentType.CENTER,
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "E7E5E4" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "E7E5E4" },
                left: { style: BorderStyle.SINGLE, size: 1, color: "E7E5E4" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "E7E5E4" },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E7E5E4" },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E7E5E4" },
              },
            })
          );
          children.push(new Paragraph({ spacing: { after: 200 } }));
        }
        continue;
      }

      // Handle Headings
      if (line.startsWith("## ")) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.replace("## ", ""),
                bold: true,
                size: 28,
                color: "1C1917", // stone-900
              }),
            ],
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
            border: {
              bottom: { color: "E7E5E4", space: 1, style: BorderStyle.SINGLE, size: 6 },
            },
          })
        );
      } else if (line.startsWith("### ")) {
        const headingText = line.replace("### ", "");
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: headingText,
                bold: true,
                size: 24,
                color: "44403C", // stone-700
              }),
            ],
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 300, after: 150 },
          })
        );
        
        // Add red warning if it's the budget table heading
        if (headingText.includes("Daftar Bahan & Budget")) {
          children.push(
            new Paragraph({
              spacing: { after: 200 },
              children: [
                new TextRun({
                  text: "⚠️ Catatan: Table hanya bisa di baca jika anda Download Resep via Laptop/Komputer",
                  bold: true,
                  color: "EF4444", // red-500
                  size: 18,
                }),
              ],
            })
          );
        }
      } 
      // Handle Lists
      else if (line.startsWith("- ") || line.startsWith("* ")) {
        children.push(
          new Paragraph({
            children: parseBoldText(line.substring(2)),
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      } 
      // Handle Blockquotes
      else if (line.startsWith("> ")) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line.replace("> ", ""),
                italics: true,
                color: "78716C", // stone-500
              }),
            ],
            spacing: { before: 100, after: 100 },
            indent: { left: 720 },
          })
        );
      }
      // Regular Paragraphs
      else {
        children.push(
          new Paragraph({
            children: parseBoldText(line),
            spacing: { after: 150 },
          })
        );
      }
      i++;
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600 },
        children: [
          new TextRun({
            text: "Resep dibuat oleh Resep Kalkulator by Masak Enak ID",
            italics: true,
            color: "A8A29E", // stone-400
            size: 18,
          }),
        ],
      })
    );

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Resep_${foodName.replace(/\s+/g, "_")}.docx`);
  };

  const portionOptions = [2, 4, 6, 8, 10];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-orange-200">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-orange-600 min-w-0">
            <ChefHat className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
            <h1 className="text-sm sm:text-lg md:text-xl font-bold tracking-tight leading-tight">
              Resep Kalkulator by{" "}
              <span className="text-stone-900 block sm:inline">
                Masak Enak ID
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] sm:text-xs md:text-sm font-bold flex-shrink-0 bg-stone-50 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl border border-stone-100 uppercase tracking-wider">
            <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="whitespace-nowrap">Harga Lokal</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 mb-4"
          >
            Masak Enak, <span className="text-orange-600">Belanja Hemat</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-stone-600"
          >
            Ketik nama masakan yang ingin kamu buat. Kami akan berikan resep
            lengkap beserta estimasi harga bahan di pasar tradisional Indonesia.
          </motion.p>
        </div>

        {/* Search & Options Form */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto mb-16 space-y-6"
        >
          {/* Portion Selection */}
          <div className="bg-white p-4 rounded-2xl border-2 border-stone-100 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-stone-600 font-medium">
              <Users className="w-4 h-4" />
              <span>Pilih Jumlah Porsi:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {portionOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPortions(opt)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    portions === opt
                      ? "bg-orange-600 text-white shadow-md shadow-orange-200"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  {opt} Orang
                </button>
              ))}
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-5 h-5 text-stone-400" />
            <input
              type="text"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              placeholder="Contoh: Rendang..."
              className="w-full pl-10 sm:pl-12 pr-24 sm:pr-32 py-3 sm:py-4 bg-white border-2 border-stone-200 rounded-2xl text-sm sm:text-lg focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all shadow-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !foodName.trim()}
              className="absolute right-2 top-2 bottom-2 px-4 sm:px-6 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">Meracik...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 sm:hidden" />
                  <span className="hidden sm:inline">Cari Resep</span>
                  <span className="sm:hidden">Cari</span>
                </>
              )}
            </button>
          </div>
        </motion.form>

        {/* Results Area */}
        <div ref={resultsRef} className="scroll-mt-24">
          <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-2xl mx-auto p-4 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center"
            >
              {error}
            </motion.div>
          )}

          {recipe && (
            <motion.div
              key="recipe"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl shadow-xl border border-stone-100 overflow-hidden"
            >
              {isLoading && (
                <div className="bg-orange-50 px-4 sm:px-6 py-3 border-b border-orange-100 flex items-center justify-center gap-3">
                  <Loader2 className="w-4 h-4 text-orange-600 animate-spin" />
                  <span className="text-sm font-medium text-orange-800">
                    {currentStep === "INFO" && "Menganalisis nutrisi..."}
                    {currentStep === "INGREDIENTS" && "Menghitung budget belanja..."}
                    {currentStep === "STEPS" && "Menyusun langkah memasak detail..."}
                  </span>
                </div>
              )}
              {/* Share Actions */}
              <div className="bg-stone-50 border-b border-stone-100 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <span className="text-xs sm:text-sm font-semibold text-stone-500 uppercase tracking-wider">
                  Hasil Resep
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">
                    Bagikan:
                  </span>
                  <button
                    onClick={shareToWhatsApp}
                    className="flex items-center gap-2 px-3 py-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-[10px] sm:text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <svg
                      className="w-3.5 h-3.5 fill-current"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                    </svg>
                    <span>WhatsApp</span>
                  </button>
                  <button
                    onClick={downloadAsDocx}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-xs font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download Resep</span>
                  </button>
                </div>
              </div>
              <div
                className="p-4 sm:p-10 prose prose-stone prose-orange max-w-none
                prose-headings:font-bold 
                prose-h2:text-2xl sm:prose-h2:text-3xl prose-h2:mb-4 sm:prose-h2:mb-6 prose-h2:pb-2 sm:prose-h2:pb-4 prose-h2:border-b prose-h2:border-stone-100
                prose-h3:text-lg sm:prose-h3:text-xl prose-h3:mt-6 sm:prose-h3:mt-8 prose-h3:mb-3 sm:prose-h3:mb-4 prose-h3:flex prose-h3:items-center prose-h3:gap-2
                prose-table:border-collapse prose-table:my-0
                prose-th:bg-stone-50 prose-th:p-2 sm:prose-th:p-3 prose-th:text-left prose-th:border prose-th:border-stone-200 prose-th:font-semibold prose-th:text-xs sm:prose-th:text-sm
                prose-td:p-2 sm:prose-td:p-3 prose-td:border prose-td:border-stone-200 prose-td:text-xs sm:prose-td:text-sm
                prose-li:my-1 prose-li:text-sm sm:prose-li:text-base
                prose-p:text-sm sm:prose-p:text-base
                prose-strong:text-stone-900
                prose-blockquote:border-l-4 prose-blockquote:border-orange-500 prose-blockquote:bg-orange-50 prose-blockquote:py-1 sm:prose-blockquote:py-2 prose-blockquote:px-3 sm:prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic prose-blockquote:text-stone-700 prose-blockquote:text-sm sm:prose-blockquote:text-base
              "
              >
                <Markdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ children }) => (
                      <div className="my-6">
                        <motion.div 
                          initial={{ x: 0 }}
                          animate={{ x: [0, 5, 0] }}
                          transition={{ 
                            repeat: Infinity, 
                            duration: 1.5,
                            ease: "easeInOut"
                          }}
                          className="flex items-center gap-2 mb-2 text-orange-500 sm:hidden bg-orange-50 w-fit px-3 py-1 rounded-full border border-orange-100"
                        >
                          <ArrowRightLeft className="w-3 h-3" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Geser untuk detail</span>
                        </motion.div>
                        <div className="w-full overflow-x-auto border border-stone-200 rounded-xl shadow-sm">
                          <table className="w-full border-collapse min-w-[600px]">
                            {children}
                          </table>
                        </div>
                      </div>
                    ),
                  }}
                >
                  {recipe}
                </Markdown>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
      <AnimatePresence>
        {showQuotaModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 sm:p-8 text-center">
                <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-stone-900 mb-2">
                  Batas Penggunaan Habis
                </h3>
                <p className="text-stone-600 mb-8">
                  Maaf, batas penggunaan harian Anda sudah habis. Silakan coba lagi besok untuk meracik resep baru.
                </p>
                <button
                  onClick={() => setShowQuotaModal(false)}
                  className="w-full py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
