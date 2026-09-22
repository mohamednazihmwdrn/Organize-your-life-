import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Transaction } from '../types';
import { dbAll } from '../lib/db';
import { money, num, esc } from '../lib/utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

interface MonthStat {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

interface CategoryComparison {
  category: string;
  income: number;
  expense: number;
  total: number;
}

interface CategoryPieItem {
  name: string;
  value: number;
  color: string;
}

const PALETTE_EXPENSE = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
  '#64748b',
];

const PALETTE_INCOME = [
  '#10b981',
  '#059669',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
];

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '10px 14px',
          boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
          fontSize: '12px',
          direction: 'rtl',
        }}
      >
        <p style={{ fontWeight: 800, marginBottom: '6px', color: 'var(--text)' }}>
          {label || payload[0]?.name}
        </p>
        {payload.map((entry: any, index: number) => (
          <div
            key={`item-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              color: entry.color || entry.fill,
              margin: '3px 0',
              fontWeight: 700,
            }}
          >
            <span>{entry.name}:</span>
            <span>{money(entry.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const ReportsView: React.FC = () => {
  const [months, setMonths] = useState<MonthStat[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');
  const [activeChartTab, setActiveChartTab] = useState<'comparison' | 'expensePie' | 'incomePie'>('comparison');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const txs = await dbAll<Transaction>('transactions');
        setTransactions(txs);

        const now = new Date();
        const monthIndex = now.getMonth();
        const year = now.getFullYear();

        const mList: MonthStat[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(year, monthIndex - i, 1);
          const key = d.toISOString().slice(0, 7);
          const label = new Intl.DateTimeFormat('ar-EG', { month: 'short', year: 'numeric' }).format(d);
          mList.push({ key, label, income: 0, expense: 0, net: 0 });
        }

        const currentMonthKey = now.toISOString().slice(0, 7);
        setSelectedMonthKey(currentMonthKey);

        txs.forEach((t) => {
          const amt = num(t.amount);
          const mKey = t.date.slice(0, 7);
          const matchMonth = mList.find((x) => x.key === mKey);
          if (matchMonth) {
            if (t.type === 'income') matchMonth.income += amt;
            if (t.type === 'expense') matchMonth.expense += amt;
            matchMonth.net = matchMonth.income - matchMonth.expense;
          }
        });

        setMonths(mList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filtered current selected month data
  const {
    categoryComparisonData,
    expensePieData,
    incomePieData,
    totalMonthIncome,
    totalMonthExpense,
    topExpenseCat,
    topIncomeCat,
    savingsRate,
  } = useMemo(() => {
    const targetMonth = selectedMonthKey || new Date().toISOString().slice(0, 7);
    const monthTxs = transactions.filter((t) => t.date.startsWith(targetMonth));

    const catMap: Record<string, { income: number; expense: number }> = {};
    let tIncome = 0;
    let tExpense = 0;

    monthTxs.forEach((t) => {
      const amt = num(t.amount);
      const cat = t.category?.trim() || 'عام / غير مصنف';
      if (!catMap[cat]) {
        catMap[cat] = { income: 0, expense: 0 };
      }
      if (t.type === 'income') {
        catMap[cat].income += amt;
        tIncome += amt;
      } else if (t.type === 'expense') {
        catMap[cat].expense += amt;
        tExpense += amt;
      }
    });

    // Bar comparison list
    const compData: CategoryComparison[] = Object.entries(catMap)
      .map(([cat, val]) => ({
        category: cat,
        income: val.income,
        expense: val.expense,
        total: val.income + val.expense,
      }))
      .sort((a, b) => b.total - a.total);

    // Expense Pie
    const expList = Object.entries(catMap)
      .filter(([_, val]) => val.expense > 0)
      .map(([cat, val], idx) => ({
        name: cat,
        value: val.expense,
        color: PALETTE_EXPENSE[idx % PALETTE_EXPENSE.length],
      }))
      .sort((a, b) => b.value - a.value);

    // Income Pie
    const incList = Object.entries(catMap)
      .filter(([_, val]) => val.income > 0)
      .map(([cat, val], idx) => ({
        name: cat,
        value: val.income,
        color: PALETTE_INCOME[idx % PALETTE_INCOME.length],
      }))
      .sort((a, b) => b.value - a.value);

    const sRate = tIncome > 0 ? Math.round(((tIncome - tExpense) / tIncome) * 100) : 0;

    return {
      categoryComparisonData: compData,
      expensePieData: expList,
      incomePieData: incList,
      totalMonthIncome: tIncome,
      totalMonthExpense: tExpense,
      topExpenseCat: expList[0] || null,
      topIncomeCat: incList[0] || null,
      savingsRate: sRate,
    };
  }, [transactions, selectedMonthKey]);

  if (loading) {
    return (
      <div className="card panel" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
        <div>جاري تحميل التقارير والرسوم البيانية...</div>
      </div>
    );
  }

  const selectedMonthObj = months.find((m) => m.key === selectedMonthKey) || {
    label: 'الشهر الحالي',
    income: totalMonthIncome,
    expense: totalMonthExpense,
    net: totalMonthIncome - totalMonthExpense,
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    setExportNotice('جاري إنشاء وتجهيز ملف PDF للتقرير...');

    try {
      // Small pause to allow UI to settle
      await new Promise((resolve) => setTimeout(resolve, 150));

      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f8fafc',
        windowWidth: element.scrollWidth,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = 210; // A4 width mm
      const pdfHeight = 297; // A4 height mm
      const margin = 10; // 10mm margins
      const printWidth = pdfWidth - margin * 2;
      const imgHeight = (canvas.height * printWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = margin;

      // First page
      pdf.addImage(imgData, 'PNG', margin, position, printWidth, imgHeight, undefined, 'FAST');
      heightLeft -= (pdfHeight - margin * 2);

      // Remaining pages if report is long
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, printWidth, imgHeight, undefined, 'FAST');
        heightLeft -= (pdfHeight - margin * 2);
      }

      const fileName = `التقرير-المالي-${selectedMonthKey || 'الشهر-الحالي'}.pdf`;
      pdf.save(fileName);
      setExportNotice(`تم تحميل ملف "${fileName}" بنجاح! 🎉`);
      setTimeout(() => setExportNotice(null), 4000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setExportNotice('حدث خطأ أثناء إنشاء ملف PDF، يرجى المحاولة مجدداً.');
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-head">
        <div>
          <h3>التقارير والتحليلات البيانية</h3>
          <p>تحليل مرئي تفاعلي لتوزيع المصروفات مقابل الدخل لكل فئة واتجاهات التدفق المالي.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700 }}>الشهر:</label>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', fontWeight: 700 }}
              value={selectedMonthKey}
              onChange={(e) => setSelectedMonthKey(e.target.value)}
            >
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExportPDF}
            disabled={isExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              fontSize: '13px',
              padding: '7px 14px',
              borderColor: 'var(--primary)',
              color: 'var(--primary)',
              backgroundColor: isExporting ? 'var(--surface2)' : 'var(--surface)',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.1)',
            }}
            title="تصدير كافة مخططات المصروفات والتقارير كملف PDF"
          >
            {isExporting ? (
              <>
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid var(--primary)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span>جاري التصدير...</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: '15px' }}>📄</span>
                <span>تصدير كـ PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Notification Toast Banner */}
      {exportNotice && (
        <div
          style={{
            background: exportNotice.includes('خطأ') ? '#fee2e2' : '#ecfdf5',
            color: exportNotice.includes('خطأ') ? '#dc2626' : '#047857',
            border: `1px solid ${exportNotice.includes('خطأ') ? '#fca5a5' : '#a7f3d0'}`,
            padding: '10px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            fontSize: '13px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          }}
        >
          <span>{exportNotice}</span>
          <button
            type="button"
            onClick={() => setExportNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              color: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Printable Report Canvas Wrapper */}
      <div ref={reportRef} id="printable-report" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Printable Header Info (Appears cleanly in PDF and screen) */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
            color: '#ffffff',
            padding: '16px 20px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 16px rgba(37,99,235,0.15)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', opacity: 0.85, fontWeight: 700 }}>
              تقرير الإيرادات والمصروفات المالية
            </div>
            <h4 style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 900 }}>
              ملخص شهر: {selectedMonthObj.label}
            </h4>
          </div>
          <div style={{ textAlign: 'left', fontSize: '11px', opacity: 0.9 }}>
            <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')}</div>
            <div style={{ fontWeight: 700, marginTop: '2px' }}>نظام إدارة المال الشخصي</div>
          </div>
        </div>

        {/* Quick Summary Cards */}
        <div className="cards report-mini-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="card stat">
            <div className="label">إجمالي دخل الشهر</div>
            <div className="value amount-income">{money(totalMonthIncome)}</div>
            <div className="sub">
              {topIncomeCat ? `أعلى مصدر: ${topIncomeCat.name}` : 'لا توجد مداخيل مسجلة'}
            </div>
            <div className="stat-icon">📈</div>
          </div>

          <div className="card stat">
            <div className="label">إجمالي مصروف الشهر</div>
            <div className="value amount-expense">{money(totalMonthExpense)}</div>
            <div className="sub">
              {topExpenseCat ? `أعلى تصنيف: ${topExpenseCat.name}` : 'لا توجد مصروفات مسجلة'}
            </div>
            <div className="stat-icon">📉</div>
          </div>

          <div className="card stat">
            <div className="label">صافي الفائض / العجز</div>
            <div
              className={`value ${
                totalMonthIncome - totalMonthExpense >= 0 ? 'kpi-positive' : 'kpi-negative'
              }`}
            >
              {money(totalMonthIncome - totalMonthExpense)}
            </div>
            <div className="sub">
              معدل الادخار: <b style={{ color: savingsRate >= 0 ? '#10b981' : '#ef4444' }}>{savingsRate}%</b>
            </div>
            <div className="stat-icon">⚖️</div>
          </div>
        </div>

      {/* Main Interactive Category Breakdown Section */}
      <div className="card panel" style={{ marginBottom: '20px' }}>
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h4>📊 توزيع المصروفات مقابل الدخل لكل فئة</h4>
            <small className="muted" style={{ fontSize: '11px' }}>
              مقارنة تفاعلية لحجم الإنفاق والإيرادات حسب الفئات لشهر {selectedMonthObj.label}
            </small>
          </div>

          {/* Chart View Selector Tabs */}
          <div
            className="chart-view-selector"
            style={{
              display: 'flex',
              background: 'var(--surface2)',
              padding: '3px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeChartTab === 'comparison' ? 'var(--primary)' : 'transparent',
                color: activeChartTab === 'comparison' ? '#ffffff' : 'var(--text)',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setActiveChartTab('comparison')}
            >
              مقارنة الأعمدة (دخل ومصروف)
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeChartTab === 'expensePie' ? 'var(--primary)' : 'transparent',
                color: activeChartTab === 'expensePie' ? '#ffffff' : 'var(--text)',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setActiveChartTab('expensePie')}
            >
              دائري (المصروفات)
            </button>
            <button
              type="button"
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeChartTab === 'incomePie' ? 'var(--primary)' : 'transparent',
                color: activeChartTab === 'incomePie' ? '#ffffff' : 'var(--text)',
                fontWeight: 700,
                fontSize: '11px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => setActiveChartTab('incomePie')}
            >
              دائري (المداخيل)
            </button>
          </div>
        </div>

        {/* Dynamic Chart Container */}
        <div style={{ width: '100%', minHeight: '340px', marginTop: '16px' }}>
          {categoryComparisonData.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--muted)',
                fontSize: '13px',
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              لا توجد أي معاملات مسجلة في هذا الشهر حتى الآن لإظهار الرسم البياني.
            </div>
          ) : activeChartTab === 'comparison' ? (
            <div className="chart-touch-scroll">
              <div style={{ width: '100%', minWidth: Math.max(340, categoryComparisonData.length * 65), height: '350px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryComparisonData}
                    margin={{ top: 20, right: 20, left: 10, bottom: 40 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis
                      dataKey="category"
                      tick={{ fill: 'var(--text)', fontSize: 11 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: 'var(--muted)', fontSize: 11 }}
                      tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : val)}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      height={36}
                      formatter={(val) => (
                        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '12px' }}>
                          {val === 'income' ? 'الدخل' : 'المصروف'}
                        </span>
                      )}
                    />
                    <Bar
                      name="income"
                      dataKey="income"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                    />
                    <Bar
                      name="expense"
                      dataKey="expense"
                      fill="#ef4444"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={45}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : activeChartTab === 'expensePie' ? (
            <div className="chart-touch-scroll">
              <div style={{ width: '100%', minWidth: '320px', height: '350px' }}>
                {expensePieData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                    لا توجد مصروفات مسجلة في هذا الشهر.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, percent }) =>
                          `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                        }
                      >
                        {expensePieData.map((entry, index) => (
                          <Cell key={`cell-exp-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          ) : (
            <div className="chart-touch-scroll">
              <div style={{ width: '100%', minWidth: '320px', height: '350px' }}>
                {incomePieData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                    لا توجد مداخيل مسجلة في هذا الشهر.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomePieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={50}
                        paddingAngle={3}
                        label={({ name, percent }) =>
                          `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                        }
                      >
                        {incomePieData.map((entry, index) => (
                          <Cell key={`cell-inc-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Detailed Category Table Breakdown */}
        {categoryComparisonData.length > 0 && (
          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <h5 style={{ marginBottom: '10px', fontSize: '13px', fontWeight: 800 }}>
              📋 جدول تفصيلي للمصروفات والدخل حسب الفئة:
            </h5>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>الفئة / التصنيف</th>
                    <th>إجمالي الدخل</th>
                    <th>إجمالي المصروف</th>
                    <th>الصافي للفئة</th>
                    <th>نسبة الإنفاق من الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryComparisonData.map((c) => {
                    const netVal = c.income - c.expense;
                    const expRatio = totalMonthExpense > 0 ? Math.round((c.expense / totalMonthExpense) * 100) : 0;

                    return (
                      <tr key={c.category}>
                        <td style={{ fontWeight: 800 }}>{esc(c.category)}</td>
                        <td className="amount-income">{c.income > 0 ? money(c.income) : '—'}</td>
                        <td className="amount-expense">{c.expense > 0 ? money(c.expense) : '—'}</td>
                        <td
                          style={{
                            fontWeight: 800,
                            color: netVal >= 0 ? '#10b981' : '#ef4444',
                          }}
                        >
                          {netVal > 0 ? '+' : ''}{money(netVal)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                flex: 1,
                                height: '6px',
                                background: 'var(--border)',
                                borderRadius: '4px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${expRatio}%`,
                                  height: '100%',
                                  background: '#ef4444',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 700 }}>{expRatio}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 6 Months Trend Area Chart */}
      <div className="card panel">
        <div className="panel-head">
          <div>
            <h4>📈 مسار وتدفق الأموال (آخر 6 أشهر)</h4>
            <small className="muted" style={{ fontSize: '11px' }}>
              متابعة نمو الدخل والمصروفات خلال النصف سنة الماضي
            </small>
          </div>
        </div>

        <div className="chart-touch-scroll" style={{ marginTop: '14px' }}>
          <div style={{ width: '100%', minWidth: '320px', height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={months} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text)', fontSize: 11 }} />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  tickFormatter={(val) => (val >= 1000 ? `${val / 1000}k` : val)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={30}
                  formatter={(val) => (
                    <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: '12px' }}>
                      {val === 'income' ? 'الدخل' : 'المصروف'}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  name="income"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#incomeGrad)"
                />
                <Area
                  type="monotone"
                  name="expense"
                  dataKey="expense"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#expenseGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
