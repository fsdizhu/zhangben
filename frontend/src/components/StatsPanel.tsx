import { useState, useEffect } from 'react';
import { getStats, getStatsByPerson, getPersons } from '../api';
import { Statistics, StatisticsByPerson } from '../types';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, Users, CheckSquare, Square } from 'lucide-react';

export default function StatsPanel() {
  const [stats, setStats] = useState<Statistics | null>(null);
  const [statsByPerson, setStatsByPerson] = useState<StatisticsByPerson | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showPersonFilter, setShowPersonFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [allPersons, setAllPersons] = useState<string[]>([]);
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);

  const isValidDate = (date: string) => /^\d{8}$/.test(date);

  const loadStats = async () => {
    setLoading(true);
    try {
      // 判断是否使用日期筛选：只有当开始日期和结束日期都有效时才使用
      const useDateFilter = isValidDate(startDate) && isValidDate(endDate);
      // 判断是否使用人员筛选：只要选中了人员就使用
      const usePersonFilter = selectedPersons.length > 0;

      const sDate = useDateFilter ? startDate : undefined;
      const eDate = useDateFilter ? endDate : undefined;
      const persons = usePersonFilter ? selectedPersons : undefined;

      const [statsResult, personStatsResult, personsResult] = await Promise.all([
        getStats(sDate, eDate, persons),
        getStatsByPerson(sDate, eDate, persons),
        getPersons(),
      ]);

      if (statsResult.success && statsResult.stats) {
        setStats(statsResult.stats);
      }
      if (personStatsResult.success && personStatsResult.stats) {
        setStatsByPerson(personStatsResult.stats);
      }
      if (personsResult.success && personsResult.persons) {
        setAllPersons(personsResult.persons);
      }
    } catch {
      console.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 初始加载和人员选择变化时刷新
    loadStats();
  }, []); // 移除对日期的依赖

  const togglePerson = (person: string) => {
    if (selectedPersons.includes(person)) {
      setSelectedPersons(selectedPersons.filter(p => p !== person));
    } else {
      setSelectedPersons([...selectedPersons, person]);
    }
  };

  const toggleAllPersons = () => {
    if (selectedPersons.length === allPersons.length) {
      setSelectedPersons([]);
    } else {
      setSelectedPersons([...allPersons]);
    }
  };

  const formatMoney = (amount: number) => {
    return `¥${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">统计信息</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              showDateFilter ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            日期筛选
          </button>
          <button
            onClick={() => setShowPersonFilter(!showPersonFilter)}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
              showPersonFilter ? 'bg-purple-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            人员筛选
          </button>
        </div>
      </div>

      {showDateFilter && (
        <div className="mb-6 flex gap-4 flex-wrap">
          <input
            type="text"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="开始日期 (YYYYMMDD)"
          />
          <span className="flex items-center text-gray-500">至</span>
          <input
            type="text"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            placeholder="结束日期 (YYYYMMDD)"
          />
          <button
            onClick={loadStats}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            查询
          </button>
          <button
            onClick={() => { setStartDate(''); setEndDate(''); loadStats(); }}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            清除筛选
          </button>
        </div>
      )}

      {showPersonFilter && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-800">选择人员</h4>
            <div className="flex gap-2">
              <button
                onClick={toggleAllPersons}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {selectedPersons.length === allPersons.length ? '取消全选' : '全选'}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {allPersons.map(person => (
              <button
                key={person}
                onClick={() => togglePerson(person)}
                className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition ${
                  selectedPersons.includes(person)
                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {selectedPersons.includes(person) ? (
                  <CheckSquare className="w-4 h-4" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
                {person}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {selectedPersons.length > 0 && (
              <span className="text-sm text-gray-500">已选择 {selectedPersons.length} 人</span>
            )}
            <button
              onClick={() => setSelectedPersons([])}
              className="text-sm text-red-600 hover:text-red-800"
            >
              清除选择
            </button>
            <button
              onClick={loadStats}
              className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
            >
              查询
            </button>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总记录数</p>
                <p className="text-2xl font-bold text-gray-800">{stats.total_entries}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总借出</p>
                <p className="text-2xl font-bold text-red-600">{formatMoney(stats.total_lend)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">总收回</p>
                <p className="text-2xl font-bold text-green-600">{formatMoney(stats.total_receive)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                stats.balance >= 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <DollarSign className={`w-5 h-5 ${
                  stats.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`} />
              </div>
              <div>
                <p className="text-sm text-gray-500">结余</p>
                <p className={`text-2xl font-bold ${
                  stats.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stats.balance >= 0 ? '+' : ''}{formatMoney(stats.balance)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {statsByPerson && Object.keys(statsByPerson).length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">按人统计</h3>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">人物</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">借出</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">收回</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">结余</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Object.entries(statsByPerson).map(([person, data]) => {
                  const balance = data['收回'] - data['借出'];
                  return (
                    <tr key={person} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{person}</td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right">
                        {formatMoney(data['借出'])}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600 text-right">
                        {formatMoney(data['收回'])}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-medium ${
                        balance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {balance >= 0 ? '+' : ''}{formatMoney(balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!statsByPerson || Object.keys(statsByPerson).length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          暂无数据
        </div>
      ) : null}
    </div>
  );
}