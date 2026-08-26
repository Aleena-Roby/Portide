import React, { useState, useEffect } from 'react';
import { BerthUtilisationData } from '../../types';
import { useApp } from '../../context/AppContext';
import { 
  PieChart, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar, 
  RefreshCw, 
  Anchor, 
  CheckCircle2, 
  Ship, 
  Wrench, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  SlidersHorizontal,
  Activity,
  Layers
} from 'lucide-react';

export const BerthUtilisationDashboard: React.FC = () => {
  const { currentUser, addToast } = useApp();

  const [period, setPeriod] = useState<'today' | '7days' | 'month' | 'custom'>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [data, setData] = useState<BerthUtilisationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  const fetchUtilisationData = async () => {
    setLoading(true);
    setError('');
    try {
      let url = `http://127.0.0.1:8000/api/berths/utilisation/?period=${period}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
      }

      const response = await fetch(url, {
        headers: {
          'X-User-Email': currentUser?.email || '',
          'X-User-Role': 'port_operations_officer',
          'X-User-Id': currentUser?.id || ''
        }
      });

      const resJson = await response.json();
      if (response.ok && resJson.status === 'success') {
        setData(resJson.data);
      } else {
        setError(resJson.message || 'Failed to load berth utilisation data.');
      }
    } catch (err) {
      setError('Unable to connect to backend server. Please verify Django API server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUtilisationData();
  }, [period]);

  const handleApplyCustomRange = () => {
    if (!startDate || !endDate) {
      addToast('warning', 'Invalid Custom Range', 'Please select both start date and end date.');
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      addToast('warning', 'Invalid Range', 'End date must be after start date.');
      return;
    }
    fetchUtilisationData();
  };

  const kpis = data?.kpis;
  const breakdown = data?.berth_breakdown || [];
  const dailyMovements = data?.daily_movements || [];
  const distribution = data?.status_distribution || { AVAILABLE: 0, RESERVED: 0, OCCUPIED: 0, MAINTENANCE: 0 };

  const maxUtilisationPct = Math.max(...breakdown.map(b => b.utilisation_pct), 10);
  const maxMovementsDaily = Math.max(...dailyMovements.map(d => d.total), 5);

  return (
    <div className="space-y-6">
      {/* Dashboard Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950 to-indigo-950 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>PORT OPERATIONS ANALYTICS</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Berth Utilisation Dashboard</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Operational metrics, occupancy duration, and berth capacity utilization derived directly from PostgreSQL database records.
            </p>
          </div>
          <button
            onClick={fetchUtilisationData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-md transition-all cursor-pointer border border-white/15 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Recalculate Metrics</span>
          </button>
        </div>
      </div>

      {/* Date Range & Period Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-sky-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Time Period:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setPeriod('today')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'today'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Today
          </button>

          <button
            onClick={() => setPeriod('7days')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === '7days'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Last 7 Days
          </button>

          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'month'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setPeriod('custom')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              period === 'custom'
                ? 'bg-sky-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Custom Range
          </button>
        </div>

        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-slate-800">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-white"
            />
            <button
              onClick={handleApplyCustomRange}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
            >
              Apply Filter
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Calculating berth utilisation statistics from operational logs...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</div>
          <button
            onClick={fetchUtilisationData}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          {/* Main KPI Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Overall Utilisation % */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border border-sky-500/20 shadow-xs space-y-1 col-span-2 sm:col-span-1 lg:col-span-2">
              <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Berth Utilisation %</span>
                <PieChart className="w-4 h-4" />
              </div>
              <div className="text-3xl font-black text-sky-600 dark:text-sky-400">
                {kpis?.overall_utilisation_pct ?? 0}%
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {kpis?.total_occupied_hours} hrs occupied / {kpis?.total_operational_hours} hrs available
              </div>
            </div>

            {/* Average Occupancy Duration */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1 col-span-2 sm:col-span-1 lg:col-span-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Avg Occupancy Duration</span>
                <Clock className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {kpis?.avg_occupancy_hours ?? 0} hrs
              </div>
              <div className="text-[11px] font-medium text-slate-500">Per Vessel Stay</div>
            </div>

            {/* Vessel Movements */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1 col-span-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Vessel Movements</span>
                <Ship className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {kpis?.total_vessel_movements ?? 0}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Arrivals / Departures</div>
            </div>

            {/* Total Berths */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-1 col-span-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Berths</span>
                <Anchor className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white">
                {kpis?.total_berths ?? 0}
              </div>
              <div className="text-[11px] font-medium text-slate-500">Configured Berths</div>
            </div>
          </div>

          {/* Highlights: Most & Least Utilised Berths */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Most Utilised Berth
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {kpis?.most_utilised_berth ? kpis.most_utilised_berth.berth_name : 'N/A'}
                </div>
                <div className="text-xs text-slate-500">
                  {kpis?.most_utilised_berth ? `${kpis.most_utilised_berth.occupied_hours} hrs occupied (${kpis.most_utilised_berth.utilisation_pct}%)` : 'No operational records'}
                </div>
              </div>
              {kpis?.most_utilised_berth && (
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                  {kpis.most_utilised_berth.utilisation_pct}%
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500/20 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  Least Utilised Berth
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">
                  {kpis?.least_utilised_berth ? kpis.least_utilised_berth.berth_name : 'N/A'}
                </div>
                <div className="text-xs text-slate-500">
                  {kpis?.least_utilised_berth ? `${kpis.least_utilised_berth.occupied_hours} hrs occupied (${kpis.least_utilised_berth.utilisation_pct}%)` : 'No operational records'}
                </div>
              </div>
              {kpis?.least_utilised_berth && (
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                  {kpis.least_utilised_berth.utilisation_pct}%
                </div>
              )}
            </div>
          </div>

          {/* Visual Analytics Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Berth Utilisation by Berth */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-sky-500" />
                    Berth Utilisation by Berth (%)
                  </h3>
                  <p className="text-[11px] text-slate-400">Percentage of operational period berth was occupied</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {breakdown.map((item) => (
                  <div key={item.berth_id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        {item.berth_name}
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {item.berth_type_display || item.berth_type}
                        </span>
                      </span>
                      <span className="font-black text-sky-600 dark:text-sky-400">
                        {item.utilisation_pct}% ({item.occupied_hours} hrs)
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(2, item.utilisation_pct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Daily Vessel Movements */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    Daily Vessel Movements Timeline
                  </h3>
                  <p className="text-[11px] text-slate-400">Number of vessel arrivals & departures per day</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {dailyMovements.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">No movement logs in selected timeframe</div>
                ) : (
                  dailyMovements.map((day, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700 dark:text-slate-300">{day.date}</span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          <span className="text-emerald-600 dark:text-emerald-400">{day.arrivals} Arrivals</span> •{' '}
                          <span className="text-indigo-600 dark:text-indigo-400">{day.departures} Departures</span>
                        </span>
                      </div>
                      <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                        {day.arrivals > 0 && (
                          <div
                            className="h-full bg-emerald-500 rounded-l-full"
                            style={{ width: `${(day.arrivals / maxMovementsDaily) * 100}%` }}
                            title={`${day.arrivals} Arrivals`}
                          />
                        )}
                        {day.departures > 0 && (
                          <div
                            className="h-full bg-indigo-500 rounded-r-full"
                            style={{ width: `${(day.departures / maxMovementsDaily) * 100}%` }}
                            title={`${day.departures} Departures`}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Detailed Berth Breakdown Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-500" />
                  Detailed Berth Operational Metrics
                </h3>
                <p className="text-[11px] text-slate-400">Calculated from actual arrival, at-berth, and departure timestamps</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-bold">
                    <th className="py-3 px-3">Berth</th>
                    <th className="py-3 px-3">Berth Type</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Occupied Hours</th>
                    <th className="py-3 px-3">Utilisation %</th>
                    <th className="py-3 px-3">Avg Stay Duration</th>
                    <th className="py-3 px-3 text-right">Vessel Movements</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {breakdown.map((item) => (
                    <tr key={item.berth_id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-black text-slate-900 dark:text-white">{item.berth_name}</td>
                      <td className="py-3 px-3 font-semibold text-slate-600 dark:text-slate-300">
                        {item.berth_type_display || item.berth_type}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.berth_status === 'AVAILABLE' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          item.berth_status === 'RESERVED' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                          item.berth_status === 'OCCUPIED' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' :
                          'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                        }`}>
                          {item.berth_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold">{item.occupied_hours} hrs</td>
                      <td className="py-3 px-3 font-black text-sky-600 dark:text-sky-400">{item.utilisation_pct}%</td>
                      <td className="py-3 px-3 font-medium">{item.avg_stay_hours} hrs</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">{item.movements_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
