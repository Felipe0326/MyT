export const COLORS = {
  digital: "#74785C", 
  traditional: "#8A495D", 
  textDark: "#2E332A",
  grid: "#E5E7EB", 
  accent: "#D3BC8D",
  brown: "#7B543E",
  year2021: "#cbd5e1", 
  year2022: "#94a3b8", 
  year2023: "#8A495D", 
  year2024: "#2E332A", 
  year2025: "#3b82f6",
  year2026: "#F97316", 
  year2026Projected: "#F97316", 
  daily2024: "#94a3b8", 
  daily2025: "#3b82f6", 

  historyLine: {
    2026: "#8A495D", 
    2025: "#74785C", 
    2024: "#64748b", 
    2023: "#94a3b8", 
    2022: "#cbd5e1", 
    2021: "#e2e8f0", 
  }
};

export const formatCurrency = (value: number) => new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
}).format(value);
