import { useState, useEffect, useRef } from 'react';
import { getReportStats, getMemberGrowth, getRevenueOverview } from '../lib/stats';
import { getPayments } from '../lib/payments';
import StatCard from '../components/StatCard';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  DollarSign,
  Users,
  RefreshCw,
  AlertTriangle,
  Download,
  FileText,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { formatNepaliDate, getNepaliMonthYear } from '../lib/nepali-date';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  Legend
);

const chartBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      backgroundColor: '#111827',
      titleColor: '#f9fafb',
      bodyColor: '#d1d5db',
      borderColor: 'rgba(220, 38, 38, 0.3)',
      borderWidth: 1,
      cornerRadius: 10,
      padding: 12,
      titleFont: { weight: '700', size: 13, family: 'Inter' },
      bodyFont: { size: 12, family: 'Inter' },
      displayColors: false,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#9ca3af',
        font: { size: 11, family: 'Inter', weight: '500' },
      },
      border: { display: false },
    },
    y: {
      grid: { color: 'rgba(0,0,0,0.04)' },
      ticks: {
        color: '#9ca3af',
        font: { size: 11, family: 'Inter' },
      },
      border: { display: false },
      beginAtZero: true,
    },
  },
};

export default function Reports() {
  const [range, setRange] = useState('year');
  const [stats, setStats] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const rangeToMonths = { month: 1, '3months': 3, '6months': 6, year: 12 };
      const months = rangeToMonths[range] || 12;

      const [statsData, growth, revenue, paymentsData] = await Promise.all([
        getReportStats(range),
        getMemberGrowth(months),
        getRevenueOverview(months),
        getPayments(),
      ]);

      setStats(statsData);
      setGrowthData(growth);
      setRevenueData(revenue);
      setPayments(paymentsData || []);
    } catch (err) {
      console.error('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [range]);

  const formatDate = (dateStr) => {
    return formatNepaliDate(dateStr, 'short');
  };

  const handleExportCSV = () => {
    if (payments.length === 0) return;

    const headers = ['Date', 'Member', 'Amount', 'Method', 'Notes'];
    const rows = payments.map((p) => [
      formatDate(p.payment_date),
      p.members?.name || '—',
      p.amount,
      p.payment_method || '—',
      p.notes || '',
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Convert Gregorian month labels to Nepali
  const toNepaliLabels = (data) => {
    if (!data) return null;
    const nepaliData = {};
    Object.entries(data).forEach(([key, value]) => {
      // key is like "Apr 2026" — parse to a date and convert
      const date = new Date(key);
      if (!isNaN(date.getTime())) {
        const label = getNepaliMonthYear(date);
        nepaliData[label] = value;
      } else {
        nepaliData[key] = value;
      }
    });
    return nepaliData;
  };

  // Build chart datasets
  const nepaliRevenue = toNepaliLabels(revenueData);
  const revenueChartData = nepaliRevenue
    ? {
        labels: Object.keys(nepaliRevenue),
        datasets: [
          {
            label: 'Revenue (Rs.)',
            data: Object.values(nepaliRevenue),
            backgroundColor: 'rgba(220, 38, 38, 0.15)',
            borderColor: '#DC2626',
            borderWidth: 2.5,
            borderRadius: 6,
            hoverBackgroundColor: 'rgba(220, 38, 38, 0.3)',
          },
        ],
      }
    : null;

  const nepaliGrowth = toNepaliLabels(growthData);
  const growthChartData = nepaliGrowth
    ? {
        labels: Object.keys(nepaliGrowth),
        datasets: [
          {
            label: 'New Members',
            data: Object.values(nepaliGrowth),
            fill: true,
            backgroundColor: (ctx) => {
              const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 280);
              gradient.addColorStop(0, 'rgba(220, 38, 38, 0.15)');
              gradient.addColorStop(1, 'rgba(220, 38, 38, 0.0)');
              return gradient;
            },
            borderColor: '#DC2626',
            borderWidth: 2.5,
            pointBackgroundColor: '#DC2626',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.35,
          },
        ],
      }
    : null;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '100px' }}>
        <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-text">
          <h1>Reports</h1>
          <p>Analyze your gym's performance with charts and data.</p>
        </div>
        <div className="report-actions">
          <select
            className="filter-select"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            id="report-range-select"
          >
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="year">This Year</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            id="export-csv-btn"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        <StatCard
          title="Total Collected"
          value={`Rs. ${(stats?.totalCollected || 0).toLocaleString()}`}
          icon={DollarSign}
          color="#059669"
        />
        <StatCard
          title="New Members"
          value={stats?.newMembers || 0}
          icon={Users}
          color="#2563eb"
        />
        <StatCard
          title="Total Payments"
          value={stats?.renewals || 0}
          icon={RefreshCw}
          color="#d97706"
        />
        <StatCard
          title="Unpaid Balances"
          value={`Rs. ${(stats?.unpaidBalances || 0).toLocaleString()}`}
          icon={AlertTriangle}
          color="#DC2626"
        />
      </div>

      {/* Charts */}
      <div className="content-grid">
        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="content-card-title">
                <TrendingUp size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Revenue Overview
              </div>
              <div className="content-card-subtitle">Monthly revenue breakdown</div>
            </div>
          </div>
          <div className="chart-wrapper">
            {revenueChartData ? (
              <Bar data={revenueChartData} options={{
                ...chartBaseOptions,
                plugins: {
                  ...chartBaseOptions.plugins,
                  tooltip: {
                    ...chartBaseOptions.plugins.tooltip,
                    callbacks: {
                      label: (ctx) => `Rs. ${ctx.parsed.y.toLocaleString()}`,
                    },
                  },
                },
              }} />
            ) : (
              <div className="empty-state">
                <FileText />
                <p>No revenue data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <div>
              <div className="content-card-title">
                <Users size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Member Growth
              </div>
              <div className="content-card-subtitle">New members over time</div>
            </div>
          </div>
          <div className="chart-wrapper">
            {growthChartData ? (
              <Line data={growthChartData} options={chartBaseOptions} />
            ) : (
              <div className="empty-state">
                <FileText />
                <p>No growth data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="content-card">
        <div className="content-card-header">
          <div>
            <div className="content-card-title">
              <Calendar size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Payment History
            </div>
            <div className="content-card-subtitle">
              {payments.length} total payment{payments.length !== 1 ? 's' : ''} recorded
            </div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table" id="payment-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Member</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-state">
                      <DollarSign />
                      <p>No payments recorded yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.slice(0, 25).map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td>
                      <span className="member-name">{payment.members?.name || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        Rs. {payment.amount?.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-active" style={{ textTransform: 'capitalize' }}>
                        {payment.payment_method || '—'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {payment.notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {payments.length > 25 && (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
            Showing 25 of {payments.length} payments. Export to CSV to view all.
          </div>
        )}
      </div>
    </div>
  );
}
