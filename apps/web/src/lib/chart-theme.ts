// Shared chart theme for consistent brand-aligned visualizations

export const chartColors = {
  sage: {
    primary: '#71907C',
    light: '#8AA694',
    lighter: '#E4EBE6',
    dark: '#3A4D41',
  },
  lavender: {
    primary: '#8A75BD',
    light: '#9F8ECB',
    lighter: '#EBE7F5',
    dark: '#4A3B69',
  },
  palette: [
    '#71907C', // sage-600
    '#8A75BD', // lavender-600
    '#f59e0b', // amber-500
    '#64748b', // slate-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
  ],
};

export const chartDefaults = {
  fontFamily: "'Inter', sans-serif",
  gridColor: '#f1f5f9',
  textColor: '#64748b',
  borderRadius: 8,
  tooltipStyle: {
    backgroundColor: 'white',
    borderRadius: 12,
    boxShadow: '0 12px 40px -12px rgba(0, 0, 0, 0.1)',
    padding: '8px 12px',
    border: 'none',
  },
};

// Recharts-compatible theme config
export function getRechartsTheme() {
  return {
    colors: chartColors.palette,
    cartesianGrid: {
      strokeDasharray: '3 3',
      stroke: chartDefaults.gridColor,
    },
    xAxis: {
      tick: { fill: chartDefaults.textColor, fontSize: 12, fontFamily: chartDefaults.fontFamily },
      axisLine: { stroke: chartDefaults.gridColor },
      tickLine: false,
    },
    yAxis: {
      tick: { fill: chartDefaults.textColor, fontSize: 12, fontFamily: chartDefaults.fontFamily },
      axisLine: false,
      tickLine: false,
    },
    tooltip: {
      contentStyle: chartDefaults.tooltipStyle,
      labelStyle: { color: '#1e293b', fontWeight: 600, fontSize: 13 },
      itemStyle: { color: '#475569', fontSize: 12 },
    },
  };
}
