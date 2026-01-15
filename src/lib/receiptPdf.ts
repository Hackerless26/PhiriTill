import { jsPDF } from "jspdf";
import { formatZmw } from "./currency";

type ReceiptItem = {
  name: string;
  quantity: number;
  price: number;
};

export type ReceiptData = {
  receipt_no: string;
  payment_method: string;
  total: number;
  items: ReceiptItem[];
  created_at: string;
  cashier?: string;
};

async function loadLogoDataUrl() {
  try {
    const response = await fetch("/logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function generateFallbackLogo() {
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#2bb673";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 18px sans-serif";
  ctx.fillText("PhiriTill", 8, 26);
  return canvas.toDataURL("image/png");
}

export async function generateReceiptPdf(receipt: ReceiptData) {
  const doc = new jsPDF();
  const logo = (await loadLogoDataUrl()) ?? generateFallbackLogo();
  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 40, 14);
  }
  doc.setFontSize(16);
  doc.text("PhiriTill Receipt", 14, 32);
  doc.setFontSize(10);
  doc.text(`Receipt: ${receipt.receipt_no}`, 14, 40);
  doc.text(`Date: ${new Date(receipt.created_at).toLocaleString()}`, 14, 46);
  if (receipt.cashier) {
    doc.text(`Cashier: ${receipt.cashier}`, 14, 52);
  }

  let y = receipt.cashier ? 64 : 58;
  doc.setFontSize(11);
  doc.text("Item", 14, y);
  doc.text("Qty", 120, y);
  doc.text("Total", 160, y);
  y += 6;

  receipt.items.forEach((item) => {
    const lineTotal = item.price * item.quantity;
    doc.setFontSize(10);
    doc.text(item.name, 14, y);
    doc.text(String(item.quantity), 120, y);
    doc.text(formatZmw(lineTotal), 160, y);
    y += 6;
  });

  y += 6;
  doc.setFontSize(12);
  doc.text(`Total: ${formatZmw(receipt.total)}`, 14, y);

  doc.save(`${receipt.receipt_no}.pdf`);
}
