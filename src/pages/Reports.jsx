import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  DollarSign,
  Download,
  FileText,
  Minus,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import StatCard from '../components/StatCard';
import { getPayments } from '../lib/payments';
import { getMemberGrowth, getReportStats, getRevenueOverview } from '../lib/stats';
import { getPaymentMethodLabel } from '../lib/payment-methods';
import { formatNepaliDate, toLocalISODate } from '../lib/nepali-date';
import { getReportRangeConfig } from '../lib/report-range';

function normalizeMetricData(data) {
  if (!data || typeof data !== 'object') return null;

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, Number(value) || 0])
  );
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  const safeHex = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  const intValue = Number.parseInt(safeHex, 16);

  return {
    r: (intValue >> 16) & 255,
    g: (intValue >> 8) & 255,
    b: intValue & 255,
  };
}

function buildMetricTheme(color) {
  const { r, g, b } = hexToRgb(color);

  return {
    '--metric-accent': color,
    '--metric-accent-soft': `rgba(${r}, ${g}, ${b}, 0.14)`,
    '--metric-accent-fade': `rgba(${r}, ${g}, ${b}, 0.08)`,
    '--metric-accent-line': `rgba(${r}, ${g}, ${b}, 0.2)`,
    '--metric-accent-shadow': `rgba(${r}, ${g}, ${b}, 0.22)`,
  };
}

function formatMetricAverage(value) {
  if (Number.isInteger(value)) return value;
  return Number(value.toFixed(1));
}

function formatCompactMetricLabel(label) {
  const firstToken = String(label || '-').trim().split(/\s+/)[0];
  if (firstToken.length <= 4) return firstToken;
  return firstToken.slice(0, 3);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? '');
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function MetricInsightCard({
  icon: Icon,
  title,
  subtitle,
  data,
  color,
  emptyText,
  valueFormatter,
  totalLabel,
  centerLabel,
}) {
  const entries = data ? Object.entries(data) : [];
  const totalValue = entries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
  const averageValue = entries.length ? totalValue / entries.length : 0;
  const latestEntry = entries[entries.length - 1] || null;
  const previousEntry = entries.length > 1 ? entries[entries.length - 2] : null;
  const peakEntry = entries.reduce((currentPeak, entry) => {
    if (!currentPeak) return entry;
    return Number(entry[1]) > Number(currentPeak[1]) ? entry : currentPeak;
  }, null);
  const recentEntries = entries.slice(-6);
  const recentMax = Math.max(1, ...recentEntries.map(([, value]) => Number(value) || 0));
  const latestValue = Number(latestEntry?.[1]) || 0;
  const previousValue = Number(previousEntry?.[1]) || 0;
  const peakValue = Number(peakEntry?.[1]) || 0;
  const peakMatch = peakValue > 0 ? Math.min(latestValue / peakValue, 1) : 0;
  const ringProgress = peakValue > 0 ? Math.max(0.08, peakMatch) : 0;
  const trendDelta = previousEntry ? latestValue - previousValue : null;
  const trendTone = trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat';
  const TrendIcon = trendTone === 'up' ? ArrowUpRight : trendTone === 'down' ? ArrowDownRight : Minus;
  const themeStyle = {
    ...buildMetricTheme(color),
    '--metric-progress': `${Math.round(ringProgress * 100)}%`,
  };
  const averageDisplay = formatMetricAverage(averageValue);

  let trendMessage = 'No previous period yet';

  if (trendDelta === 0) {
    trendMessage = 'No change from the previous period';
  } else if (trendDelta) {
    trendMessage = `${trendDelta > 0 ? '+' : '-'}${valueFormatter(Math.abs(trendDelta))} vs previous`;
  }

  return (
    <div className="content-card reports-insight-card" style={themeStyle}>
      <div className="reports-insight-head">
        <div className="reports-insight-heading">
          <div className="reports-insight-icon">
            <Icon size={18} />
          </div>
          <div>
            <div className="reports-insight-title">{title}</div>
            <div className="reports-insight-subtitle">{subtitle}</div>
          </div>
        </div>
        <div className="reports-insight-pill">{entries.length} periods</div>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <FileText />
          <p>{emptyText}</p>
        </div>
      ) : (
        <>
          <div className="reports-insight-main">
            <div className="reports-insight-ring-panel">
              <div className="reports-insight-ring">
                <div className="reports-insight-ring-inner">
                  <span className="reports-insight-ring-label">{centerLabel}</span>
                  <strong>{valueFormatter(latestValue)}</strong>
                  <small>{latestEntry?.[0] || 'No data yet'}</small>
                </div>
              </div>

              <div className={`reports-insight-trend reports-insight-trend-${trendTone}`}>
                <TrendIcon size={15} />
                <span>{trendMessage}</span>
              </div>
            </div>

            <div className="reports-insight-stats">
              <div className="reports-insight-stat-card">
                <span>{totalLabel}</span>
                <strong>{valueFormatter(totalValue)}</strong>
                <small>Across {entries.length} periods</small>
              </div>

              <div className="reports-insight-stat-card">
                <span>Average</span>
                <strong>{valueFormatter(averageDisplay)}</strong>
                <small>Per selected period</small>
              </div>

              <div className="reports-insight-stat-card">
                <span>Peak Period</span>
                <strong>{peakEntry ? valueFormatter(peakValue) : '-'}</strong>
                <small>{peakEntry?.[0] || 'No data yet'}</small>
              </div>
            </div>
          </div>

          <div className="reports-insight-trend-card">
            <div className="reports-insight-section-head">
              <div>
                <div className="reports-insight-section-title">Recent Trend</div>
                <div className="reports-insight-section-subtitle">
                  Last {recentEntries.length} period{recentEntries.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="reports-insight-scale">
                <span>Top</span>
                <strong>{valueFormatter(recentMax)}</strong>
              </div>
            </div>

            <div className="reports-insight-bars">
              {recentEntries.map(([label, value]) => {
                const numericValue = Number(value) || 0;
                const height = numericValue <= 0
                  ? '0%'
                  : `${Math.max(14, (numericValue / recentMax) * 100)}%`;
                const isLatest = latestEntry?.[0] === label;
                const isPeak = peakEntry?.[0] === label;

                return (
                  <div
                    key={label}
                    className="reports-insight-bar-group"
                    title={`${label}: ${valueFormatter(numericValue)}`}
                  >
                    <div className="reports-insight-bar-track">
                      <div
                        className={`reports-insight-bar ${isLatest ? 'is-active' : ''} ${isPeak ? 'is-peak' : ''}`}
                        style={{ height }}
                      />
                    </div>

                    <div className="reports-insight-bar-caption">
                      <span className="reports-insight-bar-label">
                        {formatCompactMetricLabel(label)}
                      </span>
                      <span className="reports-insight-bar-note">
                        {isPeak ? 'Peak' : isLatest ? 'Now' : '\u00A0'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="reports-insight-footer">
            <span className="reports-insight-chip">Latest: {latestEntry?.[0] || '-'}</span>
            <span className="reports-insight-chip">Peak match: {Math.round(peakMatch * 100)}%</span>
            <span className="reports-insight-chip">Moments shown: {entries.length}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function Reports() {
  const [range, setRange] = useState('year');
  const [stats, setStats] = useState(null);
  const [growthData, setGrowthData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReportData = async () => {
    setLoading(true);
    setError('');

    try {
      const { startDate } = getReportRangeConfig(range);

      const [statsData, growth, revenue, paymentsData] = await Promise.all([
        getReportStats(range),
        getMemberGrowth(range),
        getRevenueOverview(range),
        getPayments({ startDate, endDate: toLocalISODate(new Date()) }),
      ]);

      setStats(statsData);
      setGrowthData(growth);
      setRevenueData(revenue);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
    } catch (err) {
      console.error('Report fetch error:', err);
      setError(err.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [range]);

  const formatDate = (dateStr) => formatNepaliDate(dateStr, 'short');

  const handleExportCSV = () => {
    if (payments.length === 0) return;

    const headers = ['Date', 'Member', 'Amount', 'Method', 'Notes'];
    const rows = payments.map((payment) => [
      formatDate(payment.payment_date),
      payment.members?.name || '-',
      payment.amount,
      payment.payment_method || '-',
      payment.notes || '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `payments_report_${toLocalISODate(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const nepaliRevenue = normalizeMetricData(revenueData);
  const nepaliGrowth = normalizeMetricData(growthData);

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
          <p>Analyze your gym&apos;s performance with charts and data.</p>
        </div>
        <div className="report-actions">
          <select
            className="filter-select"
            value={range}
            onChange={(event) => setRange(event.target.value)}
            id="report-range-select"
          >
            <option value="alltime">All Time</option>
            <option value="month">This Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="year">This Year</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            disabled={payments.length === 0}
            id="export-csv-btn"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

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
          title="Total Transactions"
          value={stats?.totalPayments || 0}
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

      <div className="content-grid">
        <MetricInsightCard
          icon={TrendingUp}
          title="Revenue Overview"
          subtitle="Monthly revenue breakdown"
          data={nepaliRevenue}
          color="#DC2626"
          emptyText="No revenue data available"
          totalLabel="Total Revenue"
          centerLabel="Latest Revenue"
          valueFormatter={(value) => `Rs. ${value.toLocaleString()}`}
        />

        <MetricInsightCard
          icon={Users}
          title="Member Growth"
          subtitle="New members over time"
          data={nepaliGrowth}
          color="#2563eb"
          emptyText="No growth data available"
          totalLabel="Members Added"
          centerLabel="Latest Growth"
          valueFormatter={(value) => `${value}`}
        />
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <div>
            <div className="content-card-title">
              <Calendar size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Payment History
            </div>
            <div className="content-card-subtitle">
              {payments.length} payment{payments.length !== 1 ? 's' : ''} {range === 'alltime' ? 'recorded all time' : 'in the selected range'}
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
                      <p>{range === 'alltime' ? 'No payments recorded yet.' : 'No payments recorded in this range yet.'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.slice(0, 25).map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td>
                      <span className="member-name">{payment.members?.name || '-'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                        Rs. {payment.amount?.toLocaleString()}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-active" style={{ textTransform: 'capitalize' }}>
                        {getPaymentMethodLabel(payment.payment_method)}
                      </span>
                    </td>
                    <td
                      style={{
                        color: 'var(--color-text-secondary)',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {payment.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {payments.length > 25 && (
          <div
            style={{
              textAlign: 'center',
              padding: '16px 0',
              color: 'var(--color-text-muted)',
              fontSize: 13,
            }}
          >
            Showing 25 of {payments.length} payments. Export to CSV to view all.
          </div>
        )}
      </div>
    </div>
  );
}
